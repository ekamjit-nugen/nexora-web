import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CallingService } from './calling.service';
import { InitiateCallDto, AnswerCallDto, RejectCallDto, EndCallDto, IceCandidateDto, MediaNegotiationDto } from './dto/index';

const RINGING_TIMEOUT_MS = 45_000; // 45 seconds before marking as missed
const DISCONNECT_GRACE_MS = 30_000; // 30 seconds grace period before ending call
const CALL_RATE_LIMIT_MAX = 10; // max calls per window
const CALL_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
      .split(',').map(o => o.trim()),
    credentials: true,
  },
  namespace: '/calls',
  transports: ['websocket', 'polling'],
})
export class CallingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private logger = new Logger('CallingGateway');

  // Track active sockets: socketId -> userId
  private socketUsers = new Map<string, string>();
  // Track user display names: userId -> full name
  private userNames = new Map<string, string>();
  // Track online users: userId -> Set<socketId>
  private onlineUsers = new Map<string, Set<string>>();
  // Track active call sessions: callId -> Set<socketId>
  private callSessions = new Map<string, Set<string>>();
  // Track ringing timeouts: callId -> timeout handle
  private ringingTimeouts = new Map<string, NodeJS.Timeout>();
  // Track disconnect grace periods: callId:userId -> timeout handle
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
  // Track call initiation rate limits: userId -> { count, resetAt }
  private callRateLimits = new Map<string, { count: number; resetAt: number }>();

  // Redis publisher for cross-service notification events
  private redisPubClient: any = null;

  constructor(
    private jwtService: JwtService,
    private callingService: CallingService,
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
      this.redisPubClient = pubClient;
      console.log('Calling gateway: Redis adapter connected');
    } catch (error: any) {
      console.warn('Calling gateway: Redis adapter failed, using in-memory:', error.message);
    }
  }

  // ── Connection handling ──
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        this.logger.warn('Connection attempt without token');
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub || decoded.userId;

      if (!userId) {
        this.logger.warn('Token missing userId');
        client.disconnect();
        return;
      }

      const user = decoded;
      client.data.user = user;

      this.socketUsers.set(client.id, userId);
      const fullName = [decoded.firstName, decoded.lastName].filter(Boolean).join(' ');
      if (fullName) this.userNames.set(userId, fullName);
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(client.id);

      this.logger.log(`User connected to calling: ${userId} (socket: ${client.id})`);
      client.emit('connected', { userId, message: 'Connected to calling service' });
    } catch (err) {
      this.logger.error(`Connection error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      // Handle active calls this socket was part of
      for (const [callId, sockets] of this.callSessions.entries()) {
        if (sockets.has(client.id)) {
          sockets.delete(client.id);

          // Count distinct users remaining (not just sockets)
          const remainingUserIds = this.getDistinctUsersInCall(sockets);
          const userStillInCall = remainingUserIds.has(userId);

          if (!userStillInCall) {
            if (remainingUserIds.size > 0) {
              // Other participants remain — start grace period before declaring user left
              const graceKey = `${callId}:${userId}`;
              if (!this.disconnectGraceTimers.has(graceKey)) {
                const timer = setTimeout(async () => {
                  this.disconnectGraceTimers.delete(graceKey);
                  // Re-check: did user rejoin during grace period?
                  const currentSockets = this.callSessions.get(callId);
                  if (currentSockets) {
                    const currentUsers = this.getDistinctUsersInCall(currentSockets);
                    if (!currentUsers.has(userId)) {
                      // User did not rejoin — notify remaining participants
                      this.server.to(`call:${callId}`).emit('call:participant-left', {
                        callId,
                        userId,
                        reason: 'disconnected',
                      });
                      this.logger.log(`User ${userId} left call ${callId} after grace period`);

                      // If only 1 user remains, end the call
                      if (currentUsers.size <= 1) {
                        this.endCallCleanup(callId, userId, 'last-participant');
                      }
                    }
                  }
                }, DISCONNECT_GRACE_MS);
                this.disconnectGraceTimers.set(graceKey, timer);
              }
            } else {
              // No one left at all — end the call
              this.endCallCleanup(callId, userId, 'disconnected');
            }
          }
        }
      }

      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.onlineUsers.delete(userId);
        }
      }
      this.socketUsers.delete(client.id);
      this.logger.log(`User disconnected from calling: ${userId}`);
    }
  }

  // ── Call signaling events ──
  @SubscribeMessage('call:initiate')
  async handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: InitiateCallDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    if (client.data?.user?.orgRole === 'viewer') {
      client.emit('error', { message: 'Viewers cannot initiate calls' });
      return;
    }

    // Rate limit: max 10 calls per minute per user
    if (!this.checkCallRateLimit(userId)) {
      client.emit('error', { message: 'Too many call attempts. Please wait before trying again.' });
      return;
    }

    try {
      const orgId = client.data?.user?.organizationId || 'default-org';
      const call = await this.callingService.initiateCall(userId, orgId, data);

      // Join initiator to call room
      client.join(`call:${call.callId}`);
      this.callSessions.set(call.callId, new Set([client.id]));

      // Emit call:incoming to recipient
      const recipientSockets = this.onlineUsers.get(data.recipientId) || new Set();
      recipientSockets.forEach(socketId => {
        this.server.to(socketId).emit('call:incoming', {
          callId: call.callId,
          initiatorId: userId,
          initiatorName: this.userNames.get(userId) || '',
          type: data.type,
          // S-004: Use conversationId from validated call record, not raw client data
          conversationId: call.conversationId,
        });
      });

      // Send confirmation to initiator
      client.emit('call:initiated', {
        callId: call.callId,
        status: call.status,
        type: call.type,
      });

      // Publish incoming call push notification
      this.publishCallNotification({
        type: 'incoming_call',
        title: `${this.userNames.get(userId) || 'Someone'} is calling`,
        body: data.type === 'video' ? 'Incoming video call' : 'Incoming voice call',
        userId: data.recipientId,
        organizationId: orgId,
        senderId: userId,
        priority: 'high',
        // S-004: Use conversationId from validated call record, not raw client data
        data: { callId: call.callId, callType: data.type, conversationId: call.conversationId || '' },
      }).catch(err => this.logger.warn(`Incoming call notification failed: ${err.message}`));

      // Start ringing timeout — auto-miss after 45 seconds
      this.startRingingTimeout(call.callId, userId, data.recipientId);

      this.logger.log(`Call initiated: ${call.callId} from ${userId} to ${data.recipientId}`);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('call:answer')
  async handleAnswerCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AnswerCallDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    try {
      // Check if call was already answered from another tab
      const existingCall = await this.callingService.getCallDetails(data.callId, userId).catch(() => null);
      if (existingCall && existingCall.status === 'connected') {
        client.emit('call:already-answered', { callId: data.callId });
        return;
      }

      const call = await this.callingService.answerCall(
        data.callId,
        userId,
        data.audioEnabled ?? true,
        data.videoEnabled ?? false,
      );

      // Clear ringing timeout
      this.clearRingingTimeout(call.callId);

      // Add recipient to call room
      client.join(`call:${call.callId}`);
      const callSockets = this.callSessions.get(call.callId) || new Set();
      callSockets.add(client.id);
      this.callSessions.set(call.callId, callSockets);

      // Dismiss ringing on all OTHER sockets of the same user
      const userSockets = this.onlineUsers.get(userId) || new Set();
      userSockets.forEach(sid => {
        if (sid !== client.id) {
          this.server.to(sid).emit('call:dismissed', {
            callId: call.callId,
            reason: 'answered-elsewhere',
          });
        }
      });

      // Notify all participants that call is connected
      this.server.to(`call:${call.callId}`).emit('call:connected', {
        callId: call.callId,
        status: call.status,
        participants: call.participants,
      });

      this.logger.log(`Call answered: ${call.callId} by ${userId}`);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('call:invite')
  async handleInviteToCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; userId: string },
  ) {
    const inviterId = this.socketUsers.get(client.id);
    if (!inviterId) return;

    try {
      const call = await this.callingService.inviteToCall(data.callId, inviterId, data.userId);

      // Send call:incoming to the invited user's sockets
      const inviteeSockets = this.onlineUsers.get(data.userId) || new Set();
      inviteeSockets.forEach(socketId => {
        this.server.to(socketId).emit('call:incoming', {
          callId: call.callId,
          initiatorId: inviterId,
          initiatorName: this.userNames.get(inviterId) || '',
          type: call.type,
          conversationId: call.conversationId,
        });
      });

      // Notify existing call participants that someone was invited
      this.server.to(`call:${call.callId}`).emit('call:participant-invited', {
        callId: call.callId,
        invitedUserId: data.userId,
        invitedBy: inviterId,
      });

      this.logger.log(`User ${data.userId} invited to call ${call.callId} by ${inviterId}`);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('call:reject')
  async handleRejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RejectCallDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    try {
      const call = await this.callingService.rejectCall(data.callId, userId, data.reason);

      // Clear ringing timeout
      this.clearRingingTimeout(call.callId);

      // Notify initiator that call was rejected
      this.server.to(`call:${call.callId}`).emit('call:rejected', {
        callId: call.callId,
        rejectedBy: userId,
        reason: data.reason,
      });

      // Dismiss ringing on all OTHER sockets of this user
      const userSockets = this.onlineUsers.get(userId) || new Set();
      userSockets.forEach(sid => {
        if (sid !== client.id) {
          this.server.to(sid).emit('call:dismissed', {
            callId: call.callId,
            reason: 'rejected',
          });
        }
      });

      // Clean up call room
      this.callSessions.delete(call.callId);

      this.logger.log(`Call rejected: ${call.callId} by ${userId}`);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('call:end')
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: EndCallDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    try {
      // Remove ALL of this user's sockets from the call (handles multi-tab)
      const callSockets = this.callSessions.get(data.callId);
      if (callSockets) {
        const userSocketsInCall = Array.from(callSockets).filter(
          sid => this.socketUsers.get(sid) === userId,
        );
        for (const sid of userSocketsInCall) {
          callSockets.delete(sid);
          const targetSocket = this.server.sockets.sockets.get(sid);
          targetSocket?.leave(`call:${data.callId}`);
        }
      }
      client.leave(`call:${data.callId}`);

      // Clear any disconnect grace timer for this user
      this.disconnectGraceTimers.delete(`${data.callId}:${userId}`);

      // Count distinct remaining users
      const remainingUsers = callSockets ? this.getDistinctUsersInCall(callSockets) : new Set<string>();

      if (remainingUsers.size > 0) {
        // Other participants remain — mark this user as left
        await this.callingService.leaveCall(data.callId, userId);

        this.server.to(`call:${data.callId}`).emit('call:participant-left', {
          callId: data.callId,
          userId,
          reason: 'left',
        });

        this.logger.log(`User ${userId} left call ${data.callId}, ${remainingUsers.size} user(s) remain`);

        // If only 1 user remains, end the call
        if (remainingUsers.size <= 1) {
          this.endCallCleanup(data.callId, userId, 'last-participant');
        }
      } else {
        // Last person — fully end the call
        this.endCallCleanup(data.callId, userId, 'ended');
      }
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  // ── Reconnection support ──
  @SubscribeMessage('call:rejoin')
  async handleRejoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data?.callId) return;

    try {
      // Verify user is a participant
      const call = await this.callingService.getCallDetails(data.callId, userId);
      if (!call || ['ended', 'missed', 'rejected'].includes(call.status)) {
        client.emit('call:rejoin-failed', { callId: data.callId, reason: 'Call no longer active' });
        return;
      }

      // Cancel any disconnect grace timer
      const graceKey = `${data.callId}:${userId}`;
      const graceTimer = this.disconnectGraceTimers.get(graceKey);
      if (graceTimer) {
        clearTimeout(graceTimer);
        this.disconnectGraceTimers.delete(graceKey);
      }

      // Re-add to call room and session
      client.join(`call:${data.callId}`);
      const callSockets = this.callSessions.get(data.callId) || new Set();
      callSockets.add(client.id);
      this.callSessions.set(data.callId, callSockets);

      // Notify participant rejoined
      this.server.to(`call:${data.callId}`).emit('call:participant-rejoined', {
        callId: data.callId,
        userId,
      });

      client.emit('call:rejoined', {
        callId: data.callId,
        status: call.status,
        participants: call.participants,
      });

      this.logger.log(`User ${userId} rejoined call ${data.callId}`);
    } catch (err) {
      client.emit('call:rejoin-failed', { callId: data.callId, reason: err.message });
    }
  }

  // ── WebRTC Media Negotiation ──
  @SubscribeMessage('call:offer')
  async handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MediaNegotiationDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    try {
      client.to(`call:${data.callId}`).emit('call:offer', {
        callId: data.callId,
        sdp: data.sdp,
        from: userId,
      });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('call:answer-sdp')
  async handleAnswerSdp(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MediaNegotiationDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    try {
      client.to(`call:${data.callId}`).emit('call:answer-sdp', {
        callId: data.callId,
        sdp: data.sdp,
        from: userId,
      });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: IceCandidateDto,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    try {
      client.to(`call:${data.callId}`).emit('call:ice-candidate', {
        callId: data.callId,
        candidate: data.candidate,
        sdpMLineIndex: data.sdpMLineIndex,
        sdpMid: data.sdpMid,
        from: userId,
      });
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  // ── Annotation broadcast (screen share drawing) ──
  @SubscribeMessage('call:annotation-stroke')
  handleAnnotationStroke(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; stroke: { fromX: number; fromY: number; toX: number; toY: number; color: string; brushSize: number } },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data?.callId) return;

    // Broadcast to all other participants in the call
    client.to(`call:${data.callId}`).emit('call:annotation-stroke', {
      ...data.stroke,
      from: userId,
    });
  }

  @SubscribeMessage('call:annotation-clear')
  handleAnnotationClear(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId || !data?.callId) return;

    client.to(`call:${data.callId}`).emit('call:annotation-clear', {
      from: userId,
    });
  }

  // ── Call quality metrics ──
  @SubscribeMessage('call:quality-report')
  async handleQualityReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; metrics: { callQuality?: string; bitrate?: number; frameRate?: number; packetLoss?: number } },
  ) {
    if (!data?.callId || !data?.metrics) return;

    try {
      await this.callingService.updateCallMetrics(data.callId, data.metrics);
    } catch {
      // Non-critical — swallow errors
    }
  }

  // ── Utility methods ──
  emitToCall(callId: string, event: string, data: any) {
    this.server.to(`call:${callId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    const sockets = this.onlineUsers.get(userId) || new Set();
    sockets.forEach(socketId => {
      this.server.to(socketId).emit(event, data);
    });
  }

  // ── Private helpers ──

  /** Get distinct user IDs from a set of socket IDs */
  private getDistinctUsersInCall(socketIds: Set<string>): Set<string> {
    const userIds = new Set<string>();
    for (const sid of socketIds) {
      const uid = this.socketUsers.get(sid);
      if (uid) userIds.add(uid);
    }
    return userIds;
  }

  /** Start a 45-second ringing timeout — marks call as missed if unanswered */
  private startRingingTimeout(callId: string, initiatorId: string, recipientId: string) {
    this.clearRingingTimeout(callId);

    const timer = setTimeout(async () => {
      this.ringingTimeouts.delete(callId);
      try {
        const call = await this.callingService.missCall(callId);
        if (call) {
          // Notify initiator
          this.emitToUser(initiatorId, 'call:missed', {
            callId,
            recipientId,
            reason: 'no-answer',
          });
          // Notify recipient (stop ringing)
          this.emitToUser(recipientId, 'call:missed', {
            callId,
            initiatorId,
            reason: 'no-answer',
          });
          // Publish missed call push notification to recipient
          this.publishCallNotification({
            type: 'missed_call',
            title: 'Missed call',
            body: `Missed call from ${this.userNames.get(initiatorId) || 'Unknown'}`,
            userId: recipientId,
            organizationId: call.organizationId || 'default-org',
            senderId: initiatorId,
            data: { callId },
          }).catch(err => this.logger.warn(`Missed call notification failed: ${err.message}`));

          // Clean up session
          this.callSessions.delete(callId);
          this.logger.log(`Call ${callId} timed out — marked as missed`);
        }
      } catch (err) {
        this.logger.error(`Error handling ringing timeout for ${callId}: ${err.message}`);
      }
    }, RINGING_TIMEOUT_MS);

    this.ringingTimeouts.set(callId, timer);
  }

  /** Clear a ringing timeout (call was answered/rejected) */
  private clearRingingTimeout(callId: string) {
    const timer = this.ringingTimeouts.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.ringingTimeouts.delete(callId);
    }
  }

  /** Full call cleanup: end in DB, notify participants, remove session */
  private async endCallCleanup(callId: string, endedByUserId: string, reason: string) {
    try {
      this.clearRingingTimeout(callId);

      const call = await this.callingService.endCall(callId, endedByUserId);

      call.participantIds?.forEach(pid => {
        this.emitToUser(pid, 'call:ended', {
          callId: call.callId,
          endedBy: endedByUserId,
          duration: call.duration,
          reason,
        });
      });

      this.callSessions.delete(callId);

      // Clear any remaining grace timers for this call
      for (const [key, timer] of this.disconnectGraceTimers.entries()) {
        if (key.startsWith(`${callId}:`)) {
          clearTimeout(timer);
          this.disconnectGraceTimers.delete(key);
        }
      }

      this.logger.log(`Call ended: ${callId} by ${endedByUserId}, reason: ${reason}`);
    } catch (err) {
      this.logger.error(`Error ending call ${callId}: ${err.message}`);
    }
  }

  /** Per-user rate limit for call initiation */
  private checkCallRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = this.callRateLimits.get(userId);
    if (!entry || now > entry.resetAt) {
      this.callRateLimits.set(userId, { count: 1, resetAt: now + CALL_RATE_LIMIT_WINDOW_MS });
      return true;
    }
    entry.count++;
    return entry.count <= CALL_RATE_LIMIT_MAX;
  }

  // ── Push notification helpers ──

  /**
   * Publish a call-related push notification to the `notifications` Redis channel.
   * Supports: incoming_call, missed_call, voicemail.
   */
  private async publishCallNotification(payload: {
    type: string;
    title: string;
    body: string;
    userId: string;
    organizationId: string;
    senderId?: string;
    priority?: string;
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.redisPubClient) return;

    try {
      await this.redisPubClient.publish('notifications', JSON.stringify({
        ...payload,
        priority: payload.priority || 'normal',
      }));
    } catch (err) {
      this.logger.warn(`Failed to publish call notification: ${err.message}`);
    }
  }

  /**
   * Public method: send a voicemail notification.
   * Called by CallingService or external controllers when a voicemail is left.
   */
  async sendVoicemailNotification(
    recipientId: string, callerId: string, organizationId: string,
    voicemailData?: { duration?: number; callId?: string },
  ): Promise<void> {
    const callerName = this.userNames.get(callerId) || 'Unknown';
    const durationText = voicemailData?.duration ? ` (${voicemailData.duration}s)` : '';

    await this.publishCallNotification({
      type: 'voicemail',
      title: 'New voicemail',
      body: `Voicemail from ${callerName}${durationText}`,
      userId: recipientId,
      organizationId,
      senderId: callerId,
      data: {
        callId: voicemailData?.callId || '',
        duration: String(voicemailData?.duration || 0),
      },
    });
  }
}
