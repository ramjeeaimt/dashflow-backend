import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';
import type { Response } from 'express';

const MANAGEMENT_ROLES = ['admin', 'super admin', 'manager', 'hr manager'];
const SUPER_ADMIN_EMAILS = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'];

function isPayrollPrivileged(user: any): boolean {
  if (!user) return false;
  if (SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return true;

  const roles = user.roles || [];
  if (roles.some((r: any) => MANAGEMENT_ROLES.includes((r?.name || '').toLowerCase()))) {
    return true;
  }

  const rolePerms = roles.flatMap((r: any) => r?.permissions || []);
  const perms = [...(user.permissions || []), ...rolePerms];
  return perms.some(
    (p: any) =>
      (p.resource === 'payroll' || p.resource === 'all') &&
      ['manage', 'create', 'update', 'delete'].includes((p.action || '').toLowerCase()),
  );
}

@Controller('payroll')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class PayrollAliasController {
  constructor(private readonly financeService: FinanceService) {}

  @Get(':id/slip')
  async getPayrollSlip(
    @Param('id') payrollId: string,
    @Request() req: any,
    @Res({ passthrough: false }) res: Response,
  ) {
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

    return res.end(pdfBuffer);
  }

  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'payroll' })
  async findOnePayroll(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    const payroll = await this.financeService.findPayrollById(id);
    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }
    const privileged = isPayrollPrivileged(user) || SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase());
    if (!privileged) {
      const owned = await this.financeService.isPayrollOwnedBy(id, user.id);
      if (!owned) {
        throw new ForbiddenException('You are not authorized to view this payroll.');
      }
    }
    return payroll;
  }

  @Get('employee/:employeeId')
  @CheckAbilities({ action: Action.Read, subject: 'payroll' })
  async findByEmployee(
    @Param('employeeId') employeeId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.financeService.findAllPayroll(employeeId, month, year);
  }
}
