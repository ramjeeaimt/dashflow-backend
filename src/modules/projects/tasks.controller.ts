import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../access-control/abilities.guard';
import { CheckAbilities } from '../access-control/abilities.decorator';
import { Action } from '../access-control/ability.factory';

/**
 * Advanced task board API — list/kanban/calendar data, plus per-task detail,
 * comments, activity log and time tracking. Visibility and assignment are
 * enforced in the service from the resolved actor, so every handler threads
 * `req.user` through `resolveActor` first.
 */
@Controller('tasks')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async list(
    @Query('projectId') projectId: string,
    @Query('assigneeId') assigneeId: string,
    @Request() req: any,
  ) {
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.findTasks(actor, { projectId, assigneeId });
  }

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'task' })
  async create(@Body() data: any, @Request() req: any) {
    if (!data?.title || !String(data.title).trim()) {
      throw new BadRequestException('Task title is required.');
    }
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.createTask(data, actor);
  }

  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async detail(@Param('id') id: string, @Request() req: any) {
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.getTaskDetail(id, actor);
  }

  @Put(':id')
  @CheckAbilities({ action: Action.Update, subject: 'task' })
  async update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.updateTask(id, data, actor);
  }

  // Kanban drag: move a card to a column at a position.
  @Patch(':id/move')
  @CheckAbilities({ action: Action.Update, subject: 'task' })
  async move(
    @Param('id') id: string,
    @Body() body: { status: string; order: number },
    @Request() req: any,
  ) {
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.moveTask(id, body.status, body.order ?? 0, actor);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'task' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.deleteTask(id, actor);
  }

  @Get(':id/comments')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async comments(@Param('id') id: string) {
    return this.tasksService.getComments(id);
  }

  @Post(':id/comments')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async addComment(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    if (!body?.content || !String(body.content).trim()) {
      throw new BadRequestException('Comment cannot be empty.');
    }
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.addComment(id, body.content, actor);
  }

  @Get(':id/activity')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async activity(@Param('id') id: string) {
    return this.tasksService.getActivity(id);
  }

  @Get(':id/time-logs')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async timeLogs(@Param('id') id: string) {
    return this.tasksService.getTimeLogs(id);
  }

  @Post(':id/time-logs')
  @CheckAbilities({ action: Action.Read, subject: 'task' })
  async logTime(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    const actor = await this.tasksService.resolveActor(req.user);
    return this.tasksService.logTime(id, data, actor);
  }
}
