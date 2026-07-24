import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    action: string,
    resource: string,
    details?: any,
    ipAddress?: string,
  ) {
    const auditLog = this.auditLogRepository.create({
      userId,
      action,
      resource,
      details,
      ipAddress,
    });
    return this.auditLogRepository.save(auditLog);
  }

  async findAll(filters?: any) {
    return this.auditLogRepository.find({
      where: filters,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  // Company-scoped recent logs, filtered and limited in SQL — for the dashboard
  // feed. Joins user.company so the company filter actually works (findAll only
  // loads 'user', which left user.company undefined for callers filtering on it).
  async findRecentForCompany(companyId: string, limit = 50) {
    return this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoin('user.company', 'company')
      .where('company.id = :companyId', { companyId })
      .orderBy('log.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
