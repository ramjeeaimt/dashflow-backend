import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from './designation.entity';

@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private readonly designationRepository: Repository<Designation>,
  ) {}

  async create(data: Partial<Designation>): Promise<Designation> {
    const designation = this.designationRepository.create(data);
    return this.designationRepository.save(designation);
  }

  async findAll(companyId: string): Promise<Designation[]> {
    return this.designationRepository.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Designation | null> {
    return this.designationRepository.findOne({ where: { id } });
  }

  async update(
    id: string,
    data: Partial<Designation>,
  ): Promise<Designation | null> {
    await this.designationRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.designationRepository.delete(id);
  }

  async seedDefaultDesignations(companyId: string): Promise<Designation[]> {
    const defaults = [
      'CEO & Founder',
      'Operations Manager',
      'HR Manager',
      'Software Engineer',
      'Product Manager',
      'UI/UX Designer',
      'Accountant',
      'Sales Executive',
      'Intern',
      'Staff Member'
    ];

    const results: Designation[] = [];
    for (const name of defaults) {
      const existing = await this.designationRepository.findOne({ where: { name, companyId } });
      if (!existing) {
        results.push(await this.create({ name, companyId }));
      }
    }
    return results;
  }
}
