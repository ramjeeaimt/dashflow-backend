import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './email-template.entity';

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private emailTemplateRepository: Repository<EmailTemplate>,
  ) {}

  async create(companyId: string, templateData: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const template = this.emailTemplateRepository.create({
      ...templateData,
      companyId,
    });
    return this.emailTemplateRepository.save(template);
  }

  async findAll(companyId: string): Promise<EmailTemplate[]> {
    return this.emailTemplateRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<EmailTemplate> {
    const template = await this.emailTemplateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`EmailTemplate with ID ${id} not found`);
    }
    return template;
  }

  async update(id: string, updateData: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, updateData);
    return this.emailTemplateRepository.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.emailTemplateRepository.remove(template);
  }
}
