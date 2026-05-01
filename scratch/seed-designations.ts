import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DesignationService } from '../src/modules/designations/designation.service';
import { CompanyService } from '../src/modules/companies/company.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const designationService = app.get(DesignationService);
  const companyService = app.get(CompanyService);

  const companies = await companyService.findAll();
  console.log(`Seeding designations for ${companies.length} companies...`);

  for (const company of companies) {
    console.log(`Processing ${company.name}...`);
    await designationService.seedDefaultDesignations(company.id);
  }

  console.log('Done!');
  await app.close();
}

seed();
