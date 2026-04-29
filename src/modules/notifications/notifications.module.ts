import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { FcmToken } from './entities/fcm-token.entity';
import { Employee } from '../employees/employee.entity';
import { User } from '../users/user.entity';
import { Client } from '../clients/client.entity';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsGateway } from './notifications.gateway';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification, FcmToken, Employee, User, Client]),
        AccessControlModule,
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, NotificationsGateway],
    exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule { }
