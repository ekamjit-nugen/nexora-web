import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { mediasoupConfig } from './sfu.config';

// mediasoup types — imported conditionally to allow graceful fallback
let mediasoup: any = null;

type Worker = any;
type Router = any;
type WebRtcTransport = any;
type Producer = any;
type Consumer = any;

@Injectable()
export class SfuService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SfuService.name);
  private workers: Worker[] = [];
  private workerRouterCounts: number[] = [];
  private rooms = new Map<string, SfuRoom>();
  private initialized = false;

  async onModuleInit() {
    try {
      mediasoup = await (Function('return import("mediasoup")')());
      const numWorkers = parseInt(process.env.MEDIASOUP_WORKERS || '1');

      for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker(mediasoupConfig.worker);
        worker.on('died', () => {
          this.logger.error(`mediasoup Worker died [pid:${worker.pid}], restarting...`);
          setTimeout(() => this.replaceWorker(i), 2000);
        });
        this.workers.push(worker);
        this.workerRouterCounts.push(0);
        this.logger.log(`mediasoup Worker created [pid:${worker.pid}]`);
      }

      this.initialized = true;
      this.logger.log(`SFU Service initialized with ${numWorkers} mediasoup worker(s)`);
    } catch (err) {
      this.logger.warn(`mediasoup not available — running in stub mode. Error: ${err.message}`);
      this.logger.warn('Group calls will use P2P fallback. Install mediasoup for SFU support.');
      this.initialized = false;
    }
  }

  async onModuleDestroy() {
    for (const [, room] of this.rooms) {
      room.close();
    }
    this.rooms.clear();

    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
    this.logger.log('SFU Service destroyed');
  }

  isAvailable(): boolean {
    return this.initialized && this.workers.length > 0;
  }

  /**
   * Least-loaded worker selection: pick the worker with the fewest routers.
   */
  private getLeastLoadedWorker(): { worker: Worker; index: number } {
    let minIdx = 0;
    let minCount = this.workerRouterCounts[0] ?? 0;
    for (let i = 1; i < this.workers.length; i++) {
      if (this.workerRouterCounts[i] < minCount) {
        minCount = this.workerRouterCounts[i];
        minIdx = i;
      }
    }
    return { worker: this.workers[minIdx], index: minIdx };
  }

  private async replaceWorker(index: number): Promise<void> {
    try {
      const worker = await mediasoup.createWorker(mediasoupConfig.worker);
      worker.on('died', () => {
        this.logger.error(`Replacement Worker died [pid:${worker.pid}]`);
        setTimeout(() => this.replaceWorker(index), 2000);
      });
      this.workers[index] = worker;
      this.workerRouterCounts[index] = 0;
      this.logger.log(`Replacement Worker created [pid:${worker.pid}]`);
    } catch (err) {
      this.logger.error(`Failed to create replacement worker: ${err.message}`);
    }
  }

  async createRoom(roomId: string): Promise<SfuRoom> {
    if (this.rooms.has(roomId)) return this.rooms.get(roomId)!;

    let router: Router = null;
    let workerIndex = -1;
    if (this.isAvailable()) {
      const { worker, index } = this.getLeastLoadedWorker();
      workerIndex = index;
      router = await worker.createRouter({ mediaCodecs: mediasoupConfig.routerMediaCodecs });
      this.workerRouterCounts[workerIndex]++;
      this.logger.log(`mediasoup Router created for room ${roomId} on worker ${workerIndex}`);
    }

    const room = new SfuRoom(roomId, router, workerIndex);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): SfuRoom | undefined {
    return this.rooms.get(roomId);
  }

  async closeRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      if (room.workerIndex >= 0 && room.workerIndex < this.workerRouterCounts.length) {
        this.workerRouterCounts[room.workerIndex] = Math.max(0, this.workerRouterCounts[room.workerIndex] - 1);
      }
      room.close();
      this.rooms.delete(roomId);
      this.logger.log(`Room ${roomId} closed`);
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Create a PlainTransport on the room's router for recording egress.
   * Listens on 127.0.0.1 with rtcpMux enabled and comedia disabled.
   */
  async createPlainTransport(roomId: string): Promise<any> {
    const room = this.rooms.get(roomId);
    if (!room?.router) {
      throw new Error(`Room ${roomId} not found or has no router`);
    }

    const transport = await room.router.createPlainTransport({
      listenIp: '127.0.0.1',
      rtcpMux: true,
      comedia: false,
    });

    this.logger.log(`PlainTransport created for room ${roomId} [id:${transport.id}]`);
    return transport;
  }

  getRouterRtpCapabilities(roomId?: string): object {
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room?.router) return room.router.rtpCapabilities;
    }
    return { codecs: mediasoupConfig.routerMediaCodecs };
  }
}

/**
 * SFU Room — wraps a mediasoup Router.
 * Each group call / meeting gets one room.
 */
export class SfuRoom {
  readonly id: string;
  readonly router: Router;
  readonly workerIndex: number;
  private participants = new Map<string, SfuParticipant>();
  private closed = false;

  constructor(id: string, router: Router, workerIndex: number = -1) {
    this.id = id;
    this.router = router;
    this.workerIndex = workerIndex;
  }

  async addParticipant(userId: string): Promise<SfuParticipant> {
    if (this.participants.has(userId)) return this.participants.get(userId)!;

    const participant = new SfuParticipant(userId);

    if (this.router) {
      participant.sendTransport = await this.createWebRtcTransport();
      participant.recvTransport = await this.createWebRtcTransport();
    }

    this.participants.set(userId, participant);
    return participant;
  }

  removeParticipant(userId: string): void {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.close();
      this.participants.delete(userId);
    }
  }

  getParticipant(userId: string): SfuParticipant | undefined {
    return this.participants.get(userId);
  }

  getParticipantIds(): string[] {
    return Array.from(this.participants.keys());
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }

  /**
   * Get all producers from other participants (for consumer creation).
   */
  getOtherProducers(excludeUserId: string): Array<{ userId: string; producerId: string; kind: string }> {
    const result: Array<{ userId: string; producerId: string; kind: string }> = [];
    for (const [userId, participant] of this.participants) {
      if (userId === excludeUserId) continue;
      for (const [producerId, producer] of participant.producers) {
        result.push({ userId, producerId, kind: producer.kind || 'unknown' });
      }
    }
    return result;
  }

  /**
   * Create a consumer on the receiver's transport for a given producer.
   */
  async createConsumer(receiverUserId: string, producerId: string, rtpCapabilities: any): Promise<any> {
    if (!this.router) return null;

    const receiver = this.participants.get(receiverUserId);
    if (!receiver?.recvTransport) return null;

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      return null;
    }

    const consumer = await receiver.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, client resumes after setup
    });

    receiver.consumers.set(consumer.id, consumer);
    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  private async createWebRtcTransport(): Promise<WebRtcTransport> {
    if (!this.router) return null;
    const transport = await this.router.createWebRtcTransport(mediasoupConfig.webRtcTransport);
    if (mediasoupConfig.webRtcTransport.maxIncomingBitrate) {
      try { await transport.setMaxIncomingBitrate(mediasoupConfig.webRtcTransport.maxIncomingBitrate); } catch {}
    }
    return transport;
  }

  close(): void {
    for (const [, participant] of this.participants) participant.close();
    this.participants.clear();
    if (this.router) this.router.close();
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

export class SfuParticipant {
  readonly userId: string;
  sendTransport: WebRtcTransport = null;
  recvTransport: WebRtcTransport = null;
  producers = new Map<string, Producer>();
  consumers = new Map<string, Consumer>();
  private closed = false;

  constructor(userId: string) {
    this.userId = userId;
  }

  close(): void {
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producers.forEach(p => p.close());
    this.consumers.forEach(c => c.close());
    this.producers.clear();
    this.consumers.clear();
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}
