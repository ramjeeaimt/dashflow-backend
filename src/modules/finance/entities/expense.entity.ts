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

@Entity()
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  category: string; // rent, utility, equipment, marketing, etc

  @Column({ default: 'debit' })
  type: string; // credit, debit

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'date' })
  date: Date;

  @ManyToOne(() => Company)
  company: Company;

  @Column()
  companyId: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn()
  employee: Employee;

  @Column({ nullable: true })
  employeeId: string;

  @Column({ default: 'pending' })
  status: string; // pending, approved, paid, rejected

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
