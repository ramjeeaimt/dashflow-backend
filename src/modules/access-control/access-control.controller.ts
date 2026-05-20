import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('access-control')
@UseGuards(JwtAuthGuard)
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) { }

  @Get('roles')
  async findAllRoles(@Query('companyId') companyId: string, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : companyId;
    return this.accessControlService.findAllRoles(finalCompanyId);
  }

  @Get('roles/:id')
  async findOneRole(@Param('id') id: string) {
    return this.accessControlService.findOneRole(id);
  }

  @Post('roles')
  async createRole(@Body() data: any) {
    return this.accessControlService.createRole(data);
  }

  @Put('roles/:id')
  async updateRole(@Param('id') id: string, @Body() data: any) {
    return this.accessControlService.updateRole(id, data);
  }

  @Get('permissions')
  async findAllPermissions() {
    return this.accessControlService.findAllPermissions();
  }

  @Post('permissions')
  async createPermission(@Body() data: any) {
    return this.accessControlService.createPermission(data);
  }

  @Post('seed')
  async seed() {
    return this.accessControlService.seedDefaultPermissions();
  }

  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    return this.accessControlService.deleteRole(id);
  }
}
