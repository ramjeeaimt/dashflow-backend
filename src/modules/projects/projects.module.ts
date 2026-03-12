import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Project, Task]),
    AccessControlModule
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule { }

