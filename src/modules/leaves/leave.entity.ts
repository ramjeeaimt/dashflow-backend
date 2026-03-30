import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { IsOptional, IsString } from 'class-validator';

@Entity()
export class Leave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // @ManyToOne(() => Employee)
  // @JoinColumn()
  // employee: Employee;

  // @Column()
  // employeeId: string;

  // Is line ko update karo -> @JoinColumn({ name: 'employeeId' })
  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  employeeId: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column()
  reason: string;

  @Column({ default: 'pending' }) // pending, approved, rejected
  status: string;

  @Column()
  type: string; // sick, casual, earned, etc.

  @IsString()
  @IsOptional()
  adminComment?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
