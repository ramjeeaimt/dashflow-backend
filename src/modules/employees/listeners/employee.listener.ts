import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../companies/company.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class EmployeeListener {
  private readonly logger = new Logger(EmployeeListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private async getAdminEmails(companyId: string): Promise<string[]> {
    const adminEmails: string[] = [];
    try {
      const company = await this.companyRepository.findOne({ where: { id: companyId } });
      if (!company) return [];

      if (company.email) {
        adminEmails.push(company.email.trim());
      }

      if (company.attendanceAlertEmails) {
        const configuredEmails = company.attendanceAlertEmails
          .split(',')
          .map(email => email.trim())
          .filter(Boolean);
        adminEmails.push(...configuredEmails);
      }
    } catch (err) {
      this.logger.error(`[EmployeeListener] Failed to resolve admin emails: ${err.message}`);
    }
    return [...new Set(adminEmails)].filter(email => !!email);
  }

  @OnEvent('employee.created', { async: true })
  async handleEmployeeCreatedEvent(payload: {
    employeeId: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    companyName: string;
    password?: string;
  }) {
    this.logger.log(`[EmployeeListener] Handling employee.created event for ${payload.email}`);
    try {
      // 1. Notify Employee
      await this.notificationsService.send({
        title: 'Welcome to the Team!',
        message: `Hello ${payload.firstName}, congratulations! You have been successfully added as an employee to ${payload.companyName}. We are excited to have you on board.`,
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: [payload.userId],
        recipientEmails: [payload.email], // Explicity provide email to guarantee delivery
        companyId: payload.companyId,
        metadata: {
          type: 'WELCOME',
          employeeId: payload.employeeId,
          email: payload.email,
          companyName: payload.companyName,
          password: payload.password || 'welcome123',
        },
      });

      // 2. Notify Admins
      const adminEmails = await this.getAdminEmails(payload.companyId);
      for (const email of adminEmails) {
        await this.mailService.sendAdminEmployeeCreatedEmail(email, {
          employeeName: `${payload.firstName} ${payload.lastName}`.trim(),
          employeeEmail: payload.email,
          companyName: payload.companyName,
        });
      }

      await this.notificationsService.send({
        title: 'New Employee Added',
        message: `${payload.firstName} ${payload.lastName} has been added to the system.`,
        type: 'push',
        recipientFilter: 'admin',
        companyId: payload.companyId,
        metadata: { type: 'employee_created', severity: 'success' },
      });

    } catch (err) {
      this.logger.error(`[EmployeeListener] Failed to send welcome notification for ${payload.email}: ${err.message}`);
    }
  }

  @OnEvent('employee.roles.updated', { async: true })
  async handleEmployeeRolesUpdatedEvent(payload: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    roles: string[];
  }) {
    this.logger.log(`[EmployeeListener] Handling employee.roles.updated event for ${payload.email}`);
    try {
      const employeeName = `${payload.firstName || ''} ${payload.lastName || ''}`.trim();

      // 1. Notify Employee
      await this.mailService.sendRoleAssignmentNotification(payload.email, {
        employeeName,
        roles: payload.roles,
      });

      await this.notificationsService.send({
        title: 'Role Updated',
        message: `Your account roles have been updated to: ${payload.roles.join(', ')}.`,
        type: 'push',
        recipientFilter: 'custom',
        recipientIds: [payload.userId],
        companyId: payload.companyId,
        metadata: { type: 'role_update', severity: 'info' },
      });

      // 2. Notify Admins
      const adminEmails = await this.getAdminEmails(payload.companyId);
      for (const email of adminEmails) {
        await this.mailService.sendAdminEmployeeUpdatedEmail(email, {
          employeeName,
          employeeEmail: payload.email,
          roles: payload.roles.join(', '),
        });
      }

      await this.notificationsService.send({
        title: 'Employee Roles Updated',
        message: `${employeeName}'s roles have been updated to: ${payload.roles.join(', ')}.`,
        type: 'push',
        recipientFilter: 'admin',
        companyId: payload.companyId,
        metadata: { type: 'role_update', severity: 'info' },
      });

    } catch (err) {
      this.logger.error(`[EmployeeListener] Failed to send role update notification for ${payload.email}: ${err.message}`);
    }
  }
}
