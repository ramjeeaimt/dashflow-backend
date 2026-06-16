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

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'uuid', nullable: true })
  companyId: string;

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

  @Column({ type: 'float', default: 0 })
  basicSalary: number;

  @Column({ type: 'float', default: 0 })
  allowances: number;

  @Column({ type: 'float',  default: 0 })
  deductions: number;

  @Column({ type: 'float', default: 0 })
  leaveDeduction: number;

  @Column({ type: 'float', default: 0 })
  halfDeduction: number;

  @Column({ type: 'float', default: 0})
  netSalary: number;

  @Column()
  month: number;

  @Column()
  year: number;

  @Column({ type: 'int', default: 0 })
  totalWorkingDays: number;

  @Column({ type: 'float', default: 0 })
  workDays: number;

  @Column({ type: 'float', default: 0 })
  paidLeaves: number;

  @Column({ type: 'float', default: 0 })
  unpaidLeaves: number;

  @Column({ type: 'float', default: 0 })
  overtime: number;

  @Column({ type: 'int', default: 8 })
  workingHoursPerDay: number;

  @Column({ type: 'float', default: 100 })
  overtimeRate: number;

  @Column({ type: 'float', default: 4 })
  freeLeaves: number;

  @Column({ type: 'int', default: 50 })
  halfDayPercent: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  customPayslipHtml: string;

  @Column({ type: 'text', nullable: true })
  customEmailBodyHtml: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}