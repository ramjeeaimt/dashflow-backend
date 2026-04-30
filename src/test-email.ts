import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EmployeeService } from './modules/employees/employee.service';
import { Company } from './modules/companies/company.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const employeeService = app.get(EmployeeService);
  const companyRepo = app.get<Repository<Company>>(getRepositoryToken(Company));

  // Try to find a company, or create a mock one
  const company = await companyRepo.findOne({ where: {} });
  if (!company) {
    console.log('No company found to associate with the employee.');
    await app.close();
    return;
  }

  console.log('Found company:', company.name);

  try {
    const employee = await employeeService.create({
      firstName: 'Pritam',
      lastName: 'Kumar',
      email: 'pritamkumars811@gmail.com',
      companyId: company.id,
      phone: '1234567890',
      password: 'testPassword123',
      role: 'Employee',
      hireDate: new Date().toISOString()
    });
    console.log('Employee created and email triggered successfully!', employee.id);
  } catch (err) {
    console.error('Failed to create employee/send email:', err);
  }

  await app.close();
}

bootstrap();
