import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';
import type { Response } from 'express';
import { Attendance } from '../attendance/attendance.entity';

@Controller('finance')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  @Post('payroll')
  @CheckAbilities({ action: Action.Create, subject: 'payroll' })

  createPayroll(@Body() data: any) {

    console.log(" BODY:", data);
    return this.financeService.createPayroll(data);
  }


  @Post('payroll/pay')
  markAsPaid(@Body() body: { payrollId: string }) {
    return this.financeService.markPayrollPaid(body.payrollId);
  }

  // FinanceController.ts
  @Get('payroll')
  @CheckAbilities({ action: Action.Read, subject: 'payroll' })
  findAllPayroll(
    @Query('employeeId') employeeId?: string,
    @Query('companyId') companyId?: string, // 👈 Admin ke liye ye add kiya
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Request() req?: any
  ) {
    // LOGIC: Agar na employeeId hai na companyId, toh logged-in user (Employee) ka data dikhao
    if (!employeeId && !companyId) {
      employeeId = req.user.employeeId || req.user.id;
    }

    // Ab service ko 4 arguments bhejo
    return this.financeService.findAllPayroll(employeeId, month, year, companyId);
  }


  @Post('expenses')
  @CheckAbilities({ action: Action.Create, subject: 'expense' })
  createExpense(@Request() req, @Body() data: any) {
    return this.financeService.createExpense(data, req.user.id);
  }

  @Get('expenses')
  @CheckAbilities({ action: Action.Read, subject: 'expense' })
  findAllExpenses(
    @Query('companyId') companyId: string,
    @Query('currency') currency?: string,
  ) {
    return this.financeService.findAllExpenses(companyId, currency);
  }

  @Delete('expenses/:id')
  @CheckAbilities({ action: Action.Delete, subject: 'expense' })
  deleteExpense(@Param('id') id: string) {
    return this.financeService.deleteExpense(id);
  }

  @Get('payroll/:id/slip')
  async getPayrollSlip(
    @Param('id') payrollId: string,
    @Res({ passthrough: false }) res: Response
  ) {
    const pdfBuffer = await this.financeService.generatePayrollSlip(payrollId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=payroll_${payrollId}.pdf`,
    });

    return res.end(pdfBuffer); //  use end instead of send
  }

  @Post('generate')
  generatePayroll(
    @Body() body: { attendanceId: string; month: number; year: number }
  ) {
    return this.financeService.generatePayroll(body);
  }

  @Post('generate-single')
  generateSingle(@Body() body: { attendanceId: string }) {
    return this.financeService.generatePayrollSingle(body.attendanceId);
  }

  @Get('summary')
  @CheckAbilities({ action: Action.Read, subject: 'expense' })
  getSummary(
    @Query('companyId') companyId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('currency') currency?: string,
  ) {
    return this.financeService.getFinancialSummary(companyId, month, year, currency);
  }

  @Patch('payroll/:id')
  @CheckAbilities({ action: Action.Update, subject: 'payroll' })
  updatePayroll(@Param('id') id: string, @Body() data: any) {
    return this.financeService.updatePayroll(id, data);
  }

  @Post('payroll/:id/send-email')
  @CheckAbilities({ action: Action.Update, subject: 'payroll' })
  sendPayrollEmail(@Param('id') id: string) {
    return this.financeService.sendPayrollEmail(id);
  }

  @Delete('payroll/:id')
  @CheckAbilities({ action: Action.Delete, subject: 'payroll' })
  deletePayroll(@Param('id') id: string) {
    return this.financeService.deletePayroll(id);
  }
}
