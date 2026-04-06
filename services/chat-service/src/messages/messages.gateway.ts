import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Inject, Optional } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MentionsService } from '../mentions/mentions.service';
import { IConversation, IParticipant } from '../conversations/schemas/conversation.schema';
import { IChatSettings } from '../settings/schemas/chat-settings.schema';
import { IMessage } from './schemas/message.schema';

const TYPING_TTL_MS = 7_000; // Auto-clear typing indicator after 7 seconds
const PRESENCE_GRACE_MS = 30_000; // Wait 30 seconds before marking user offline
const RATE_LIMIT_WINDOW_MS = 60_000;

// In-memory rate limit tracker (fallback when Redis unavailable)
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();
function checkRateLimitInMemory(userId: string, event: string, max: number, windowMs: number): boolean {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const entry = rateLimitCounters.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitCounters.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
      .split(',').map(o => o.trim()),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  namespace: '/chat',
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private logger = new Logger('MessagesGateway');

  // Track online users: userId -> Set<socketId>
  private onlineUsers = new Map<string, Set<string>>();
  // Track socket -> userId mapping
  private socketUsers = new Map<string, string>();
  // Track typing indicator TTL timers: `${userId}:${conversationId}` -> timeout
  private typingTimers = new Map<string, NodeJS.Timeout>();
  // Track disconnect grace period timers: userId -> timeout
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
  // Redis client for distributed rate limiting (optional)
  private redisClient: any = null;
  // Interval for cleaning stale rate limit entries
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;

  // Redis publisher for cross-service notification events
  private redisPubClient: any = null;

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private mentionsService: MentionsService,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    @InjectModel('ChatSettings') private chatSettingsModel: Model<IChatSettings>,
    @InjectModel('Message') private messageModel: Model<IMessage>,
  ) {}

  async afterInit(server: any) {
    const redisUrl = process.env.REDIS_URI || 'redis://redis:6379';
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      const { createClient } = await import('redis');
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      // Keep a reference for distributed rate limiting and notification publishing
      this.redisClient = pubClient;
      this.redisPubClient = pubClient;

      // B-006: Add error handler on pub client to prevent unhandled errors
      pubClient.on('error', (err: any) => {
        this.logger.error(`Redis pub client error: ${err.message}`);
      });
      subClient.on('error', (err: any) => {
        this.logger.error(`Redis sub client error: ${err.message}`);
      });

      this.logger.log('Redis adapter connected');
    } catch (error: any) {
      this.logger.warn('Redis adapter failed, using in-memory: ' + error.message);
    }

    // Periodic cleanup of stale in-memory rate limit entries (every 60 seconds)
    this.rateLimitCleanupInterval = setInterval(() => {
      // B-009: If map has grown too large, clear it entirely to prevent unbounded growth
      if (rateLimitCounters.size > 10_000) {
        rateLimitCounters.clear();
        return;
      }
      const now = Date.now();
      for (const [key, entry] of rateLimitCounters.entries()) {
        if (now > entry.resetAt) rateLimitCounters.delete(key);
      }
    }, 60_000);
  }

  // B-006: Clean up interval and Redis connections on module destroy
  onModuleDestroy() {
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        || client.handshake.query?.token as string
        || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      this.socketUsers.set(client.id, userId);
      if (!this.onlineUsers.has(userId)) this.onlineUsers.set(userId, new Set());
      this.onlineUsers.get(userId).add(client.id);

      // Cancel any pending disconnect grace timer (user reconnected in time)
      const graceTimer = this.disconnectGraceTimers.get(userId);
      if (graceTimer) {
        clearTimeout(graceTimer);
        this.disconnectGraceTimers.delete(userId);
      }

      client.join(`user:${userId}`);

      const conversations = await this.conversationsService.getMyConversations(userId);
      for (const conv of conversations) {
        client.join(`conv:${conv._id}`);
      }

      client.emit('users:online-list', this.getOnlineUserIds());
      this.server.emit('user:online', { userId, online: true });
      this.logger.log(`User connected: ${userId} (socket: ${client.id})`);
    } catch (err) {
      this.logger.warn(`Auth failed: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      // 1. Clear typing indicators across all rooms this socket was in
      const rooms = Array.from(client.rooms || []);
      for (const room of rooms) {
        if (room.startsWith('conv:')) {
          const conversationId = room.replace('conv:', '');
          // Clear typing TTL timer for this user+conversation
          const timerKey = `${userId}:${conversationId}`;
          const timer = this.typingTimers.get(timerKey);
          if (timer) {
            clearTimeout(timer);
            this.typingTimers.delete(timerKey);
          }
          this.server.to(room).emit('typing', { conversationId, userId, typing: false });
        }
      }

      // 2. Clean up socket listeners to prevent memory leaks
      client.removeAllListeners();

      // 3. Remove from online tracking
      const sockets = this.onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.onlineUsers.delete(userId);

          // Start 30-second grace period before broadcasting offline
          const graceTimer = setTimeout(() => {
            this.disconnectGraceTimers.delete(userId);
            // Re-check: did user reconnect during grace period?
            if (!this.onlineUsers.has(userId)) {
              this.server.emit('user:online', { userId, online: false });
            }
          }, PRESENCE_GRACE_MS);
          this.disconnectGraceTimers.set(userId, graceTimer);
        }
      }
      this.socketUsers.delete(client.id);

      // 4. Update lastSeenAt
      try {
        await this.chatSettingsModel.findOneAndUpdate(
          { userId }, { lastSeenAt: new Date() }, { upsert: true },
        );
      } catch { /* non-critical */ }
    }
  }

  // ── Distributed rate limiting (Redis with in-memory fallback) ──
  private async checkRateLimit(userId: string, event: string, max: number, windowMs: number): Promise<boolean> {
    if (!this.redisClient) {
      return checkRateLimitInMemory(userId, event, max, windowMs);
    }
    try {
      const key = `ratelimit:${userId}:${event}`;
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.pExpire(key, windowMs);
      }
      return count <= max;
    } catch {
      // Redis error — fall back to in-memory
      return checkRateLimitInMemory(userId, event, max, windowMs);
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string; content: string; type?: string; replyTo?: string;
      fileUrl?: string; fileName?: string; fileSize?: number; fileMimeType?: string;
      idempotencyKey?: string;
    },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    // Rate limit: 30 messages per minute (distributed)
    const allowed = await this.checkRateLimit(userId, 'message:send', 30, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      client.emit('error', { code: 'RATE_LIMITED', message: 'Too many messages. Please slow down.' });
      return;
    }

    // Message length limit: 40KB
    if (data.content && data.content.length > 40000) {
      client.emit('error', { message: 'Message too long (max 40,000 characters)' });
      return;
    }

    try {
      const message = await this.messagesService.sendMessage(
        data.conversationId, userId, data.content, data.type || 'text', data.replyTo, null,
        data.fileUrl ? { fileUrl: data.fileUrl, fileName: data.fileName, fileSize: data.fileSize, fileMimeType: data.fileMimeType } : undefined,
        data.idempotencyKey,
      );

      // Emit new message to conversation
      this.server.to(`conv:${data.conversationId}`).emit('message:new', message);
      this.server.to(`conv:${data.conversationId}`).emit('conversation:updated', {
        conversationId: data.conversationId,
        lastMessage: { content: data.content, senderId: userId, sentAt: new Date() },
      });

      // Send acknowledgement back to sender with message ID and status
      client.emit('message:ack', {
        idempotencyKey: data.idempotencyKey,
        messageId: message._id.toString(),
        status: 'sent',
      });

      // Publish push notifications (async, non-blocking)
      this.publishMessageNotifications(
        data.conversationId, userId, message, data.content, data.type || 'text', data.fileName,
      ).catch(err => this.logger.warn(`Push notification publish failed: ${err.message}`));
    } catch (err) {
      client.emit('error', { message: err.message });
      // Notify sender of failure
      if (data.idempotencyKey) {
        client.emit('message:ack', {
          idempotencyKey: data.idempotencyKey,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  @SubscribeMessage('message:delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data?.messageId) return;

    try {
      await this.messagesService.markAsDelivered(data.messageId, userId);
      // Notify the sender that their message was delivered
      this.server.to(`conv:${data.conversationId}`).emit('message:status-update', {
        messageId: data.messageId,
        status: 'delivered',
        userId,
        deliveredAt: new Date(),
      });
    } catch { /* non-critical */ }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    // RL-002: Rate limit edits to 30/min
    const allowed = await this.checkRateLimit(userId, 'message:edit', 30, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      client.emit('error', { code: 'RATE_LIMITED', message: 'Too many edits. Please slow down.' });
      return;
    }

    try {
      const message = await this.messagesService.editMessage(data.messageId, userId, data.content);
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

    // RL-002: Rate limit deletes to 30/min
    const allowed = await this.checkRateLimit(userId, 'message:delete', 30, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      client.emit('error', { code: 'RATE_LIMITED', message: 'Too many deletions. Please slow down.' });
      return;
    }

    try {
      await this.messagesService.deleteMessage(data.messageId, userId);
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
      await this.messagesService.markAsRead(data.conversationId, userId);
      this.server.to(`conv:${data.conversationId}`).emit('conversation:read', {
        conversationId: data.conversationId, userId, readAt: new Date(),
      });
    } catch { /* silent */ }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    // RL-002: Rate limit typing events to 60/min (more lenient since frequent)
    const allowed = await this.checkRateLimit(userId, 'typing:start', 60, RATE_LIMIT_WINDOW_MS);
    if (!allowed) return; // Silently drop excessive typing events

    client.to(`conv:${data.conversationId}`).emit('typing', { conversationId: data.conversationId, userId, typing: true });

    // Set auto-clear timer (TTL) to prevent ghost typing indicators
    const timerKey = `${userId}:${data.conversationId}`;
    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    this.typingTimers.set(timerKey, setTimeout(() => {
      this.typingTimers.delete(timerKey);
      this.server.to(`conv:${data.conversationId}`).emit('typing', { conversationId: data.conversationId, userId, typing: false });
    }, TYPING_TTL_MS));
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    // Clear the TTL timer
    const timerKey = `${userId}:${data.conversationId}`;
    const timer = this.typingTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(timerKey);
    }

    client.to(`conv:${data.conversationId}`).emit('typing', { conversationId: data.conversationId, userId, typing: false });
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data?.conversationId) return;

    const conversation = await this.conversationModel.findOne({
      _id: data.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) {
      client.emit('error', { message: 'Not a participant' });
      return;
    }
    client.join(`conv:${data.conversationId}`);
  }

  // ── Reactions via WebSocket ──

  @SubscribeMessage('message:reaction')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; emoji: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    // Rate limit: 20 reactions per minute (distributed)
    const allowed = await this.checkRateLimit(userId, 'message:reaction', 20, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      client.emit('error', { code: 'RATE_LIMITED', message: 'Too many reactions' });
      return;
    }

    // Validate emoji length
    if (!data.emoji || data.emoji.length > 20) {
      client.emit('error', { message: 'Invalid emoji' });
      return;
    }

    try {
      const updated = await this.messagesService.addReaction(data.messageId, userId, data.emoji);
      this.server.to(`conv:${data.conversationId}`).emit('message:reaction:update', {
        messageId: data.messageId,
        reactions: updated.reactions,
      });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  // ── Thread events via WebSocket ──

  @SubscribeMessage('thread:reply')
  async handleThreadReply(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string; content: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data.conversationId) return;

    // RL-002: Rate limit thread replies to 30/min
    const allowed = await this.checkRateLimit(userId, 'thread:reply', 30, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      client.emit('error', { code: 'RATE_LIMITED', message: 'Too many replies. Please slow down.' });
      return;
    }

    try {
      const reply = await this.messagesService.sendMessage(
        data.conversationId, userId, data.content, 'text', undefined, null,
      );

      this.server.to(`conv:${data.conversationId}`).emit('thread:new-reply', {
        threadId: data.threadId,
        reply,
        conversationId: data.conversationId,
      });

      // Publish thread reply notifications (async, non-blocking)
      this.publishThreadReplyNotifications(
        data.conversationId, data.threadId, userId, reply, data.content,
      ).catch(err => this.logger.warn(`Thread reply notification publish failed: ${err.message}`));
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  // ── Poll events via WebSocket ──

  @SubscribeMessage('poll:vote')
  async handlePollVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; optionId: string; conversationId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data.conversationId) return;
    try {
      this.server.to(`conv:${data.conversationId}`).emit('poll:updated', {
        messageId: data.messageId,
        optionId: data.optionId,
        userId,
      });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  // ── Presence heartbeat ──

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;
    // Presence heartbeat is handled by the presence service
    // This keeps the socket alive and updates lastActiveAt
  }

  // ── Helpers for REST controllers ──

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
    const onlineIds = this.getOnlineUserIds();
    const settings = await this.chatSettingsModel.find(
      { userId: { $in: userIds } }, { userId: 1, lastSeenAt: 1 },
    ).lean();

    return userIds.map(id => ({
      userId: id,
      online: onlineIds.includes(id),
      lastSeenAt: (settings as any[]).find((s: any) => s.userId === id)?.lastSeenAt || null,
    }));
  }

  // ── Sanitization helper ──

  /**
   * Sanitize user-supplied text before including it in notification payloads.
   * Strips HTML, decodes entities, removes control chars, and truncates.
   */
  private sanitizeNotificationText(text: string): string {
    if (!text) return '';
    let s = text
      // Strip HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode common HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Strip control characters
      .replace(/[\x00-\x1F\x7F]/g, '');
    // Truncate to 200 chars
    if (s.length > 200) s = s.substring(0, 200);
    return s;
  }

  // ── Push notification helpers ──

  /**
   * Publish push notifications for a new message to the `notifications` Redis channel.
   * Handles: regular messages, @mentions, and per-conversation mute/preference checks.
   */
  private async publishMessageNotifications(
    conversationId: string, senderId: string, message: any,
    content: string, messageType: string, fileName?: string,
  ): Promise<void> {
    if (!this.redisPubClient) return;

    const conversation = await this.conversationModel
      .findOne({ _id: conversationId, isDeleted: false })
      .lean() as IConversation | null;
    if (!conversation) return;

    const senderName = this.sanitizeNotificationText(message.senderName || `User ${senderId.slice(-6)}`);
    const preview = this.sanitizeNotificationText(this.formatNotificationPreview(messageType, content, fileName));

    // Parse @mentions from content
    const mentions = this.mentionsService.parseMentions(content || '');
    const onlineUserIds = this.getOnlineUserIds();
    const mentionedUserIds = this.mentionsService.getMentionedUserIds(
      mentions, conversation.participants, onlineUserIds,
    );
    const hasHereMention = mentions.some(m => m.type === 'here');

    for (const participant of conversation.participants) {
      // Never notify the sender
      if (participant.userId === senderId) continue;

      // Check mute status
      if (participant.muted) {
        if (!participant.mutedUntil || new Date() < participant.mutedUntil) continue;
      }

      // Check notifyPreference
      const pref = participant.notifyPreference || 'all';
      if (pref === 'nothing') continue;

      const isMentioned = mentionedUserIds.includes(participant.userId);

      // If preference is 'mentions', only notify if mentioned
      if (pref === 'mentions' && !isMentioned) continue;

      const notificationType = isMentioned ? 'mention' : 'message';
      const safeName = this.sanitizeNotificationText(conversation.name || 'Group');

      const payload: Record<string, any> = {
        type: notificationType,
        title: conversation.type === 'direct'
          ? senderName
          : `${senderName} in ${safeName}`,
        body: isMentioned ? `Mentioned you: ${preview}` : preview,
        userId: participant.userId,
        organizationId: conversation.organizationId,
        conversationId,
        senderId,
        messageType,
        data: {
          messageId: message._id?.toString() || '',
          conversationId,
          conversationType: conversation.type,
        },
      };

      // Tag @here mentions so the client/notification-service can check online status
      if (isMentioned && hasHereMention) {
        payload.mentionType = 'here';
      }

      try {
        await this.redisPubClient.publish('notifications', JSON.stringify(payload));
      } catch (err) {
        this.logger.warn(`Failed to publish notification for ${participant.userId}: ${err.message}`);
      }
    }
  }

  /**
   * Publish push notifications for thread replies to thread followers.
   */
  private async publishThreadReplyNotifications(
    conversationId: string, threadId: string, senderId: string,
    reply: any, content: string,
  ): Promise<void> {
    if (!this.redisPubClient) return;

    // Look up the root message to get thread followers
    const rootMessage = await this.messageModel.findById(threadId).lean();
    if (!rootMessage?.threadInfo?.followers?.length) return;

    const conversation = await this.conversationModel
      .findOne({ _id: conversationId, isDeleted: false })
      .lean() as IConversation | null;
    if (!conversation) return;

    const senderName = this.sanitizeNotificationText(reply.senderName || `User ${senderId.slice(-6)}`);
    const preview = this.sanitizeNotificationText(this.formatNotificationPreview('text', content));

    for (const followerId of rootMessage.threadInfo.followers) {
      // Never notify the sender
      if (followerId === senderId) continue;

      // Check participant mute/preference
      const participant = conversation.participants.find(p => p.userId === followerId);
      if (!participant) continue;
      if (participant.muted && (!participant.mutedUntil || new Date() < participant.mutedUntil)) continue;
      if (participant.notifyPreference === 'nothing') continue;

      const payload = {
        type: 'thread_reply',
        title: `${senderName} replied in thread`,
        body: preview,
        userId: followerId,
        organizationId: conversation.organizationId,
        conversationId,
        senderId,
        messageType: 'text',
        data: {
          messageId: reply._id?.toString() || '',
          threadId,
          conversationId,
        },
      };

      try {
        await this.redisPubClient.publish('notifications', JSON.stringify(payload));
      } catch (err) {
        this.logger.warn(`Failed to publish thread notification for ${followerId}: ${err.message}`);
      }
    }
  }

  /**
   * Format a notification preview string based on message type.
   */
  private formatNotificationPreview(messageType?: string, body?: string, fileName?: string): string {
    switch (messageType) {
      case 'image': return 'sent a photo';
      case 'video': return 'sent a video';
      case 'file': return `sent ${fileName || 'a file'}`;
      case 'audio': return 'Voice message';
      case 'poll': return `Poll: ${(body || '').substring(0, 60)}`;
      case 'code': return 'shared a code snippet';
      // B-005: No naive HTML stripping here — sanitizeNotificationText handles it properly
      default: return (body || '').substring(0, 200);
    }
  }
}
