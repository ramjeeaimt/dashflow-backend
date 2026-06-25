import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Employee } from '../employees/employee.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly notificationsService: NotificationsService,
  ) { }

  // Clients
  async createClient(data: Partial<Client>): Promise<Client> {
    return this.clientRepository.save(this.clientRepository.create(data));
  }

  async findAllClients(companyId: string): Promise<Client[]> {
    return this.clientRepository.find({ where: { companyId } });
  }

  // Projects
  async createProject(data: Partial<Project>): Promise<Project> {
    // Sanitize dates: convert empty strings to null/undefined
    if ((data as any).assigningDate === '' || (typeof data.assigningDate === 'string' && (data.assigningDate as string).trim() === '')) {
      data.assigningDate = undefined;
    }
    if ((data as any).deadline === '' || (typeof data.deadline === 'string' && (data.deadline as string).trim() === '')) {
      data.deadline = undefined;
    }
    if ((data as any)['assignedEmployeeIds'] && Array.isArray((data as any)['assignedEmployeeIds'])) {
      data.assignedPeople = (data as any)['assignedEmployeeIds'];
    }

    if (Array.isArray(data.assignedPeople)) {
      data.assignedPeople = (data.assignedPeople as string[]).join(',') as any;
    }

    const project = await this.projectRepository.save(this.projectRepository.create(data));

    // Notify Admins about the project creation (run in background)
    this.resolveEmployeeNames(project.assignedPeople).then(assignedNames => {
      this.notificationsService.send({
        title: 'Difmo Pvt Ltd: New Project Created',
        message: `A new project has been created: ${project.projectName}.`,
        type: 'both',
        recipientFilter: 'admin',
        companyId: project.companyId,
        metadata: {
          type: 'PROJECT_CREATED',
          projectId: project.id,
          projectName: project.projectName,
          deadline: project.deadline,
          project: { ...project, assignedPeople: assignedNames }
        }
      }).catch(err => {
        console.error('[ProjectsService] Failed to notify admins of project creation:', err.message);
      });
    });

    // Send notifications to assigned employees
    if (project.assignedPeople && project.assignedPeople.length > 0) {
      try {
        const employees = await this.employeeRepository.find({
          where: { id: In(project.assignedPeople) },
          relations: ['user']
        });

        const recipientIds = employees.map(emp => emp.userId).filter(Boolean);
        const recipientEmails = employees.map(emp => emp.user?.email).filter(Boolean);

        if (recipientIds.length > 0) {
          await this.notificationsService.send({
            title: 'Difmo Pvt Ltd: New Project Assignment',
            message: `You have been assigned to a new project: ${project.projectName}.`,
            type: 'both',
            recipientFilter: 'custom',
            recipientIds,
            recipientEmails,
            companyId: project.companyId,
            metadata: {
              type: 'PROJECT_ASSIGNED',
              projectId: project.id,
              projectName: project.projectName,
              deadline: project.deadline
            }
          });
        }
      } catch (err) {
        console.error('[ProjectsService] Failed to notify assigned employees:', err.message);
      }
    }

    return project;
  }

  async findAllProjects(companyId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { companyId },
      relations: ['client'],
    });
  }

  async findOneProject(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id },
      relations: ['client'],
    });
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
    try {
      const updateData: any = {};
      const columnNames = this.projectRepository.metadata.columns.map(c => c.propertyName);
      
      for (const key of Object.keys(data)) {
        if (columnNames.includes(key) && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
          updateData[key] = (data as any)[key];
        }
      }

      // Sanitize dates
      if (updateData.assigningDate === '' || (typeof updateData.assigningDate === 'string' && updateData.assigningDate.trim() === '')) {
        updateData.assigningDate = null;
      }
      if (updateData.deadline === '' || (typeof updateData.deadline === 'string' && updateData.deadline.trim() === '')) {
        updateData.deadline = null;
      }

      // Map frontend assignedEmployeeIds to assignedPeople if provided
      if (data['assignedEmployeeIds'] && Array.isArray(data['assignedEmployeeIds'])) {
        updateData.assignedPeople = data['assignedEmployeeIds'];
      }

      // Fetch old project to compare changes
      const oldProject = await this.findOneProject(id);
      const updatedFields: { field: string; oldValue: any; newValue: any }[] = [];

      if (oldProject) {
        for (const key of Object.keys(updateData)) {
          let oldVal = (oldProject as any)[key];
          let newVal = updateData[key];

          // Handle simple-array comparison (assignedPeople)
          if (key === 'assignedPeople') {
            const oldArr = Array.isArray(oldVal) ? oldVal.join(',') : (oldVal || '');
            const newArr = Array.isArray(newVal) ? newVal.join(',') : (newVal || '');
            if (oldArr !== newArr) {
              updatedFields.push({ field: key, oldValue: oldArr, newValue: newArr });
            }
          } else {
            const normalizedOld = (oldVal === null || oldVal === undefined) ? '' : String(oldVal);
            const normalizedNew = (newVal === null || newVal === undefined) ? '' : String(newVal);
            if (normalizedOld !== normalizedNew) {
              updatedFields.push({ field: key, oldValue: oldVal, newValue: newVal });
            }
          }
        }
      }

      // TypeORM update() does not apply transformers, so simple-arrays must be joined manually
      if (Array.isArray(updateData.assignedPeople)) {
        updateData.assignedPeople = updateData.assignedPeople.join(',');
      }

      if (Object.keys(updateData).length > 0) {
        await this.projectRepository.update(id, updateData);
      }
      
      const updatedProject = await this.findOneProject(id);

      if (updatedProject && updatedFields.length > 0) {
        // 1. Notify Admins about the project update with changed fields (run in background)
        Promise.all([
          this.resolveEmployeeNames(oldProject?.assignedPeople),
          this.resolveEmployeeNames(updatedProject.assignedPeople)
        ]).then(([oldAssignedNames, newAssignedNames]) => {
          
          const assignedField = updatedFields.find(f => f.field === 'assignedPeople');
          if (assignedField) {
            assignedField.oldValue = oldAssignedNames || 'none';
            assignedField.newValue = newAssignedNames || 'none';
          }

          this.notificationsService.send({
            title: 'Difmo Pvt Ltd: Project Updated',
            message: `The project "${updatedProject.projectName}" has been updated.`,
            type: 'both',
            recipientFilter: 'admin',
            companyId: updatedProject.companyId,
            metadata: {
              type: 'PROJECT_UPDATED',
              projectId: updatedProject.id,
              projectName: updatedProject.projectName,
              updatedFields: updatedFields,
              project: { ...updatedProject, assignedPeople: newAssignedNames }
            }
          }).catch(err => {
            console.error('[ProjectsService] Failed to notify admins of project update:', err.message);
          });
        });
      }

      return updatedProject;
    } catch (error) {
      console.error('[ProjectsService.updateProject] Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    await this.projectRepository.delete(id);
  }

  // Tasks
  async createTask(data: any): Promise<Task> {
    const taskData = {
      ...data,
      deadline: data.dueDate ? new Date(data.dueDate) : undefined,
    };
    const newTask = this.taskRepository.create(taskData);
    const savedTask = await this.taskRepository.save(newTask) as any;

    // 🔥 Real-time Notification for Task Assignment
    if (savedTask.assigneeId) {
      try {
        // We need to fetch the employee to get the userId for notification
        const assignee = await this.employeeRepository.findOne({
          where: { id: savedTask.assigneeId },
          relations: ['user']
        });

        if (assignee?.userId) {
          await this.notificationsService.send({
            title: 'Difmo Pvt Ltd: New Task Assigned',
            message: `You have been assigned a new task: ${savedTask.title}. Priority: ${savedTask.priority}.`,
            type: 'both',
            recipientFilter: 'employees',
            recipientIds: [assignee.userId],
            companyId: savedTask.companyId || (assignee.companyId),
            metadata: {
              type: 'TASK_ASSIGNED',
              taskId: savedTask.id,
              projectId: savedTask.projectId,
              priority: savedTask.priority
            }
          });
        }
      } catch (err) {
        console.error('[ProjectsService] Failed to notify assignee:', err.message);
      }
    }

    return savedTask;
  }

  async findAllTasks(projectId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { projectId },
      relations: ['assignee', 'assignee.user'],
    });
  }

  async findAllTasksByCompany(companyId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: [
        { companyId },
        { project: { companyId } }
      ],
      relations: ['assignee', 'assignee.user', 'project'],
      order: { createdAt: 'DESC' }
    });
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
    await this.taskRepository.update(id, data);
    return this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });
  }
  async resolveEmployeeNames(assignedPeople: any): Promise<string> {
    try {
      if (!assignedPeople) return '';
      
      let ids: string[] = [];
      if (Array.isArray(assignedPeople)) {
        ids = assignedPeople;
      } else if (typeof assignedPeople === 'string') {
        ids = assignedPeople.split(',').map(id => id.trim()).filter(id => id);
      }

      if (ids.length === 0) return '';

      const employees = await this.employeeRepository.find({
        where: { id: In(ids) },
        select: ['id', 'user'],
        relations: ['user']
      });

      return employees.map(emp => emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : 'Unknown Employee').join(', ');
    } catch (err) {
      console.error('[ProjectsService] Error resolving employee names:', err.message);
      return Array.isArray(assignedPeople) ? assignedPeople.join(', ') : String(assignedPeople);
    }
  }
}
