import { DataSource } from 'typeorm';
import { User } from '../modules/users/user.entity';
import { Company } from '../modules/companies/company.entity';
import { Role } from '../modules/access-control/role.entity';
import { Permission } from '../modules/access-control/permission.entity';
import { Department } from '../modules/departments/department.entity';
import { Employee } from '../modules/employees/employee.entity';
import { Designation } from '../modules/designations/designation.entity';
import { Attendance } from '../modules/attendance/attendance.entity';

require('dotenv').config();

async function resetPasswords() {
    const dbUrl = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
    console.log('Connecting to database...');
    
    const AppDataSource = new DataSource({
        type: 'postgres',
        url: dbUrl,
        entities: [User, Company, Role, Permission, Department, Employee, Attendance, Designation],
        synchronize: false,
        ssl: { rejectUnauthorized: false },
    } as any);

    try {
        await AppDataSource.initialize();
        console.log('Database connected');

        const userRepo = AppDataSource.getRepository(User);
        const users = await userRepo.find();
        
        console.log(`Found ${users.length} users to reset.`);
        
        for (const user of users) {
            console.log(`Resetting password for: ${user.email}`);
            user.password = 'welcome123';
            // TypeORM's save() will trigger @BeforeUpdate hook which hashes the password
            await userRepo.save(user);
        }

        console.log('All passwords have been reset successfully.');
        await AppDataSource.destroy();
        console.log('Database connection closed.');
    } catch (error) {
        console.error('Error during password reset:', error);
    }
}

resetPasswords();
