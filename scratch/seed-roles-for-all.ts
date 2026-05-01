import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AccessControlService } from '../src/modules/access-control/access-control.service';
import { CompanyService } from '../src/modules/companies/company.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const accessControlService = app.get(AccessControlService);
  const companyService = app.get(CompanyService);

  const companies = await companyService.findAll();
  console.log(`Found ${companies.length} companies. Seeding default roles...`);

  for (const company of companies) {
    console.log(`Seeding roles for ${company.name} (${company.id})...`);
    await accessControlService.seedDefaultRolesForCompany(company.id);
  }

  console.log('Seeding complete!');
  await app.close();
}

bootstrap();
