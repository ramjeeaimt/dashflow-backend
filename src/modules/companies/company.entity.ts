import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Department } from '../departments/department.entity';

@Entity()
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  size: string; // e.g., '1-10', '11-50'

  @Column({ nullable: true })
  logo: string; // URL

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ nullable: true })
  currency: string;

  @Column('simple-json', { nullable: true })
  workingDays: string[]; // e.g., ['Monday', 'Tuesday']

  @Column({ nullable: true })
  workingHoursStart: string; // e.g., '09:00 AM'

  @Column({ nullable: true })
  workingHoursEnd: string; // e.g., '05:00 PM'

  @Column({ default: false })
  enableTimeTracking: boolean;

  @Column({ default: false })
  enableScreenMonitoring: boolean;

  @Column({ default: false })
  enablePayroll: boolean;

  @Column({ nullable: true })
  openingTime: string; // HH:mm format

  @Column({ nullable: true })
  closingTime: string; // HH:mm format

  @Column({ default: 'active' })
  status: string; // active, blocked

  @Column({ default: false })
  isDeleted: boolean;

  @OneToMany(() => User, (user) => user.company)
  users: User[];

  @OneToMany(() => Department, (department) => department.company)
  departments: Department[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
