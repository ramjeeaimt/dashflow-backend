import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Company } from '../companies/company.entity';
import { Department } from '../departments/department.entity';
import { Designation } from '../designations/designation.entity';

@Entity()
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ unique: true, nullable: true })
  employeeCode: string;

  @ManyToOne(() => Company, (company) => company.users)
  company: Company;

  @Column({ nullable: true })
  companyId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn()
  department: Department;

  @Column({ nullable: true })
  departmentId: string;

  @ManyToOne(() => Designation, { nullable: true })
  @JoinColumn()
  designation: Designation;

  @Column({ nullable: true })
  designationId: string;

  @Column({ nullable: true })
  role: string;

  @Column({ type: 'date' })
  hireDate: Date;

  @Column({ nullable: true })
  salary: string;

  @Column({ nullable: true })
  manager: string;

  @Column({ nullable: true })
  branch: string;

  @Column({ default: 'full-time' })
  employmentType: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  emergencyContact: string;

  @Column({ nullable: true })
  emergencyPhone: string;

  @Column({ type: 'simple-array', nullable: true })
  skills: string[];

  // ✅ Soft delete fla

  @Column({ default: false })
  isDeleted: boolean

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
