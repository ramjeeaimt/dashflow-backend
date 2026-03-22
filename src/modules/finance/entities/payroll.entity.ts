import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/company.entity';
import { Employee } from '../../employees/employee.entity';
import { Attendance } from '../../attendance/attendance.entity';
@Entity()
export class Payroll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Attendance, (attendance) => attendance.payrolls, {
    nullable: true,
  })
  @JoinColumn({ name: 'attendanceId' })
  attendance: Attendance;

  @Column({ type: 'uuid', nullable: true })
  attendanceId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basicSalary: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  allowances: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deductions: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netSalary: number;

  @Column()
  month: number;

  @Column()
  year: number;

  @Column({ type: 'int', default: 8 })
  workingHoursPerDay: number;

  @Column({ type: 'int', default: 100 })
  overtimeRate: number;

  @Column({ type: 'int', default: 4 })
  freeLeaves: number;

  @Column({ type: 'int', default: 50 })
  halfDayPercent: number;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}