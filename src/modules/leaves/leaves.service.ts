import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Leave } from './leave.entity';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave)
    private leavesRepository: Repository<Leave>,
  ) {}

  async create(createLeaveDto: CreateLeaveDto): Promise<Leave> {
    const leave = this.leavesRepository.create(createLeaveDto);
    return this.leavesRepository.save(leave);
  }

  async findAll(filters?: any): Promise<Leave[]> {
    const query = this.leavesRepository
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .orderBy('leave.createdAt', 'DESC');

    if (filters?.employeeId) {
      query.andWhere('leave.employeeId = :employeeId', {
        employeeId: filters.employeeId,
      });
    }

    if (filters?.status) {
      query.andWhere('leave.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Leave> {
    const leave = await this.leavesRepository.findOne({
      where: { id },
      relations: ['employee'],
    });
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }
    return leave;
  }

 // NestJS Service update
async updateStatus(id: string, updateLeaveStatusDto: UpdateLeaveStatusDto) {
    const leave = await this.findOne(id);
    leave.status = updateLeaveStatusDto.status;
    
    // 👇 Ye line add karo warna comment DB mein nahi jayega
    if (updateLeaveStatusDto.adminComment) {
        leave.adminComment = updateLeaveStatusDto.adminComment;
    }
    
    return this.leavesRepository.save(leave);
}

  async isEmployeeOnLeave(employeeId: string, date: string): Promise<boolean> {
    const leave = await this.leavesRepository.findOne({
      where: {
        employeeId,
        status: 'approved',
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
    });
    return !!leave;
  }
}
