import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';

@Controller('finance')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  @Post('payroll')
  @CheckAbilities({ action: Action.Create, subject: 'payroll' })
  createPayroll(@Body() data: any) {
    return this.financeService.createPayroll(data);
  }

  @Get('payroll')
  @CheckAbilities({ action: Action.Read, subject: 'payroll' })
  findAllPayroll(
    @Query('companyId') companyId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.financeService.findAllPayroll(companyId, month, year);
  }

  @Post('expenses')
  @CheckAbilities({ action: Action.Create, subject: 'expense' })
  createExpense(@Request() req, @Body() data: any) {
    return this.financeService.createExpense(data, req.user.userId);
  }

  @Get('expenses')
  @CheckAbilities({ action: Action.Read, subject: 'expense' })
  findAllExpenses(
    @Query('companyId') companyId: string,
    @Query('currency') currency?: string,
  ) {
    return this.financeService.findAllExpenses(companyId, currency);
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
}
