import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Leave } from './leave.entity';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { Employee } from '../employees/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave)
    private leavesRepository: Repository<Leave>,

    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
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

    //  Real-time Notification to Admin
    try {
      await this.notificationsService.send({
        title: 'Difmo Pvt Ltd: New Leave Request',
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

    // Send Leave Request email to configured admins and fallback company admins
    try {
      const adminEmails: string[] = [];
      const companyId = employee.companyId;

      if (employee.company?.attendanceAlertEmails) {
        const configuredEmails = employee.company.attendanceAlertEmails
          .split(',')
          .map(email => email.trim())
          .filter(Boolean);
        adminEmails.push(...configuredEmails);
      }

      if (companyId) {
        const allEmployees = await this.employeeRepository.find({
          where: { companyId, isDeleted: false },
          relations: ['user', 'user.roles'],
        });
        const companyAdmins = allEmployees
          .filter(emp => emp.user?.email && emp.user?.roles?.some(role => ['admin', 'super admin', 'superadmin', 'manager'].includes(role.name.toLowerCase())))
          .map(emp => emp.user.email);
        adminEmails.push(...companyAdmins);
      }

      if (employee.company?.email) {
        adminEmails.push(employee.company.email);
      }

      const uniqueAdmins = [...new Set(adminEmails)].filter(email => !!email);
      const empName = `${employee.user?.firstName} ${employee.user?.lastName}`;
      uniqueAdmins.forEach(adminEmail => {
        // Send using MailService, which supports the global email template
        this.mailService.sendLeaveStatusEmail(adminEmail, {
          employeeName: empName,
          status: 'REQUESTED',
          startDate: createLeaveDto.startDate,
          endDate: createLeaveDto.endDate,
          comment: createLeaveDto.reason || 'Not specified',
          companyId: employee.companyId,
        }).catch(err => console.error(`[LeavesService] Failed to send leave alert to ${adminEmail}:`, err));
      });
    } catch (err) {
      console.error('[LeavesService] Admin email alerting failed for leave request:', err);
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

    // 1. Notification to Employee
    try {
      await this.notificationsService.send({
        title: `Difmo Pvt Ltd: Leave ${updatedLeave.status}`,
        message: `Your leave application has been ${updatedLeave.status.toLowerCase()}.${updatedLeave.adminComment ? ` Admin Note: ${updatedLeave.adminComment}` : ''}`,
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: [updatedLeave.employee?.userId].filter(Boolean) as string[],
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

    // 2. Notification to Admin (Both Side)
    try {
      await this.notificationsService.send({
        title: `Difmo Pvt Ltd: Leave Request ${updatedLeave.status.charAt(0) + updatedLeave.status.slice(1).toLowerCase()}`,
        message: `Leave request for ${updatedLeave.employee?.user?.firstName || 'Employee'} has been ${updatedLeave.status.toLowerCase()}.`,
        type: 'both',
        recipientFilter: 'admin',
        companyId: updatedLeave.employee?.companyId || '',
        metadata: {
          type: 'LEAVE_STATUS_UPDATED',
          leaveId: updatedLeave.id,
          status: updatedLeave.status,
          employeeName: updatedLeave.employee?.user?.firstName || 'Employee',
          comment: updatedLeave.adminComment
        }
      });
    } catch (err) {
      console.error('[LeavesService] Failed to send admin notification:', err.message);
    }

    // Also send direct email using nodemailer for important status updates to employee
    try {
      const empEmail = updatedLeave.employee?.user?.email;
      if (empEmail) {
        await this.mailService.sendLeaveStatusEmail(empEmail, {
          employeeName: updatedLeave.employee?.user?.firstName || 'Employee',
          status: updatedLeave.status,
          startDate: updatedLeave.startDate,
          endDate: updatedLeave.endDate,
          comment: updatedLeave.adminComment,
          companyId: updatedLeave.employee?.companyId,
        });
      }
    } catch (emailErr) {
      console.error('[LeavesService] Failed to send direct leave email:', emailErr?.message || emailErr);
    }

    // 3. Email to Admins and Configured Attendance Alert Emails
    try {
      const adminEmails: string[] = [];
      const companyId = updatedLeave.employee?.companyId;

      if (updatedLeave.employee?.company?.attendanceAlertEmails) {
        const configuredEmails = updatedLeave.employee.company.attendanceAlertEmails
          .split(',')
          .map(email => email.trim())
          .filter(Boolean);
        adminEmails.push(...configuredEmails);
      }

      if (companyId) {
        const allEmployees = await this.employeeRepository.find({
          where: { companyId, isDeleted: false },
          relations: ['user', 'user.roles'],
        });
        const companyAdmins = allEmployees
          .filter(emp => emp.user?.email && emp.user?.roles?.some(role => ['admin', 'super admin', 'superadmin', 'manager'].includes(role.name.toLowerCase())))
          .map(emp => emp.user.email);
        adminEmails.push(...companyAdmins);
      }

      if (updatedLeave.employee?.company?.email) {
        adminEmails.push(updatedLeave.employee.company.email);
      }

      const uniqueAdmins = [...new Set(adminEmails)].filter(email => !!email);
      const empName = `${updatedLeave.employee?.user?.firstName || ''} ${updatedLeave.employee?.user?.lastName || ''}`.trim() || 'Employee';
      
      uniqueAdmins.forEach(adminEmail => {
        this.mailService.sendLeaveStatusEmail(adminEmail, {
          employeeName: empName,
          status: updatedLeave.status,
          startDate: updatedLeave.startDate,
          endDate: updatedLeave.endDate,
          comment: updatedLeave.adminComment,
          companyId: updatedLeave.employee?.companyId,
        }).catch(err => console.error(`[LeavesService] Failed to send leave status update to admin ${adminEmail}:`, err));
      });
    } catch (err) {
      console.error('[LeavesService] Admin email alerting failed for leave status update:', err);
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