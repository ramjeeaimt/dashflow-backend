import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Notification } from './entities/notification.entity';
import { FcmToken } from './entities/fcm-token.entity';
import { Employee } from '../employees/employee.entity';
import { User } from '../users/user.entity';
import { ConfigService } from '@nestjs/config';

export interface SendNotificationDto {
    title: string;
    message: string;
    type: 'email' | 'push' | 'both';
    recipientFilter: 'all' | 'country' | 'employees' | 'custom' | 'clients';
    recipientIds?: string[];
    recipientEmails?: string[];
    recipientCountry?: string;
    companyId: string;
    sentById: string;
}

import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

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

    // ─── FCM Token Management ────────────────────────────────────────────────────

    async saveFcmToken(userId: string, token: string, platform = 'web', deviceId?: string) {
        // Upsert: if token already exists for user, update it
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

    // ─── Recipient Resolution ────────────────────────────────────────────────────

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
            // Filter by country stored on user or branch field
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
        } else if (dto.recipientFilter === 'employees') {
            if (dto.recipientIds?.length) {
                const employees = await this.employeeRepo.find({
                    where: { id: In(dto.recipientIds) },
                    relations: ['user'],
                });
                for (const emp of employees) {
                    if (emp.user?.email) emails.push(emp.user.email);
                    if (emp.userId) userIds.push(emp.userId);
                }
            }
        } else if (dto.recipientFilter === 'custom' || dto.recipientFilter === 'clients') {
            // Custom: direct email addresses
            if (dto.recipientEmails?.length) {
                emails.push(...dto.recipientEmails);
            }
        }

        return { emails: [...new Set(emails)], userIds: [...new Set(userIds)] };
    }

    // ─── Send Email ──────────────────────────────────────────────────────────────

    private async sendEmails(emails: string[], title: string, message: string): Promise<{ success: number; failure: number }> {
        let success = 0;
        let failure = 0;

        for (const email of emails) {
            try {
                await this.mailerService.sendMail({
                    to: email,
                    subject: title,
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">${title}</h1>
              </div>
              <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0;">${message.replace(/\n/g, '<br/>')}</p>
              </div>
              <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">Sent via CRM Notification System</p>
            </div>
          `,
                });
                success++;
            } catch (err) {
                this.logger.error(`Failed to send email to ${email}: ${err.message}`);
                failure++;
            }
        }
        return { success, failure };
    }

    // ─── Send FCM Push Notification ──────────────────────────────────────────────

    private async sendPushNotifications(userIds: string[], title: string, message: string): Promise<{ success: number; failure: number }> {
        const fcmServerKey = this.configService.get('FCM_SERVER_KEY');
        if (!fcmServerKey) {
            this.logger.warn('FCM_SERVER_KEY not set. Skipping push notifications.');
            return { success: 0, failure: 0 };
        }

        const tokens = await this.fcmTokenRepo.find({
            where: { userId: In(userIds) },
        });

        if (!tokens.length) return { success: 0, failure: 0 };

        let success = 0;
        let failure = 0;

        // Send via FCM HTTP v1 API
        for (const tokenRecord of tokens) {
            try {
                const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `key=${fcmServerKey}`,
                    },
                    body: JSON.stringify({
                        to: tokenRecord.token,
                        notification: { title, body: message },
                        data: { title, message, timestamp: new Date().toISOString() },
                    }),
                });

                const result = await response.json() as any;
                if (result.success === 1) {
                    success++;
                } else {
                    failure++;
                    // If token is invalid, remove it
                    if (result.results?.[0]?.error === 'InvalidRegistration' ||
                        result.results?.[0]?.error === 'NotRegistered') {
                        await this.fcmTokenRepo.delete(tokenRecord.id);
                    }
                }
            } catch (err) {
                this.logger.error(`FCM send failed: ${err.message}`);
                failure++;
            }
        }

        return { success, failure };
    }

    // ─── Main Send Method ─────────────────────────────────────────────────────────

    async send(dto: SendNotificationDto): Promise<Notification> {
        const { emails, userIds } = await this.resolveRecipients(dto);

        if (!emails.length && !userIds.length) {
            throw new BadRequestException('No recipients found for the selected filter.');
        }

        const notification = this.notificationRepo.create({
            title: dto.title,
            message: dto.message,
            type: dto.type,
            recipientFilter: dto.recipientFilter,
            recipientIds: userIds,
            recipientEmails: emails,
            recipientCountry: dto.recipientCountry,
            companyId: dto.companyId,
            sentById: dto.sentById,
            status: 'pending',
        });
        await this.notificationRepo.save(notification);

        let emailResult = { success: 0, failure: 0 };
        let pushResult = { success: 0, failure: 0 };

        if (dto.type === 'email' || dto.type === 'both') {
            emailResult = await this.sendEmails(emails, dto.title, dto.message);
        }
        if (dto.type === 'push' || dto.type === 'both') {
            pushResult = await this.sendPushNotifications(userIds, dto.title, dto.message);
        }

        notification.successCount = emailResult.success + pushResult.success;
        notification.failureCount = emailResult.failure + pushResult.failure;
        notification.status = notification.failureCount === 0 ? 'sent' : 'partial';
        if (notification.successCount === 0) notification.status = 'failed';

        return this.notificationRepo.save(notification);
    }

    // ─── History ──────────────────────────────────────────────────────────────────

    async getHistory(companyId: string): Promise<Notification[]> {
        return this.notificationRepo.find({
            where: { companyId },
            relations: ['sentBy'],
            order: { createdAt: 'DESC' },
        });
    }

    async getStats(companyId: string) {
        const total = await this.notificationRepo.count({ where: { companyId } });
        const sent = await this.notificationRepo.count({ where: { companyId, status: 'sent' } });
        const failed = await this.notificationRepo.count({ where: { companyId, status: 'failed' } });
        return { total, sent, failed };
    }

    async getAllEmployees(companyId: string) {
        return this.employeeRepo.find({
            where: { companyId, status: 'active' },
            relations: ['user'],
        });
    }
}
