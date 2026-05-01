import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/modules/users/user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../src/modules/employees/employee.entity';
import { Repository } from 'typeorm';

async function repairPritam() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const employeeRepo = app.get<Repository<Employee>>(getRepositoryToken(Employee));

  const email = 'pritam@difmo.com';
  const user = await userService.findByEmail(email);
  
  if (!user) {
    console.log('User not found!');
    await app.close();
    return;
  }

  console.log(`Found User: ${user.email} (ID: ${user.id})`);

  // Manual search instead of using withDeleted
  const allEmployees = await employeeRepo.find();
  let employee = allEmployees.find(e => e.email === email || e.userId === user.id);

  if (!employee) {
    console.log('Employee record not found. Please run the fix-founders.ts script first.');
  } else {
    console.log(`Found Employee record: ${employee.id}`);
    
    // Simple direct update
    await employeeRepo.update(employee.id, {
      isDeleted: false,
      userId: user.id,
      status: 'active',
      role: 'Admin'
    });
    console.log('Employee record REPAIRED and LINKED.');
  }

  console.log('SUCCESS: Pritam account is now fully active.');
  await app.close();
}

repairPritam();
