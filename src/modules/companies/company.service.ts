import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
  ) { }

  async create(companyData: Partial<Company>): Promise<Company> {
    const company = this.companyRepository.create(companyData);
    return this.companyRepository.save(company);
  }

  async findByEmail(email: string): Promise<Company | null> {
    return this.companyRepository.findOne({ where: { email } });
  }

  async findAll(includeDeleted = false): Promise<Company[]> {
    const findOptions = {
      relations: ['users', 'users.roles'],
    };

    if (includeDeleted) return this.companyRepository.find(findOptions);
    return this.companyRepository.find({ 
      ...findOptions,
      where: { isDeleted: false } 
    });
  }

  async findById(id: string): Promise<Company | null> {
    return this.companyRepository.findOne({
      where: { id },
      relations: ['users', 'departments'],
    });
  }

  async update(id: string, updateData: Partial<Company>): Promise<Company> {
    await this.companyRepository.update(id, updateData);
    return this.findById(id) as Promise<Company>;
  }

  async block(id: string): Promise<Company> {
    return this.update(id, { status: 'blocked' });
  }

  async unblock(id: string): Promise<Company> {
    return this.update(id, { status: 'active' });
  }

  async softDelete(id: string): Promise<Company> {
    return this.update(id, { isDeleted: true });
  }

  // ── Holiday Calendar Management ────────────────────────────────────
  async getHolidays(companyId: string): Promise<any[]> {
    const company = await this.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Company #${companyId} not found`);
    }
    const holidays = Array.isArray(company.holidays) ? company.holidays : [];
    return [...holidays].sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  async addHoliday(
    companyId: string,
    holidayData: { name: string; date: string; type?: 'full' | 'half'; description?: string; category?: string },
  ): Promise<{ holiday: any; holidays: any[] }> {
    if (!holidayData?.name || !holidayData?.date) {
      throw new BadRequestException('Holiday name and date are required');
    }
    const company = await this.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Company #${companyId} not found`);
    }

    const currentHolidays = Array.isArray(company.holidays) ? [...company.holidays] : [];
    const id = `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newHoliday = {
      id,
      name: holidayData.name.trim(),
      date: holidayData.date,
      type: (holidayData.type === 'half' ? 'half' : 'full') as 'full' | 'half',
      description: holidayData.description?.trim() || '',
      category: holidayData.category || 'General',
    };

    // Upsert by date
    const existingIndex = currentHolidays.findIndex((h) => h.date === holidayData.date);
    if (existingIndex >= 0) {
      currentHolidays[existingIndex] = { ...currentHolidays[existingIndex], ...newHoliday };
    } else {
      currentHolidays.push(newHoliday);
    }

    currentHolidays.sort((a, b) => (a.date > b.date ? 1 : -1));
    await this.companyRepository.update(companyId, { holidays: currentHolidays });

    return { holiday: newHoliday, holidays: currentHolidays };
  }

  async updateHoliday(
    companyId: string,
    holidayId: string,
    holidayData: Partial<{ name: string; date: string; type: 'full' | 'half'; description?: string; category?: string }>,
  ): Promise<{ holiday: any; holidays: any[] }> {
    const company = await this.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Company #${companyId} not found`);
    }

    const currentHolidays = Array.isArray(company.holidays) ? [...company.holidays] : [];
    const index = currentHolidays.findIndex((h) => h.id === holidayId || h.date === holidayId);
    if (index === -1) {
      throw new NotFoundException(`Holiday #${holidayId} not found`);
    }

    currentHolidays[index] = {
      ...currentHolidays[index],
      ...holidayData,
      name: holidayData.name !== undefined ? holidayData.name.trim() : currentHolidays[index].name,
      description: holidayData.description !== undefined ? holidayData.description?.trim() : currentHolidays[index].description,
    };

    currentHolidays.sort((a, b) => (a.date > b.date ? 1 : -1));
    await this.companyRepository.update(companyId, { holidays: currentHolidays });

    return { holiday: currentHolidays[index], holidays: currentHolidays };
  }

  async deleteHoliday(companyId: string, holidayId: string): Promise<{ deletedId: string; holidays: any[] }> {
    const company = await this.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Company #${companyId} not found`);
    }

    const currentHolidays = (Array.isArray(company.holidays) ? company.holidays : []).filter(
      (h) => h.id !== holidayId && h.date !== holidayId,
    );

    await this.companyRepository.update(companyId, { holidays: currentHolidays });
    return { deletedId: holidayId, holidays: currentHolidays };
  }

  async bulkSaveHolidays(companyId: string, holidays: any[]): Promise<any[]> {
    const company = await this.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Company #${companyId} not found`);
    }

    const sanitized = (Array.isArray(holidays) ? holidays : [])
      .map((h, idx) => ({
        id: h.id || `hol_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: String(h.name || '').trim(),
        date: String(h.date || ''),
        type: (h.type === 'half' ? 'half' : 'full') as 'full' | 'half',
        description: h.description ? String(h.description).trim() : '',
        category: h.category || 'General',
      }))
      .filter((h) => h.name && h.date);

    sanitized.sort((a, b) => (a.date > b.date ? 1 : -1));

    await this.companyRepository.update(companyId, { holidays: sanitized });
    return sanitized;
  }
}
