import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/modules/users/user.service';
import { EmployeeService } from '../src/modules/employees/employee.service';

async function fixFounderRecords() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const employeeService = app.get(EmployeeService);

  const founders = [
    { email: 'pritam@difmo.com', firstName: 'Pritam', lastName: 'Sharma' },
    { email: 'admin@difmo.com', firstName: 'System', lastName: 'Administrator' }
  ];

  for (const founderInfo of founders) {
    const user = await userService.findByEmail(founderInfo.email);
    if (user) {
      const existingEmployee = await employeeService.findByUserId(user.id);
      if (!existingEmployee) {
        console.log(`Creating employee record for founder: ${user.email}`);
        await employeeService.create({
          userId: user.id,
          companyId: user.company?.id || (user as any).companyId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: 'Admin',
          status: 'active',
          hireDate: new Date().toISOString(),
        });
      } else {
        console.log(`Employee record already exists for: ${user.email}`);
      }
    }
  }

  console.log('SUCCESS: Founder employee records synchronized.');
  await app.close();
}

fixFounderRecords();
