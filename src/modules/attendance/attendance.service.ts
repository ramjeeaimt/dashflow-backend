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
      // Skip geofence if employee has an approved WFH request for today
      const onApprovedWFH = await this.wfhRequestsService.isEmployeeOnWFH(employeeRecord.id, today);
      console.log('[AttendanceService] onApprovedWFH:', onApprovedWFH);
      this['onApprovedWFH'] = onApprovedWFH; // Store for later use in status

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

        // Allow check-in 1 hour before opening time
        const earliestHour = openHour - 1;

        if (ist.hours < earliestHour) {
          const earliestStr = `${earliestHour.toString().padStart(2, '0')}:${openMinute.toString().padStart(2, '0')}`;
          throw new ForbiddenException(
            `Cannot check in before ${earliestStr} AM.`,
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

    // Determine status with specific late/early rules
    let status = 'present';
    try {
      const employee = await this.employeeService.findOne(checkInDto.employeeId);
      if (!employee) throw new Error('Employee not found');

      const specialEmployees = ['anuskapadit', 'khushhi', 'rahul', 'shadhna', 'simran'];
      const employeeIdentifier = `${employee.user?.firstName || ''} ${employee.user?.lastName || ''} ${employee.user?.email || ''}`.toLowerCase();

      // Resolve Target Time
      let targetTime = employee.checkInTime; // Using the new column
      if (!targetTime) {
        const isSpecial = specialEmployees.some(name => employeeIdentifier.includes(name));
        targetTime = isSpecial ? '09:15' : '10:15';
      }

      const [targetHour, targetMinute] = targetTime.split(':').map(Number);
      const targetTotalMinutes = targetHour * 60 + targetMinute;
      const checkInTotalMinutes = ist.hours * 60 + ist.minutes;

      if (checkInTotalMinutes > targetTotalMinutes) {
        status = 'late';
        // Send notification about late check-in
        try {
          await this.notificationsService.send({
            title: 'Late Check-in',
            message: `You checked in late at ${checkInTime}. Scheduled time: ${targetTime}.`,
            type: 'realtime',
            recipientFilter: 'employees',
            recipientIds: [employee.userId],
            companyId: employee.companyId,
            metadata: { type: 'attendance', severity: 'warning' },
          });
        } catch (nErr) {
          console.error('[AttendanceService] Notification error:', nErr);
        }
      } else if (checkInTotalMinutes < targetTotalMinutes) {
        status = 'early_checkin';
        // Notify about early check-in
        try {
          await this.notificationsService.send({
            title: 'Early Check-in',
            message: `You checked in early at ${checkInTime}. Scheduled time: ${targetTime}.`,
            type: 'realtime',
            recipientFilter: 'employees',
            recipientIds: [employee.userId],
            companyId: employee.companyId,
            metadata: { type: 'attendance', severity: 'info' },
          });
        } catch (nErr) {
          console.error('[AttendanceService] Notification error:', nErr);
        }
      }
    } catch (e) {
      console.error('[AttendanceService] Error determining status:', e);
    }

    console.log('[AttendanceService] Status:', status);

    const attendance = this.attendanceRepository.create({
      employeeId: checkInDto.employeeId,
      date: today as any,
      checkInTime,
      status: this['onApprovedWFH'] ? 'wfh' : status,
      location: this['onApprovedWFH'] ? 'WFH' : (checkInDto.location || 'Office'),
      notes: checkInDto.notes,
    });

    console.log('[AttendanceService] Saving attendance record...');
    try {
      const saved = await this.attendanceRepository.save(attendance);
      console.log('[AttendanceService] Success! ID:', saved.id);

      // Trigger Email Notification
      const employee = await this.employeeService.findOne(saved.employeeId);
      if (employee?.user?.email) {
        this.mailService.sendCheckInEmail(employee.user.email, {
          employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
          time: saved.checkInTime,
          status: saved.status,
          date: today,
        }).catch(err => console.error('[AttendanceService] Check-in email failed:', err));
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
      this.mailService.sendCheckOutEmail(employee.user.email, {
        employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
        time: saved.checkOutTime,
        date: saved.date as any,
        workHours: saved.workHours || 0,
        overtime: saved.overtime || 0,
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
    console.log('[AttendanceService] getAnalytics (HARDCODED) - Filters:', JSON.stringify(filters));

    return {
      total: 10,
      present: 8,
      absent: 1,
      late: 1,
      earlyOut: 0,
      averageWorkHours: 8,
      weeklyTrend: [],
      distribution: [],
      punctualityTrend: [],
    };
  }
}
