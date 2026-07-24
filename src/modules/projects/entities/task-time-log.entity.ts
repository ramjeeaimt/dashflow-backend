import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * A single block of time a member logged against a task. Totals are summed at
 * read time and compared against the task's estimatedHours, so tracked-vs-
 * estimated is always current without a stored running total to keep in sync.
 */
@Entity('task_time_logs')
export class TaskTimeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  taskId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  userName: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  hours: number;

  @Column({ nullable: true })
  note: string;

  // The day the work happened (may differ from when it was logged).
  @Column({ type: 'date', nullable: true })
  workDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
