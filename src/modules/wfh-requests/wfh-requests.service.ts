import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { WFHRequest } from './wfh-request.entity';
import { CreateWFHRequestDto, UpdateWFHRequestStatusDto } from './dto/wfh-request.dto';
import { Employee } from '../employees/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WFHRequestsService {
  constructor(
    @InjectRepository(WFHRequest)
    private wfhRepository: Repository<WFHRequest>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private readonly notificationsService: NotificationsService,
  ) { }

  async create(dto: CreateWFHRequestDto): Promise<WFHRequest> {
    const employee = await this.employeeRepository.findOne({
      where: [{ id: dto.employeeId }, { userId: dto.employeeId }],
      relations: ['user'],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    // Conflict check
    const conflict = await this.wfhRepository.findOne({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        startDate: LessThanOrEqual(dto.endDate),
        endDate: MoreThanOrEqual(dto.startDate),
      },
    });

    if (conflict) {
      throw new BadRequestException('Approved Work From Home request already exists in this date range');
    }

    const request = this.wfhRepository.create({
      ...dto,
      employeeId: employee.id,
      status: 'PENDING',
    });

    const saved = await this.wfhRepository.save(request);

    // Notify Admin
    try {
      await this.notificationsService.send({
        title: 'Difmo Pvt Ltd: New Work From Home Request',
        message: `${employee.user?.firstName || 'An employee'} has requested Work From Home from ${dto.startDate} to ${dto.endDate}.`,
        type: 'both',
        recipientFilter: 'admin',
        companyId: employee.companyId,
        metadata: {
          type: 'WFH_REQUEST',
          employeeName: employee.user?.firstName || 'An employee',
          requestId: saved.id,
        },
      });
    } catch (err) {
      console.error('[WFHRequestsService] Notification error:', err.message);
    }

    return saved;
  }

  async findAll(filters?: any): Promise<WFHRequest[]> {
    const query = this.wfhRepository
      .createQueryBuilder('wfh')
      .leftJoinAndSelect('wfh.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .orderBy('wfh.createdAt', 'DESC');

    if (filters?.employeeId) {
      query.andWhere('employee.userId = :userId', { userId: filters.employeeId });
    }

    if (filters?.status) {
      query.andWhere('wfh.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<WFHRequest> {
    const request = await this.wfhRepository.findOne({
      where: { id },
      relations: ['employee', 'employee.user'],
    });
    if (!request) throw new NotFoundException('Work From Home Request not found');
    return request;
  }

  async updateStatus(id: string, dto: UpdateWFHRequestStatusDto): Promise<WFHRequest> {
    const request = await this.findOne(id);
    request.status = dto.status;
    if (dto.adminComment) request.adminComment = dto.adminComment;

    const updated = await this.wfhRepository.save(request);

    // Notify Employee
    try {
      await this.notificationsService.send({
        title: `Difmo Pvt Ltd: Work From Home Request ${updated.status}`,
        message: `Your Work From Home request has been ${updated.status.toLowerCase()}.`,
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: [updated.employee?.userId || ''],
        companyId: updated.employee?.companyId || '',
        metadata: {
          type: 'WFH_STATUS',
          requestId: updated.id,
          status: updated.status,
        },
      });
    } catch (err) {
      console.error('[WFHRequestsService] Notification error:', err.message);
    }

    return updated;
  }

  async isEmployeeOnWFH(employeeId: string, date: string): Promise<boolean> {
    const request = await this.wfhRepository.findOne({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
    });
    return !!request;
  }

  async delete(id: string): Promise<void> {
    const request = await this.findOne(id);
    if (!request) {
      throw new NotFoundException('Work from home request not found');
    }
    await this.wfhRepository.remove(request);
  }
}
