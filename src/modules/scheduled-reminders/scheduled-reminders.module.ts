import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/employee.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduledRemindersService } from './scheduled-reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), NotificationsModule],
  providers: [ScheduledRemindersService],
})
export class ScheduledRemindersModule {}
