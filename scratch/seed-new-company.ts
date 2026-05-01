import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from '../src/modules/companies/company.entity';
import { User } from '../src/modules/users/user.entity';
import { Role } from '../src/modules/access-control/role.entity';
import { Employee } from '../src/modules/employees/employee.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

async function seedNewCompany() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const companyRepo = app.get<Repository<Company>>(getRepositoryToken(Company));
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const roleRepo = app.get<Repository<Role>>(getRepositoryToken(Role));
  const employeeRepo = app.get<Repository<Employee>>(getRepositoryToken(Employee));

  console.log('Seeding new company: TechNova Solutions...');

  try {
    // 1. Create Company
    const company = companyRepo.create({
      name: 'TechNova Solutions',
      email: 'hello@technova.com',
      website: 'www.technova.com',
      industry: 'Software Development',
      size: '11-50',
      address: 'Innovation Hub, Sector 62, Noida',
      status: 'active'
    });
    const savedCompany = await companyRepo.save(company);
    console.log(`Company created: ${savedCompany.name} (ID: ${savedCompany.id})`);

    // 2. Get Admin Role
    const allRoles = await roleRepo.find();
    const adminRole = allRoles.find(r => r.name.toUpperCase() === 'ADMIN') || allRoles[0];

    // 3. Create Founder User
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = userRepo.create({
      firstName: 'Arjun',
      lastName: 'Mehta',
      email: 'founder@technova.com',
      password: hashedPassword,
      phone: '9876543210',
      companyId: savedCompany.id,
      roles: [adminRole]
    });
    const savedUser = await userRepo.save(user);
    console.log(`Founder User created: ${savedUser.email}`);

    // 4. Create Employee Record for Founder
    const employee = employeeRepo.create({
      userId: savedUser.id,
      companyId: savedCompany.id,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      email: savedUser.email,
      phone: savedUser.phone,
      role: 'Admin',
      status: 'active',
      hireDate: new Date().toISOString()
    });
    await employeeRepo.save(employee);
    console.log('Employee record created for Founder.');

    console.log('SUCCESS: TechNova Solutions is now fully seeded.');
  } catch (error) {
    console.error('Seeding failed:', error);
  }

  await app.close();
}

seedNewCompany();
