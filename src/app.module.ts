import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
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
import { EmailTemplate } from './modules/email-templates/email-template.entity';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('NODE_ENV') || 'development';
        const isProd = env === 'production';

        // Strict per-environment DB selection:
        //   production  -> DATABASE_URL_PROD   (never the dev DB)
        //   development -> DATABASE_URL_DEV    (never the prod DB)
        // DATABASE_URL is only a shared fallback when the env-specific one is
        // unset. There is deliberately NO cross-fallback between dev and prod so
        // a running environment can never silently connect to the other's data.
        const envSpecificUrl = isProd
          ? configService.get<string>('DATABASE_URL_PROD')
          : configService.get<string>('DATABASE_URL_DEV');
        const dbUrl = envSpecificUrl || configService.get<string>('DATABASE_URL');

        const usingFallback = !envSpecificUrl && !!dbUrl;
        console.log(`[DB] NODE_ENV=${env} -> using ${isProd ? 'DATABASE_URL_PROD' : 'DATABASE_URL_DEV'}${usingFallback ? ' (MISSING — fell back to DATABASE_URL)' : ''}`);
        if (dbUrl?.startsWith('postgres')) {
          console.log(`[DB] Host: ${dbUrl.split('@')[1]?.split('/')[0] ?? 'unknown'}`);
        }
        if (usingFallback) {
          console.warn(`[DB] ⚠️  ${isProd ? 'DATABASE_URL_PROD' : 'DATABASE_URL_DEV'} is not set; using DATABASE_URL. Set the ${env}-specific URL for proper separation.`);
        }

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
          EmailTemplate,
        ];
        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities,
            // Auto-sync only outside production; prod schema changes must go through migrations
            synchronize:
              env !== 'production' &&
              (configService.get<string>('DB_SYNCHRONIZE') === 'true' || env === 'development'),
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
          throw new Error('No production database URL found. Set DATABASE_URL_PROD (or DATABASE_URL) in the environment.');
        }

        console.log('Using SQLite Database (no DATABASE_URL_DEV / DATABASE_URL set for development)');
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
    EmailTemplatesModule,
    EventEmitterModule.forRoot(),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
