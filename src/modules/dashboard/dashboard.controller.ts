import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  async getMetrics(@Query('companyId') companyId: string, @Query('userId') userId?: string, @Request() req?: any) {
    const user = req?.user;
    const isSuperAdmin = user && ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user?.company?.id) ? user.company.id : companyId;
    return this.dashboardService.getMetrics(finalCompanyId, userId);
  }

  @Get('charts')
  async getCharts(@Query('companyId') companyId: string, @Request() req?: any) {
    const user = req?.user;
    const isSuperAdmin = user && ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user?.company?.id) ? user.company.id : companyId;
    return this.dashboardService.getChartData(finalCompanyId);
  }

  @Get('feed')
  async getFeed(@Query('companyId') companyId: string, @Query('userId') userId?: string, @Request() req?: any) {
    const user = req?.user;
    const isSuperAdmin = user && ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user?.company?.id) ? user.company.id : companyId;
    return this.dashboardService.getFeedData(finalCompanyId, userId);
  }

  @Get('financials')
  async getFinancials(@Query('companyId') companyId: string, @Request() req?: any) {
    const user = req?.user;
    const isSuperAdmin = user && ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user?.company?.id) ? user.company.id : companyId;
    return this.dashboardService.getFinancials(finalCompanyId);
  }
}
