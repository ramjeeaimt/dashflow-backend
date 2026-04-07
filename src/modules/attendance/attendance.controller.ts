import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
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
//by id
  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'attendance' })
  async findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }
}
