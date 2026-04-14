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
}
