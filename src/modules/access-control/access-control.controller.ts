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
import { AbilitiesGuard } from './abilities.guard';
import { CheckAbilities } from './abilities.decorator';
import { Action } from './ability.factory';

// Roles & permissions are administrative data. Reads require `read access-control`
// and every mutation requires `manage access-control`; admins get both via the
// manage-all bypass. Plain employees have neither, so they are denied — this
// closes the hole where any authenticated user could read (and potentially
// create) roles and permissions.
@Controller('access-control')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) { }

  @Get('roles')
  @CheckAbilities({ action: Action.Read, subject: 'access-control' })
  async findAllRoles(@Query('companyId') companyId: string, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    const finalCompanyId = (!isSuperAdmin && user.company?.id) ? user.company.id : companyId;
    return this.accessControlService.findAllRoles(finalCompanyId);
  }

  @Get('roles/:id')
  @CheckAbilities({ action: Action.Read, subject: 'access-control' })
  async findOneRole(@Param('id') id: string) {
    return this.accessControlService.findOneRole(id);
  }

  @Post('roles')
  @CheckAbilities({ action: Action.Manage, subject: 'access-control' })
  async createRole(@Body() data: any) {
    return this.accessControlService.createRole(data);
  }

  @Put('roles/:id')
  @CheckAbilities({ action: Action.Manage, subject: 'access-control' })
  async updateRole(@Param('id') id: string, @Body() data: any) {
    return this.accessControlService.updateRole(id, data);
  }

  @Get('permissions')
  @CheckAbilities({ action: Action.Read, subject: 'access-control' })
  async findAllPermissions() {
    return this.accessControlService.findAllPermissions();
  }

  @Post('permissions')
  @CheckAbilities({ action: Action.Manage, subject: 'access-control' })
  async createPermission(@Body() data: any) {
    return this.accessControlService.createPermission(data);
  }

  @Post('seed')
  @CheckAbilities({ action: Action.Manage, subject: 'access-control' })
  async seed() {
    return this.accessControlService.seedDefaultPermissions();
  }

  @Delete('roles/:id')
  @CheckAbilities({ action: Action.Manage, subject: 'access-control' })
  async deleteRole(@Param('id') id: string) {
    return this.accessControlService.deleteRole(id);
  }
}
