import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../access-control/ability.factory';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { AbilitiesGuard } from '../access-control/abilities.guard';

@Controller('employees')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) { }

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'employee' })
  async create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }


  @Post('sync-roles')
  @CheckAbilities({ action: Action.Update, subject: 'employee' })
  async syncRoles(@Body('companyId') companyId: string) {
    return this.employeeService.fixEmployeeRoles(companyId);
  }

  @Post('bulk-managers')
  @CheckAbilities({ action: Action.Update, subject: 'employee' })
  async bulkManagers(@Body('employeeIds') ids: string[]) {
    return this.employeeService.bulkAssignManagers(ids);
  }

  @Delete(':id/manager-role')
  @CheckAbilities({ action: Action.Update, subject: 'employee' })
  async revokeManager(@Param('id') id: string) {
    return this.employeeService.revokeManagerRole(id);
  }

  @Get('stats/count')
  @CheckAbilities({ action: Action.Read, subject: 'employee' })
  async getCount(@Query('companyId') companyId?: string) {
    const count = await this.employeeService.count(companyId);
    return { count };
  }

  @Get()
  async findAll(@Query() query: any, @Request() req: any) {
    const user = req.user;
    const canViewAll = user.roles?.some((role) =>
      ['super admin', 'admin', 'ceo', 'cfo', 'manager', 'hr'].includes(role.name.toLowerCase())
    );

    // If not admin/management, they can ONLY read their own record
    if (!canViewAll) {
      if (!query.userId || query.userId !== user.id) {
        throw new ForbiddenException('You can only access your own employee record.');
      }
    }

    const employees = await this.employeeService.findAll(query);
    return employees.map((emp) => this.transformEmployee(emp));
  }

  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'employee' })
  async findOne(@Param('id') id: string) {
    const employee = await this.employeeService.findOne(id);
    return employee ? this.transformEmployee(employee) : null;
  }

  @Put(':id')
  @CheckAbilities({ action: Action.Update, subject: 'employee' })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    const employee = await this.employeeService.update(id, updateEmployeeDto);
    return employee ? this.transformEmployee(employee) : null;
  }

  private transformEmployee(emp: any) {
    return {
      ...emp,
      user: emp.user
        ? {
          id: emp.user.id,
          email: emp.user.email,
          firstName: emp.user.firstName,
          lastName: emp.user.lastName,
          name: `${emp.user.firstName || ''} ${emp.user.lastName || ''}`.trim(),
          phone: emp.user.phone,
          isActive: emp.user.isActive,
          roles: emp.user.roles?.map((r) => ({
            id: r.id,
            name: r.name,
            permissions: r.permissions,
          })),
          permissions: emp.user.permissions,
        }
        : null,
      company: emp.company
        ? {
          id: emp.company.id,
          name: emp.company.name,
        }
        : null,
      department: emp.department
        ? {
          id: emp.department.id,
          name: emp.department.name,
        }
        : null,
      designation: emp.designation
        ? {
          id: emp.designation.id,
          name: emp.designation.name,
        }
        : null,
    };
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'employee' })
  async remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }
}
