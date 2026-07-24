import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * One immutable entry in a task's history — "who did what, when".
 *
 * Every create, field change, comment, status move and time log writes a row
 * here, so the detail screen can show a complete audit trail. `field`, `from`
 * and `to` are populated for value changes; `type` classifies the entry so the
 * UI can pick an icon and phrasing without parsing free text.
 */
@Entity('task_activities')
export class TaskActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  taskId: string;

  // created | updated | status_changed | assigned | commented |
  // time_logged | completed | reopened | subtask_added | deleted
  @Column()
  type: string;

  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorName: string;

  // Human-readable summary, e.g. "changed priority from medium to high".
  @Column('text', { nullable: true })
  message: string;

  @Column({ nullable: true })
  field: string;

  @Column('text', { nullable: true })
  fromValue: string;

  @Column('text', { nullable: true })
  toValue: string;

  @CreateDateColumn()
  createdAt: Date;
}
