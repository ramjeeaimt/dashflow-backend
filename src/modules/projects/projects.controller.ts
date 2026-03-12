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
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';

@Controller('projects')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) { }

  // Clients
  @Post('clients')
  @CheckAbilities({ action: Action.Create, subject: 'client' })
  createClient(@Body() data: any) {
    return this.projectsService.createClient(data);
  }

  @Get('clients')
  @CheckAbilities({ action: Action.Read, subject: 'client' })
  findAllClients(@Query('companyId') companyId: string) {
    return this.projectsService.findAllClients(companyId);
  }

  // Projects
  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'project' })
  createProject(@Body() data: any) {
    return this.projectsService.createProject(data);
  }

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'project' })
  findAllProjects(@Query('companyId') companyId: string) {
    return this.projectsService.findAllProjects(companyId);
  }

  // Tasks (MUST be before parameterized `:id` routes to avoid swallowing)
  @Post('tasks')
  @CheckAbilities({ action: Action.Create, subject: 'task' })
  createTask(@Body() data: any) {
    return this.projectsService.createTask(data);
  }

  @Get('tasks/company')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  findAllTasksByCompany(@Query('companyId') companyId: string) {
    return this.projectsService.findAllTasksByCompany(companyId);
  }

  @Get('tasks')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  findAllTasks(@Query('projectId') projectId: string) {
    return this.projectsService.findAllTasks(projectId);
  }

  @Put('tasks/:id')
  @CheckAbilities({ action: Action.Update, subject: 'task' })
  updateTask(@Param('id') id: string, @Body() data: any) {
    return this.projectsService.updateTask(id, data);
  }

  // Parameterized project routes (AFTER static routes)
  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'project' })
  findOneProject(@Param('id') id: string) {
    return this.projectsService.findOneProject(id);
  }

  @Put(':id')
  @CheckAbilities({ action: Action.Update, subject: 'project' })
  updateProject(@Param('id') id: string, @Body() data: any) {
    return this.projectsService.updateProject(id, data);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'project' })
  deleteProject(@Param('id') id: string) {
    return this.projectsService.deleteProject(id);
  }
}
