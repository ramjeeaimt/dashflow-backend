import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A comment on a task. Author identity is denormalised (id + name + avatar) so
 * the discussion thread renders without joining back to users/employees — the
 * same pattern the rest of this module uses for read-heavy screens.
 */
@Entity('task_comments')
export class TaskComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  taskId: string;

  @Column({ nullable: true })
  authorId: string;

  @Column({ nullable: true })
  authorName: string;

  @Column({ nullable: true })
  authorAvatar: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
