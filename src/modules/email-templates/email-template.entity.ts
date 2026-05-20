import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from '../companies/company.entity';

@Entity()
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'email' })
  type: string;

  // Signature Details
  @Column({ nullable: true })
  signatureTeam: string;

  @Column({ nullable: true })
  signatureDept: string;

  @Column({ nullable: true })
  signatureRole: string;

  @Column({ nullable: true })
  signatureCompany: string;

  @Column({ nullable: true })
  signatureMeetText: string;

  @Column({ nullable: true })
  signatureMeetLink: string;

  @Column({ nullable: true })
  signatureEmail: string;

  @Column({ nullable: true })
  signatureAddress: string;

  @Column({ nullable: true })
  signatureWebsite: string;

  @Column({ nullable: true })
  signatureWebsiteLink: string;

  @Column({ name: 'companyId' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
