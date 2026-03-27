import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MeetingService } from './meeting.service';

interface MeetingParticipantInfo {
  userId?: string;
  displayName: string;
  isAnonymous: boolean;
  socketId: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/meetings',
  transports: ['websocket', 'polling'],
})
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('MeetingGateway');

  // socketId -> participant info
  private socketParticipants = new Map<string, MeetingParticipantInfo>();
  // userId -> Set<socketId> (for registered users)
  private userSockets = new Map<string, Set<string>>();
  // meetingId -> Set<socketId>
  private meetingRooms = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private meetingService: MeetingService,
  ) {}

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
        // Token invalid — treat as anonymous if displayName provided later
      }
    }

    // Anonymous connection — displayName will come with meeting:join
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
    const speakerId = info?.userId || client.id;
    const speakerName = data.speakerName || info?.displayName || 'Unknown';

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
    this.server.to(`meeting:${data.meetingId}`).emit('meeting:chat', {
      socketId: client.id,
      userId: info?.userId,
      displayName: info?.displayName,
      text: data.text,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Utility ──

  notifyUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId) || new Set();
    sockets.forEach((sid) => this.server.to(sid).emit(event, data));
  }

  emitToRoom(meetingId: string, event: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit(event, data);
  }
}
