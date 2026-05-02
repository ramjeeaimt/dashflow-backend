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

  // ── Attendance Policy ──────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  lateThresholdMinutes: number; // minutes after openingTime before marked late

  @Column({ type: 'int', default: 60 })
  earlyCheckInBuffer: number; // minutes before openingTime check-in is allowed

  @Column({ type: 'int', default: 240 })
  checkInCutoffMinutes: number; // minutes after openingTime after which check-in is blocked

  @Column({ type: 'int', default: 4 })
  halfDayMinHours: number; // hours worked that constitutes a half-day

  @Column({ type: 'int', default: 50 })
  halfDayPayPercent: number; // pay % for a half-day (affects payroll)

  @Column({ default: true })
  enableLateEmailAlert: boolean; // send warning email on late check-in

  // ── Reward System ──────────────────────────────────────────────────
  @Column({ default: false })
  enableRewardSystem: boolean;

  @Column({ type: 'int', default: 10 })
  rewardPointsPerDay: number; // points earned for on-time attendance

  @Column({ type: 'int', default: 5 })
  rewardPointsLateDeduction: number; // points deducted for late check-in

  @Column({ type: 'int', default: 100 })
  rewardRedemptionThreshold: number; // points required to claim a reward

  @Column({ nullable: true })
  rewardDescription: string; // what the employee earns (e.g. "Gift voucher ₹500")

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
