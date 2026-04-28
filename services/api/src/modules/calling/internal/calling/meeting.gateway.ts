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
import { MeetingService } from './meeting.service';
import { isHost, isCoHost } from '../meetings/meeting-permissions';

interface MeetingParticipantInfo {
  userId?: string;
  displayName: string;
  isAnonymous: boolean;
  socketId: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
      .split(',').map(o => o.trim()),
    credentials: true,
  },
  namespace: '/meetings',
  transports: ['websocket', 'polling'],
})
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private logger = new Logger('MeetingGateway');

  // socketId -> participant info
  private socketParticipants = new Map<string, MeetingParticipantInfo>();
  // userId -> Set<socketId> (for registered users)
  private userSockets = new Map<string, Set<string>>();
  // meetingId -> Set<socketId>
  private meetingRooms = new Map<string, Set<string>>();
  // Transcript rate limit: `${userId}:${meetingId}` -> last timestamp (max 1 per second)
  private transcriptRateLimit = new Map<string, number>();

  constructor(
    private jwtService: JwtService,
    private meetingService: MeetingService,
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
      this.logger.log('Meeting gateway: Redis adapter connected');
    } catch (error: any) {
      this.logger.warn(`Meeting gateway: Redis adapter failed, using in-memory: ${error.message}`);
    }
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = this.jwtService.verify(token);
        const userId = decoded.sub || decoded.userId;
        const displayName = [decoded.firstName, decoded.lastName].filter(Boolean).join(' ') || decoded.email || userId;

        this.socketParticipants.set(client.id, { userId, displayName, isAnonymous: false, socketId: client.id });
        if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
        this.userSockets.get(userId)!.add(client.id);

        client.emit('meeting:connected', { userId, displayName });
        this.logger.log(`Authenticated user connected: ${userId}`);
        return;
      } catch {
        // Token was provided but is invalid/expired — reject the connection
        this.logger.warn('Connection rejected: invalid or expired token');
        client.emit('meeting:error', { message: 'Invalid or expired authentication token' });
        client.disconnect();
        return;
      }
    }

    // No token provided at all — allow anonymous connection (displayName will come with meeting:join)
    this.socketParticipants.set(client.id, { displayName: 'Guest', isAnonymous: true, socketId: client.id });
    client.emit('meeting:connected', { anonymous: true });
  }

  handleDisconnect(client: Socket) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    // Find and clean up meeting rooms this socket was in
    for (const [meetingId, sockets] of this.meetingRooms.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        this.server.to(`meeting:${meetingId}`).emit('meeting:participant-left', {
          meetingId,
          socketId: client.id,
          userId: info.userId,
          displayName: info.displayName,
        });
        this.meetingService.leaveMeeting(meetingId, info.userId, info.displayName).catch(() => {});

        // UC-015: If the disconnected user was the host, transfer host role
        if (info.userId && sockets.size > 0) {
          this.handleHostTransferOnDisconnect(meetingId, info.userId, sockets).catch((err) => {
            this.logger.error(`Host transfer failed for meeting ${meetingId}: ${err.message}`);
          });
        }

        if (sockets.size === 0) this.meetingRooms.delete(meetingId);
      }
    }

    // Clean up user socket tracking
    if (info.userId) {
      const userSocketSet = this.userSockets.get(info.userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) this.userSockets.delete(info.userId);
      }
    }

    this.socketParticipants.delete(client.id);
  }

  /**
   * Check if the socket user is host or co-host of the meeting.
   * Returns the meeting if authorized, null otherwise (emits error to client).
   */
  private async requireHostOrCoHost(client: Socket, meetingId: string): Promise<any | null> {
    const info = this.socketParticipants.get(client.id);
    if (!info?.userId) {
      client.emit('error', { message: 'Authentication required for this action' });
      return null;
    }
    try {
      const meeting = await this.meetingService.getMeeting(meetingId);
      if (!meeting) {
        client.emit('error', { message: 'Meeting not found' });
        return null;
      }
      if (!isHost(meeting, info.userId) && !isCoHost(meeting, info.userId)) {
        client.emit('error', { message: 'Only the host or co-host can perform this action' });
        return null;
      }
      return meeting;
    } catch {
      client.emit('error', { message: 'Meeting not found' });
      return null;
    }
  }

  // ── Join / Leave ──

  @SubscribeMessage('meeting:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; displayName?: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    // Anonymous users must provide displayName
    if (info.isAnonymous && data.displayName) {
      info.displayName = data.displayName;
    }

    try {
      const meeting = await this.meetingService.joinMeeting(
        data.meetingId,
        info.userId,
        info.displayName,
        info.isAnonymous,
      );

      // Join the socket room
      client.join(`meeting:${data.meetingId}`);
      if (!this.meetingRooms.has(data.meetingId)) this.meetingRooms.set(data.meetingId, new Set());
      this.meetingRooms.get(data.meetingId)!.add(client.id);

      // Tell existing participants about the new joiner
      client.to(`meeting:${data.meetingId}`).emit('meeting:participant-joined', {
        meetingId: data.meetingId,
        socketId: client.id,
        userId: info.userId,
        displayName: info.displayName,
        isAnonymous: info.isAnonymous,
      });

      // Tell the new joiner about all existing participants
      const existingSockets = Array.from(this.meetingRooms.get(data.meetingId) || [])
        .filter((sid) => sid !== client.id)
        .map((sid) => {
          const p = this.socketParticipants.get(sid);
          return p ? { socketId: sid, userId: p.userId, displayName: p.displayName, isAnonymous: p.isAnonymous } : null;
        })
        .filter(Boolean);

      client.emit('meeting:joined', {
        meetingId: data.meetingId,
        meeting: {
          title: meeting.title,
          hostId: meeting.hostId,
          isRecording: meeting.isRecording,
          recordingEnabled: meeting.recordingEnabled,
          status: meeting.status,
        },
        participants: existingSockets,
        yourSocketId: client.id,
      });

      this.logger.log(`${info.displayName} joined meeting ${data.meetingId}`);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('meeting:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    const sockets = this.meetingRooms.get(data.meetingId);
    if (sockets) sockets.delete(client.id);

    client.leave(`meeting:${data.meetingId}`);
    client.to(`meeting:${data.meetingId}`).emit('meeting:participant-left', {
      meetingId: data.meetingId,
      socketId: client.id,
      userId: info.userId,
      displayName: info.displayName,
    });

    await this.meetingService.leaveMeeting(data.meetingId, info.userId, info.displayName);
  }

  // ── WebRTC Signaling (mesh topology) ──
  // TODO: Mesh topology does not scale beyond ~6 participants due to O(n^2) peer connections.
  // For larger meetings, integrate with the SFU gateway (/sfu namespace) which uses mediasoup
  // for server-side media routing. See sfu.gateway.ts and sfu.service.ts.

  @SubscribeMessage('meeting:offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; targetSocketId: string; sdp: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    this.server.to(data.targetSocketId).emit('meeting:offer', {
      meetingId: data.meetingId,
      sdp: data.sdp,
      from: client.id,
      fromUserId: info?.userId,
      fromName: info?.displayName,
    });
  }

  @SubscribeMessage('meeting:answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; targetSocketId: string; sdp: string },
  ) {
    this.server.to(data.targetSocketId).emit('meeting:answer', {
      meetingId: data.meetingId,
      sdp: data.sdp,
      from: client.id,
    });
  }

  @SubscribeMessage('meeting:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; targetSocketId: string; candidate: any },
  ) {
    this.server.to(data.targetSocketId).emit('meeting:ice-candidate', {
      meetingId: data.meetingId,
      candidate: data.candidate,
      from: client.id,
    });
  }

  // ── Transcript ──

  @SubscribeMessage('meeting:transcript')
  async handleTranscript(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; text: string; speakerName: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    // Validate transcript text length
    if (!data.text || data.text.length > 5000) {
      client.emit('error', { message: 'Transcript text must be between 1 and 5000 characters' });
      return;
    }

    // Rate limit: max 1 transcript per second per user per meeting
    const rateLimitKey = `${info.userId || client.id}:${data.meetingId}`;
    const now = Date.now();
    const lastTime = this.transcriptRateLimit.get(rateLimitKey) || 0;
    if (now - lastTime < 1000) {
      client.emit('error', { message: 'Transcript rate limit exceeded (max 1 per second)' });
      return;
    }
    this.transcriptRateLimit.set(rateLimitKey, now);

    const speakerId = info.userId || client.id;
    const speakerName = data.speakerName || info.displayName || 'Unknown';

    await this.meetingService.addTranscript(data.meetingId, speakerId, {
      text: data.text,
      speakerName,
    });

    // Broadcast transcript entry to all participants in the room
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:transcript-entry', {
      meetingId: data.meetingId,
      speakerId,
      speakerName,
      text: data.text,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Media state ──

  @SubscribeMessage('meeting:media-state')
  handleMediaState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; audioEnabled: boolean; videoEnabled: boolean },
  ) {
    client.to(`meeting:${data.meetingId}`).emit('meeting:media-state', {
      socketId: client.id,
      audioEnabled: data.audioEnabled,
      videoEnabled: data.videoEnabled,
    });
  }

  // ── Screen share ──

  @SubscribeMessage('meeting:screen-share-start')
  handleScreenShareStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    client.to(`meeting:${data.meetingId}`).emit('meeting:screen-share-started', {
      socketId: client.id,
      userId: info?.userId,
      displayName: info?.displayName,
    });
  }

  @SubscribeMessage('meeting:screen-share-stop')
  handleScreenShareStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    client.to(`meeting:${data.meetingId}`).emit('meeting:screen-share-stopped', {
      socketId: client.id,
    });
  }

  // ── Chat in meeting ──

  @SubscribeMessage('meeting:chat')
  handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; text: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    // Verify sender is actually in this meeting room
    const roomName = `meeting:${data.meetingId}`;
    if (!client.rooms.has(roomName)) {
      client.emit('error', { message: 'You are not in this meeting' });
      return;
    }

    // Validate content length
    if (!data.text || data.text.length > 5000) {
      client.emit('error', { message: 'Invalid message content' });
      return;
    }

    this.server.to(roomName).emit('meeting:chat', {
      socketId: client.id,
      userId: info.userId,
      displayName: info.displayName,
      text: data.text,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Lobby events ──

  @SubscribeMessage('meeting:lobby-admit')
  async handleLobbyAdmit(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; userId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.notifyUser(data.userId, 'meeting:lobby-admitted', { meetingId: data.meetingId });
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:lobby-updated', { action: 'admitted', userId: data.userId });
  }

  @SubscribeMessage('meeting:lobby-admit-all')
  async handleLobbyAdmitAll(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; userIds: string[] }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    for (const userId of data.userIds || []) {
      this.notifyUser(userId, 'meeting:lobby-admitted', { meetingId: data.meetingId });
    }
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:lobby-updated', { action: 'admitted-all' });
  }

  @SubscribeMessage('meeting:lobby-deny')
  async handleLobbyDeny(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; userId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.notifyUser(data.userId, 'meeting:lobby-denied', { meetingId: data.meetingId });
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:lobby-updated', { action: 'denied', userId: data.userId });
  }

  // ── Reaction & hand raise events ──

  @SubscribeMessage('meeting:hand-raise')
  async handleHandRaise(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string }) {
    const info = this.socketParticipants.get(client.id);
    if (!info || !client.rooms.has(`meeting:${data.meetingId}`)) return;
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:participant-updated', {
      userId: info.userId, handRaised: true, handRaisedAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('meeting:hand-lower')
  async handleHandLower(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string }) {
    const info = this.socketParticipants.get(client.id);
    if (!info || !client.rooms.has(`meeting:${data.meetingId}`)) return;
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:participant-updated', {
      userId: info.userId, handRaised: false,
    });
  }

  @SubscribeMessage('meeting:hand-lower-all')
  async handleHandLowerAll(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:hands-lowered', {});
  }

  @SubscribeMessage('meeting:reaction')
  async handleReaction(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; emoji: string }) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    // Validate emoji: must be non-empty and max 10 characters
    if (!data.emoji || data.emoji.length > 10) {
      client.emit('error', { message: 'Invalid emoji: must be 1-10 characters' });
      return;
    }

    // Ephemeral — auto-dismiss on client after 5s
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:reaction:broadcast', {
      userId: info.userId, displayName: info.displayName, emoji: data.emoji,
    });
  }

  // ── Breakout room events ──

  @SubscribeMessage('meeting:breakout-open')
  async handleBreakoutOpen(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:breakout-opened', {});
  }

  @SubscribeMessage('meeting:breakout-close')
  async handleBreakoutClose(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:breakout-closed', {});
  }

  @SubscribeMessage('meeting:breakout-move')
  async handleBreakoutMove(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; userId: string; roomId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.notifyUser(data.userId, 'meeting:breakout-assigned', { meetingId: data.meetingId, roomId: data.roomId });
  }

  @SubscribeMessage('meeting:breakout-broadcast')
  async handleBreakoutBroadcast(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; message: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:breakout-broadcast', { message: data.message });
  }

  // ── Host mute participant ──

  @SubscribeMessage('meeting:mute-participant')
  async handleMuteParticipant(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string; userId: string }) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;
    this.notifyUser(data.userId, 'meeting:muted-by-host', { meetingId: data.meetingId });
  }

  // ── Recording consent ──

  @SubscribeMessage('meeting:recording-start')
  async handleRecordingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;

    const info = this.socketParticipants.get(client.id);

    // Broadcast recording started to ALL participants
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:recording-started', {
      meetingId: data.meetingId,
      startedBy: info?.userId,
      startedByName: info?.displayName || '',
      startedAt: new Date().toISOString(),
      requireConsent: meeting.settings?.requireRecordingConsent ?? true,
    });

    this.logger.log(`Recording started in meeting ${data.meetingId} — all participants notified`);
  }

  @SubscribeMessage('meeting:recording-stop')
  async handleRecordingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const meeting = await this.requireHostOrCoHost(client, data.meetingId);
    if (!meeting) return;

    const info = this.socketParticipants.get(client.id);
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:recording-stopped', {
      meetingId: data.meetingId,
      stoppedBy: info?.userId,
    });

    this.logger.log(`Recording stopped in meeting ${data.meetingId}`);
  }

  @SubscribeMessage('meeting:recording-consent')
  async handleRecordingConsent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const info = this.socketParticipants.get(client.id);
    if (!info) return;

    this.server.to(`meeting:${data.meetingId}`).emit('meeting:recording-consent-ack', {
      meetingId: data.meetingId,
      userId: info.userId,
      displayName: info.displayName,
      consentedAt: new Date().toISOString(),
    });

    this.logger.log(`${info.displayName} acknowledged recording in meeting ${data.meetingId}`);
  }

  // ── Utility ──

  notifyUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId) || new Set();
    sockets.forEach((sid) => this.server.to(sid).emit(event, data));
  }

  emitToRoom(meetingId: string, event: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit(event, data);
  }

  /**
   * UC-015: When the host disconnects, transfer host role to a co-host or
   * the earliest-joined remaining participant.
   */
  private async handleHostTransferOnDisconnect(
    meetingId: string,
    disconnectedUserId: string,
    remainingSockets: Set<string>,
  ): Promise<void> {
    const meeting = await this.meetingService.getMeeting(meetingId).catch(() => null);
    if (!meeting || meeting.hostId !== disconnectedUserId) return;

    // Determine remaining user IDs in the meeting room
    const remainingUserIds: string[] = [];
    for (const sid of remainingSockets) {
      const p = this.socketParticipants.get(sid);
      if (p?.userId && !remainingUserIds.includes(p.userId)) {
        remainingUserIds.push(p.userId);
      }
    }
    if (remainingUserIds.length === 0) return;

    // Prefer co-hosts first
    let newHostId: string | null = null;
    if (meeting.coHostIds?.length) {
      newHostId = meeting.coHostIds.find((id: string) => remainingUserIds.includes(id)) || null;
    }

    // Fall back to earliest-joined remaining participant
    if (!newHostId) {
      const joinedParticipants = (meeting.participants || [])
        .filter((p: any) => p.userId && remainingUserIds.includes(p.userId) && !p.leftAt)
        .sort((a: any, b: any) => (a.joinedAt?.getTime?.() || 0) - (b.joinedAt?.getTime?.() || 0));
      newHostId = joinedParticipants[0]?.userId || remainingUserIds[0];
    }

    if (!newHostId) return;

    // Update host in DB
    meeting.hostId = newHostId;
    await meeting.save();

    // Notify all participants
    this.server.to(`meeting:${meetingId}`).emit('meeting:host-transferred', {
      meetingId,
      previousHostId: disconnectedUserId,
      newHostId,
    });

    this.logger.log(`Meeting ${meetingId}: host transferred from ${disconnectedUserId} to ${newHostId}`);
  }
}
