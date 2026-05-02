import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Attendance } from './attendance.entity';
import {
  CheckInDto,
  CheckOutDto,
  CreateAttendanceDto,
} from './dto/attendance.dto';
import { LeavesService } from '../leaves/leaves.service';
import { EmployeeService } from '../employees/employee.service';
import { Employee } from '../employees/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WFHRequestsService } from '../wfh-requests/wfh-requests.service';
import { MailService } from '../mail/mail.service';


@Injectable()
export class AttendanceService {
  // Office coordinates: 26.8604635, 81.0199275
  private readonly OFFICE_LAT = 26.8604635;
  private readonly OFFICE_LNG = 81.0199275;
  private readonly MAX_DISTANCE_METERS = 350;

  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    private leavesService: LeavesService,
    private employeeService: EmployeeService,
    private notificationsService: NotificationsService,
    private wfhRequestsService: WFHRequestsService,
    private mailService: MailService,
  ) { }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  private getISTDateString(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  private getISTTimeParts() {
    const istString = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });
    const [hours, minutes, seconds] = istString.split(':').map(Number);
    return { hours, minutes, seconds, timeString: istString };
  }

  async checkIn(checkInDto: CheckInDto): Promise<Attendance> {
    console.log('[AttendanceService] checkIn initiated for employeeId:', checkInDto.employeeId);
    const today = this.getISTDateString();
    console.log('[AttendanceService] Date:', today);

    // 1. Check for Leave
    try {
      const isOnLeave = await this.leavesService.isEmployeeOnLeave(
        checkInDto.employeeId,
        today,
      );
      console.log('[AttendanceService] isOnLeave:', isOnLeave);
      if (isOnLeave) {
        throw new BadRequestException(
          'Cannot check in: Employee is on approved leave today.',
        );
      }
    } catch (e) {
      console.error('[AttendanceService] Error checking leave status:', e);
      throw e;
    }

    // 2. Resolve true Employee Record (handling userId vs employeeId)
    let employeeRecord: Employee | null = null;
    try {
      // First try as direct Employee ID
      employeeRecord = await this.employeeService.findOne(checkInDto.employeeId);

      // If not found, it might be a userId (common in mobile app)
      if (!employeeRecord) {
        console.log('[AttendanceService] Resolving employee by userId:', checkInDto.employeeId);
        employeeRecord = await this.employeeService.findByUserId(checkInDto.employeeId);
      }

      if (!employeeRecord) {
        console.error('[AttendanceService] No employee found for ID:', checkInDto.employeeId);
        throw new NotFoundException('Employee not found');
      }

      console.log('[AttendanceService] Resolved Employee PK:', employeeRecord.id);

      // Update DTO with the TRUE PK for database integrity
      checkInDto.employeeId = employeeRecord.id;

      const ist = this.getISTTimeParts();
      const checkInTime = ist.timeString;

      // 3. Geofencing Check - apply based on employeeType and workFromHome flag
      const onApprovedWFH = await this.wfhRequestsService.isEmployeeOnWFH(employeeRecord.id, today);
      console.log('[AttendanceService] onApprovedWFH:', onApprovedWFH);

      const requiresGeofenceCheck =
        !onApprovedWFH && (
          employeeRecord.employeeType === 'office' ||
          (employeeRecord.employeeType === 'hybrid' && !employeeRecord.workFromHome)
        );

      if (requiresGeofenceCheck && checkInDto.latitude && checkInDto.longitude) {

        const distance = this.calculateDistance(
          checkInDto.latitude,
          checkInDto.longitude,
          this.OFFICE_LAT,
          this.OFFICE_LNG,
        );
        console.log('[AttendanceService] Distance:', distance, 'MAX:', this.MAX_DISTANCE_METERS);
        if (distance > this.MAX_DISTANCE_METERS) {
          throw new ForbiddenException(
            `You are ${Math.round(distance)}m away. You must be within ${this.MAX_DISTANCE_METERS}m of the office to check in.`,
          );
        }
      }

      if (employeeRecord.company && employeeRecord.company.openingTime) {
        console.log('[AttendanceService] Opening Time:', employeeRecord.company.openingTime);
        const ist = this.getISTTimeParts();
        const [openHour, openMinute] = employeeRecord.company.openingTime
          .split(':')
          .map(Number);
        const openTotalMinutes = openHour * 60 + openMinute;
        const nowTotalMinutes = ist.hours * 60 + ist.minutes;

        // Use company-configured buffer (default 60 min before opening)
        const earlyBuffer = employeeRecord.company.earlyCheckInBuffer ?? 60;
        const earliestMinutes = openTotalMinutes - earlyBuffer;
        const earliestHour = Math.floor(earliestMinutes / 60);
        const earliestMin = earliestMinutes % 60;

        if (nowTotalMinutes < earliestMinutes) {
          const earliestStr = `${earliestHour.toString().padStart(2, '0')}:${earliestMin.toString().padStart(2, '0')}`;
          throw new ForbiddenException(
            `Check-in is not allowed before ${earliestStr}. Please wait until then.`,
          );
        }

        // Use company-configured cutoff (default 240 min = 4 hours after opening)
        const cutoffMinutes = employeeRecord.company.checkInCutoffMinutes ?? 240;
        if (cutoffMinutes > 0 && nowTotalMinutes > openTotalMinutes + cutoffMinutes) {
          const cutoffHour = Math.floor((openTotalMinutes + cutoffMinutes) / 60);
          const cutoffMin = (openTotalMinutes + cutoffMinutes) % 60;
          const cutoffStr = `${cutoffHour.toString().padStart(2, '0')}:${cutoffMin.toString().padStart(2, '0')}`;
          throw new ForbiddenException(
            `Check-in window has closed. The latest allowed check-in was ${cutoffStr}.`,
          );
        }
      }
    } catch (e) {
      console.error('[AttendanceService] Error during employee resolution:', e);
      throw e;
    }

    // Check if already checked in today
    try {
      const existing = await this.attendanceRepository.findOne({
        where: {
          employeeId: checkInDto.employeeId,
          date: today as any,
        },
      });
      console.log('[AttendanceService] Existing attendance:', !!existing);

      if (existing) {
        throw new BadRequestException('Already checked in today');
      }
    } catch (e) {
      console.error('[AttendanceService] Error checking existing attendance:', e);
      throw e;
    }

    const ist = this.getISTTimeParts();
    const checkInTime = ist.timeString;

    let status = 'present';
    let isLate = false;
    let onApprovedWFH = false;
    let resolvedEmployee: Employee | null = null;

    try {
      resolvedEmployee = await this.employeeService.findOne(checkInDto.employeeId);
      if (!resolvedEmployee) throw new Error('Employee not found');

      onApprovedWFH = await this.wfhRequestsService.isEmployeeOnWFH(resolvedEmployee.id, today);

      const targetTime =
        resolvedEmployee.checkInTime ||
        resolvedEmployee.company?.openingTime ||
        '10:00';

      if (targetTime) {
        const [targetHour, targetMinute] = targetTime.split(':').map(Number);
        const lateThreshold = resolvedEmployee.company?.lateThresholdMinutes ?? 0;
        const targetTotalMinutes = targetHour * 60 + targetMinute + lateThreshold;
        const checkInTotalMinutes = ist.hours * 60 + ist.minutes;

        if (checkInTotalMinutes > targetTotalMinutes) {
          status = 'late';
          isLate = true;
          this.notificationsService.send({
            title: 'Late Check-in',
            message: `You checked in late at ${checkInTime}. Scheduled time: ${targetTime}.`,
            type: 'realtime',
            recipientFilter: 'custom',
            recipientIds: [resolvedEmployee.userId],
            companyId: resolvedEmployee.companyId,
            metadata: { type: 'attendance', severity: 'warning' },
          }).catch(nErr => console.error('[AttendanceService] Notification error:', nErr));
        } else if (checkInTotalMinutes < targetHour * 60 + targetMinute) {
          status = 'early_checkin';
          this.notificationsService.send({
            title: 'Early Check-in',
            message: `You checked in early at ${checkInTime}. Scheduled time: ${targetTime}.`,
            type: 'realtime',
            recipientFilter: 'custom',
            recipientIds: [resolvedEmployee.userId],
            companyId: resolvedEmployee.companyId,
            metadata: { type: 'attendance', severity: 'info' },
          }).catch(nErr => console.error('[AttendanceService] Notification error:', nErr));
        }
      }
    } catch (e) {
      console.error('[AttendanceService] Error determining status:', e);
    }

    const finalStatus = onApprovedWFH ? 'wfh' : status;

    const attendance = this.attendanceRepository.create({
      employeeId: checkInDto.employeeId,
      date: today as any,
      checkInTime,
      status: finalStatus,
      location: onApprovedWFH ? 'WFH' : (checkInDto.location || 'Office'),
      notes: checkInDto.notes,
    });

    console.log(`[AttendanceService] Saving attendance record for employee ${checkInDto.employeeId} with status: ${finalStatus}`);
    try {
      const saved = await this.attendanceRepository.save(attendance);
      console.log('[AttendanceService] Success! ID:', saved.id);

      // Trigger Email Notifications
      const employee = resolvedEmployee || await this.employeeService.findOne(saved.employeeId);
      if (employee?.user?.email) {
        const empName = `${employee.user.firstName} ${employee.user.lastName}`;
        const company = employee.company;
        const companyCtx = {
          companyName: company?.name || 'Your Company',
          companyLogo: company?.logo || '',
          companyAddress: [company?.address, company?.city, company?.country].filter(Boolean).join(', '),
          companyEmail: company?.email || '',
        };

        // Always send standard check-in confirmation
        this.mailService.sendCheckInEmail(employee.user.email, {
          employeeName: empName,
          time: saved.checkInTime,
          status: saved.status,
          date: today,
          ...companyCtx,
        }).catch(err => console.error('[AttendanceService] Check-in email failed:', err));

        // Send late warning email if applicable
        if (isLate && (company?.enableLateEmailAlert !== false)) {
          this.mailService.sendLateWarningEmail(employee.user.email, {
            employeeName: empName,
            checkInTime: saved.checkInTime,
            scheduledTime: employee.checkInTime || company?.openingTime || '',
            date: today,
            ...companyCtx,
          }).catch(err => console.error('[AttendanceService] Late warning email failed:', err));
        }
      }

      return saved;
    } catch (e) {
      console.error('[AttendanceService] Database save error:', e);
      throw e;
    }
  }

  async bulkCheckIn(employeeIds: string[], notes?: string): Promise<any> {
    const results: {
      success: string[];
      failed: { employeeId: string; error: any }[];
    } = {
      success: [],
      failed: [],
    };

    for (const employeeId of employeeIds) {
      try {
        await this.checkIn({ employeeId, notes, location: 'Bulk Check-in' });
        results.success.push(employeeId);
      } catch (error) {
        results.failed.push({ employeeId, error: error.message });
      }
    }

    return results;
  }

  async checkOut(checkOutDto: CheckOutDto): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id: checkOutDto.attendanceId },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    if (attendance.checkOutTime) {
      throw new BadRequestException('Already checked out');
    }

    // Geofencing Check for Checkout
    const employee = await this.employeeService.findOne(attendance.employeeId);
    const requiresGeofenceCheckout =
      employee?.employeeType === 'office' ||
      (employee?.employeeType === 'hybrid' && !employee.workFromHome);

    if (employee && requiresGeofenceCheckout && checkOutDto.latitude && checkOutDto.longitude) {
      const distance = this.calculateDistance(
        checkOutDto.latitude,
        checkOutDto.longitude,
        this.OFFICE_LAT,
        this.OFFICE_LNG,
      );
      if (distance > this.MAX_DISTANCE_METERS) {
        throw new ForbiddenException(
          `You are ${Math.round(distance)}m away. You must be within ${this.MAX_DISTANCE_METERS}m of the office to check out.`,
        );
      }
    }

    const ist = this.getISTTimeParts();
    const checkOutTime = ist.timeString;

    // Calculate work hours
    if (attendance.checkInTime) {
      const checkIn = new Date(`2000-01-01 ${attendance.checkInTime}`);
      const checkOut = new Date(`2000-01-01 ${checkOutTime}`);
      const workHours =
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      attendance.workHours = Math.round(workHours * 100) / 100;

      // Overtime logic
      if (attendance.workHours > 8) {
        attendance.overtime =
          Math.round((attendance.workHours - 8) * 100) / 100;
      }
    }

    attendance.checkOutTime = checkOutTime;

    // Early departure logic
    const endHour = 17;
    if (ist.hours < endHour) {
      if (attendance.status === 'present') {
        attendance.status = 'early_departure';
      }
    }

    if (checkOutDto.notes) {
      attendance.notes = checkOutDto.notes;
    }

    const saved = await this.attendanceRepository.save(attendance);

    // Trigger Email Notification
    if (employee?.user?.email) {
      const co = employee.company;
      this.mailService.sendCheckOutEmail(employee.user.email, {
        employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
        time: saved.checkOutTime,
        date: saved.date as any,
        workHours: saved.workHours || 0,
        overtime: saved.overtime || 0,
        companyName: co?.name || 'Your Company',
        companyLogo: co?.logo || '',
        companyAddress: [co?.address, co?.city, co?.country].filter(Boolean).join(', '),
        companyEmail: co?.email || '',
      }).catch(err => console.error('[AttendanceService] Check-out email failed:', err));
    }

    return saved;
  }

  async create(createAttendanceDto: CreateAttendanceDto): Promise<Attendance> {
    const attendance = this.attendanceRepository.create(createAttendanceDto);

    if (attendance.checkInTime && attendance.checkOutTime) {
      const checkIn = new Date(`2000-01-01 ${attendance.checkInTime}`);
      const checkOut = new Date(`2000-01-01 ${attendance.checkOutTime}`);
      const workHours =
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      attendance.workHours = Math.round(workHours * 100) / 100;
    }

    return this.attendanceRepository.save(attendance);
  }

  async findAll(filters?: any): Promise<Attendance[]> {
    const query = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.company', 'company');

    if (filters?.companyId) {
      query.andWhere('employee.companyId = :companyId', {
        companyId: filters.companyId,
      });
    }

    if (filters?.employeeId || filters?.userId) {
      let targetEmployeeId = filters.employeeId || filters.userId;
      const employee = await this.employeeService.findByUserId(targetEmployeeId);
      if (employee) {
        targetEmployeeId = employee.id;
      }
      query.andWhere('attendance.employeeId = :employeeId', {
        employeeId: targetEmployeeId,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('attendance.date BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters?.status) {
      query.andWhere('attendance.status = :status', { status: filters.status });
    }

    query.orderBy('attendance.date', 'DESC');

    return query.getMany();
  }

  async findOne(id: string): Promise<Attendance | null> {
    return this.attendanceRepository.findOne({
      where: { id },
      relations: ['employee', 'employee.user'],
    });
  }

  async getTodayAttendance(employeeId: string): Promise<Attendance | null> {
    const today = this.getISTDateString();

    // First attempt with what we got
    let attendance = await this.attendanceRepository.findOne({
      where: {
        employeeId,
        date: today as any,
      },
    });

    // If not found, check if employeeId is actually a userId
    if (!attendance) {
      const employee = await this.employeeService.findByUserId(employeeId);
      if (employee) {
        attendance = await this.attendanceRepository.findOne({
          where: {
            employeeId: employee.id,
            date: today as any,
          },
        });
      }
    }

    return attendance;
  }

  async getAnalytics(filters?: any): Promise<any> {
    const { startDate, endDate, companyId, departmentId } = filters;

    const query = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.department', 'department');

    if (companyId) {
      query.andWhere('employee.companyId = :companyId', { companyId });
    }

    if (departmentId && departmentId !== 'all') {
      query.andWhere('employee.departmentId = :departmentId', { departmentId });
    }

    if (startDate && endDate) {
      query.andWhere('attendance.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const records = await query.getMany();
    const totalEmployees = await this.employeeService.findAll({ companyId });
    const employeeCount = totalEmployees.length || 1;

    // Calculate Metrics
    const presentCount = records.length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtime || 0), 0);
    const totalWorkHours = records.reduce((sum, r) => sum + (r.workHours || 0), 0);

    // Assuming startDate/endDate covers a period of X working days
    const start = new Date(startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const end = new Date(endDate || new Date());
    const workingDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const totalPossibleManDays = employeeCount * workingDays;

    const attendanceRate = Math.min(100, Math.round((presentCount / totalPossibleManDays) * 100));
    const punctualityScore = presentCount > 0 ? Math.round(((presentCount - lateCount) / presentCount) * 100) : 100;
    const absenteeismRate = 100 - attendanceRate;

    // Trends (Daily)
    const trendMap = new Map();
    records.forEach(r => {
      const date = r.date.toString();
      if (!trendMap.has(date)) {
        trendMap.set(date, { attendance: 0, late: 0, count: 0 });
      }
      const data = trendMap.get(date);
      data.count++;
      if (r.status === 'late') data.late++;
    });

    const trends = Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      attendance: Math.round((data.count / employeeCount) * 100),
      punctuality: Math.round(((data.count - data.late) / data.count) * 100),
      productivity: Math.round(Math.random() * 20 + 75), // Mock productivity for now
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Department Stats
    const deptMap = new Map();
    records.forEach(r => {
      const deptName = r.employee?.department?.name || 'Unassigned';
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, { present: 0, late: 0, totalHours: 0 });
      }
      const data = deptMap.get(deptName);
      data.present++;
      if (r.status === 'late') data.late++;
      data.totalHours += (r.workHours || 0);
    });

    const departmentStats = Array.from(deptMap.entries()).map(([name, data]) => ({
      name,
      attendance: Math.round((data.present / (workingDays * (totalEmployees.filter(e => e.department?.name === name).length || 1))) * 100),
      punctuality: Math.round(((data.present - data.late) / data.present) * 100),
      employees: totalEmployees.filter(e => e.department?.name === name).length,
    }));

    return {
      attendanceRate,
      punctualityScore,
      absenteeismRate,
      overtimeHours: Math.round(totalOvertime),
      trends,
      departmentStats,
      complianceRate: 98.5, // Logic for policy compliance can be added later
      atRiskCount: lateCount > 5 ? Math.floor(lateCount / 2) : 2, // Simple logic
      improvementRate: 2.4,
    };
  }

  async update(id: string, data: any): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    // Detect changes for audit log
    const changes: string[] = [];
    if (data.checkInTime && data.checkInTime !== attendance.checkInTime) {
      changes.push(`In: ${attendance.checkInTime || 'N/A'} → ${data.checkInTime}`);
    }
    if (data.checkOutTime && data.checkOutTime !== attendance.checkOutTime) {
      changes.push(`Out: ${attendance.checkOutTime || 'N/A'} → ${data.checkOutTime}`);
    }
    if (data.status && data.status !== attendance.status) {
      changes.push(`Status: ${attendance.status} → ${data.status}`);
    }

    // Update fields
    if (data.checkInTime) attendance.checkInTime = data.checkInTime;
    if (data.checkOutTime) attendance.checkOutTime = data.checkOutTime;
    if (data.status) attendance.status = data.status;

    if (data.notes) {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      };
      const timestamp = new Intl.DateTimeFormat('en-IN', options).format(now);

      const changeSummary = changes.length > 0 ? ` [${changes.join(', ')}]` : '';
      const editNote = `[Edited on ${timestamp}]${changeSummary}: ${data.notes}`;

      attendance.notes = attendance.notes ? `${attendance.notes} | ${editNote}` : editNote;
    } else if (data.checkInTime || data.checkOutTime) {
      // If times are being changed, enforce a note
      throw new BadRequestException('A note explaining the reason for change is required.');
    }

    // Recalculate work hours if times exist
    if (attendance.checkInTime && attendance.checkOutTime) {
      const checkIn = new Date(`2000-01-01 ${attendance.checkInTime}`);
      const checkOut = new Date(`2000-01-01 ${attendance.checkOutTime}`);

      // Handle case where checkout is after midnight (next day)
      let diff = checkOut.getTime() - checkIn.getTime();
      if (diff < 0) {
        // Assume checkout is next day
        diff += 24 * 60 * 60 * 1000;
      }

      const workHours = diff / (1000 * 60 * 60);
      attendance.workHours = Math.round(workHours * 100) / 100;

      // Overtime logic (standard 8-hour workday)
      if (attendance.workHours > 8) {
        attendance.overtime = Math.round((attendance.workHours - 8) * 100) / 100;
      } else {
        attendance.overtime = 0;
      }
    }

    return this.attendanceRepository.save(attendance);
  }

  async revoke(employeeId: string): Promise<{ message: string }> {
    const today = this.getISTDateString();

    // Resolve employee first (handles userId vs employeeId)
    let emp = await this.employeeService.findOne(employeeId);
    if (!emp) {
      emp = await this.employeeService.findByUserId(employeeId);
    }

    if (!emp) {
      throw new NotFoundException('Employee not found');
    }

    const attendance = await this.attendanceRepository.findOne({
      where: {
        employeeId: emp.id,
        date: today as any,
      },
    });

    if (!attendance) {
      throw new NotFoundException('No attendance record found for today to revoke.');
    }

    await this.attendanceRepository.remove(attendance);

    return { message: 'Attendance record revoked successfully. You can now check in again.' };
  }
}
