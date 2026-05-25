import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';

@Entity()
export class OvertimeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee)
  employee: Employee;

  @Column()
  employeeId: string;

  @Column({ type: 'date' })
  date: string; // Date of overtime work

  @Column('int')
  hours: number;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ nullable: true })
  approvedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
