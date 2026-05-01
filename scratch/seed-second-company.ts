import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CompanyService } from '../src/modules/companies/company.service';
import { UserService } from '../src/modules/users/user.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const companyService = app.get(CompanyService);
  const userService = app.get(UserService);

  const email = 'pritam@difmo.com';
  const user = await userService.findByEmail(email);

  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  // Create new company
  const newCompany = await companyService.create({
    name: 'Difmo Solutions',
    email: 'contact@difmosolutions.com',
    industry: 'Software',
    size: '11-50',
    country: 'India',
    city: 'Bangalore',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });

  console.log('Created company:', newCompany.name);

  // Link to user
  if (!user.companies) user.companies = [];
  user.companies.push(newCompany);
  
  await userService.saveUser(user);
  console.log('Linked company to user:', email);

  await app.close();
}

bootstrap();
