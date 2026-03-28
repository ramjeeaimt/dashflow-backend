import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Client } from '../clients/client.entity';


@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'Pending' }) // Pending, Paid, Cancelled
  status: string;

  @CreateDateColumn()
  issuedAt: Date;

  @ManyToOne(() => Client, (client) => client.invoices)
  client: Client;
}