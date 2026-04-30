import {
    Injectable,
    Logger,
    BadRequestException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Notification } from './entities/notification.entity';
import { FcmToken } from './entities/fcm-token.entity';
import { Employee } from '../employees/employee.entity';
import { User } from '../users/user.entity';
import { Client } from '../clients/client.entity';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { NotificationsGateway } from './notifications.gateway';
import { getEmailLayout } from './email-templates/email-layout.template';
import { getSpecializedContent } from './email-templates/email-content.template';

export interface SendNotificationDto {
    title: string;
    message: string;
    type: 'email' | 'push' | 'both' | 'realtime';
    recipientFilter: 'all' | 'country' | 'employees' | 'custom' | 'clients' | 'admin';
    recipientIds?: string[];
    recipientEmails?: string[];
    recipientClientIds?: string[];
    recipientCountry?: string;
    companyId: string;
    sentById?: string;
    metadata?: any;
    attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

@Injectable()
export class NotificationsService implements OnModuleInit {
    private readonly logger = new Logger(NotificationsService.name);
    private firestore: admin.firestore.Firestore;

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(FcmToken)
        private readonly fcmTokenRepo: Repository<FcmToken>,
        @InjectRepository(Employee)
        private readonly employeeRepo: Repository<Employee>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Client)
        private readonly clientRepo: Repository<Client>,
        private readonly mailerService: MailerService,
        private readonly configService: ConfigService,
        private readonly gateway: NotificationsGateway,
    ) { }

    onModuleInit() {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        try {
            if (!admin.apps.length) {
                admin.initializeApp({
                    projectId: this.configService.get('FIREBASE_PROJECT_ID'),
                });
                this.logger.log('Firebase Admin initialized successfully');
            }
            this.firestore = admin.firestore();
        } catch (error) {
            this.logger.error('Failed to initialize Firebase Admin:', error.message);
        }
    }

    // ─── FCM Token Management ────────────────────────────────────────────────────

    async saveFcmToken(userId: string, token: string, platform = 'web', deviceId?: string) {
        const existing = await this.fcmTokenRepo.findOne({ where: { userId, platform } });
        if (existing) {
            existing.token = token;
            existing.deviceId = (deviceId ?? undefined) as any;
            return this.fcmTokenRepo.save(existing);
        }
        const entry = this.fcmTokenRepo.create({ userId, token, platform, deviceId });
        return this.fcmTokenRepo.save(entry);
    }

    async removeFcmToken(userId: string, token: string) {
        await this.fcmTokenRepo.delete({ userId, token });
    }

    async getUserFcmTokens(userId: string): Promise<FcmToken[]> {
        return this.fcmTokenRepo.find({ where: { userId } });
    }

    // ─── Send Notification to Firestore (Real-time) ─────────────────────────────

    private async sendToFirestore(userIds: string[], title: string, message: string, metadata: any = {}) {
        if (!this.firestore) {
            this.logger.warn('Firestore not initialized, skipping real-time sync.');
            return;
        }

        const batch = this.firestore.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        userIds.forEach(userId => {
            if (!userId) return;
            const docRef = this.firestore.collection('notifications').doc();
            batch.set(docRef, {
                userId,
                title,
                message,
                read: false,
                timestamp,
                type: metadata?.type || 'system',
                priority: metadata?.priority || 'medium',
                ...metadata
            });
        });

        try {
            await batch.commit();
            this.logger.log(`[FirestoreSync] Successfully committed batch for ${userIds.length} users. Collection: 'notifications'`);
            this.logger.debug(`[FirestoreSync] Targeted User IDs: ${userIds.join(', ')}`);
        } catch (error) {
            this.logger.error(`[FirestoreSync] CRITICAL: Failed to commit Firestore batch: ${error.message}`);
        }
    }

    // ─── Email Templates ─────────────────────────────────────────────────────────

    private getEmailTemplate(type: string, title: string, message: string, metadata: any = {}): string {
        const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
        const content = getSpecializedContent(type, title, message, metadata, appUrl);
        return getEmailLayout(title, content);
    }


    private async resolveRecipients(dto: SendNotificationDto): Promise<{ emails: string[]; userIds: string[] }> {
        const emails: string[] = [...(dto.recipientEmails || [])];
        const userIds: string[] = [];

        if (dto.recipientFilter === 'all') {
            const employees = await this.employeeRepo.find({
                where: { companyId: dto.companyId, status: 'active' },
                relations: ['user'],
            });
            for (const emp of employees) {
                if (emp.user?.email) emails.push(emp.user.email);
                if (emp.userId) userIds.push(emp.userId);
            }
            const clients = await this.clientRepo.find({
                where: { companyId: dto.companyId },
            });
            for (const client of clients) {
                if (client.email) emails.push(client.email);
            }
        } else if (dto.recipientFilter === 'country') {
            const employees = await this.employeeRepo.find({
                where: { companyId: dto.companyId, status: 'active' },
                relations: ['user'],
            });
            const countryLower = (dto.recipientCountry || '').toLowerCase();
            for (const emp of employees) {
                const match = (emp.branch || '').toLowerCase().includes(countryLower) ||
                    (emp.address || '').toLowerCase().includes(countryLower);
                if (match) {
                    if (emp.user?.email) emails.push(emp.user.email);
                    if (emp.userId) userIds.push(emp.userId);
                }
            }
        } else if (dto.recipientFilter === 'admin') {
            const admins = await this.userRepo.createQueryBuilder('user')
                .leftJoinAndSelect('user.roles', 'role')
                .where('user.companyId = :companyId', { companyId: dto.companyId })
                .andWhere('LOWER(role.name) IN (:...roleNames)', { roleNames: ['admin', 'super admin', 'superadmin'] })
                .getMany();

            this.logger.log(`Found ${admins.length} admins to notify for company ${dto.companyId}`);
            for (const admin of admins) {
                if (admin.email) emails.push(admin.email);
                userIds.push(admin.id);
            }
        } else if (dto.recipientFilter === 'employees') {
            const employees = dto.recipientIds?.length
                ? await this.employeeRepo.find({
                    where: [
                        { id: In(dto.recipientIds), companyId: dto.companyId, status: 'active' as any },
                        { userId: In(dto.recipientIds), companyId: dto.companyId, status: 'active' as any },
                    ],
                    relations: ['user'],
                })
                : await this.employeeRepo.find({
                    where: { companyId: dto.companyId, status: 'active' },
                    relations: ['user'],
                });
            for (const emp of employees) {
                if (emp.user?.email) emails.push(emp.user.email);
                if (emp.userId) userIds.push(emp.userId);
            }
        } else if (dto.recipientFilter === 'clients') {
            const clientIds = dto.recipientClientIds?.length ? dto.recipientClientIds : dto.recipientIds;
            const clients = clientIds?.length
                ? await this.clientRepo.find({
                    where: { id: In(clientIds), companyId: dto.companyId },
                })
                : await this.clientRepo.find({
                    where: { companyId: dto.companyId },
                });
            for (const client of clients) {
                if (client.email) emails.push(client.email);
            }
        } else if (dto.recipientIds?.length) {
            this.logger.debug(`Resolving recipients by explicit IDs: ${dto.recipientIds.join(', ')}`);
            userIds.push(...dto.recipientIds);
            const users = await this.userRepo.find({ where: { id: In(dto.recipientIds) } });
            emails.push(...users.map(u => u.email).filter(Boolean));
        }

        const uniqueEmails = [...new Set(emails)].filter(Boolean);
        const uniqueUserIds = [...new Set(userIds)].filter(id => id && id.trim() !== '');
        this.logger.log(`Resolved recipients: ${uniqueUserIds.length} users, ${uniqueEmails.length} emails`);
        return { emails: uniqueEmails, userIds: uniqueUserIds };
    }

    // ─── Send Email ──────────────────────────────────────────────────────────────

    private async sendEmails(emails: string[], title: string, message: string, metadata: any = {}): Promise<{ success: number; failure: number }> {
        let success = 0;
        let failure = 0;

        for (const email of emails) {
            try {
                const htmlContent = this.getEmailTemplate(metadata.type, title, message, metadata);
                const finalSubject = title.includes('Difmo') ? title : `Difmo Pvt Ltd - ${title}`;
                this.logger.log(`[Email] Sending template '${metadata.type}' to ${email} with subject: ${finalSubject}`);
                await this.mailerService.sendMail({
                    to: email,
                    subject: finalSubject,
                    html: htmlContent,
                    attachments: metadata.attachments || [],
                });
                success++;
            } catch (err) {
                this.logger.error(`[Email] Failed to send to ${email}: ${err?.message || err}`);
                this.logger.debug(err);
                failure++;
            }
        }
        return { success, failure };
    }

    // ─── Unified Send Method (Firestore + Email + Socket) ────────────────────────
    async send(dto: SendNotificationDto): Promise<Notification> {
        this.logger.log(`NotificationsService.send called with type: ${dto.type}, recipients count: ${dto.recipientIds?.length || 0}`);
        const { emails, userIds } = await this.resolveRecipients(dto);
        this.logger.log(`Resolved: ${emails.length} emails, ${userIds.length} userIds`);

        if (!emails.length && !userIds.length) {
            this.logger.warn(`No recipients found for filter: ${dto.recipientFilter}`);
            throw new BadRequestException('No recipients found for the selected filter.');
        }

        // 1. Save to SQL Database (History)
        const notification = this.notificationRepo.create({
            title: dto.title,
            message: dto.message,
            type: dto.type,
            recipientFilter: dto.recipientFilter,
            recipientIds: userIds,
            recipientEmails: emails,
            metadata: dto.metadata,
            companyId: dto.companyId,
            sentById: dto.sentById,
            status: 'sent',
        });
        await this.notificationRepo.save(notification);

        // 2. Real-time Firestore Sync (Powers the dynamic 
        await this.sendToFirestore(userIds, dto.title, dto.message, dto.metadata);

        // 3. Nodemailer Email Alerts
        if (dto.type === 'email' || dto.type === 'both') {
            this.logger.log(`Attempting to send emails to: ${emails.join(', ')}`);
            try {
                const results = await this.sendEmails(emails, dto.title, dto.message, { ...dto.metadata, attachments: dto.attachments });
                notification.successCount = results.success;
                notification.failureCount = results.failure;
                notification.status = results.failure > 0 && results.success === 0 ? 'failed' : 'sent';
                await this.notificationRepo.save(notification);
                this.logger.log(`Email send results: Success=${results.success}, Failure=${results.failure}`);
            } catch (err) {
                notification.status = 'failed';
                await this.notificationRepo.save(notification);
                throw err;
            }
        }

        // 4. Instant Socket.io Toast (Optional background feedback)
        userIds.forEach(id => {
            this.gateway.sendNotificationToUser(id, {
                title: dto.title,
                message: dto.message,
                ...dto.metadata
            });
        });

        return notification;
    }

    // ─── History ──────────────────────────────────────────────────────────────────

    async getHistory(companyId: string): Promise<Notification[]> {
        return this.notificationRepo.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
            take: 100,
        });
    }

    // ─── Direct User Notifications (SQL Fallback) ─────────────────────────────────
    async getUserNotifications(userId: string): Promise<Notification[]> {

        return this.notificationRepo
            .createQueryBuilder('n')
            .where('n.recipientIds LIKE :userId', { userId: `%${userId}%` })
            .orderBy('n.createdAt', 'DESC')
            .limit(30)
            .getMany();
    }

    async getStats(companyId: string) {
        const notifications = await this.notificationRepo.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
            take: 200,
        });

        return {
            total: notifications.length,
            sent: notifications.filter((item) => item.status === 'sent').length,
            failed: notifications.filter((item) => item.status === 'failed').length,
            emailOnly: notifications.filter((item) => item.type === 'email').length,
            multiChannel: notifications.filter((item) => item.type === 'both').length,
        };
    }

    async getAllEmployees(companyId: string) {
        return this.employeeRepo.find({
            where: { companyId, status: 'active' },
            relations: ['user'],
        });
    }

    // ─── Interaction Logic ──────────────────────────────────────────────────────

    async markAllAsRead(userId: string) {

        if (!this.firestore) return;

        const snapshot = await this.firestore.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .get();

        if (snapshot.empty) return { count: 0 };

        const batch = this.firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();
        this.logger.log(`Marked ${snapshot.size} notifications as read for user ${userId}`);
        return { count: snapshot.size };
    }

    async clearAll(userId: string) {
        // 1. Clear from Firestore (Batch delete)
        if (!this.firestore) return;

        const snapshot = await this.firestore.collection('notifications')
            .where('userId', '==', userId)
            .get();

        if (snapshot.empty) return { count: 0 };

        const batch = this.firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        this.logger.log(`Cleared ${snapshot.size} notifications for user ${userId}`);
        return { count: snapshot.size };
    }
}
