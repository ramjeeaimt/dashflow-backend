import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LeavesService } from './modules/leaves/leaves.service';
import { MailService } from './modules/mail/mail.service';
import { CompanyService } from './modules/companies/company.service';
import { EmployeeService } from './modules/employees/employee.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const leavesService = app.get(LeavesService);
  const companyService = app.get(CompanyService);
  const employeeService = app.get(EmployeeService);
  const mailService = app.get(MailService);

  try {
    const companies = await companyService.findAll();
    if (companies.length === 0) {
      console.log('No companies found');
      process.exit(0);
    }
    
    const company = companies[0];
    console.log('Using company:', company.name);
    console.log('Alert emails configured:', company.attendanceAlertEmails);
    
    const employees = await employeeService.findAll({ companyId: company.id });
    if (employees.length === 0) {
      console.log('No employees found');
      process.exit(0);
    }
    
    const employee = employees[0];
    console.log('Using employee:', employee.user?.email);
    
    console.log('Creating a test leave request...');
    
    const leaveDto = {
      employeeId: employee.id,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      reason: 'Testing email delivery',
      type: 'sick',
      status: 'PENDING'
    };
    
    const leave = await leavesService.create(leaveDto);
    console.log('Leave request created:', leave.id);
    
    // Wait a bit to see if emails are sent
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Done.');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
