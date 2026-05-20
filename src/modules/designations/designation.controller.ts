import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DesignationService } from './designation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';

@Controller('designations')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class DesignationController {
  constructor(private readonly designationService: DesignationService) {}

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'designation' })
  create(@Body() data: any) {
    return this.designationService.create(data);
  }

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'designation' })
  findAll(@Query('companyId') companyId: string, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : companyId;
    return this.designationService.findAll(finalCompanyId);
  }

  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'designation' })
  findOne(@Param('id') id: string) {
    return this.designationService.findOne(id);
  }

  @Put(':id')
  @CheckAbilities({ action: Action.Update, subject: 'designation' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.designationService.update(id, data);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'designation' })
  remove(@Param('id') id: string) {
    return this.designationService.remove(id);
  }
}
