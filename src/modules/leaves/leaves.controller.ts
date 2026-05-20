import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  create(@Body() createLeaveDto: CreateLeaveDto) {
    return this.leavesService.create(createLeaveDto);
  }

  @Get()
  findAll(@Query() query: any, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    if (!isSuperAdmin && user?.company?.id) {
      query.companyId = user.company.id;
    }
    return this.leavesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leavesService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateLeaveStatusDto: UpdateLeaveStatusDto,
  ) {
    return this.leavesService.updateStatus(id, updateLeaveStatusDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLeaveDto: any) {
    return this.leavesService.update(id, updateLeaveDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leavesService.delete(id);
  }
}
