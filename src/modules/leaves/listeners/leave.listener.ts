import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../employees/employee.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class LeaveListener {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private notificationsService: NotificationsService,
    private mailService: MailService,
  ) {}

  private async getAdminEmails(companyId: string, companyEmail?: string, attendanceAlertEmails?: string): Promise<string[]> {
    const adminEmails: string[] = [];

    if (attendanceAlertEmails) {
      const configuredEmails = attendanceAlertEmails
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
      adminEmails.push(...configuredEmails);
    }

    if (companyId) {
      const allEmployees = await this.employeeRepository.find({
        where: { companyId, isDeleted: false },
        relations: ['user', 'user.roles'],
      });
      const companyAdmins = allEmployees
        .filter(emp => emp.user?.email && emp.user?.roles?.some(role => ['admin', 'super admin', 'superadmin', 'manager'].includes(role.name.toLowerCase())))
        .map(emp => emp.user.email);
      adminEmails.push(...companyAdmins);
    }

    if (companyEmail) {
      adminEmails.push(companyEmail);
    }

    return [...new Set(adminEmails)].filter(email => !!email);
  }

  @OnEvent('leave.requested', { async: true })
  async handleLeaveRequested(payload: {
    leaveId: string;
    employeeId: string;
    employeeName: string;
    startDate: string | Date;
    endDate: string | Date;
    reason: string;
    companyId: string;
    companyEmail?: string;
    attendanceAlertEmails?: string;
  }) {
    console.log(`[LeaveListener] Processing leave request notification for ${payload.employeeName}`);

    // Real-time Notification to Admin
    try {
      await this.notificationsService.send({
        title: 'Difmo Pvt Ltd: New Leave Request',
        message: `${payload.employeeName} has applied for leave from ${String(payload.startDate)} to ${String(payload.endDate)}.`,
        type: 'push',
        recipientFilter: 'admin',
        companyId: payload.companyId,
        metadata: {
          type: 'LEAVE_REQUEST',
          employeeName: payload.employeeName,
          startDate: String(payload.startDate),
          endDate: String(payload.endDate),
          leaveId: payload.leaveId,
          employeeId: payload.employeeId
        }
      });
    } catch (err) {
      console.error('[LeaveListener] Failed to send admin push notification:', err.message);
    }

    // Email to Admins
    try {
      const uniqueAdmins = await this.getAdminEmails(payload.companyId, payload.companyEmail, payload.attendanceAlertEmails);
      
      uniqueAdmins.forEach(adminEmail => {
        this.mailService.sendLeaveStatusEmail(adminEmail, {
          employeeName: payload.employeeName,
          status: 'REQUESTED',
          startDate: String(payload.startDate),
          endDate: String(payload.endDate),
          userReason: payload.reason || 'Not specified',
          companyId: payload.companyId,
        }).catch(err => console.error(`[LeaveListener] Failed to send leave alert to ${adminEmail}:`, err.message));
      });
    } catch (err) {
      console.error('[LeaveListener] Admin email alerting failed for leave request:', err.message);
    }
  }

  @OnEvent('leave.status.updated', { async: true })
  async handleLeaveStatusUpdated(payload: {
    leaveId: string;
    employeeId: string;
    employeeUserId?: string;
    employeeName: string;
    employeeEmail?: string;
    status: string;
    startDate: string | Date;
    endDate: string | Date;
    reason: string;
    adminComment?: string;
    companyId: string;
    companyEmail?: string;
    attendanceAlertEmails?: string;
  }) {
    console.log(`[LeaveListener] Processing leave status update (${payload.status}) for ${payload.employeeName}`);

    // Notification to Employee
    try {
      if (payload.employeeUserId) {
        await this.notificationsService.send({
          title: `Difmo Pvt Ltd: Leave ${payload.status}`,
          message: `Your leave application has been ${payload.status.toLowerCase()}.${payload.adminComment ? ` Admin Note: ${payload.adminComment}` : ''}`,
          type: 'push',
          recipientFilter: 'employees',
          recipientIds: [payload.employeeUserId],
          companyId: payload.companyId,
          metadata: {
            type: 'LEAVE_STATUS',
            leaveId: payload.leaveId,
            status: payload.status,
            comment: payload.adminComment
          }
        });
      }
    } catch (err) {
      console.error('[LeaveListener] Failed to send employee notification:', err.message);
    }

    // Notification to Admin
    try {
      await this.notificationsService.send({
        title: `Difmo Pvt Ltd: Leave Request ${payload.status.charAt(0) + payload.status.slice(1).toLowerCase()}`,
        message: `Leave request for ${payload.employeeName} has been ${payload.status.toLowerCase()}.`,
        type: 'push',
        recipientFilter: 'admin',
        companyId: payload.companyId,
        metadata: {
          type: 'LEAVE_STATUS_UPDATED',
          leaveId: payload.leaveId,
          status: payload.status,
          employeeName: payload.employeeName,
          comment: payload.adminComment
        }
      });
    } catch (err) {
      console.error('[LeaveListener] Failed to send admin push notification:', err.message);
    }

    // Direct email to Employee
    try {
      if (payload.employeeEmail) {
        await this.mailService.sendLeaveStatusEmail(payload.employeeEmail, {
          employeeName: payload.employeeName,
          status: payload.status,
          startDate: String(payload.startDate),
          endDate: String(payload.endDate),
          userReason: payload.reason,
          adminComment: payload.adminComment,
          actionUrl: 'https://dashflow-frontend.vercel.app/employee/leaves',
          companyId: payload.companyId,
        });
      }
    } catch (err) {
      console.error('[LeaveListener] Failed to send direct leave email:', err.message);
    }

    // Email to Admins
    try {
      const uniqueAdmins = await this.getAdminEmails(payload.companyId, payload.companyEmail, payload.attendanceAlertEmails);
      
      uniqueAdmins.forEach(adminEmail => {
        this.mailService.sendLeaveStatusEmail(adminEmail, {
          employeeName: payload.employeeName,
          status: payload.status,
          startDate: String(payload.startDate),
          endDate: String(payload.endDate),
          userReason: payload.reason,
          adminComment: payload.adminComment,
          companyId: payload.companyId,
        }).catch(err => console.error(`[LeaveListener] Failed to send leave status update to admin ${adminEmail}:`, err.message));
      });
    } catch (err) {
      console.error('[LeaveListener] Admin email alerting failed for leave status update:', err.message);
    }
  }
}
