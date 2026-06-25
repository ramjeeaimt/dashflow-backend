import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeavesService } from './leaves.service';
import { EmailService } from './email.service';
import { LeavesController } from './leaves.controller';
import { Leave } from './leave.entity';
import { Employee } from '../employees/employee.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

import { Attendance } from '../attendance/attendance.entity';
import { LeaveListener } from './listeners/leave.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Leave, Employee, Attendance]), NotificationsModule, MailModule],
  controllers: [LeavesController],
  providers: [LeavesService, EmailService, LeaveListener],
  exports: [LeavesService, EmailService],
})
export class LeavesModule {}
