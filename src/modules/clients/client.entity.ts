import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { Project } from '../projects/entities/project.entity';


@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  company: string;

  // Address Fields
  @Column({ nullable: true })
  address1: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  pincode: string;

  @OneToMany(() => Project, (project) => project.client)
  projects: Project[];
  
  // Status & Metadata
  @Column({ default: 'Lead' })
  status: string;

  @Column({ default: 'Website' })
  source: string;

  @Column({ default: 'Medium' })
  priority: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  budget: number;

  @Column({ nullable: true })
  followUpDate: Date;

  @Column({ nullable: true })
  lastContacted: Date;

  @OneToMany(() => Invoice, (invoice) => invoice.client)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;
}