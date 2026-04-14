import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { Application } from './entities/application.entity';
import { JobMessage } from './entities/message.entity';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private jobsRepo: Repository<Job>,
    @InjectRepository(Application) private appsRepo: Repository<Application>,
    @InjectRepository(JobMessage) private msgsRepo: Repository<JobMessage>,
  ) {}

  // Jobs
  createJob(data: Partial<Job>) {
    const job = this.jobsRepo.create(data);
    return this.jobsRepo.save(job);
  }

  listJobs() {
    return this.jobsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getJob(id: string) {
    const job = await this.jobsRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  // Applications
  async createApplication(jobId: string, data: Partial<Application>) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    const app = this.appsRepo.create({ ...data, job, jobId });
    return this.appsRepo.save(app);
  }

  async listApplications(filter?: any) {
    const page = parseInt(filter?.page) || 1;
    const limit = parseInt(filter?.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.appsRepo.createQueryBuilder('app')
      .leftJoinAndSelect('app.job', 'job')
      .orderBy('app.createdAt', 'DESC');
    
    if (filter?.jobId) qb.andWhere('app.jobId = :jobId', { jobId: filter.jobId });
    if (filter?.status && filter?.status !== 'ALL') qb.andWhere('UPPER(app.status) = :status', { status: filter.status.toUpperCase() });

    const [applications, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      applications,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async updateApplicationStatus(id: string, status: string) {
    const app = await this.appsRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    app.status = status as any;
    return this.appsRepo.save(app);
  }

  async deleteJob(id: string) {
    const job = await this.getJob(id);
    return this.jobsRepo.remove(job);
  }

  async updateJob(id: string, data: Partial<Job>) {
    const job = await this.getJob(id);
    Object.assign(job, data);
    return this.jobsRepo.save(job);
  }

  // Messages
  async createMessage(data: Partial<JobMessage>) {
    try {
      const m = this.msgsRepo.create(data);
      return await this.msgsRepo.save(m);
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async listMessages(filter?: any) {
    try {
      const qb = this.msgsRepo.createQueryBuilder('m').orderBy('m.createdAt','DESC');
      if (filter?.jobId) qb.andWhere('m.jobId = :jobId', { jobId: filter.jobId });
      return await qb.getMany();
    } catch (error) {
      console.error('Error listing messages:', error);
      // Return empty array instead of throwing to prevent 500 error
      return [];
    }
  }
}
