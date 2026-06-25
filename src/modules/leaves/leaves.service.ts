import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Leave } from './leave.entity';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { Employee } from '../employees/employee.entity';
import { Attendance } from '../attendance/attendance.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave)
    private leavesRepository: Repository<Leave>,

    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  // ✅ CREATE LEAVE
  async create(createLeaveDto: CreateLeaveDto): Promise<Leave> {
    console.log("Incoming employeeId:", createLeaveDto.employeeId);

    // 🔥 Map userId or employee.id → employee
    const employee = await this.employeeRepository.findOne({
      where: [
        { id: createLeaveDto.employeeId },
        { userId: createLeaveDto.employeeId }
      ],
      relations: ['user', 'company'],
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    // Validation: date check
    if (createLeaveDto.startDate > createLeaveDto.endDate) {
      throw new BadRequestException("Start date cannot be after end date");
    }

    // Conflict check (already approved leave)
    const conflict = await this.leavesRepository.findOne({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        startDate: LessThanOrEqual(createLeaveDto.endDate),
        endDate: MoreThanOrEqual(createLeaveDto.startDate),
      },
    });

    if (conflict) {
      throw new BadRequestException("Leave already exists in this date range");
    }

    const leave = this.leavesRepository.create({
      ...createLeaveDto,
      status: 'PENDING', // always default
      employee: employee,
      employeeId: employee.id,
    });

    const savedLeave = await this.leavesRepository.save(leave);

    try {
      this.eventEmitter.emit('leave.requested', {
        leaveId: savedLeave.id,
        employeeId: employee.id,
        employeeName: employee.user?.firstName || 'An employee',
        startDate: createLeaveDto.startDate,
        endDate: createLeaveDto.endDate,
        reason: createLeaveDto.reason,
        companyId: employee.companyId,
        companyEmail: employee.company?.email,
        attendanceAlertEmails: employee.company?.attendanceAlertEmails,
      });
    } catch (err) {
      console.error('[LeavesService] Failed to emit leave.requested event:', err.message);
    }

    return savedLeave;
  }

  //  GET ALL (FILTER SUPPORT)
  async findAll(filters?: any): Promise<Leave[]> {
    const query = this.leavesRepository
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .orderBy('leave.createdAt', 'DESC');

    if (filters?.employeeId) {
      query.andWhere('employee.userId = :userId', {
        userId: filters.employeeId,
      });
    }

    if (filters?.companyId) {
      query.andWhere('employee.companyId = :companyId', {
        companyId: filters.companyId,
      });
    }

    if (filters?.status) {
      query.andWhere('leave.status = :status', { status: filters.status });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere(
        '(leave.startDate <= :endDate AND leave.endDate >= :startDate)',
        { startDate: filters.startDate, endDate: filters.endDate }
      );
    }

    return query.getMany();
  }

  //  GET ONE
  async findOne(id: string): Promise<Leave> {
    const leave = await this.leavesRepository.findOne({
      where: { id },
      relations: ['employee', 'employee.user', 'employee.company'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    return leave;
  }

  //  UPDATE STATUS (APPROVE / REJECT)
  async updateStatus(id: string, dto: UpdateLeaveStatusDto): Promise<Leave> {
    const leave = await this.findOne(id);

    leave.status = dto.status.toUpperCase();
    if (dto.adminComment) {
      leave.adminComment = dto.adminComment;
    }

    const updatedLeave = await this.leavesRepository.save(leave);

    // Auto-generate Attendance records if leave is APPROVED
    if (updatedLeave.status === 'APPROVED') {
      try {
        const company = updatedLeave.employee?.company;
        let workingDays = company?.workingDays;
        
        // Parse simple-json if it comes as a string (TypeORM simple-json sometimes needs it, but usually handles it. Just in case)
        if (typeof workingDays === 'string') {
          try { workingDays = JSON.parse(workingDays); } catch(e) {}
        }
        
        if (!workingDays || !Array.isArray(workingDays) || workingDays.length === 0) {
          workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        }
        const workingDaysLower = workingDays.map(d => typeof d === 'string' ? d.toLowerCase() : '');
        const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        const start = new Date(updatedLeave.startDate);
        const end = new Date(updatedLeave.endDate);
        const datesToLog: string[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayName = daysMap[d.getDay()];
          if (workingDaysLower.includes(dayName)) {
            // Adjust to local ISO string (to avoid timezone shifting issues)
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            datesToLog.push(`${year}-${month}-${day}`);
          }
        }

        for (const dateStr of datesToLog) {
          const existing = await this.attendanceRepository.findOne({
            where: { employeeId: updatedLeave.employeeId, date: dateStr as any }
          });

          if (!existing) {
            const att = this.attendanceRepository.create({
              employeeId: updatedLeave.employeeId,
              date: dateStr as any,
              status: 'leave',
              notes: 'Auto-generated from approved leave request'
            });
            await this.attendanceRepository.save(att);
          } else if (existing.status !== 'present') {
            existing.status = 'leave';
            existing.notes = existing.notes ? `${existing.notes} | Auto-approved leave` : 'Auto-approved leave';
            await this.attendanceRepository.save(existing);
          }
        }
      } catch (err) {
        console.error('[LeavesService] Failed to auto-generate attendance for approved leave:', err);
      }
    }

    try {
      this.eventEmitter.emit('leave.status.updated', {
        leaveId: updatedLeave.id,
        employeeId: updatedLeave.employeeId,
        employeeUserId: updatedLeave.employee?.userId,
        employeeName: updatedLeave.employee?.user?.firstName || 'Employee',
        employeeEmail: updatedLeave.employee?.user?.email,
        status: updatedLeave.status,
        startDate: updatedLeave.startDate,
        endDate: updatedLeave.endDate,
        reason: updatedLeave.reason,
        adminComment: updatedLeave.adminComment,
        companyId: updatedLeave.employee?.companyId,
        companyEmail: updatedLeave.employee?.company?.email,
        attendanceAlertEmails: updatedLeave.employee?.company?.attendanceAlertEmails,
      });
    } catch (err) {
      console.error('[LeavesService] Failed to emit leave.status.updated event:', err.message);
    }

    return updatedLeave;
  }

  //  CHECK IF EMPLOYEE ON LEAVE
  async isEmployeeOnLeave(employeeId: string, date: string): Promise<boolean> {
    const leave = await this.leavesRepository.findOne({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
    });

    return !!leave;
  }
  async update(id: string, updateLeaveDto: any): Promise<Leave> {
    const leave = await this.leavesRepository.preload({
      id,
      ...updateLeaveDto,
    });
    if (!leave) {
      throw new NotFoundException(`Leave with ID ${id} not found`);
    }
    return this.leavesRepository.save(leave);
  }

  async delete(id: string): Promise<void> {
    const leave = await this.findOne(id);
    if (!leave) {
      throw new NotFoundException('Leave record not found');
    }
    await this.leavesRepository.remove(leave);
  }
}