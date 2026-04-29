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
import { WFHRequest } from './modules/wfh-requests/wfh-request.entity';
import { WFHRequestsModule } from './modules/wfh-requests/wfh-requests.module';


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
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AllProject } from './modules/project/project.entity';
import { AllProjectModule } from './modules/project/project.module';
import { ClientsModule } from './modules/clients/clients.module';
import { Client } from './modules/clients/client.entity';
import { UploadModule } from './modules/upload/upload.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { Invoice } from './modules/invoices/invoice.entity';
import { CompaniesModule } from './modules/companyGstDocs/copmanies.Gst.modules';
import { CompanyGst } from './modules/companyGstDocs/company.Gst.entity';
import { JobsModule } from './modules/jobs/jobs.module';
import { Job } from './modules/jobs/entities/job.entity';
import { Application } from './modules/jobs/entities/application.entity';
import { JobMessage } from './modules/jobs/entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('NODE_ENV') || 'development';

        console.log(`[APP_START] Current NODE_ENV: ${env}`);
        console.log(`[APP_START] APP_ENV_PROD: ${process.env.DATABASE_URL_PROD ? 'exists' : 'MISSING'}`);
        console.log(`[APP_START] APP_ENV_DEV: ${process.env.DATABASE_URL_DEV ? 'exists' : 'MISSING'}`);

        let dbUrl: string | undefined;
        if (env === 'production') {
          dbUrl = configService.get<string>('DATABASE_URL_PROD') || configService.get<string>('DATABASE_URL');
        } else if (env === 'development') {
          dbUrl = configService.get<string>('DATABASE_URL_DEV') || configService.get<string>('DATABASE_URL') || configService.get<string>('DATABASE_URL_PROD');
        }
        
        if (!dbUrl) {
           dbUrl = configService.get<string>('DATABASE_URL');
        }

        console.log(`[DB_DIAGNOSTIC] Environment: ${env}`);
        console.log(`[DB_DIAGNOSTIC] DATABASE_URL_PROD defined: ${!!configService.get('DATABASE_URL_PROD')}`);
        console.log(`[DB_DIAGNOSTIC] DATABASE_URL defined: ${!!configService.get('DATABASE_URL')}`);
        
        const finalUrl = dbUrl || 'NONE';
        console.log(`[DB_DIAGNOSTIC] Final Connection URL: ${finalUrl.startsWith('postgres') ? finalUrl.split('@')[1] : finalUrl}`);

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
          Invoice,
          CompanyGst,
          Job,
          Application,
          JobMessage,
          WFHRequest,
        ];
        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities,
            synchronize: env === 'development',
            ssl: {
              rejectUnauthorized: false,
            },
            extra: {
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
              ssl: {
                rejectUnauthorized: false,
              },
            },
            retryAttempts: 10,
            retryDelay: 3000,
          };
        }

        if (env === 'production') {
          throw new Error('DATABASE_URL is not defined in production environment!');
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
    AllProjectModule,
    NotificationsModule,
    ClientsModule,
    UploadModule,
    CloudinaryModule,
    CompaniesModule,
    DashboardModule,
    JobsModule,
    WFHRequestsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
