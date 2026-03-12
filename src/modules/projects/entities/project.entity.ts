import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Company } from '../../companies/company.entity';
import { Client } from './client.entity';

@Entity()
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Core project fields
  @Column({ nullable: true })
  projectName: string;

  @Column({ nullable: true })
  githubLink: string;

  @Column({ nullable: true })
  deploymentLink: string;

  @Column({ nullable: true })
  description: string;

  // Client details (denormalized for quick access without join)
  @Column({ nullable: true })
  clientName: string;

  @Column({ nullable: true })
  clientEmail: string;

  @Column({ nullable: true })
  contactInfo: string;

  // Timeline
  @Column({ nullable: true, type: 'date' })
  assigningDate: Date;

  @Column({ nullable: true, type: 'date' })
  deadline: Date;

  // Status / phase
  @Column({ nullable: true, default: 'Planning' })
  phase: string;

  @Column({ default: 'active', nullable: true })
  status: string;

  // Financials
  @Column({ nullable: true, type: 'numeric', default: 0 })
  totalPayment: number;

  @Column({ nullable: true, type: 'numeric', default: 0 })
  paymentReceived: number;

  @Column({ nullable: true, default: 0 })
  budget: number;

  // Team
  @Column({ nullable: true, type: 'simple-array' })
  assignedPeople: string[];

  // Relations
  @ManyToOne(() => Company)
  company: Company;

  @Column()
  companyId: string;

  @ManyToOne(() => Client, { nullable: true })
  client: Client;

  @Column({ nullable: true })
  clientId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

