import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskActivity } from './entities/task-activity.entity';
import { TaskTimeLog } from './entities/task-time-log.entity';
import { Employee } from '../employees/employee.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployeeModule } from '../employees/employee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      Project,
      Task,
      TaskComment,
      TaskActivity,
      TaskTimeLog,
      Employee,
    ]),
    AccessControlModule,
    NotificationsModule,
    EmployeeModule,
  ],
  providers: [ProjectsService, TasksService],
  controllers: [ProjectsController, TasksController],
  exports: [ProjectsService, TasksService],
})
export class ProjectsModule { }

