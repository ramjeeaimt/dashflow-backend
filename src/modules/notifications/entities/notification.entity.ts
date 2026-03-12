import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from 'typeorm';
import { Company } from '../../companies/company.entity';
import { User } from '../../users/user.entity';

@Entity()
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ default: 'email' })
    type: string; // 'email' | 'push' | 'both'

    @Column({ default: 'all' })
    recipientFilter: string; // 'all' | 'country' | 'employees' | 'custom' | 'clients'

    @Column({ nullable: true, type: 'simple-array' })
    recipientIds: string[]; // specific user ids when filter is 'custom' or 'employees'

    @Column({ nullable: true })
    recipientCountry: string;

    @Column({ nullable: true, type: 'simple-array' })
    recipientEmails: string[];

    @Column({ default: 'pending' })
    status: string; // 'pending' | 'sent' | 'failed'

    @Column({ nullable: true, type: 'int', default: 0 })
    successCount: number;

    @Column({ nullable: true, type: 'int', default: 0 })
    failureCount: number;

    @ManyToOne(() => User, { nullable: true })
    sentBy: User;

    @Column({ nullable: true })
    sentById: string;

    @ManyToOne(() => Company)
    company: Company;

    @Column()
    companyId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
