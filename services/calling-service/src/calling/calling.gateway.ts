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
import { CallingService } from './calling.service';
import { InitiateCallDto, AnswerCallDto, RejectCallDto, EndCallDto, IceCandidateDto, MediaNegotiationDto } from './dto/index';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/calls',
  transports: ['websocket', 'polling'],
})
export class CallingGateway implements OnGatewayConnection, OnGatewayDisconnect {
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

  constructor(
    private jwtService: JwtService,
    private callingService: CallingService,
  ) {}

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

      this.socketUsers.set(client.id, userId);
      // Store display name from JWT for use in call events
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
          // Check if this user has other sockets still in the call
          const userHasOtherSockets = Array.from(sockets).some(
            (sid) => this.socketUsers.get(sid) === userId,
          );
          if (!userHasOtherSockets) {
            if (sockets.size > 0) {
              // Other participants remain — notify them this person left, but DON'T end the call
              this.server.to(`call:${callId}`).emit('call:participant-left', {
                callId,
                userId,
                reason: 'disconnected',
              });
              this.logger.log(`User ${userId} left call ${callId} (disconnected), ${sockets.size} socket(s) remain`);
            } else {
              // Last person — end the call
              this.server.to(`call:${callId}`).emit('call:ended', {
                callId,
                endedBy: userId,
                reason: 'disconnected',
              });
              this.callSessions.delete(callId);
              this.logger.log(`Call ${callId} ended — last participant ${userId} disconnected`);
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

    try {
      // Create call in database
      const call = await this.callingService.initiateCall(userId, 'default-org', data);

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
          conversationId: data.conversationId,
        });
      });

      // Send confirmation to initiator
      client.emit('call:initiated', {
        callId: call.callId,
        status: call.status,
        type: call.type,
      });

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
      const call = await this.callingService.answerCall(
        data.callId,
        userId,
        data.audioEnabled ?? true,
        data.videoEnabled ?? false,
      );

      // Add recipient to call room
      client.join(`call:${call.callId}`);
      const callSockets = this.callSessions.get(call.callId) || new Set();
      callSockets.add(client.id);
      this.callSessions.set(call.callId, callSockets);

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

      // Notify initiator that call was rejected
      this.server.to(`call:${call.callId}`).emit('call:rejected', {
        callId: call.callId,
        rejectedBy: userId,
        reason: data.reason,
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
      // Remove this user's socket from the call session
      const callSockets = this.callSessions.get(data.callId);
      if (callSockets) {
        callSockets.delete(client.id);
      }
      client.leave(`call:${data.callId}`);

      const remainingSockets = callSockets ? callSockets.size : 0;

      if (remainingSockets > 0) {
        // Other participants remain — mark this user as left but keep call alive
        await this.callingService.leaveCall(data.callId, userId);

        // Notify remaining participants
        this.server.to(`call:${data.callId}`).emit('call:participant-left', {
          callId: data.callId,
          userId,
          reason: 'left',
        });

        this.logger.log(`User ${userId} left call ${data.callId}, ${remainingSockets} socket(s) remain`);
      } else {
        // Last person — fully end the call
        const call = await this.callingService.endCall(data.callId, userId);

        // Notify all participants that call ended
        call.participantIds?.forEach(pid => {
          this.emitToUser(pid, 'call:ended', {
            callId: call.callId,
            endedBy: userId,
            duration: call.duration,
          });
        });

        // Clean up call room
        this.callSessions.delete(call.callId);
        this.logger.log(`Call ended: ${call.callId} by ${userId}`);
      }
    } catch (err) {
      client.emit('error', { message: err.message });
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
      // Forward SDP offer to other participants
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
      // Forward SDP answer to other participants
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
      // Forward ICE candidate to other participants
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
}
