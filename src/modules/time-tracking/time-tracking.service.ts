import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeEntry } from './time-entry.entity';

/** IST calendar-day string, used to bucket entries by "today". */
function istDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Minutes between two instants, floored at 0. */
function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

@Injectable()
export class TimeTrackingService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntryRepository: Repository<TimeEntry>,
  ) {}

  async startTimer(data: Partial<TimeEntry>) {
    // Guard against two running timers for the same employee — stop any open one
    // first so "elapsed" is never ambiguous.
    if (data.employeeId && !data.endTime) {
      const running = await this.getActive(data.employeeId);
      if (running) {
        await this.stopTimer(running.id, running.description || undefined);
      }
    }

    const entry = this.timeEntryRepository.create({
      startTime: new Date(),
      ...data,
    });

    // A manual entry arrives with both ends set — compute its duration up front.
    if (entry.startTime && entry.endTime && entry.durationMinutes == null) {
      entry.durationMinutes = minutesBetween(new Date(entry.startTime), new Date(entry.endTime));
    }
    return this.timeEntryRepository.save(entry);
  }

  async stopTimer(id: string, description?: string) {
    const entry = await this.timeEntryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');

    entry.endTime = new Date();
    entry.durationMinutes = minutesBetween(new Date(entry.startTime), entry.endTime);
    if (description) entry.description = description;

    return this.timeEntryRepository.save(entry);
  }

  /** The employee's currently-running entry (no endTime), if any. */
  async getActive(employeeId: string): Promise<TimeEntry | null> {
    return this.timeEntryRepository.findOne({
      where: { employeeId, endTime: null as any },
      relations: ['task'],
      order: { startTime: 'DESC' },
    });
  }

  async update(id: string, data: Partial<TimeEntry>) {
    const entry = await this.timeEntryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');

    if (data.startTime !== undefined) entry.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) entry.endTime = data.endTime ? new Date(data.endTime) : (null as any);
    if (data.description !== undefined) entry.description = data.description;
    if (data.taskId !== undefined) entry.taskId = data.taskId;

    if (entry.startTime && entry.endTime) {
      entry.durationMinutes = minutesBetween(new Date(entry.startTime), new Date(entry.endTime));
    }
    return this.timeEntryRepository.save(entry);
  }

  async remove(id: string) {
    const entry = await this.timeEntryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    await this.timeEntryRepository.delete(id);
    return { success: true };
  }

  /**
   * Entries for one employee or (when employeeId is omitted) the whole company.
   * Optional [from, to] window filters on start time.
   */
  async findAll(filters: {
    employeeId?: string;
    companyId?: string;
    from?: string;
    to?: string;
  }): Promise<TimeEntry[]> {
    const query = this.timeEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.task', 'task')
      .leftJoinAndSelect('entry.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .orderBy('entry.startTime', 'DESC');

    if (filters.employeeId) {
      query.andWhere('entry.employeeId = :employeeId', { employeeId: filters.employeeId });
    } else if (filters.companyId) {
      query.andWhere('employee.companyId = :companyId', { companyId: filters.companyId });
    }
    if (filters.from) {
      query.andWhere('entry.startTime >= :from', { from: new Date(`${filters.from}T00:00:00`) });
    }
    if (filters.to) {
      query.andWhere('entry.startTime <= :to', { to: new Date(`${filters.to}T23:59:59`) });
    }

    return query.getMany();
  }

  /**
   * Roll-up for the Time Tracking header tiles: hours today / this week, entry
   * and task counts, plus a per-day series for the analytics chart. Scoped to
   * one employee or the whole company.
   */
  async summary(filters: { employeeId?: string; companyId?: string }): Promise<any> {
    const entries = await this.findAll(filters);
    const today = istDate();
    const weekAgo = istDate(new Date(Date.now() - 6 * 86400000));

    let todayMinutes = 0;
    let weekMinutes = 0;
    let totalMinutes = 0;
    const taskIds = new Set<string>();
    const byDay = new Map<string, number>();

    // Seed the last 7 days so the chart has no gaps.
    for (let i = 6; i >= 0; i--) {
      byDay.set(istDate(new Date(Date.now() - i * 86400000)), 0);
    }

    for (const e of entries) {
      const mins = e.durationMinutes ?? (e.endTime ? minutesBetween(new Date(e.startTime), new Date(e.endTime)) : 0);
      const day = istDate(new Date(e.startTime));
      totalMinutes += mins;
      if (day === today) todayMinutes += mins;
      if (day >= weekAgo) weekMinutes += mins;
      if (byDay.has(day)) byDay.set(day, byDay.get(day)! + mins);
      if (e.taskId) taskIds.add(e.taskId);
    }

    const round = (m: number) => Math.round((m / 60) * 100) / 100;

    return {
      todayHours: round(todayMinutes),
      weekHours: round(weekMinutes),
      totalHours: round(totalMinutes),
      totalEntries: entries.length,
      tasksTracked: taskIds.size,
      activeEntries: entries.filter((e) => !e.endTime).length,
      byDay: [...byDay.entries()].map(([date, mins]) => ({ date, hours: round(mins) })),
    };
  }

  /**
   * Per-employee "today" view for the monitoring dashboard: who has an active
   * timer, how long they've tracked today, and what they're working on.
   */
  async teamSummary(companyId: string): Promise<any[]> {
    const today = istDate();
    const entries = await this.findAll({ companyId });
    const byEmployee = new Map<string, any>();

    for (const e of entries) {
      const emp = e.employee;
      if (!emp) continue;
      if (!byEmployee.has(emp.id)) {
        byEmployee.set(emp.id, {
          employeeId: emp.id,
          name: emp.user ? `${emp.user.firstName || ''} ${emp.user.lastName || ''}`.trim() : 'Unknown',
          todayMinutes: 0,
          active: false,
          activeSince: null as string | null,
          currentTask: null as string | null,
          lastActivity: null as Date | null,
        });
      }
      const row = byEmployee.get(emp.id);
      const day = istDate(new Date(e.startTime));
      const mins = e.durationMinutes ?? (e.endTime ? minutesBetween(new Date(e.startTime), new Date(e.endTime)) : minutesBetween(new Date(e.startTime), new Date()));
      if (day === today) row.todayMinutes += mins;
      if (!e.endTime) {
        row.active = true;
        row.activeSince = e.startTime as any;
        row.currentTask = e.task?.title || e.description || 'Working';
      }
      const start = new Date(e.startTime);
      if (!row.lastActivity || start > row.lastActivity) row.lastActivity = start;
    }

    return [...byEmployee.values()].map((r) => ({
      ...r,
      todayHours: Math.round((r.todayMinutes / 60) * 100) / 100,
    }));
  }
}
