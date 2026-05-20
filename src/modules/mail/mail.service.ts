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

  private async getCustomHtml(companyId: string | undefined, vars: any, defaultMsgHtml: string = ''): Promise<string> {
    try {
      let tpl: any = {
        signatureTeam: 'Team DIFMO',
        signatureDept: 'Corporate Support',
        signatureRole: 'Communications & Experience',
        signatureCompany: 'DIFMO Pvt Ltd',
        signatureMeetText: "Let's meet",
        signatureMeetLink: 'https://www.difmo.com/contact',
        signatureEmail: 'info@difmo.com',
        signatureAddress: '4/37 Vibhav Khand, Gomtinagr Lucknow, Uttar Pradesh 226016, India',
        signatureWebsite: 'difmo.com',
        signatureWebsiteLink: 'https://www.difmo.com'
      };

      let msg = defaultMsgHtml;

      if (companyId) {
        const company = await this.companyRepository.findOne({ where: { id: companyId } });
        if (company?.activeEmailTemplateId) {
          const dbTpl = await this.emailTemplateRepository.findOne({ where: { id: company.activeEmailTemplateId } });
          if (dbTpl) {
            tpl = dbTpl;
            msg = dbTpl.message || '';
          }
        }
      }

      for (const key of Object.keys(vars)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        msg = msg.replace(regex, vars[key]);
      }

      const year = new Date().getFullYear();
      const bannerUrl = 'https://res.cloudinary.com/dxju8ikk4/image/upload/v1777468072/difmo_banner_final.png';

      const randomId = Math.random().toString(36).substring(2, 15);

      return `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff; color: #1e293b; margin: 0; padding: 20px; box-sizing: border-box; min-height: 100%;">
          <div style="max-width: 700px; margin: 0 auto; background: #fff; box-sizing: border-box;">
            <div style="font-size: 16px; line-height: 1.6; color: #334155;">
              ${msg}
            </div>
                <div style="margin-top: 48px; padding-top: 28px; border-top: 1px solid #f1f5f9;">
                  <img src="https://res.cloudinary.com/dxju8ikk4/image/upload/v1777469595/difmo_vector_icon.png" width="100" height="100" style="border-radius: 50%; object-fit: cover; display: block; margin-bottom: 20px;">
                  <div style="border-top: 1px solid #1e293b; padding-top: 22px; max-width: 650px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="55%" valign="top">
                          <p style="margin: 0 0 2px; font-size: 20px; font-weight: 800; color: #000; letter-spacing: -0.4px;">${tpl.signatureTeam || 'Team DIFMO'}</p>
                          <p style="margin: 0 0 1px; font-size: 15px; color: #1e293b; font-weight: 500;">${tpl.signatureDept || 'Corporate Support'}</p>
                          <p style="margin: 0 0 12px; font-size: 14px; color: #475569; font-style: italic;">${tpl.signatureRole || 'Communications & Experience'}</p>
                          <p style="margin: 0 0 14px; font-size: 15px; font-weight: 800; color: #000;">${tpl.signatureCompany || 'DIFMO Pvt Ltd'}</p>
                          <a href="${tpl.signatureMeetLink || '#'}" style="color: #d03f13ff; font-size: 14px; font-weight: 700; text-decoration: none;">${tpl.signatureMeetText || "Let's meet"}</a>
                        </td>
                        <td width="45%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="32" valign="top" style="padding-bottom: 14px;"><div style="width: 24px; height: 24px; background: #000; border-radius: 50%; text-align: center; line-height: 24px;"><span style="color: #fff; font-size: 11px; font-weight: 800;">E</span></div></td>
                              <td style="padding-bottom: 14px; font-size: 14px; font-weight: 600; color: #000; line-height: 1.5;">${tpl.signatureEmail || ''}</td>
                            </tr>
                            <tr>
                              <td width="32" valign="top" style="padding-bottom: 14px;"><div style="width: 24px; height: 24px; background: #000; border-radius: 50%; text-align: center; line-height: 24px;"><span style="color: #fff; font-size: 11px; font-weight: 800;">A</span></div></td>
                              <td style="padding-bottom: 14px; font-size: 14px; font-weight: 600; color: #000; line-height: 1.5;">${tpl.signatureAddress || ''}</td>
                            </tr>
                            <tr>
                              <td width="32" valign="top" style="padding-bottom: 14px;"><div style="width: 24px; height: 24px; background: #000; border-radius: 50%; text-align: center; line-height: 24px;"><span style="color: #fff; font-size: 11px; font-weight: 800;">W</span></div></td>
                              <td style="padding-bottom: 14px; font-size: 14px; font-weight: 600; color: #000; line-height: 1.5;"><a href="${tpl.signatureWebsiteLink || '#'}" style="color: #d03f13ff; text-decoration: none;">${tpl.signatureWebsite || ''}</a></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </div>
                  <div style="border-top: 1px solid #1e293b; margin-top: 22px; max-width: 650px;"></div>
                </div>
                <div style="margin-top: 36px; border-radius: 10px; overflow: hidden; line-height: 0;">
                  <img src="${bannerUrl}" style="width: 100%; height: auto; display: block;">
                </div>
                <div style="margin-top: 36px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                  <p>&copy; ${year} ${tpl.signatureCompany || 'DIFMO PRIVATE LIMITED'}. ALL RIGHTS RESERVED.</p>
                </div>
              </div>
            </div>
            <div style="display: none; opacity: 0; font-size: 0; max-height: 0; line-height: 0; mso-hide: all;">
              Ref: ${randomId}-${Date.now()}
            </div>
          `;
    } catch (err) {
      console.error('[MailService] getCustomHtml error:', err);
      return '';
    }
  }
  //this is for testing
  async sendLeaveStatusEmail(to: string, data: { employeeName: string; status: string; startDate: string; endDate: string; comment?: string; companyId?: string }) {
    const statusUpper = data.status.toUpperCase();
    const subject = `Leave Application ${statusUpper}`;
    
    let color = '#f59e0b';
    let actionText = `A new leave request has been submitted by <strong>${data.employeeName}</strong> and requires your review.`;
    if (statusUpper === 'APPROVED') {
      color = '#10b981';
      actionText = `The leave request for <strong>${data.employeeName}</strong> has been approved.`;
    } else if (statusUpper === 'REJECTED') {
      color = '#ef4444';
      actionText = `The leave request for <strong>${data.employeeName}</strong> has been rejected.`;
    }

    const defaultMsgHtml = `
      <div style="background: #f8fafc; border-left: 4px solid ${color}; padding: 24px; margin-bottom: 32px; border-radius: 4px;">
        <h2 style="color: ${color}; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">Leave ${statusUpper}</h2>
        <p style="margin: 0; color: #475569; font-size: 15px;">${actionText}</p>
        <div style="margin-top: 16px; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Employee:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Start Date:</strong> ${data.startDate}</p>
          <p style="margin: 4px 0;"><strong>End Date:</strong> ${data.endDate}</p>
          ${data.comment ? `<p style="margin: 8px 0 0 0; color: #334155;"><strong>Note:</strong> ${data.comment}</p>` : ''}
        </div>
      </div>
    `;

    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
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
    companyName?: string; companyLogo?: string; companyAddress?: string; companyEmail?: string; companyId?: string;
  }) {
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
          <p style="margin: 4px 0;"><strong>Check-in Time:</strong> ${data.time}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: bold; color: ${color};">${data.status}</span></p>
        </div>
      </div>
    `;

    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
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
    companyName?: string; companyLogo?: string; companyAddress?: string; companyEmail?: string; companyId?: string;
  }) {
    const subject = `Check-out Summary: ${data.employeeName} - ${data.date}`;

    const defaultMsgHtml = `
      <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 24px; margin-bottom: 32px; border-radius: 4px;">
        <h2 style="color: #6366f1; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">Check-out Complete</h2>
        <p style="margin: 0; color: #475569; font-size: 15px;">Your check-out has been successfully recorded for today.</p>
        <div style="margin-top: 16px; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Employee:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${data.date}</p>
          <p style="margin: 4px 0;"><strong>Check-out Time:</strong> ${data.time}</p>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 4px 0;"><strong>Total Work Hours:</strong> ${data.workHours.toFixed(2)} hrs</p>
            <p style="margin: 4px 0;"><strong>Overtime:</strong> ${data.overtime.toFixed(2)} hrs</p>
          </div>
        </div>
      </div>
    `;

    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
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

  async sendAdminAttendanceAlert(to: string, data: {
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
    showStats?: boolean;
    workHours?: number;
    overtime?: number;
    companyName?: string;
    companyLogo?: string;
    companyAddress?: string;
    companyEmail?: string;
    companyId?: string;
  }) {
    const subject = `🔔 Admin Alert: ${data.alertTitle} - ${data.employeeName}`;
    
    let color = '#3b82f6'; // default blue
    if (data.isLate) color = '#ef4444';
    else if (data.status === 'present') color = '#10b981';
    else if (data.status === 'early_checkin') color = '#f59e0b';
    else if (data.status === 'wfh') color = '#8b5cf6';

    const defaultMsgHtml = `
      <div style="background: #f8fafc; border-left: 4px solid ${color}; padding: 24px; margin-bottom: 32px; border-radius: 4px;">
        <h2 style="color: ${color}; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">${data.alertTitle}</h2>
        <p style="margin: 0; color: #475569; font-size: 15px;">${data.introText}</p>
        <div style="margin-top: 16px; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Employee:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${data.date}</p>
          <p style="margin: 4px 0;"><strong>${data.timeLabel}:</strong> ${data.timeValue}</p>
          ${data.scheduledTime ? `<p style="margin: 4px 0;"><strong>Scheduled Time:</strong> ${data.scheduledTime}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: bold; color: ${color};">${data.status}</span></p>
          ${data.showStats ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 4px 0;"><strong>Total Work Hours:</strong> ${data.workHours ? data.workHours.toFixed(2) : '0.00'} hrs</p>
              <p style="margin: 4px 0;"><strong>Overtime:</strong> ${data.overtime ? data.overtime.toFixed(2) : '0.00'} hrs</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const customHtml = await this.getCustomHtml(data.companyId, data, defaultMsgHtml);
    await this.mailerService.sendMail({ to, subject, html: customHtml });
  }
}
