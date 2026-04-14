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

async function cleanupAttendance() {
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

        const attendanceRepo = AppDataSource.getRepository(Attendance);
        
        // Find records for the 14th (April 14, 2026)
        // Since it's only 2:30 AM IST, any record with a 9 AM or 10 AM check-in
        // MUST have been meant for the 13th but saved with the 14th.
        const records = await attendanceRepo.find({
            where: { date: '2026-04-14' as any }
        });

        console.log(`Found ${records.length} records for April 14th.`);
        let fixedCount = 0;

        for (const r of records) {
            // Check-in times like "09:05:00" or "10:16:00"
            if (r.checkInTime && (r.checkInTime.startsWith('09:') || r.checkInTime.startsWith('10:') || r.checkInTime.startsWith('08:'))) {
                console.log(`Moving record ${r.id} (${r.checkInTime}) to April 13th...`);
                r.date = '2026-04-13' as any;
                await attendanceRepo.save(r);
                fixedCount++;
            }
        }

        console.log(`Successfully moved ${fixedCount} records to April 13th.`);
        await AppDataSource.destroy();
        console.log('Done.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

cleanupAttendance();
