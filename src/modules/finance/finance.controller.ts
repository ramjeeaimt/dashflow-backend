import {
  Controller,
  Get,
  Post,
  Put,
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
import { ForbiddenException, NotFoundException } from '@nestjs/common';

// Case-insensitive so DB role casing (e.g. 'ADMIN', 'HR Manager') still matches.
const MANAGEMENT_ROLES = ['admin', 'super admin', 'manager', 'hr manager'];
const SUPER_ADMIN_EMAILS = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'];

/**
 * A payroll-privileged user may read the WHOLE company's payroll (all employees,
 * including drafts). This is any admin/manager: a super-admin email, a management
 * role (case-insensitive), or a payroll permission stronger than plain `read`
 * (manage/create/update/delete, or on resource `all`). A plain employee who only
 * has `read payroll` is NOT privileged and is scoped to their own finalized slips.
 */
function isPayrollPrivileged(user: any): boolean {
  if (!user) return false;
  if (SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return true;

  const roles = user.roles || [];
  if (roles.some((r: any) => MANAGEMENT_ROLES.includes((r?.name || '').toLowerCase()))) {
    return true;
  }

  // Consider BOTH direct user permissions and permissions inherited from roles.
  // (`user.permissions` is only the direct many-to-many; role grants live on
  // `user.roles[].permissions`, which is where an Admin's payroll rights sit.)
  const rolePerms = roles.flatMap((r: any) => r?.permissions || []);
  const perms = [...(user.permissions || []), ...rolePerms];
  return perms.some(
    (p: any) =>
      (p.resource === 'payroll' || p.resource === 'all') &&
      ['manage', 'create', 'update', 'delete'].includes((p.action || '').toLowerCase()),
  );
}

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
    @Query('companyId') companyId?: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any
  ) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);

    // Only privileged callers may read the whole company's payroll. A plain
    // employee (has `read payroll` but not manage/create/update) is hard-scoped
    // to their OWN records and only finalized (sent/paid) payslips — they can
    // never enumerate the company via companyId. This closes the data-exposure
    // hole where any employee could read every salary.
    const privileged = isPayrollPrivileged(user) || isSuperAdmin;

    if (!privileged) {
      return this.financeService.findAllPayroll(
        user.id,               // resolves to their employee record by userId
        month,
        year,
        undefined,             // ignore any companyId the client supplied
        { page, limit, finalizedOnly: true },
      );
    }

    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : companyId;
    if (!employeeId && !finalCompanyId) {
      employeeId = req.user.employeeId || req.user.id;
    }

    return this.financeService.findAllPayroll(employeeId, month, year, finalCompanyId, { page, limit });
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
    @Request() req?: any
  ) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : companyId;
    return this.financeService.findAllExpenses(finalCompanyId, currency);
  }

  @Patch('expenses/:id')
  @CheckAbilities({ action: Action.Update, subject: 'expense' })
  updateExpense(@Param('id') id: string, @Body() data: any) {
    return this.financeService.updateExpense(id, data);
  }

  @Delete('expenses/:id')
  @CheckAbilities({ action: Action.Delete, subject: 'expense' })
  deleteExpense(@Param('id') id: string) {
    return this.financeService.deleteExpense(id);
  }

  @Get('payroll/:id/slip')
  async getPayrollSlip(
    @Param('id') payrollId: string,
    @Request() req: any,
    @Res({ passthrough: false }) res: Response
  ) {
    // A payslip PDF is viewable only by a payroll-privileged user or the
    // employee who owns it (and only once finalized).
    const user = req.user;
    if (!isPayrollPrivileged(user)) {
      const owned = await this.financeService.isPayrollOwnedBy(payrollId, user.id);
      if (!owned) {
        throw new ForbiddenException('You can only view your own payslip.');
      }
    }

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

  @Post('bulk-generate')
  @CheckAbilities({ action: Action.Create, subject: 'payroll' })
  bulkGeneratePayroll(
    @Request() req: any,
    @Body() body: { month: number; year: number; companyId?: string; employeeId?: string }
  ) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : body.companyId;

    if (!finalCompanyId) {
      throw new Error('Company ID is required for bulk generation');
    }

    return this.financeService.generateMonthlyPayroll(body.month, body.year, finalCompanyId, body.employeeId);
  }

  @Post('generate-single')
  generateSingle(@Body() body: { attendanceId: string }) {
    return this.financeService.generatePayrollSingle(body.attendanceId);
  }

  @Put('payroll/:id/custom-html')
  @CheckAbilities({ action: Action.Update, subject: 'payroll' })
  saveCustomHtml(
    @Param('id') id: string,
    @Body() body: { customPayslipHtml: string; customEmailBodyHtml: string }
  ) {
    return this.financeService.saveCustomHtml(id, body.customPayslipHtml, body.customEmailBodyHtml);
  }

  @Get('summary')
  @CheckAbilities({ action: Action.Read, subject: 'expense' })
  getSummary(
    @Query('companyId') companyId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('currency') currency?: string,
    @Request() req?: any
  ) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : companyId;
    return this.financeService.getFinancialSummary(finalCompanyId, month, year, currency);
  }

  @Get('payroll/:id')
  @CheckAbilities({ action: Action.Read, subject: 'payroll' })
  async findOnePayroll(
    @Param('id') id: string,
    @Request() req: any
  ) {
    const user = req.user;
    const payroll = await this.financeService.findPayrollById(id);
    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }
    const privileged = isPayrollPrivileged(user) || ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes((user.email || '').toLowerCase());
    if (!privileged) {
      const owned = await this.financeService.isPayrollOwnedBy(id, user.id);
      if (!owned) {
        throw new ForbiddenException('You are not authorized to view this payroll.');
      }
    }
    return payroll;
  }

  @Patch('payroll/:id')
  @CheckAbilities({ action: Action.Update, subject: 'payroll' })
  updatePayroll(@Param('id') id: string, @Body() data: any) {
    return this.financeService.updatePayroll(id, data);
  }

  @Post('payroll/:id/send')
  @CheckAbilities({ action: Action.Update, subject: 'payroll' })
  finalizeAndSendPayroll(
    @Param('id') id: string,
    @Body() body: { payslipHtml: string; emailBodyHtml: string }
  ) {
    return this.financeService.finalizeAndSendPayroll(id, body.payslipHtml, body.emailBodyHtml);
  }

  @Delete('payroll/:id')
  @CheckAbilities({ action: Action.Delete, subject: 'payroll' })
  deletePayroll(@Param('id') id: string) {
    return this.financeService.deletePayroll(id);
  }
}
