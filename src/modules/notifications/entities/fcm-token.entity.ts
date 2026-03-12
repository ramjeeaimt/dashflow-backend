import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity()
export class FcmToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @Column()
    userId: string;

    @Column({ unique: false })
    token: string;

    @Column({ default: 'web' })
    platform: string; // 'web' | 'android' | 'ios'

    @Column({ nullable: true })
    deviceId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
