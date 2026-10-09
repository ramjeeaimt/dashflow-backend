import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Request,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  CheckInDto,
  CheckOutDto,
  CreateAttendanceDto,
  BulkCheckInDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../access-control/ability.factory';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { AbilitiesGuard } from '../access-control/abilities.guard';

@Controller('attendance')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }

  @Post('check-in')
  @CheckAbilities({ action: Action.Create, subject: 'attendance' })
  async checkIn(@Body() checkInDto: CheckInDto) {
    return this.attendanceService.checkIn(checkInDto);
  }

  @Post('bulk-check-in')
  @CheckAbilities({ action: Action.Create, subject: 'attendance' })
  async bulkCheckIn(@Body() bulkCheckInDto: BulkCheckInDto) {
    return this.attendanceService.bulkCheckIn(
      bulkCheckInDto.employeeIds,
      bulkCheckInDto.notes,
    );
  }

  @Post('check-out')
  @CheckAbilities({ action: Action.Update, subject: 'attendance' })
  async checkOut(@Body() checkOutDto: CheckOutDto) {
    return this.attendanceService.checkOut(checkOutDto);
  }

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'attendance' })
  async create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendanceService.create(createAttendanceDto);
  }

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'attendance' })
  async findAll(@Query() query: any) {
    return this.attendanceService.findAll(query);
  }

  @Get('today/:employeeId')
  @CheckAbilities({ action: Action.Read, subject: 'attendance' })
  async getTodayAttendance(@Param('employeeId') employeeId: string) {
    return this.attendanceService.getTodayAttendance(employeeId);
  }

  @Get('analytics')
  @CheckAbilities({ action: Action.Read, subject: 'attendance' })
  async getAnalytics(@Query() query: any) {
    return this.attendanceService.getAnalytics(query);
  }

  // Gap-free day-by-day timeline (weekends, leave and WFH included) for one
  // employee. Must stay above the `:id` route so it isn't swallowed by it.
  @Get('timeline/:employeeId')
  @CheckAbilities({ action: Action.Read, subject: 'attendance' })
  async getEmployeeTimeline(
    @Param('employeeId') employeeId: string,
    @Query() query: any,
  ) {
    return this.attendanceService.getEmployeeTimeline({
      employeeId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  //by id
  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'attendance' })
  async findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id/waive-late')
  @CheckAbilities({ action: Action.Update, subject: 'attendance' })
  async toggleWaiveLate(
    @Param('id') id: string,
    @Body() body: { waived: boolean; reason?: string },
    @Request() req: any,
  ) {
    const adminUser = req.user;
    const adminName = adminUser
      ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email
      : 'Admin';
    return this.attendanceService.toggleLateDeductionWaived(id, body.waived, adminName, body.reason);
  }

  @Post('waive-late-by-date')
  @CheckAbilities({ action: Action.Update, subject: 'attendance' })
  async waiveLateByDate(
    @Body() body: { employeeId: string; date: string; waived: boolean; reason?: string },
    @Request() req: any,
  ) {
    const adminUser = req.user;
    const adminName = adminUser
      ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email
      : 'Admin';
    return this.attendanceService.waiveLateByDate(
      body.employeeId,
      body.date,
      body.waived,
      adminName,
      body.reason,
    );
  }

  @Patch(':id')
  @CheckAbilities({ action: Action.Update, subject: 'attendance' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.attendanceService.update(id, data);
  }

  @Post('revoke/:employeeId')
  @CheckAbilities({ action: Action.Delete, subject: 'attendance' })
  async revoke(@Param('employeeId') employeeId: string) {
    return this.attendanceService.revoke(employeeId);
  }
}
