import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OvertimeRequest } from './overtime-request.entity';
import { Employee } from '../employees/employee.entity';

@Injectable()
export class OvertimeService {
  constructor(
    @InjectRepository(OvertimeRequest)
    private readonly overtimeRepo: Repository<OvertimeRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async createRequest(employeeId: string, dto: { date: string; hours: number; description?: string }) {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const request = this.overtimeRepo.create({
      employee,
      employeeId: employee.id,
      date: dto.date,
      hours: dto.hours,
      description: dto.description,
      status: 'pending',
    });
    return this.overtimeRepo.save(request);
  }

  async findPending() {
    return this.overtimeRepo.find({ where: { status: 'pending' }, relations: ['employee'] });
  }

  async updateStatus(id: string, status: 'approved' | 'rejected', adminId: string) {
    const request = await this.overtimeRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Overtime request not found');
    request.status = status;
    request.approvedById = adminId;
    return this.overtimeRepo.save(request);
  }
}
