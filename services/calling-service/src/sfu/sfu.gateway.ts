import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SfuService } from './sfu.service';

/**
 * SFU Signaling Gateway.
 *
 * Handles mediasoup-specific WebSocket events for group calls and meetings:
 * - sfu:join — Join SFU room, get Router RTP capabilities + existing producers
 * - sfu:create-transport — Create send or recv WebRtcTransport
 * - sfu:connect-transport — Connect transport with DTLS parameters
 * - sfu:produce — Start producing media (audio/video/screen)
 * - sfu:consume — Create a consumer for another participant's producer
 * - sfu:resume-consumer — Resume a paused consumer
 * - sfu:leave — Leave SFU room, cleanup
 *
 * This runs alongside the existing CallingGateway (/calls namespace).
 * P2P calls continue to use the existing gateway.
 * Group calls (mode: 'group') use this SFU gateway.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
      .split(',').map(o => o.trim()),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  namespace: '/sfu',
})
export class SfuGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('SfuGateway');

  // Map socketId -> { userId, roomId }
  private socketMap = new Map<string, { userId: string; roomId: string }>();

  constructor(
    private sfuService: SfuService,
    private jwtService: JwtService,
  ) {}

  /**
   * Join an SFU room. Returns:
   * - routerRtpCapabilities (client needs these to create Device)
   * - existingProducers (so client can consume them)
   */
  @SubscribeMessage('sfu:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; rtpCapabilities?: any },
  ) {
    const { roomId, rtpCapabilities } = data;
    // Authenticate userId from JWT token, not from client-supplied data
    const token = client.handshake.auth?.token || client.handshake.query?.token as string;
    let userId: string;
    try {
      const payload = this.jwtService.verify(token);
      userId = payload.sub;
    } catch {
      client.emit('sfu:error', { message: 'Authentication required' });
      return;
    }
    if (!roomId || !userId) return;

    try {
      const room = await this.sfuService.createRoom(roomId);
      const participant = await room.addParticipant(userId);

      this.socketMap.set(client.id, { userId, roomId });
      client.join(`sfu:${roomId}`);

      // Get existing producers to consume
      const existingProducers = room.getOtherProducers(userId);

      const response: any = {
        routerRtpCapabilities: this.sfuService.getRouterRtpCapabilities(roomId),
        existingProducers,
      };

      // Return send/recv transport params if mediasoup is available
      if (participant.sendTransport) {
        response.sendTransport = {
          id: participant.sendTransport.id,
          iceParameters: participant.sendTransport.iceParameters,
          iceCandidates: participant.sendTransport.iceCandidates,
          dtlsParameters: participant.sendTransport.dtlsParameters,
          sctpParameters: participant.sendTransport.sctpParameters,
        };
      }
      if (participant.recvTransport) {
        response.recvTransport = {
          id: participant.recvTransport.id,
          iceParameters: participant.recvTransport.iceParameters,
          iceCandidates: participant.recvTransport.iceCandidates,
          dtlsParameters: participant.recvTransport.dtlsParameters,
          sctpParameters: participant.recvTransport.sctpParameters,
        };
      }

      // Notify others that a new participant joined
      client.to(`sfu:${roomId}`).emit('sfu:peer-joined', { userId });

      client.emit('sfu:joined', response);
      this.logger.log(`User ${userId} joined SFU room ${roomId}`);
    } catch (err) {
      client.emit('sfu:error', { message: err.message });
    }
  }

  /**
   * Connect a transport with DTLS parameters from the client.
   */
  @SubscribeMessage('sfu:connect-transport')
  async handleConnectTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { transportId: string; dtlsParameters: any },
  ) {
    const info = this.socketMap.get(client.id);
    if (!info) return;

    try {
      const room = this.sfuService.getRoom(info.roomId);
      const participant = room?.getParticipant(info.userId);
      if (!participant) return;

      // Find which transport matches the ID
      const transport = participant.sendTransport?.id === data.transportId
        ? participant.sendTransport
        : participant.recvTransport?.id === data.transportId
          ? participant.recvTransport
          : null;

      if (transport) {
        await transport.connect({ dtlsParameters: data.dtlsParameters });
        client.emit('sfu:transport-connected', { transportId: data.transportId });
      }
    } catch (err) {
      client.emit('sfu:error', { message: err.message });
    }
  }

  /**
   * Start producing media. Client sends RTP parameters, we create a Producer.
   */
  @SubscribeMessage('sfu:produce')
  async handleProduce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { kind: string; rtpParameters: any; appData?: any },
  ) {
    const info = this.socketMap.get(client.id);
    if (!info) return;

    try {
      const room = this.sfuService.getRoom(info.roomId);
      const participant = room?.getParticipant(info.userId);
      if (!participant?.sendTransport) {
        client.emit('sfu:error', { message: 'No send transport' });
        return;
      }

      const producer = await participant.sendTransport.produce({
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData || {},
      });

      participant.producers.set(producer.id, producer);

      // Notify all other participants in the room about the new producer
      client.to(`sfu:${info.roomId}`).emit('sfu:new-producer', {
        userId: info.userId,
        producerId: producer.id,
        kind: producer.kind,
      });

      client.emit('sfu:produced', { producerId: producer.id });
      this.logger.log(`User ${info.userId} producing ${data.kind} in room ${info.roomId}`);
    } catch (err) {
      client.emit('sfu:error', { message: err.message });
    }
  }

  /**
   * Consume another participant's producer.
   */
  @SubscribeMessage('sfu:consume')
  async handleConsume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { producerId: string; rtpCapabilities: any },
  ) {
    const info = this.socketMap.get(client.id);
    if (!info) return;

    try {
      const room = this.sfuService.getRoom(info.roomId);
      if (!room) return;

      const consumerData = await room.createConsumer(info.userId, data.producerId, data.rtpCapabilities);
      if (!consumerData) {
        client.emit('sfu:error', { message: 'Cannot consume this producer' });
        return;
      }

      client.emit('sfu:consumed', consumerData);
    } catch (err) {
      client.emit('sfu:error', { message: err.message });
    }
  }

  /**
   * Resume a paused consumer (after client-side setup is complete).
   */
  @SubscribeMessage('sfu:resume-consumer')
  async handleResumeConsumer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { consumerId: string },
  ) {
    const info = this.socketMap.get(client.id);
    if (!info) return;

    try {
      const room = this.sfuService.getRoom(info.roomId);
      const participant = room?.getParticipant(info.userId);
      const consumer = participant?.consumers.get(data.consumerId);
      if (consumer) {
        await consumer.resume();
        client.emit('sfu:consumer-resumed', { consumerId: data.consumerId });
      }
    } catch (err) {
      client.emit('sfu:error', { message: err.message });
    }
  }

  /**
   * Set preferred spatial/temporal layers on a consumer (for simulcast).
   */
  @SubscribeMessage('sfu:set-preferred-layers')
  async handleSetPreferredLayers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { consumerId: string; spatialLayer: number; temporalLayer: number },
  ) {
    const info = this.socketMap.get(client.id);
    if (!info) return;

    try {
      const room = this.sfuService.getRoom(info.roomId);
      const participant = room?.getParticipant(info.userId);
      const consumer = participant?.consumers.get(data.consumerId);
      if (consumer) {
        await consumer.setPreferredLayers({
          spatialLayer: data.spatialLayer,
          temporalLayer: data.temporalLayer,
        });
        client.emit('sfu:preferred-layers-set', { consumerId: data.consumerId });
      }
    } catch (err) {
      client.emit('sfu:error', { message: err.message });
    }
  }

  /**
   * Leave SFU room — cleanup transports, producers, consumers.
   */
  @SubscribeMessage('sfu:leave')
  async handleLeave(@ConnectedSocket() client: Socket) {
    await this.cleanupClient(client);
  }

  async handleDisconnect(client: Socket) {
    await this.cleanupClient(client);
  }

  private async cleanupClient(client: Socket) {
    const info = this.socketMap.get(client.id);
    if (!info) return;

    const room = this.sfuService.getRoom(info.roomId);
    if (room) {
      room.removeParticipant(info.userId);

      // Notify others
      client.to(`sfu:${info.roomId}`).emit('sfu:peer-left', { userId: info.userId });

      // Close empty rooms
      if (room.isEmpty()) {
        await this.sfuService.closeRoom(info.roomId);
      }
    }

    this.socketMap.delete(client.id);
    this.logger.log(`User ${info.userId} left SFU room ${info.roomId}`);
  }
}
