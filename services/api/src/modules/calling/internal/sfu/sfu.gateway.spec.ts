import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { SfuGateway } from './sfu.gateway';
import { SfuService } from './sfu.service';

// ── Helpers ──

function createMockSocket(overrides: Partial<any> = {}): any {
  const rooms = new Set<string>();
  return {
    id: overrides.id || `sock-${Math.random().toString(36).slice(2, 8)}`,
    handshake: overrides.handshake || { auth: {}, query: {} },
    rooms,
    join: jest.fn((room: string) => rooms.add(room)),
    leave: jest.fn((room: string) => rooms.delete(room)),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
  };
}

function createMockServer(): any {
  const mock: any = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  };
  mock.to.mockReturnValue(mock);
  return mock;
}

const USER_ID = 'user-1';
const ROOM_ID = 'room-abc';

function mockTransport(id = 'transport-1') {
  return {
    id,
    iceParameters: { ice: true },
    iceCandidates: [{ candidate: 'c1' }],
    dtlsParameters: { dtls: true },
    sctpParameters: null,
    connect: jest.fn().mockResolvedValue(undefined),
    produce: jest.fn(),
    close: jest.fn(),
  };
}

function mockParticipant(overrides: any = {}) {
  const sendT = mockTransport('send-t');
  const recvT = mockTransport('recv-t');
  return {
    userId: USER_ID,
    sendTransport: sendT,
    recvTransport: recvT,
    producers: new Map(),
    consumers: new Map(),
    ...overrides,
  };
}

function mockRoom(overrides: any = {}) {
  const participant = mockParticipant();
  return {
    id: ROOM_ID,
    addParticipant: jest.fn().mockResolvedValue(participant),
    removeParticipant: jest.fn(),
    getParticipant: jest.fn().mockReturnValue(participant),
    getOtherProducers: jest.fn().mockReturnValue([]),
    createConsumer: jest.fn(),
    isEmpty: jest.fn().mockReturnValue(false),
    close: jest.fn(),
    participant, // expose for test access
    ...overrides,
  };
}

describe('SfuGateway', () => {
  let gateway: SfuGateway;
  let jwtService: jest.Mocked<JwtService>;
  let sfuService: jest.Mocked<SfuService>;
  let server: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SfuGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
        {
          provide: SfuService,
          useValue: {
            createRoom: jest.fn(),
            getRoom: jest.fn(),
            closeRoom: jest.fn(),
            getRouterRtpCapabilities: jest.fn().mockReturnValue({ codecs: [] }),
          },
        },
      ],
    }).compile();

    gateway = module.get(SfuGateway);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    sfuService = module.get(SfuService) as jest.Mocked<SfuService>;

    server = createMockServer();
    (gateway as any).server = server;
  });

  afterEach(() => {
    (gateway as any).socketMap.clear();
  });

  // ─────────────────────────── sfu:join (includes auth) ───────────────────────────

  describe('sfu:join', () => {
    it('should authenticate via JWT and join room', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 'valid' }, query: {} } });
      jwtService.verify.mockReturnValue({ sub: USER_ID });

      const room = mockRoom();
      sfuService.createRoom.mockResolvedValue(room as any);

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(jwtService.verify).toHaveBeenCalledWith('valid');
      expect(sfuService.createRoom).toHaveBeenCalledWith(ROOM_ID);
      expect(client.join).toHaveBeenCalledWith(`sfu:${ROOM_ID}`);
      expect(client.emit).toHaveBeenCalledWith('sfu:joined', expect.objectContaining({
        routerRtpCapabilities: { codecs: [] },
        existingProducers: [],
      }));
    });

    it('should emit sfu:error for invalid JWT', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 'bad' }, query: {} } });
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(client.emit).toHaveBeenCalledWith('sfu:error', { message: 'Authentication required' });
      expect(sfuService.createRoom).not.toHaveBeenCalled();
    });

    it('should emit sfu:error when no token is provided', async () => {
      const client = createMockSocket({ handshake: { auth: {}, query: {} } });
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(client.emit).toHaveBeenCalledWith('sfu:error', { message: 'Authentication required' });
    });

    it('should notify other peers about new joiner', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 'tok' }, query: {} } });
      jwtService.verify.mockReturnValue({ sub: USER_ID });

      const room = mockRoom();
      sfuService.createRoom.mockResolvedValue(room as any);

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(client.to).toHaveBeenCalledWith(`sfu:${ROOM_ID}`);
      expect(client.emit).toHaveBeenCalledWith('sfu:peer-joined', { userId: USER_ID });
    });

    it('should return existing producers from other peers', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 'tok' }, query: {} } });
      jwtService.verify.mockReturnValue({ sub: USER_ID });

      const existingProducers = [
        { userId: 'other', producerId: 'p1', kind: 'audio' },
      ];
      const room = mockRoom({ getOtherProducers: jest.fn().mockReturnValue(existingProducers) });
      sfuService.createRoom.mockResolvedValue(room as any);

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(client.emit).toHaveBeenCalledWith('sfu:joined', expect.objectContaining({
        existingProducers,
      }));
    });

    it('should include transport params in response', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 'tok' }, query: {} } });
      jwtService.verify.mockReturnValue({ sub: USER_ID });

      const room = mockRoom();
      sfuService.createRoom.mockResolvedValue(room as any);

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      const joinedCall = client.emit.mock.calls.find(
        (c: any[]) => c[0] === 'sfu:joined',
      );
      expect(joinedCall).toBeDefined();
      const response = joinedCall[1];
      expect(response.sendTransport).toBeDefined();
      expect(response.sendTransport.id).toBe('send-t');
      expect(response.recvTransport).toBeDefined();
      expect(response.recvTransport.id).toBe('recv-t');
    });

    it('should emit sfu:error when createRoom throws', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 'tok' }, query: {} } });
      jwtService.verify.mockReturnValue({ sub: USER_ID });

      sfuService.createRoom.mockRejectedValue(new Error('Worker crashed'));

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(client.emit).toHaveBeenCalledWith('sfu:error', { message: 'Worker crashed' });
    });

    it('should read token from query if not in auth', async () => {
      const client = createMockSocket({ handshake: { auth: {}, query: { token: 'query-tok' } } });
      jwtService.verify.mockReturnValue({ sub: USER_ID });

      const room = mockRoom();
      sfuService.createRoom.mockResolvedValue(room as any);

      await gateway.handleJoin(client, { roomId: ROOM_ID, userId: USER_ID });

      expect(jwtService.verify).toHaveBeenCalledWith('query-tok');
    });
  });

  // ─────────────────────────── sfu:connect-transport ───────────────────────────

  describe('sfu:connect-transport', () => {
    it('should connect send transport with DTLS parameters', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom();
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      const dtlsParams = { fingerprints: [{ algorithm: 'sha-256', value: 'abc' }] };
      await gateway.handleConnectTransport(client, {
        transportId: 'send-t',
        dtlsParameters: dtlsParams,
      });

      expect(room.participant.sendTransport.connect).toHaveBeenCalledWith({
        dtlsParameters: dtlsParams,
      });
      expect(client.emit).toHaveBeenCalledWith('sfu:transport-connected', { transportId: 'send-t' });
    });

    it('should connect recv transport', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom();
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleConnectTransport(client, {
        transportId: 'recv-t',
        dtlsParameters: { dtls: 'params' },
      });

      expect(room.participant.recvTransport.connect).toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('sfu:transport-connected', { transportId: 'recv-t' });
    });

    it('should do nothing when socket is not registered', async () => {
      const client = createMockSocket();
      await gateway.handleConnectTransport(client, { transportId: 'x', dtlsParameters: {} });

      expect(sfuService.getRoom).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('should emit sfu:error on transport connect failure', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const participant = mockParticipant();
      participant.sendTransport.connect.mockRejectedValue(new Error('DTLS failed'));
      const room = mockRoom({ getParticipant: jest.fn().mockReturnValue(participant) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleConnectTransport(client, { transportId: 'send-t', dtlsParameters: {} });

      expect(client.emit).toHaveBeenCalledWith('sfu:error', { message: 'DTLS failed' });
    });
  });

  // ─────────────────────────── sfu:produce ───────────────────────────

  describe('sfu:produce', () => {
    it('should create producer and notify peers', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const participant = mockParticipant();
      const mockProducer = { id: 'prod-1', kind: 'audio' };
      participant.sendTransport.produce.mockResolvedValue(mockProducer);

      const room = mockRoom({ getParticipant: jest.fn().mockReturnValue(participant) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleProduce(client, {
        kind: 'audio',
        rtpParameters: { codecs: [] },
      });

      expect(participant.sendTransport.produce).toHaveBeenCalledWith({
        kind: 'audio',
        rtpParameters: { codecs: [] },
        appData: {},
      });
      expect(participant.producers.get('prod-1')).toBe(mockProducer);
      expect(client.to).toHaveBeenCalledWith(`sfu:${ROOM_ID}`);
      expect(client.emit).toHaveBeenCalledWith('sfu:new-producer', {
        userId: USER_ID,
        producerId: 'prod-1',
        kind: 'audio',
      });
      expect(client.emit).toHaveBeenCalledWith('sfu:produced', { producerId: 'prod-1' });
    });

    it('should emit error when no send transport exists', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const participant = mockParticipant({ sendTransport: null });
      const room = mockRoom({ getParticipant: jest.fn().mockReturnValue(participant) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleProduce(client, { kind: 'video', rtpParameters: {} });

      expect(client.emit).toHaveBeenCalledWith('sfu:error', { message: 'No send transport' });
    });

    it('should do nothing when socket is not registered', async () => {
      const client = createMockSocket();
      await gateway.handleProduce(client, { kind: 'audio', rtpParameters: {} });
      expect(sfuService.getRoom).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────── sfu:consume ───────────────────────────

  describe('sfu:consume', () => {
    it('should create consumer and emit consumed data', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const consumerData = { id: 'cons-1', producerId: 'prod-1', kind: 'audio', rtpParameters: {} };
      const room = mockRoom({ createConsumer: jest.fn().mockResolvedValue(consumerData) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleConsume(client, {
        producerId: 'prod-1',
        rtpCapabilities: { codecs: [] },
      });

      expect(room.createConsumer).toHaveBeenCalledWith(USER_ID, 'prod-1', { codecs: [] });
      expect(client.emit).toHaveBeenCalledWith('sfu:consumed', consumerData);
    });

    it('should emit error when consumer cannot be created', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom({ createConsumer: jest.fn().mockResolvedValue(null) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleConsume(client, { producerId: 'p', rtpCapabilities: {} });

      expect(client.emit).toHaveBeenCalledWith('sfu:error', {
        message: 'Cannot consume this producer',
      });
    });
  });

  // ─────────────────────────── sfu:resume-consumer ───────────────────────────

  describe('sfu:resume-consumer', () => {
    it('should resume a paused consumer', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const consumer = { resume: jest.fn().mockResolvedValue(undefined) };
      const participant = mockParticipant();
      participant.consumers.set('cons-1', consumer);

      const room = mockRoom({ getParticipant: jest.fn().mockReturnValue(participant) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleResumeConsumer(client, { consumerId: 'cons-1' });

      expect(consumer.resume).toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('sfu:consumer-resumed', { consumerId: 'cons-1' });
    });
  });

  // ─────────────────────────── sfu:set-preferred-layers ───────────────────────────

  describe('sfu:set-preferred-layers', () => {
    it('should set simulcast layers on consumer', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const consumer = { setPreferredLayers: jest.fn().mockResolvedValue(undefined) };
      const participant = mockParticipant();
      participant.consumers.set('cons-1', consumer);

      const room = mockRoom({ getParticipant: jest.fn().mockReturnValue(participant) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleSetPreferredLayers(client, {
        consumerId: 'cons-1',
        spatialLayer: 2,
        temporalLayer: 1,
      });

      expect(consumer.setPreferredLayers).toHaveBeenCalledWith({
        spatialLayer: 2,
        temporalLayer: 1,
      });
      expect(client.emit).toHaveBeenCalledWith('sfu:preferred-layers-set', { consumerId: 'cons-1' });
    });
  });

  // ─────────────────────────── sfu:leave ───────────────────────────

  describe('sfu:leave', () => {
    it('should clean up participant and notify peers', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom();
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleLeave(client);

      expect(room.removeParticipant).toHaveBeenCalledWith(USER_ID);
      expect(client.to).toHaveBeenCalledWith(`sfu:${ROOM_ID}`);
      expect(client.emit).toHaveBeenCalledWith('sfu:peer-left', { userId: USER_ID });
      expect((gateway as any).socketMap.has('sock-1')).toBe(false);
    });

    it('should close room if empty after leave', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom({ isEmpty: jest.fn().mockReturnValue(true) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleLeave(client);

      expect(sfuService.closeRoom).toHaveBeenCalledWith(ROOM_ID);
    });

    it('should not close room if other participants remain', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom({ isEmpty: jest.fn().mockReturnValue(false) });
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleLeave(client);

      expect(sfuService.closeRoom).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────── handleDisconnect ───────────────────────────

  describe('handleDisconnect', () => {
    it('should clean up on disconnect (same as leave)', async () => {
      const client = createMockSocket({ id: 'sock-1' });
      const room = mockRoom();
      (gateway as any).socketMap.set('sock-1', { userId: USER_ID, roomId: ROOM_ID });
      sfuService.getRoom.mockReturnValue(room as any);

      await gateway.handleDisconnect(client);

      expect(room.removeParticipant).toHaveBeenCalledWith(USER_ID);
      expect((gateway as any).socketMap.has('sock-1')).toBe(false);
    });

    it('should do nothing for unknown socket', async () => {
      const client = createMockSocket();
      await gateway.handleDisconnect(client);

      expect(sfuService.getRoom).not.toHaveBeenCalled();
    });
  });
});
