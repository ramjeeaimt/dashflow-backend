import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

import { LeavesModule } from '../leaves/leaves.module';

import { EmployeeModule } from '../employees/employee.module';

import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WFHRequestsModule } from '../wfh-requests/wfh-requests.module';
import { MailModule } from '../mail/mail.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    LeavesModule,
    EmployeeModule,
    AccessControlModule,
    NotificationsModule,
    WFHRequestsModule,
    MailModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
