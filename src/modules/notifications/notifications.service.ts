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
        const content = this.getSpecializedContent(type, title, message, metadata);
        return this.getEmailLayout(title, content);
    }
    private getEmailLayout(title: string, content: string): string {
        const year = new Date().getFullYear();
        const bannerUrl = 'https://res.cloudinary.com/dxju8ikk4/image/upload/v1777468072/difmo_banner_final.png';

        const contactRow = (letter: string, children: string) => `
        <tr>
            <td width="32" valign="top" style="padding-bottom: 14px;">
                <div style="width: 24px; height: 24px; background: #000; border-radius: 50%; text-align: center; line-height: 24px;">
                    <span style="color: #fff; font-size: 11px; font-weight: 800;">${letter}</span>
                </div>
            </td>
            <td style="padding-bottom: 14px; font-size: 14px; font-weight: 600; color: #000; line-height: 1.5;">${children}</td>
        </tr>`;

        const socialIcon = (href: string, src: string) =>
            `<a href="${href}" style="display: inline-block; margin-right: 14px;">
            <img src="${src}" width="22" style="opacity: 0.75; vertical-align: middle;">
        </a>`;

        return `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff; color: #1e293b; margin: 0; padding: 0;">
            <div style="max-width: 700px; margin: 0;">

                <!-- Header Branding -->
        
                <!-- Body -->
                <div style="font-size: 16px; line-height: 1.6; color: #334155;">
                    ${content}
                </div>

                <!-- Signature -->
                <div style="margin-top: 48px; padding-top: 28px; border-top: 1px solid #f1f5f9;">
                    <img src="https://res.cloudinary.com/dxju8ikk4/image/upload/v1777469595/difmo_vector_icon.png"
                         width="100" height="100"
                         style="border-radius: 50%; object-fit: cover; display: block; margin-bottom: 20px;">

                    <div style="border-top: 1px solid #1e293b; padding-top: 22px; max-width: 650px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <!-- Left: Identity -->
                                <td width="55%" valign="top">
                                    <p style="margin: 0 0 2px; font-size: 20px; font-weight: 800; color: #000; letter-spacing: -0.4px;">Team DIFMO</p>
                                    <p style="margin: 0 0 1px; font-size: 15px; color: #1e293b; font-weight: 500;">Corporate Support</p>
                                    <p style="margin: 0 0 12px; font-size: 14px; color: #475569; font-style: italic;">Communications & Experience</p>
                                    <p style="margin: 0 0 14px; font-size: 15px; font-weight: 800; color: #000;">DIFMO Technologies Pvt Ltd</p>
                                    <a href="https://www.difmo.com/contact" style="color: #d03f13ff; font-size: 14px; font-weight: 700; text-decoration: none;">
                                        Let's meet
                                    </a>
                                </td>

                                <!-- Right: Contact -->
                                <td width="45%" valign="top">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                        ${contactRow('E', '<a href="mailto:info@difmo.com" style="color: #000; text-decoration: none;">info@difmo.com</a>')}
                                        ${contactRow('A', '4/37 Vibhav Khand, Gomtinagr Lucknow, Uttar Pradesh 226016, India')}
                                        ${contactRow('W', '<a href="https://www.difmo.com" style="color: #d03f13ff; text-decoration: none;">difmo.com</a>')}
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div style="border-top: 1px solid #1e293b; margin-top: 22px; max-width: 650px;"></div>
                </div>

                <!-- Banner -->
                <div style="margin-top: 36px; border-radius: 10px; overflow: hidden; line-height: 0;">
                    <img src="${bannerUrl}" alt="Our Services" style="width: 100%; height: auto; display: block;">
                </div>

                <!-- Social Links -->
                <div style="margin-top: 28px;">
                    ${socialIcon('#', 'https://cdn-icons-png.flaticon.com/512/145/145807.png')}
                    ${socialIcon('#', 'https://cdn-icons-png.flaticon.com/512/145/145802.png')}
                    ${socialIcon('#', 'https://cdn-icons-png.flaticon.com/512/145/145812.png')}
                </div>

                <!-- Legal -->
                <div style="margin-top: 36px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                    <p style="margin: 0;">
This email, along with any attachments, documents, project files, source code, designs, business strategies, client information, and other transmitted materials, contains confidential and proprietary information belonging to <b>DIFMO</b>. It is intended solely for the use of the individual, organization, or entity to whom it is addressed.

Any unauthorized access, review, copying, disclosure, distribution, modification, or use of this information is strictly prohibited and may be unlawful.

If you have received this communication in error, please notify us immediately by replying to this email or contacting our support team at <b>info@difmo.com, mailto:info@difmo.com</b>, and permanently delete all copies of this message and its attachments from your system.

Difmo Private Limited is committed to protecting client data, intellectual property, and business confidentiality across all services including AI solutions, web development, mobile applications, cloud services, cybersecurity, and smart technology solutions.

<b>© 2026 Difmo Private Limited. All rights reserved.</b>
</p>
                    <p style="margin: 8px 0 0;">&copy; ${year} DIFMO PRIVATE LIMITED. ALL RIGHTS RESERVED.</p>
                </div>

                <!-- Anti-clipping spacer (Gmail) -->
                <div style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">
                    ${'&nbsp;'.repeat(20)} ${Date.now()} ${Math.random().toString(36).substring(7)}
                </div>

            </div>
        </div>`;
    }



    private getSpecializedContent(type: string, title: string, message: string, metadata: any): string {
        const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';

        switch (type) {
            case 'LEAVE_STATUS':
                const leaveColor = metadata.status === 'APPROVED' ? '#10b981' : '#ef4444';
                return `
                    <div style="border-left: 4px solid ${leaveColor}; padding: 20px; background-color: #f8fafc; margin: 20px 0;">
                        <h3 style="color: ${leaveColor}; margin-top: 0; font-size: 20px;">Leave ${metadata.status}</h3>
                        <p style="color: #334155; font-size: 16px;">${message}</p>
                    </div>
                    <div style="margin-top: 30px;"><a href="${appUrl}/employee/leaves" style="background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View Leave History</a></div>
                `;

            case 'PAYROLL_GENERATED':
            case 'PAYROLL_PAID':
                const isPaid = type === 'PAYROLL_PAID';
                const accentColor = isPaid ? '#059669' : '#0f172a';
                const bgColor = isPaid ? '#ecfdf5' : '#f8fafc';
                const borderColor = isPaid ? '#d1fae5' : '#e2e8f0';
                const empName = metadata.employeeName || 'Valued Employee';

                let breakdownHtml = '';
                if (metadata.basicSalary) {
                    breakdownHtml = `
                        <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="color: #64748b; font-size: 14px; padding: 5px 0;">Basic Salary</td>
                                    <td style="color: #0f172a; font-size: 14px; padding: 5px 0; text-align: right; font-weight: 700;">₹${Number(metadata.basicSalary).toFixed(2)}</td>
                                </tr>
                                ${metadata.allowances ? `
                                <tr>
                                    <td style="color: #64748b; font-size: 14px; padding: 5px 0;">Allowances</td>
                                    <td style="color: #059669; font-size: 14px; padding: 5px 0; text-align: right; font-weight: 700;">+₹${Number(metadata.allowances).toFixed(2)}</td>
                                </tr>` : ''}
                                ${metadata.deductions ? `
                                <tr>
                                    <td style="color: #64748b; font-size: 14px; padding: 5px 0;">Deductions</td>
                                    <td style="color: #ef4444; font-size: 14px; padding: 5px 0; text-align: right; font-weight: 700;">-₹${Number(metadata.deductions).toFixed(2)}</td>
                                </tr>` : ''}
                                <tr>
                                    <td style="color: #0f172a; font-size: 16px; padding: 15px 0 5px 0; font-weight: 800;">Net Salary</td>
                                    <td style="color: ${accentColor}; font-size: 20px; padding: 15px 0 5px 0; text-align: right; font-weight: 900;">₹${Number(metadata.netSalary).toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>
                    `;
                }

                return `
                    <p style="margin-bottom: 25px; font-weight: 700; color: #0f172a;">Dear ${empName},</p>
                    <p style="margin-bottom: 20px; color: #475569;">Good day! Your payroll for <strong>${metadata.month}/${metadata.year}</strong> has been successfully processed.</p>
                    <p style="margin-bottom: 25px; color: #475569;">${isPaid ? 'The funds have been credited to your registered bank account.' : 'You can now review and download your payslip from the employee portal.'}</p>
                    
                    ${breakdownHtml}
                `;

            case 'TASK_ASSIGNED':
                return `
                    <div style="border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; margin: 30px 0; background-color: #f8fafc;">
                        <span style="background-color: #fee2e2; color: #ef4444; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase;">${metadata.priority || 'NORMAL'} PRIORITY</span>
                        <h3 style="margin: 20px 0 10px 0; color: #0f172a; font-size: 24px;">${title}</h3>
                        <p style="color: #475569; font-size: 18px;">${message}</p>
                    </div>
                    <div style="margin-top: 30px;"><a href="${appUrl}/task-management" style="background-color: #0f172a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">View Task Details</a></div>
                `;

            case 'PROJECT_ASSIGNED':
                return `
                    <div style="border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; margin: 30px 0; background-color: #f8fafc;">
                        <h3 style="margin: 0; color: #6366f1; font-size: 14px; text-transform: uppercase;">New Project Assignment</h3>
                        <p style="color: #0f172a; font-size: 28px; font-weight: 800; margin: 15px 0;">${metadata.projectName || title}</p>
                        <p style="color: #475569; font-size: 16px;">${message}</p>
                    </div>
                    <div style="margin-top: 30px; text-align: center;"><a href="${appUrl}/projects" style="background-color: #4338ca; color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 800;">GO TO PROJECT</a></div>
                `;

            default:
                return `<p style="color: #334155; font-size: 18px; line-height: 1.8;">${message}</p>`;
        }
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

        // 2. Real-time Firestore Sync (Powers the dynamic dashboard)
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
