import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { WFHRequestsService } from './wfh-requests.service';
import { CreateWFHRequestDto, UpdateWFHRequestStatusDto } from './dto/wfh-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wfh-requests')
@UseGuards(JwtAuthGuard)
export class WFHRequestsController {
  constructor(private readonly wfhRequestsService: WFHRequestsService) { }

  @Post()
  create(@Body() createDto: CreateWFHRequestDto) {
    return this.wfhRequestsService.create(createDto);
  }

  @Get()
  findAll(@Query() filters: any) {
    return this.wfhRequestsService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wfhRequestsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateDto: UpdateWFHRequestStatusDto) {
    return this.wfhRequestsService.updateStatus(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.wfhRequestsService.delete(id);
  }
}
