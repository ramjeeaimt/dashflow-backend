import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Project } from './project.entity';
import { Employee } from '../../employees/employee.entity';
import { Company } from '../../companies/company.entity';

@Entity()
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'todo' })
  status: string; // todo, in-progress, review, done

  @Column({ default: 'medium' })
  priority: string; // low, medium, high, urgent

  @Column({ nullable: true })
  deadline: Date;

  // Start of the working window — lets the calendar draw multi-day bars and the
  // board flag tasks that should have begun but are still in todo.
  @Column({ type: 'date', nullable: true })
  startDate: Date;

  // 0–100. Kept explicit rather than derived from status so a task can be
  // "in-progress, 70%" — the granularity ClickUp-style tracking needs.
  @Column({ type: 'int', default: 0 })
  progress: number;

  // Manual ordering within a status column on the board (drag to reorder).
  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Estimate for planning; actuals roll up from TaskTimeLog at read time.
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  estimatedHours: number;

  // Self-reference for subtasks. Stored as a plain id (not a relation) to keep
  // the tree cheap to query — children are fetched by parentTaskId in one go.
  @Column({ nullable: true })
  parentTaskId: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // Denormalised creator identity so the activity log and "created by" never
  // require a join back to users.
  @Column({ nullable: true })
  createdById: string;

  @Column({ nullable: true })
  createdByName: string;

  @ManyToOne(() => Project, { nullable: true })
  project: Project;

  @Column({ nullable: true })
  projectId: string;

  @ManyToOne(() => Company)
  company: Company;

  @Column({ nullable: true })
  companyId: string;

  @ManyToOne(() => Employee, { nullable: true })
  assignee: Employee;

  @Column({ nullable: true })
  assigneeId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
