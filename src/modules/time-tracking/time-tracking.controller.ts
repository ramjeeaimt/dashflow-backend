import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';

/** Resolve the caller's active company for company-wide (no employeeId) reads. */
function companyOf(req: any): string | undefined {
  return req?.user?.company?.id;
}

@Controller('time-tracking')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post('start')
  @CheckAbilities({ action: Action.Create, subject: 'time_entry' })
  start(@Body() data: any) {
    return this.timeTrackingService.startTimer(data);
  }

  @Put('stop/:id')
  @CheckAbilities({ action: Action.Update, subject: 'time_entry' })
  stop(@Param('id') id: string, @Body('description') description: string) {
    return this.timeTrackingService.stopTimer(id, description);
  }

  // Static routes must precede the `:id` routes below.
  @Get('active/:employeeId')
  @CheckAbilities({ action: Action.Read, subject: 'time_entry' })
  active(@Param('employeeId') employeeId: string) {
    return this.timeTrackingService.getActive(employeeId);
  }

  @Get('summary')
  @CheckAbilities({ action: Action.Read, subject: 'time_entry' })
  summary(@Query('employeeId') employeeId: string, @Request() req: any) {
    return this.timeTrackingService.summary({
      employeeId: employeeId || undefined,
      companyId: employeeId ? undefined : companyOf(req),
    });
  }

  @Get('team-summary')
  @CheckAbilities({ action: Action.Read, subject: 'time_entry' })
  teamSummary(@Query('companyId') companyId: string, @Request() req: any) {
    return this.timeTrackingService.teamSummary(companyId || companyOf(req) || '');
  }

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'time_entry' })
  findAll(
    @Query('employeeId') employeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
  ) {
    return this.timeTrackingService.findAll({
      employeeId: employeeId || undefined,
      companyId: employeeId ? undefined : companyOf(req),
      from: from || undefined,
      to: to || undefined,
    });
  }

  @Put(':id')
  @CheckAbilities({ action: Action.Update, subject: 'time_entry' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.timeTrackingService.update(id, data);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'time_entry' })
  remove(@Param('id') id: string) {
    return this.timeTrackingService.remove(id);
  }
}
