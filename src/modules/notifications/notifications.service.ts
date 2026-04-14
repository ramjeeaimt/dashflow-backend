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
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { NotificationsGateway } from './notifications.gateway';

export interface SendNotificationDto {
    title: string;
    message: string;
    type: 'email' | 'push' | 'both' | 'realtime';
    recipientFilter: 'all' | 'country' | 'employees' | 'custom' | 'clients' | 'admin';
    recipientIds?: string[];
    recipientEmails?: string[];
    recipientCountry?: string;
    companyId: string;
    sentById?: string;
    metadata?: any;
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
        const logoUrl = 'https://via.placeholder.com/150?text=Difmo+CRM'; 
        const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
        const baseStyle = `
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
        `;
        const headerStyle = `
            background-color: #4f46e5;
            color: white;
            padding: 20px;
            text-align: center;
        `;
        const bodyStyle = `padding: 30px; background-color: #ffffff;`;
        const footerStyle = `
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        `;

        let content = `<p>${message}</p>`;

        if (type === 'LEAVE_STATUS') {
            const statusColor = metadata.status === 'APPROVED' ? '#10b981' : '#ef4444';
            content = `
                <div style="border-left: 4px solid ${statusColor}; padding-left: 15px; margin: 20px 0;">
                    <h3 style="color: ${statusColor}; margin-top: 0;">Leave ${metadata.status}</h3>
                    <p>${message}</p>
                    ${metadata.comment ? `<p><strong>Admin Note:</strong> ${metadata.comment}</p>` : ''}
                </div>
                <div style="margin-top: 20px;">
                    <a href="${appUrl}/employee/leaves" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Leave History</a>
                </div>
            `;
        } else if (type === 'PAYROLL_GENERATED') {
            content = `
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #111827;">Payslip Available: ${metadata.month}/${metadata.year}</h3>
                    <p style="font-size: 24px; font-weight: bold; color: #4f46e5; margin: 10px 0;">₹${metadata.netSalary?.toFixed(2)}</p>
                    <p style="margin-bottom: 0;">Your payroll for the month of ${metadata.month} has been successfully processed.</p>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <a href="${appUrl}/employee/payroll" style="background-color: #10b981; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Download Payslip</a>
                </div>
            `;
        } else if (type === 'TASK_ASSIGNED') {
            content = `
                <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <span style="background-color: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${metadata.priority || 'NORMAL'}</span>
                    <h3 style="margin: 10px 0; color: #111827;">${title}</h3>
                    <p style="color: #4b5563;">${message}</p>
                </div>
                <div style="margin-top: 20px;">
                    <a href="${appUrl}/task-management" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Task Details</a>
                </div>
            `;
        } else if (type === 'PROJECT_ASSIGNED') {
            content = `
                <div style="border: 1px solid #4f46e5; padding: 20px; border-radius: 8px; margin: 20px 0; background-color: #f5f3ff;">
                    <h3 style="margin: 0; color: #4f46e5;">New Project: ${metadata.projectName || title}</h3>
                    <p style="color: #4b5563; margin-top: 10px;">${message}</p>
                    ${metadata.deadline ? `<p style="font-size: 13px; color: #6b7280;"><strong>Deadline:</strong> ${metadata.deadline}</p>` : ''}
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <a href="${appUrl}/projects" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View My Projects</a>
                </div>
            `;
        }

        return `
            <div style="${baseStyle}">
                <div style="${headerStyle}">
                    <img src="${logoUrl}" alt="Difmo CRM" style="height: 40px; margin-bottom: 10px;">
                    <h1 style="margin: 0; font-size: 20px;">Difmo CRM Notifications</h1>
                </div>
                <div style="${bodyStyle}">
                    ${content}
                </div>
                <div style="${footerStyle}">
                    <p>&copy; ${new Date().getFullYear()} Difmo Project CRM. All rights reserved.</p>
                    <p>You received this email because it's linked to your account at Difmo CRM.</p>
                </div>
            </div>
        `;
    }

    private async resolveRecipients(dto: SendNotificationDto): Promise<{ emails: string[]; userIds: string[] }> {
        const emails: string[] = [];
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
        } else if (dto.recipientIds?.length) {
            this.logger.debug(`Resolving recipients by explicit IDs: ${dto.recipientIds.join(', ')}`);
            userIds.push(...dto.recipientIds);
            const users = await this.userRepo.find({ where: { id: In(dto.recipientIds) } });
            emails.push(...users.map(u => u.email).filter(Boolean));
        }

        const uniqueEmails = [...new Set(emails)];
        const uniqueUserIds = [...new Set(userIds)];
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
                await this.mailerService.sendMail({
                    to: email,
                    subject: title,
                    html: htmlContent,
                });
                success++;
            } catch (err) {
                this.logger.error(`Failed to send email to ${email}: ${err?.message || err}`);
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
            companyId: dto.companyId,
            sentById: dto.sentById,
            status: 'sent',
        });
        await this.notificationRepo.save(notification);

        // 2. Real-time Firestore Sync (Powers the dynamic dashboard)
        await this.sendToFirestore(userIds, dto.title, dto.message, dto.metadata);

        // 3. Nodemailer Email Alerts
        if (dto.type === 'email' || dto.type === 'both') {
            this.logger.log(`Attempting to send emails to: ${emails.join(', ')}`);
            try {
                const results = await this.sendEmails(emails, dto.title, dto.message, dto.metadata);
                this.logger.log(`Email send results: Success=${results.success}, Failure=${results.failure}`);
            } catch (err) {
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
        // Querying simple-array using LIKE to bypass complex JSON/Array Postgres specific paths
        return this.notificationRepo
            .createQueryBuilder('n')
            .where('n.recipientIds LIKE :userId', { userId: `%${userId}%` })
            .orderBy('n.createdAt', 'DESC')
            .limit(30)
            .getMany();
    }

    async getStats(companyId: string) {
        const total = await this.notificationRepo.count({ where: { companyId } });
        return { total };
    }

    async getAllEmployees(companyId: string) {
        return this.employeeRepo.find({
            where: { companyId, status: 'active' },
            relations: ['user'],
        });
    }

    // ─── Interaction Logic ──────────────────────────────────────────────────────

    async markAllAsRead(userId: string) {
        // 1. Update SQL Database
        // Note: For simplicity, we are updating the recipientIds JSON array matching logic
        // In a real high-scale app, you'd have a join table for read status.
        // For this MVP, we focus on the real-time Firestore sync which is what users see.
        
        // 2. Update Firestore (Batch update)
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
