import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/company.entity';
import { EmailTemplate } from '../email-templates/email-template.entity';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(EmailTemplate)
    private emailTemplateRepository: Repository<EmailTemplate>,
  ) { }

  // Helper to convert 24‑hour time strings (e.g., "13:45") to 12‑hour format with AM/PM
  private formatTo12Hour(time24: string): string {
    const [hourStr, minute] = time24.split(':');
    const hour = parseInt(hourStr, 10);
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${suffix}`;
  }

  // Build custom HTML based on company template or default HTML
  private async getCustomHtml(
    companyId: string | undefined,
    vars: any,
    defaultMsgHtml: string = '',
  ): Promise<string> {
    // ALWAYS use the provided default HTML; ignore any DB‑stored company template.
    // This prevents salary‑slip or other unwanted templates from being sent on check‑in/out.
    let msg = defaultMsgHtml;

    // Simple Handlebars‑style interpolation for the supplied variables.
    for (const key of Object.keys(vars)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      msg = msg.replace(regex, vars[key]);
    }

    // Append a minimal footer (year + company name) if not already present.
    const year = new Date().getFullYear();
    const footer = `
      <div style="margin-top:24px;font-size:12px;color:#64748b;">
        © ${year} ${vars.companyName || 'Your Company'}. All rights reserved.
      </div>`;
    return msg + footer;
  }

  // Leave status email
  async sendLeaveStatusEmail(
    to: string,
    data: { 
      employeeName: string; 
      status: string; 
      startDate: string; 
      endDate: string; 
      userReason?: string; 
      adminComment?: string; 
      actionUrl?: string; 
      companyId?: string 
    },
  ) {
    const statusUpper = data.status.toUpperCase();
    
    // Create distinct subjects so email clients don't merge/hide them if Employee = Admin
    const isForEmployee = !!data.actionUrl;
    const subject = isForEmployee 
      ? `Your Leave Application is ${statusUpper}` 
      : `Leave Application ${statusUpper} - ${data.employeeName}`;

    let color = '#f59e0b';
    let actionText = `A new leave request has been submitted by <strong>${data.employeeName}</strong> and requires your review.`;
    if (statusUpper === 'APPROVED') {
      color = '#10b981';
      actionText = `The leave request for <strong>${data.employeeName}</strong> has been approved.`;
    } else if (statusUpper === 'REJECTED') {
      color = '#ef4444';
      actionText = `The leave request for <strong>${data.employeeName}</strong> has been rejected.`;
    }
    const buttonHtml = data.actionUrl ? `
      <div style="margin-top: 24px;">
        <a href="${data.actionUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Leave History</a>
      </div>
    ` : '';

    const defaultMsgHtml = `
      <div style="background: #f8fafc; border-left: 4px solid ${color}; padding: 24px; margin-bottom: 32px; border-radius: 4px;">
        <h2 style="color: ${color}; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">Leave ${statusUpper}</h2>
        <p style="margin: 0; color: #475569; font-size: 15px;">${actionText}</p>
        <div style="margin-top: 16px; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Employee:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Start Date:</strong> ${data.startDate}</p>
          <p style="margin: 4px 0;"><strong>End Date:</strong> ${data.endDate}</p>
          ${data.userReason ? `<p style="margin: 8px 0 0 0; color: #334155;"><strong>Reason:</strong> ${data.userReason}</p>` : ''}
          ${data.adminComment ? `<p style="margin: 8px 0 0 0; color: #334155;"><strong>Admin Note:</strong> ${data.adminComment}</p>` : ''}
        </div>
        ${buttonHtml}
      </div>
    `;
    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
  }

  // Payroll email
  async sendPayrollEmail(
    to: string,
    data: { employeeName: string; month: number; year: number; netSalary: number },
  ) {
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

  // Task assignment email
  async sendTaskAssignmentEmail(
    to: string,
    data: { employeeName: string; taskTitle: string; priority: string; deadline?: string },
  ) {
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

  // Check‑in email
  async sendCheckInEmail(
    to: string,
    data: {
      employeeName: string;
      time: string;
      status: string;
      date: string;
      companyName?: string;
      companyLogo?: string;
      companyAddress?: string;
      companyEmail?: string;
      companyId?: string;
    },
  ) {
    const formattedTime = this.formatTo12Hour(data.time);
    const isLate = data.status === 'late';
    const subject = isLate
      ? `⚠️ Late Check-in Alert: ${data.employeeName} - ${data.date}`
      : `Check-in Confirmed: ${data.employeeName} - ${data.date}`;

    let color = '#3b82f6';
    if (isLate) color = '#ef4444';
    else if (data.status === 'present') color = '#10b981';
    else if (data.status === 'early_checkin') color = '#f59e0b';
    else if (data.status === 'wfh') color = '#8b5cf6';

    const defaultMsgHtml = `
      <div style="background: #f8fafc; border-left: 4px solid ${color}; padding: 24px; margin-bottom: 32px; border-radius: 4px;">
        <h2 style="color: ${color}; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">Check-in Successful</h2>
        <p style="margin: 0; color: #475569; font-size: 15px;">Your check-in has been successfully recorded for today.</p>
        <div style="margin-top: 16px; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Employee:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${data.date}</p>
          <p style="margin: 4px 0;"><strong>Check-in Time:</strong> ${formattedTime}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: bold; color: ${color};">${data.status}</span></p>
        </div>
      </div>
    `;
    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
  }

  // Late warning email
  async sendLateWarningEmail(
    to: string,
    data: {
      employeeName: string;
      checkInTime: string;
      scheduledTime: string;
      date: string;
      companyName?: string;
      companyLogo?: string;
      companyAddress?: string;
      companyEmail?: string;
    },
  ) {
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

  // Admin attendance alert
  async sendAdminAttendanceAlert(
    to: string,
    data: {
      alertTitle: string;
      bannerClass: string;
      introText: string;
      employeeName: string;
      date: string;
      timeLabel: string;
      timeValue: string;
      scheduledTime?: string;
      status: string;
      isLate: boolean;
      companyName?: string;
      companyLogo?: string;
      companyAddress?: string;
      companyEmail?: string;
      companyId?: string;
    },
  ) {
    const formattedTime = this.formatTo12Hour(data.timeValue);
    const subject = `🔔 Admin Alert: ${data.alertTitle} - ${data.employeeName}`;
    let color = '#3b82f6';
    if (data.isLate) color = '#ef4444';
    else if (data.status === 'present') color = '#10b981';
    else if (data.status === 'early_checkin') color = '#f59e0b';
    else if (data.status === 'wfh') color = '#8b5cf6';

    if (data.isLate) {
      // Use late warning template
      await this.mailerService.sendMail({
        to,
        subject,
        template: './late-warning',
        context: {
          name: data.employeeName,
          checkInTime: formattedTime,
          scheduledTime: data.scheduledTime || '',
          date: data.date,
          companyName: data.companyName || 'Difmo CRM',
          companyLogo: data.companyLogo || '',
          companyAddress: data.companyAddress || '',
          companyEmail: data.companyEmail || '',
        },
      });
      return;
    }

    await this.mailerService.sendMail({
      to,
      subject,
      template: './admin-checkin-out',
      context: {
        alertTitle: data.alertTitle,
        bannerClass: data.bannerClass,
        introText: data.introText,
        employeeName: data.employeeName,
        date: data.date,
        timeLabel: data.timeLabel,
        timeValue: formattedTime,
        scheduledTime: data.scheduledTime,
        status: data.status,
        color: color,
      },
    });
  }

  // Check‑out email
  async sendCheckOutEmail(
    to: string,
    data: {
      employeeName: string;
      checkInTime: string;
      time: string;
      date: string;
      workHours: number;
      overtime: number;
      companyName?: string;
      companyLogo?: string;
      companyAddress?: string;
      companyEmail?: string;
      companyId?: string;
    },
  ) {
    const formattedTime = this.formatTo12Hour(data.time);
    const subject = `Attendance Summary: ${data.employeeName} - ${data.date}`;
    const color = '#3b82f6';
    const defaultMsgHtml = `
      <div style="background: #f8fafc; border-left: 4px solid ${color}; padding: 24px; margin-bottom: 32px; border-radius: 4px;">
        <h2 style="color: ${color}; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">Attendance Summary</h2>
        <p style="margin: 0; color: #475569; font-size: 15px;">Your attendance summary has been successfully recorded.</p>
        <div style="margin-top: 16px; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Employee:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${data.date}</p>
          <p style="margin: 4px 0;"><strong>Check-in Time:</strong> ${data.checkInTime}</p>
          <p style="margin: 4px 0;"><strong>Check-out Time:</strong> ${formattedTime}</p>
          <p style="margin: 4px 0;"><strong>Total Work Hours:</strong> ${data.workHours.toFixed(2)} hrs</p>
          <p style="margin: 4px 0;"><strong>Overtime:</strong> ${data.overtime.toFixed(2)} hrs</p>
        </div>
      </div>
    `;
    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
  }

  // Role Assignment Notification
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

  // OTP email for password reset
  async sendOtpEmail(to: string, data: { otp: string; companyId?: string }) {
    const defaultMsgHtml = `
      <div style="background:#f8fafc;padding:24px;border-left:4px solid #3b82f6;">
        <h2 style="color:#3b82f6;font-size:20px;margin:0 0 12px;">Your One-Time Password (OTP)</h2>
        <p style="margin:0;color:#475569;">Use the following OTP to reset your password. It expires in 5 minutes.</p>
        <p style="font-size:24px;font-weight:bold;margin-top:12px;color:#2563eb;">${data.otp}</p>
      </div>
    `;
    const customHtml = await this.getCustomHtml(data.companyId, {}, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject: 'Password Reset OTP', html: customHtml });
  }
}
