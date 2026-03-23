// @ts-nocheck

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Company } from '../modules/companies/company.entity';
import { Role } from '../modules/access-control/role.entity';
import { Permission } from '../modules/access-control/permission.entity';
import { Department } from '../modules/departments/department.entity';
import { Employee } from '../modules/employees/employee.entity';
import { Attendance } from '../modules/attendance/attendance.entity';

require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

const AppDataSource = new DataSource({
    type: dbUrl ? 'postgres' : 'sqlite',
    database: dbUrl ? undefined : 'db.sqlite',
    url: dbUrl,
    entities: [User, Company, Role, Permission, Department, Employee, Attendance],
    synchronize: false,
    ssl: dbUrl ? { rejectUnauthorized: false } : undefined,
});

async function seedAdmin() {
    try {
        await AppDataSource.initialize();
        console.log('Database connected');

        const companyRepo = AppDataSource.getRepository(Company);
        const roleRepo = AppDataSource.getRepository(Role);
        const userRepo = AppDataSource.getRepository(User);

        // 1. Create Company
        let company = await companyRepo.findOne({ where: { email: 'admin@difmocrm.com' } });
        if (!company) {
            console.log('Creating default company...');
            company = companyRepo.create({
                name: 'Difmo CRM',
                email: 'admin@difmocrm.com',
                website: 'https://difmocrm.com',
                industry: 'Technology',
            });
            await companyRepo.save(company);
        } else {
            console.log('Company already exists.');
        }

        // 2. Create Super Admin Role
        let role = await roleRepo.findOne({ where: { name: 'Super Admin' } });
        if (!role) {
            console.log('Creating Super Admin role...');
            role = roleRepo.create({
                name: 'Super Admin',
                description: 'Full access to all resources',
                company: null, // Global role
            });
            await roleRepo.save(role);
        } else {
            console.log('Super Admin role already exists.');
        }

        // 3. Create Admin User
        const adminEmail = 'admin@difmocrm.com';
        let admin = await userRepo.findOne({ where: { email: adminEmail } });
        if (!admin) {
            console.log('Creating Admin user...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            admin = userRepo.create({
                email: adminEmail,
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                isActive: true,
                company: company,
                roles: [role],
            });
            await userRepo.save(admin);
            console.log('Admin user created successfully.');
            console.log('Email: admin@difmocrm.com');
            console.log('Password: admin123');
        } else {
            console.log('Admin user already exists.');
            // Update password just in case
            const hashedPassword = await bcrypt.hash('admin123', 10);
            admin.password = hashedPassword;
            await userRepo.save(admin);
            console.log('Admin password reset to: admin123');
        }

        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
}

seedAdmin();
