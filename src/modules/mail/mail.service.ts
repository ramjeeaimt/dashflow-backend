import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}
//this is for testing
  async sendLeaveStatusEmail(to: string, data: { employeeName: string; status: string; startDate: string; endDate: string; comment?: string }) {
    await this.mailerService.sendMail({
      to,
      subject: `Leave Application ${data.status.toUpperCase()}`,
      template: './leave-status',
      context: {
        name: data.employeeName,
        status: data.status.toLowerCase(),
        startDate: data.startDate,
        endDate: data.endDate,
        comment: data.comment,
      },
    });
  }
//send payroll email
  async sendPayrollEmail(to: string, data: { employeeName: string; month: number; year: number; netSalary: number }) {
    await this.mailerService.sendMail({
      to,
      subject: `Payroll Generated - ${data.month}/${data.year}`,
      template: './payroll-notification',
      context: {
        name: data.employeeName,
        month: data.month,
        year: data.year,
        salary: data.netSalary.toFixed(2),
      },
    });
  }

  async sendTaskAssignmentEmail(to: string, data: { employeeName: string; taskTitle: string; priority: string; deadline?: string }) {
    await this.mailerService.sendMail({
      to,
      subject: `New Task Assigned: ${data.taskTitle}`,
      template: './task-assignment',
      context: {
        name: data.employeeName,
        title: data.taskTitle,
        priority: data.priority,
        deadline: data.deadline || 'No deadline set',
      },
    });
  }

  async sendCheckInEmail(to: string, data: {
    employeeName: string; time: string; status: string; date: string;
    companyName?: string; companyLogo?: string; companyAddress?: string; companyEmail?: string;
  }) {
    const isLate = data.status === 'late';
    await this.mailerService.sendMail({
      to,
      subject: isLate
        ? `⚠️ Late Check-in Alert: ${data.employeeName} - ${data.date}`
        : `Check-in Confirmed: ${data.employeeName} - ${data.date}`,
      template: './check-in',
      context: {
        name: data.employeeName,
        time: data.time,
        status: data.status,
        date: data.date,
        isLate,
        companyName: data.companyName || 'Difmo CRM',
        companyLogo: data.companyLogo || '',
        companyAddress: data.companyAddress || '',
        companyEmail: data.companyEmail || '',
      },
    });
  }

  async sendLateWarningEmail(to: string, data: {
    employeeName: string; checkInTime: string; scheduledTime: string; date: string;
    companyName?: string; companyLogo?: string; companyAddress?: string; companyEmail?: string;
  }) {
    await this.mailerService.sendMail({
      to,
      subject: `⚠️ Late Arrival Warning – ${data.date}`,
      template: './late-warning',
      context: {
        name: data.employeeName,
        checkInTime: data.checkInTime,
        scheduledTime: data.scheduledTime,
        date: data.date,
        companyName: data.companyName || 'Difmo CRM',
        companyLogo: data.companyLogo || '',
        companyAddress: data.companyAddress || '',
        companyEmail: data.companyEmail || '',
      },
    });
  }

  async sendCheckOutEmail(to: string, data: {
    employeeName: string; time: string; date: string; workHours: number; overtime: number;
    companyName?: string; companyLogo?: string; companyAddress?: string; companyEmail?: string;
  }) {
    await this.mailerService.sendMail({
      to,
      subject: `Check-out Summary: ${data.employeeName} - ${data.date}`,
      template: './check-out',
      context: {
        name: data.employeeName,
        time: data.time,
        date: data.date,
        workHours: data.workHours.toFixed(2),
        overtime: data.overtime.toFixed(2),
        companyName: data.companyName || 'Difmo CRM',
        companyLogo: data.companyLogo || '',
        companyAddress: data.companyAddress || '',
        companyEmail: data.companyEmail || '',
      },
    });
  }

  async sendRoleAssignmentNotification(to: string, data: { employeeName: string; roles: string[] }) {
    await this.mailerService.sendMail({
      to,
      subject: `Congratulations! Your New Role at DIFMO: ${data.roles.join(', ')}`,
      template: './role-assigned',
      context: {
        name: data.employeeName,
        roles: data.roles.join(', '),
        year: new Date().getFullYear(),
      },
    });
  }
}
