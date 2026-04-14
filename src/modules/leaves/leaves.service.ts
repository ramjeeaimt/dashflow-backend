import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Leave } from './leave.entity';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { Employee } from '../employees/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from './email.service';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave)
    private leavesRepository: Repository<Leave>,

    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
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
      relations: ['user'],
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

    //  Real-time Notification to Admin
    try {
      await this.notificationsService.send({
        title: 'New Leave Request',
        message: `${employee.user?.firstName || 'An employee'} has applied for leave from ${createLeaveDto.startDate} to ${createLeaveDto.endDate}.`,
        type: 'both',
        recipientFilter: 'admin',
        companyId: employee.companyId,
        metadata: {
          type: 'LEAVE_REQUEST',
          employeeName: employee.user?.firstName || 'An employee',
          startDate: createLeaveDto.startDate,
          endDate: createLeaveDto.endDate,
          leaveId: savedLeave.id,
          employeeId: employee.id
        }
      });
    } catch (err) {
      console.error('[LeavesService] Failed to send admin notification:', err.message);
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
      relations: ['employee', 'employee.user'],
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
    
    //  Real-time Notification to Employee
    try {
      await this.notificationsService.send({
        title: `Leave ${updatedLeave.status}`,
        message: `Your leave application has been ${updatedLeave.status.toLowerCase()}.${updatedLeave.adminComment ? ` Admin Note: ${updatedLeave.adminComment}` : ''}`,
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: [updatedLeave.employee?.userId || ''],
        companyId: updatedLeave.employee?.companyId || '',
        metadata: {
          type: 'LEAVE_STATUS',
          leaveId: updatedLeave.id,
          status: updatedLeave.status,
          comment: updatedLeave.adminComment
        }
      });
    } catch (err) {
      console.error('[LeavesService] Failed to send employee notification:', err.message);
    }

    // Also send direct email using nodemailer for important status updates
    try {
      const empEmail = updatedLeave.employee?.user?.email;
      if (empEmail) {
        const subject = `Leave ${updatedLeave.status}`;
        const message = `Your leave application (${updatedLeave.id}) has been ${updatedLeave.status.toLowerCase()}. ${updatedLeave.adminComment ? 'Admin Note: ' + updatedLeave.adminComment : ''}`;
        await this.emailService.sendLeaveStatusEmail(empEmail, subject, message, {
          leaveId: updatedLeave.id,
          status: updatedLeave.status,
          comment: updatedLeave.adminComment,
        });
      }
    } catch (emailErr) {
      console.error('[LeavesService] Failed to send direct leave email:', emailErr?.message || emailErr);
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
}