import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Daily HR reminders pushed to company admins:
 *  - birthdays occurring today
 *  - employees who complete another whole month of service today
 *
 * Runs once a day; each event becomes an admin notification (email + push) via
 * the existing NotificationsService, which already knows how to resolve the
 * admins of a company.
 */
@Injectable()
export class ScheduledRemindersService {
  private readonly logger = new Logger(ScheduledRemindersService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly notifications: NotificationsService,
  ) {}

  private fullName(emp: Employee): string {
    const first = emp.user?.firstName || '';
    const last = emp.user?.lastName || '';
    return `${first} ${last}`.trim() || 'An employee';
  }

  private monthsCompleted(hire: Date, today: Date): number {
    let months =
      (today.getFullYear() - hire.getFullYear()) * 12 +
      (today.getMonth() - hire.getMonth());
    if (today.getDate() < hire.getDate()) months -= 1;
    return months;
  }

  // Every day at 09:00 (server time).
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'daily-hr-reminders' })
  async runDailyReminders(): Promise<void> {
    try {
      const employees = await this.employeeRepo.find({
        where: { isDeleted: false, status: 'active' },
        relations: ['user'],
      });

      const today = new Date();
      const tMonth = today.getMonth();
      const tDate = today.getDate();

      for (const emp of employees) {
        if (!emp.companyId) continue;

        // --- Birthday today ---
        if (emp.dateOfBirth) {
          const dob = new Date(emp.dateOfBirth);
          if (dob.getMonth() === tMonth && dob.getDate() === tDate) {
            await this.notifications
              .send({
                title: '🎂 Birthday today',
                message: `${this.fullName(emp)} has a birthday today. Wish them well!`,
                type: 'both',
                recipientFilter: 'admin',
                companyId: emp.companyId,
                metadata: { type: 'birthday', employeeId: emp.id },
              })
              .catch((e) => this.logger.error(`Birthday notify failed for ${emp.id}: ${e?.message}`));
          }
        }

        // --- Monthly work-anniversary completed today ---
        if (emp.hireDate) {
          const hire = new Date(emp.hireDate);
          if (hire.getDate() === tDate) {
            const months = this.monthsCompleted(hire, today);
            if (months >= 1) {
              const tenure =
                months % 12 === 0 ? `${months / 12} year(s)` : `${months} month(s)`;
              await this.notifications
                .send({
                  title: '📅 Work anniversary',
                  message: `${this.fullName(emp)} has completed ${tenure} of service today.`,
                  type: 'both',
                  recipientFilter: 'admin',
                  companyId: emp.companyId,
                  metadata: { type: 'work-anniversary', employeeId: emp.id, months },
                })
                .catch((e) => this.logger.error(`Anniversary notify failed for ${emp.id}: ${e?.message}`));
            }
          }
        }
      }
      this.logger.log(`Daily HR reminders processed for ${employees.length} employees.`);
    } catch (err) {
      this.logger.error(`runDailyReminders failed: ${err?.message}`, err?.stack);
    }
  }
}
