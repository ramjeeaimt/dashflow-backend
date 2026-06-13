import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payroll } from './entities/payroll.entity';
import { Expense } from './entities/expense.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { Company } from '../companies/company.entity';
import { Employee } from '../employees/employee.entity';

import { AccessControlModule } from '../access-control/access-control.module';
import { Attendance } from '../attendance/attendance.entity';
import { NotificationsModule } from '../notifications/notifications.module';

import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payroll, Expense, Attendance, Company, Employee, User]),
    AccessControlModule,
    NotificationsModule,
  ],
  providers: [FinanceService],
  controllers: [FinanceController],
  exports: [FinanceService],
})
export class FinanceModule { }
