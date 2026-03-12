import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger: Logger = new Logger('NotificationsGateway');

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    @SubscribeMessage('join')
    handleJoinRoom(client: Socket, userId: string) {
        client.join(`user_${userId}`);
        this.logger.log(`Client ${client.id} joined room user_${userId}`);
        return { status: 'ok' };
    }

    sendNotificationToUser(userId: string, data: any) {
        this.server.to(`user_${userId}`).emit('notification', data);
    }
    broadcastNotification(data: any) {
        this.server.emit('notification', data);
    }
}
