import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeavesService } from './leaves.service';
import { EmailService } from './email.service';
import { LeavesController } from './leaves.controller';
import { Leave } from './leave.entity';
import { Employee } from '../employees/employee.entity';
import { NotificationsModule } from '../notifications/notifications.module';

import { Attendance } from '../attendance/attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Leave, Employee, Attendance]), NotificationsModule],
  controllers: [LeavesController],
  providers: [LeavesService, EmailService],
  exports: [LeavesService, EmailService],
})
export class LeavesModule {}
