import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { IConversation } from './schemas/conversation.schema';
import { IChatSettings } from './schemas/chat-settings.schema';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100').split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private logger = new Logger('ChatGateway');

  // Track online users: userId -> Set<socketId>
  private onlineUsers = new Map<string, Set<string>>();
  // Track socket -> userId mapping
  private socketUsers = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    @InjectModel('ChatSettings') private chatSettingsModel: Model<IChatSettings>,
  ) {}

  // ── Lifecycle ──

  async afterInit(server: any) {
    const redisUrl = process.env.REDIS_URI || 'redis://redis:6379';
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      const { createClient } = await import('redis');
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      console.log('Chat gateway: Redis adapter connected');
    } catch (error: any) {
      console.warn('Chat gateway: Redis adapter failed, using in-memory:', error.message);
    }
  }

  // ── Connection handling ──

  async handleConnection(client: Socket) {
    try {
      // Authenticate via token in handshake query or auth header
      const token = client.handshake.auth?.token
        || client.handshake.query?.token as string
        || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Store user mapping
      this.socketUsers.set(client.id, userId);
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId).add(client.id);

      // Join personal room
      client.join(`user:${userId}`);

      // Join user's conversation rooms
      const conversations = await this.chatService.getMyConversations(userId);
      for (const conv of conversations) {
        client.join(`conv:${conv._id}`);
      }

      // Send the full list of currently online users to the newly connected client
      const currentlyOnline = this.getOnlineUserIds();
      client.emit('users:online-list', currentlyOnline);

      // Broadcast online status to all other clients
      this.server.emit('user:online', { userId, online: true });
      this.logger.log(`User connected: ${userId} (socket: ${client.id})`);
    } catch (err) {
      this.logger.warn(`Auth failed for socket: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      const sockets = this.onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.onlineUsers.delete(userId);
          // Broadcast offline only if no more connections
          this.server.emit('user:online', { userId, online: false });
        }
      }
      this.socketUsers.delete(client.id);
      this.logger.log(`User disconnected: ${userId}`);

      if (userId) {
        try {
          await this.chatSettingsModel.findOneAndUpdate(
            { userId },
            { lastSeenAt: new Date() },
            { upsert: true },
          );
        } catch (e) {
          // non-critical
        }
      }
    }
  }

  // ── Message events ──

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string; type?: string; replyTo?: string; fileUrl?: string; fileName?: string; fileSize?: number; fileMimeType?: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    const user = (client as any).user;
    const orgRole = user?.orgRole || 'member';
    if (orgRole === 'viewer') {
      client.emit('error', { message: 'Viewers cannot send messages' });
      return;
    }

    try {
      const message = await this.chatService.sendMessage(
        data.conversationId, userId, data.content, data.type || 'text', data.replyTo,
        data.fileUrl ? { fileUrl: data.fileUrl, fileName: data.fileName, fileSize: data.fileSize, fileMimeType: data.fileMimeType } : undefined,
      );
      // Emit to all participants in the conversation room
      this.server.to(`conv:${data.conversationId}`).emit('message:new', message);
      // Also emit conversation update for sidebar
      this.server.to(`conv:${data.conversationId}`).emit('conversation:updated', {
        conversationId: data.conversationId,
        lastMessage: { content: data.content, senderId: userId, sentAt: new Date() },
      });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    const user = (client as any).user;
    const orgRole = user?.orgRole || 'member';
    if (orgRole === 'viewer') {
      client.emit('error', { message: 'Viewers cannot send messages' });
      return;
    }

    try {
      const message = await this.chatService.editMessage(data.messageId, userId, data.content);
      this.server.to(`conv:${data.conversationId}`).emit('message:edited', message);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    const user = (client as any).user;
    const orgRole = user?.orgRole || 'member';
    if (orgRole === 'viewer') {
      client.emit('error', { message: 'Viewers cannot send messages' });
      return;
    }

    try {
      await this.chatService.deleteMessage(data.messageId, userId);
      this.server.to(`conv:${data.conversationId}`).emit('message:deleted', { messageId: data.messageId });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;
    try {
      await this.chatService.markAsRead(data.conversationId, userId);
      // Notify others that this user has read
      this.server.to(`conv:${data.conversationId}`).emit('conversation:read', {
        conversationId: data.conversationId,
        userId,
        readAt: new Date(),
      });
    } catch { /* silent */ }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;
    client.to(`conv:${data.conversationId}`).emit('typing', { conversationId: data.conversationId, userId, typing: true });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;
    client.to(`conv:${data.conversationId}`).emit('typing', { conversationId: data.conversationId, userId, typing: false });
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId || !data?.conversationId) {
      client.emit('error', { message: 'Invalid request' });
      return;
    }

    const conversation = await this.conversationModel.findOne({
      _id: data.conversationId,
      'participants.userId': userId,
      isDeleted: false,
    });

    if (!conversation) {
      client.emit('error', { message: 'You are not a participant of this conversation' });
      return;
    }

    client.join(`conv:${data.conversationId}`);
  }

  // ── Helpers ──

  private getUserId(client: Socket): string | undefined {
    return this.socketUsers.get(client.id);
  }

  // ── Helpers for REST controller to emit events ──

  emitToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`conv:${conversationId}`).emit(event, data);
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  async getUserPresence(userIds: string[]) {
    const onlineIds = Array.from((this as any).onlineUsers?.keys() || []);
    const settings = await this.chatSettingsModel.find(
      { userId: { $in: userIds } },
      { userId: 1, lastSeenAt: 1 },
    ).lean();

    return userIds.map(id => ({
      userId: id,
      online: onlineIds.includes(id),
      lastSeenAt: (settings as any[]).find((s: any) => s.userId === id)?.lastSeenAt || null,
    }));
  }
}
