import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Payroll } from '../finance/entities/payroll.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee)
  @JoinColumn()
  employee: Employee;

  @Column()
  employeeId: string;

  @OneToMany(() => Payroll, (payroll) => payroll.attendance)
  payrolls: Payroll[];

  // @Column()
  // companyId:String;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time', nullable: true })
  checkInTime: string;

  @Column({ type: 'time', nullable: true })
  checkOutTime: string;

  @Column({
    type: 'enum',
    enum: ['present', 'absent', 'leave', 'half-day', 'early_departure', 'late', 'early_checkin'],
    default: 'present'
  })
  
  status: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  workHours: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  overtime: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  location: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
