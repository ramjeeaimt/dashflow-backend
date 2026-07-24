import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskActivity } from './entities/task-activity.entity';
import { TaskTimeLog } from './entities/task-time-log.entity';
import { Project } from './entities/project.entity';
import { Employee } from '../employees/employee.entity';
import { EmployeeService } from '../employees/employee.service';
import { NotificationsService } from '../notifications/notifications.service';

const PRIVILEGED_ROLES = new Set([
  'admin',
  'super admin',
  'owner',
  'manager',
  'cto',
  'hr',
]);

const STATUSES = ['todo', 'in-progress', 'review', 'done'];

/** Fields a value-change on which is worth an activity-log entry, with labels. */
const TRACKED_FIELDS: Record<string, string> = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  progress: 'progress',
  deadline: 'due date',
  startDate: 'start date',
  assigneeId: 'assignee',
  projectId: 'project',
  estimatedHours: 'estimate',
  tags: 'tags',
};

/**
 * The identity acting on a task, resolved once per request from `req.user`.
 * `employeeId` links the user to their employee row (used for "assigned to me"
 * visibility); `privileged` gates seeing/assigning across the whole company.
 */
export interface TaskActor {
  userId: string;
  name: string;
  companyId: string;
  employeeId: string | null;
  privileged: boolean;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskComment)
    private readonly commentRepository: Repository<TaskComment>,
    @InjectRepository(TaskActivity)
    private readonly activityRepository: Repository<TaskActivity>,
    @InjectRepository(TaskTimeLog)
    private readonly timeLogRepository: Repository<TaskTimeLog>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly employeeService: EmployeeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---- actor resolution ---------------------------------------------------

  async resolveActor(user: any): Promise<TaskActor> {
    const roleNames: string[] = (user?.roles || []).map((r: any) =>
      String(r?.name || r).toLowerCase(),
    );
    const privileged = roleNames.some((r) => PRIVILEGED_ROLES.has(r));

    let employeeId: string | null = null;
    try {
      const employee = await this.employeeService.findByUserId(user.id);
      employeeId = employee?.id || null;
    } catch {
      employeeId = null;
    }

    return {
      userId: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      companyId: user.company?.id,
      employeeId,
      privileged,
    };
  }

  // ---- reads --------------------------------------------------------------

  async findTasks(
    actor: TaskActor,
    filters: { projectId?: string; assigneeId?: string } = {},
  ): Promise<any[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('assignee.user', 'assigneeUser')
      .leftJoinAndSelect('task.project', 'project')
      .where('task.companyId = :companyId', { companyId: actor.companyId })
      .orderBy('task.order', 'ASC')
      .addOrderBy('task.createdAt', 'DESC');

    if (filters.projectId) {
      query.andWhere('task.projectId = :projectId', { projectId: filters.projectId });
    }
    if (filters.assigneeId) {
      query.andWhere('task.assigneeId = :assigneeId', { assigneeId: filters.assigneeId });
    }

    // Non-privileged users only see tasks they own, are assigned, or that sit in
    // a project they're a member of.
    if (!actor.privileged) {
      const projectIds = await this.projectIdsForEmployee(actor.employeeId, actor.companyId);
      query.andWhere(
        '(task.assigneeId = :empId OR task.createdById = :userId' +
          (projectIds.length ? ' OR task.projectId IN (:...projectIds)' : '') +
          ')',
        {
          empId: actor.employeeId || '00000000-0000-0000-0000-000000000000',
          userId: actor.userId,
          ...(projectIds.length ? { projectIds } : {}),
        },
      );
    }

    const tasks = await query.getMany();
    return this.decorateMany(tasks);
  }

  async getTaskDetail(id: string, actor: TaskActor): Promise<any> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee', 'assignee.user', 'project'],
    });
    if (!task || task.companyId !== actor.companyId) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanView(task, actor);

    const [subtasks, comments, activity, timeLogs] = await Promise.all([
      this.taskRepository.find({
        where: { parentTaskId: id },
        relations: ['assignee', 'assignee.user'],
        order: { order: 'ASC', createdAt: 'ASC' },
      }),
      this.commentRepository.find({ where: { taskId: id }, order: { createdAt: 'ASC' } }),
      this.activityRepository.find({ where: { taskId: id }, order: { createdAt: 'DESC' } }),
      this.timeLogRepository.find({ where: { taskId: id }, order: { createdAt: 'DESC' } }),
    ]);

    return {
      ...this.decorate(task, {
        subtaskCount: subtasks.length,
        subtaskDone: subtasks.filter((s) => s.status === 'done').length,
        commentCount: comments.length,
        timeLogged: this.sumHours(timeLogs),
      }),
      subtasks: this.decorateMany(subtasks),
      comments,
      activity,
      timeLogs: timeLogs.map((t) => ({ ...t, hours: Number(t.hours) })),
    };
  }

  async getComments(id: string): Promise<TaskComment[]> {
    return this.commentRepository.find({ where: { taskId: id }, order: { createdAt: 'ASC' } });
  }

  async getActivity(id: string): Promise<TaskActivity[]> {
    return this.activityRepository.find({ where: { taskId: id }, order: { createdAt: 'DESC' } });
  }

  async getTimeLogs(id: string): Promise<any[]> {
    const logs = await this.timeLogRepository.find({
      where: { taskId: id },
      order: { createdAt: 'DESC' },
    });
    return logs.map((t) => ({ ...t, hours: Number(t.hours) }));
  }

  // ---- writes -------------------------------------------------------------

  async createTask(data: any, actor: TaskActor): Promise<any> {
    const status = STATUSES.includes(data.status) ? data.status : 'todo';

    // New tasks land at the top of their column.
    const minOrder = await this.taskRepository
      .createQueryBuilder('task')
      .select('MIN(task.order)', 'min')
      .where('task.companyId = :companyId AND task.status = :status', {
        companyId: actor.companyId,
        status,
      })
      .getRawOne();

    const task = this.taskRepository.create(<Task><any>{
      title: data.title,
      description: data.description || null,
      status,
      priority: data.priority || 'medium',
      progress: this.clampProgress(data.progress, status),
      deadline: this.parseDate(data.deadline ?? data.dueDate),
      startDate: this.parseDate(data.startDate),
      estimatedHours: data.estimatedHours != null ? Number(data.estimatedHours) : null,
      tags: this.parseTags(data.tags),
      projectId: data.projectId || null,
      assigneeId: data.assigneeId || null,
      parentTaskId: data.parentTaskId || null,
      companyId: actor.companyId,
      order: (minOrder?.min ?? 0) - 1,
      createdById: actor.userId,
      createdByName: actor.name,
      completedAt: status === 'done' ? new Date() : null,
    });

    const saved = await this.taskRepository.save(task);

    await this.log(saved.id, 'created', actor, `created this task`);
    if (saved.parentTaskId) {
      await this.log(saved.parentTaskId, 'subtask_added', actor, `added subtask "${saved.title}"`);
    }
    if (saved.assigneeId) {
      await this.log(
        saved.id,
        'assigned',
        actor,
        `assigned to ${await this.employeeName(saved.assigneeId)}`,
      );
      this.notifyAssignee(saved, actor).catch(() => undefined);
    }

    return this.getTaskDetail(saved.id, actor);
  }

  async updateTask(id: string, data: any, actor: TaskActor): Promise<any> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task || task.companyId !== actor.companyId) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanView(task, actor);

    // Normalise incoming values against the entity's own types.
    const incoming: Record<string, any> = {};
    if (data.title !== undefined) incoming.title = data.title;
    if (data.description !== undefined) incoming.description = data.description;
    if (data.status !== undefined && STATUSES.includes(data.status)) incoming.status = data.status;
    if (data.priority !== undefined) incoming.priority = data.priority;
    if (data.progress !== undefined) incoming.progress = this.clampProgress(data.progress, data.status ?? task.status);
    if (data.deadline !== undefined || data.dueDate !== undefined)
      incoming.deadline = this.parseDate(data.deadline ?? data.dueDate);
    if (data.startDate !== undefined) incoming.startDate = this.parseDate(data.startDate);
    if (data.estimatedHours !== undefined)
      incoming.estimatedHours = data.estimatedHours != null ? Number(data.estimatedHours) : null;
    if (data.tags !== undefined) incoming.tags = this.parseTags(data.tags);
    if (data.assigneeId !== undefined) incoming.assigneeId = data.assigneeId || null;
    if (data.projectId !== undefined) incoming.projectId = data.projectId || null;
    if (data.order !== undefined) incoming.order = Number(data.order);

    // Moving into / out of "done" keeps completedAt and progress coherent.
    if (incoming.status && incoming.status !== task.status) {
      if (incoming.status === 'done') {
        incoming.completedAt = new Date();
        if (incoming.progress === undefined) incoming.progress = 100;
      } else if (task.status === 'done') {
        incoming.completedAt = null;
      }
    }

    const changes = this.diff(task, incoming);
    Object.assign(task, incoming);
    const saved = await this.taskRepository.save(task);

    // One activity row per meaningful change, with resolved labels.
    for (const change of changes) {
      if (change.field === 'status') {
        const done = change.to === 'done';
        await this.log(
          id,
          done ? 'completed' : change.from === 'done' ? 'reopened' : 'status_changed',
          actor,
          `moved status from ${this.label('status', change.from)} to ${this.label('status', change.to)}`,
          { field: 'status', fromValue: change.from, toValue: change.to },
        );
      } else if (change.field === 'assigneeId') {
        const toName = change.to ? await this.employeeName(change.to) : 'unassigned';
        const fromName = change.from ? await this.employeeName(change.from) : 'unassigned';
        await this.log(id, 'assigned', actor, `reassigned from ${fromName} to ${toName}`, {
          field: 'assignee',
          fromValue: fromName,
          toValue: toName,
        });
        if (change.to) this.notifyAssignee(saved, actor).catch(() => undefined);
      } else {
        await this.log(
          id,
          'updated',
          actor,
          `changed ${TRACKED_FIELDS[change.field] || change.field} from ${this.short(change.from)} to ${this.short(change.to)}`,
          { field: change.field, fromValue: this.short(change.from), toValue: this.short(change.to) },
        );
      }
    }

    return this.getTaskDetail(id, actor);
  }

  /** Lightweight reorder/move used by kanban drag — one status/order write, one log line. */
  async moveTask(id: string, status: string, order: number, actor: TaskActor): Promise<any> {
    return this.updateTask(id, { status, order }, actor);
  }

  async deleteTask(id: string, actor: TaskActor): Promise<{ success: boolean }> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task || task.companyId !== actor.companyId) {
      throw new NotFoundException('Task not found');
    }
    if (!actor.privileged && task.createdById !== actor.userId) {
      throw new ForbiddenException('You can only delete tasks you created.');
    }

    // Cascade to children and the task's own sidecar rows.
    const subtasks = await this.taskRepository.find({ where: { parentTaskId: id } });
    const ids = [id, ...subtasks.map((s) => s.id)];
    await this.commentRepository.delete({ taskId: In(ids) });
    await this.activityRepository.delete({ taskId: In(ids) });
    await this.timeLogRepository.delete({ taskId: In(ids) });
    await this.taskRepository.delete({ id: In(ids) });

    return { success: true };
  }

  async addComment(id: string, content: string, actor: TaskActor): Promise<TaskComment> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task || task.companyId !== actor.companyId) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanView(task, actor);

    const comment = await this.commentRepository.save(
      this.commentRepository.create(<TaskComment><any>{
        taskId: id,
        authorId: actor.userId,
        authorName: actor.name,
        content: content.trim(),
      }),
    );

    await this.log(id, 'commented', actor, `commented: "${this.truncate(content, 80)}"`);

    // Ping the assignee when someone else comments on their task.
    if (task.assigneeId) {
      this.notifyAssignee(task, actor, `${actor.name} commented on "${task.title}"`).catch(
        () => undefined,
      );
    }

    return comment;
  }

  async logTime(id: string, data: any, actor: TaskActor): Promise<any> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task || task.companyId !== actor.companyId) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanView(task, actor);

    const hours = Number(data.hours);
    if (!hours || hours <= 0) {
      throw new ForbiddenException('Logged hours must be a positive number.');
    }

    const log = await this.timeLogRepository.save(
      this.timeLogRepository.create(<TaskTimeLog><any>{
        taskId: id,
        userId: actor.userId,
        userName: actor.name,
        hours,
        note: data.note || null,
        workDate: data.workDate || new Date().toLocaleDateString('en-CA'),
      }),
    );

    await this.log(id, 'time_logged', actor, `logged ${hours}h${data.note ? ` — ${this.truncate(data.note, 60)}` : ''}`);

    return { ...log, hours: Number(log.hours) };
  }

  // ---- visibility helpers -------------------------------------------------

  private async projectIdsForEmployee(
    employeeId: string | null,
    companyId: string,
  ): Promise<string[]> {
    if (!employeeId) return [];
    const projects = await this.projectRepository.find({ where: { companyId } });
    return projects
      .filter((p) => {
        const people = Array.isArray(p.assignedPeople)
          ? p.assignedPeople
          : String(p.assignedPeople || '')
              .replace(/[{}"]/g, '')
              .split(',');
        return people.map((x) => String(x).trim()).includes(employeeId);
      })
      .map((p) => p.id);
  }

  private async assertCanView(task: Task, actor: TaskActor): Promise<void> {
    if (actor.privileged) return;
    if (task.assigneeId && task.assigneeId === actor.employeeId) return;
    if (task.createdById === actor.userId) return;
    if (task.projectId) {
      const projectIds = await this.projectIdsForEmployee(actor.employeeId, actor.companyId);
      if (projectIds.includes(task.projectId)) return;
    }
    throw new ForbiddenException('You do not have access to this task.');
  }

  // ---- decoration / rollups ----------------------------------------------

  private decorateMany(tasks: Task[]): any[] {
    return tasks.map((t) => this.decorate(t));
  }

  private decorate(task: Task, extra: Record<string, any> = {}): any {
    const deadline = task.deadline ? new Date(task.deadline) : null;
    const isDone = task.status === 'done';
    let daysRemaining: number | null = null;
    if (deadline && !Number.isNaN(deadline.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(deadline);
      d.setHours(0, 0, 0, 0);
      daysRemaining = Math.round((d.getTime() - today.getTime()) / 86400000);
    }
    const isOverdue = !isDone && daysRemaining !== null && daysRemaining < 0;

    return {
      ...task,
      estimatedHours: task.estimatedHours != null ? Number(task.estimatedHours) : null,
      progress: task.progress ?? 0,
      assigneeName: task.assignee?.user
        ? `${task.assignee.user.firstName || ''} ${task.assignee.user.lastName || ''}`.trim()
        : null,
      assigneeAvatar: task.assignee?.avatar || null,
      projectName: task.project?.projectName || null,
      daysRemaining,
      isOverdue,
      ...extra,
    };
  }

  private sumHours(logs: TaskTimeLog[]): number {
    return Math.round(logs.reduce((s, l) => s + Number(l.hours || 0), 0) * 100) / 100;
  }

  // ---- activity logging ---------------------------------------------------

  private async log(
    taskId: string,
    type: string,
    actor: TaskActor,
    message: string,
    extra: { field?: string; fromValue?: string; toValue?: string } = {},
  ): Promise<void> {
    try {
      await this.activityRepository.save(
        this.activityRepository.create(<TaskActivity><any>{
          taskId,
          type,
          actorId: actor.userId,
          actorName: actor.name,
          message,
          field: extra.field || null,
          fromValue: extra.fromValue ?? null,
          toValue: extra.toValue ?? null,
        }),
      );
    } catch (err) {
      // Logging must never break the operation it records.
      console.error('[TasksService] Failed to write activity:', err?.message);
    }
  }

  private diff(
    current: Task,
    incoming: Record<string, any>,
  ): { field: string; from: any; to: any }[] {
    const changes: { field: string; from: any; to: any }[] = [];
    for (const field of Object.keys(incoming)) {
      if (!(field in TRACKED_FIELDS)) continue;
      const before = (current as any)[field];
      const after = (incoming as any)[field];
      const norm = (v: any) =>
        v == null ? '' : Array.isArray(v) ? v.join(',') : v instanceof Date ? v.toISOString() : String(v);
      if (norm(before) !== norm(after)) changes.push({ field, from: before, to: after });
    }
    return changes;
  }

  // ---- small utilities ----------------------------------------------------

  private async employeeName(employeeId: string): Promise<string> {
    const emp = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: ['user'],
    });
    return emp?.user ? `${emp.user.firstName || ''} ${emp.user.lastName || ''}`.trim() : 'someone';
  }

  private async notifyAssignee(task: Task, actor: TaskActor, message?: string): Promise<void> {
    const emp = await this.employeeRepository.findOne({
      where: { id: task.assigneeId },
      relations: ['user'],
    });
    if (!emp?.userId || emp.userId === actor.userId) return;
    await this.notificationsService.send({
      title: message ? 'Task update' : 'New task assigned',
      message: message || `You were assigned "${task.title}".`,
      type: 'both',
      recipientFilter: 'custom',
      recipientIds: [emp.userId],
      companyId: task.companyId,
      metadata: { type: 'TASK_ASSIGNED', taskId: task.id },
    });
  }

  private clampProgress(value: any, status: string): number {
    if (status === 'done') return 100;
    const n = Math.round(Number(value));
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private parseTags(value: any): string[] | null {
    if (!value) return null;
    const arr = Array.isArray(value) ? value : String(value).split(',');
    const clean = arr.map((t) => String(t).trim()).filter(Boolean);
    return clean.length ? clean : null;
  }

  private label(field: string, value: any): string {
    if (field === 'status') {
      const map: Record<string, string> = {
        todo: 'To do',
        'in-progress': 'In progress',
        review: 'In review',
        done: 'Done',
      };
      return map[value] || value || '—';
    }
    return value ?? '—';
  }

  private short(value: any): string {
    if (value == null || value === '') return '—';
    if (value instanceof Date) return value.toLocaleDateString('en-CA');
    if (Array.isArray(value)) return value.join(', ') || '—';
    return this.truncate(String(value), 40);
  }

  private truncate(text: string, max: number): string {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }
}
