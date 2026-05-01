import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from '../src/modules/companies/company.entity';
import { User } from '../src/modules/users/user.entity';
import { Repository } from 'typeorm';

async function addCompanyToPritam() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const companyRepo = app.get<Repository<Company>>(getRepositoryToken(Company));
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

  console.log('Adding new company for pritam@difmo.com...');

  try {
    // 1. Find the existing user with their companies
    const pritam = await userRepo.findOne({
      where: { email: 'pritam@difmo.com' },
      relations: ['roles', 'companies', 'company'],
    });

    if (!pritam) {
      console.error('ERROR: User pritam@difmo.com not found!');
      await app.close();
      return;
    }
    console.log(`Found user: ${pritam.email}`);
    console.log(`Primary company: ${pritam.company?.name}`);
    console.log(`Extra workspaces: ${pritam.companies?.map(c => c.name).join(', ') || 'none'}`);

    // 2. Create the new company
    const newCompany = companyRepo.create({
      name: 'TechNova Solutions',
      email: 'info@technova.io',
      website: 'www.technova.io',
      industry: 'Software Development',
      size: '11-50',
      address: 'Innovation Hub, Sector 62, Noida',
      status: 'active',
    });
    const savedCompany = await companyRepo.save(newCompany);
    console.log(`New company created: ${savedCompany.name} (ID: ${savedCompany.id})`);

    // 3. Link the new company to pritam via the user_companies join table
    if (!pritam.companies) {
      pritam.companies = [];
    }
    pritam.companies.push(savedCompany);
    await userRepo.save(pritam);

    console.log(`SUCCESS: TechNova Solutions is now linked to pritam@difmo.com`);
    console.log(`pritam can now switch between: Difmo and TechNova Solutions`);
  } catch (error) {
    console.error('Failed:', error.message);
  }

  await app.close();
}

addCompanyToPritam();
