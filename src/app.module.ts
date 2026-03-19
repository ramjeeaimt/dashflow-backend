import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/companies/company.module';
import { UserModule } from './modules/users/user.module';
import { DepartmentModule } from './modules/departments/department.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { EmployeeModule } from './modules/employees/employee.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { Company } from './modules/companies/company.entity';
import { User } from './modules/users/user.entity';
import { Department } from './modules/departments/department.entity';
import { Role } from './modules/access-control/role.entity';
import { Permission } from './modules/access-control/permission.entity';
import { Employee } from './modules/employees/employee.entity';
import { Attendance } from './modules/attendance/attendance.entity';
import { LeavesModule } from './modules/leaves/leaves.module';
import { Leave } from './modules/leaves/leave.entity';
import { DesignationModule } from './modules/designations/designation.module';
import { Designation } from './modules/designations/designation.entity';
import { Client } from './modules/projects/entities/client.entity';
import { Project } from './modules/projects/entities/project.entity';
import { Task } from './modules/projects/entities/task.entity';
import { Payroll } from './modules/finance/entities/payroll.entity';
import { Expense } from './modules/finance/entities/expense.entity';
import { AuditLog } from './modules/audit-logs/audit-log.entity';
import { TimeEntry } from './modules/time-tracking/time-entry.entity';
import { MailModule } from './modules/mail/mail.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { FinanceModule } from './modules/finance/finance.module';
import { AuditLogModule } from './modules/audit-logs/audit-log.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { Notification } from './modules/notifications/entities/notification.entity';
import { FcmToken } from './modules/notifications/entities/fcm-token.entity';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { AllProject } from './modules/project/project.entity';
import { AllProjectModule } from './modules/project/project.module';
// import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('NODE_ENV') || 'development';

        let dbUrl: string | undefined;
        if (env === 'production') {
          dbUrl = configService.get<string>('DATABASE_URL_PROD');
        } else if (env === 'development') {
          dbUrl = configService.get<string>('DATABASE_URL_STAGING');
        }
        if (!dbUrl) {
          dbUrl = configService.get<string>('DATABASE_URL');
        }

        console.log(
          `[Environment: ${env}] DATABASE_URL:`,
          dbUrl ? dbUrl.replace(/:[^:@]*@/, ':****@') : 'Not Set',
        );
        const entities = [
          Company,
          User,
          Department,
          Role,
          Permission,
          Employee,
          Attendance,
          Leave,
          Designation,
          Client,
          Project,
          Task,
          Payroll,
          Expense,
          AuditLog,
          TimeEntry,
          AllProject,
          Notification,
          FcmToken,
        ];
        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities,
            synchronize: true,
            ssl: {
              rejectUnauthorized: false,
            },
          };
        }
        console.log('Using SQLite Database');
        return {
          type: 'sqlite',
          database: 'db.sqlite',
          entities,
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    CompanyModule,
    UserModule,
    DepartmentModule,
    AccessControlModule,
    EmployeeModule,
    AttendanceModule,
    LeavesModule,
    DesignationModule,
    MailModule,
    ProjectsModule,
    FinanceModule,
    AuditLogModule,
    TimeTrackingModule,
    ProjectsModule,
    AllProjectModule,
    NotificationsModule,
    // UploadModule,
  ],

  controllers: [AppController, DashboardController],
  providers: [AppService],
})
export class AppModule { }
