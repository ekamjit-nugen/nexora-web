import { SfuService, SfuRoom } from '../../src/sfu/sfu.service';

describe('SFU Room Lifecycle', () => {
  let sfuService: SfuService;

  beforeEach(() => {
    sfuService = new SfuService();
  });

  afterEach(async () => {
    await sfuService.onModuleDestroy();
  });

  describe('Room management', () => {
    it('should create a new room', async () => {
      const room = await sfuService.createRoom('call-123');
      expect(room).toBeDefined();
      expect(room.id).toBe('call-123');
      expect(sfuService.getRoomCount()).toBe(1);
    });

    it('should return existing room if already created', async () => {
      const room1 = await sfuService.createRoom('call-123');
      const room2 = await sfuService.createRoom('call-123');
      expect(room1).toBe(room2);
      expect(sfuService.getRoomCount()).toBe(1);
    });

    it('should close a room and clean up', async () => {
      await sfuService.createRoom('call-123');
      expect(sfuService.getRoomCount()).toBe(1);

      await sfuService.closeRoom('call-123');
      expect(sfuService.getRoomCount()).toBe(0);
      expect(sfuService.getRoom('call-123')).toBeUndefined();
    });

    it('should handle closing non-existent room gracefully', async () => {
      await sfuService.closeRoom('nonexistent');
      expect(sfuService.getRoomCount()).toBe(0);
    });
  });

  describe('Participant management', () => {
    let room: SfuRoom;

    beforeEach(async () => {
      room = await sfuService.createRoom('call-456');
    });

    it('should add participants to room', () => {
      const p1 = room.addParticipant('user-1');
      const p2 = room.addParticipant('user-2');

      expect(p1.userId).toBe('user-1');
      expect(p2.userId).toBe('user-2');
      expect(room.getParticipantCount()).toBe(2);
      expect(room.getParticipantIds()).toEqual(['user-1', 'user-2']);
    });

    it('should return existing participant if already added', () => {
      const p1 = room.addParticipant('user-1');
      const p2 = room.addParticipant('user-1');
      expect(p1).toBe(p2);
      expect(room.getParticipantCount()).toBe(1);
    });

    it('should remove participant and close their resources', () => {
      room.addParticipant('user-1');
      room.addParticipant('user-2');

      room.removeParticipant('user-1');
      expect(room.getParticipantCount()).toBe(1);
      expect(room.getParticipant('user-1')).toBeUndefined();
    });

    it('should report empty room correctly', () => {
      expect(room.isEmpty()).toBe(true);
      room.addParticipant('user-1');
      expect(room.isEmpty()).toBe(false);
      room.removeParticipant('user-1');
      expect(room.isEmpty()).toBe(true);
    });

    it('should close room and all participants', () => {
      const p1 = room.addParticipant('user-1');
      const p2 = room.addParticipant('user-2');

      room.close();
      expect(room.isClosed()).toBe(true);
      expect(room.getParticipantCount()).toBe(0);
      expect(p1.isClosed()).toBe(true);
      expect(p2.isClosed()).toBe(true);
    });
  });

  describe('RTP capabilities', () => {
    it('should return router RTP capabilities with supported codecs', () => {
      const caps = sfuService.getRouterRtpCapabilities();
      expect(caps).toBeDefined();
      expect((caps as any).codecs).toBeDefined();
      expect((caps as any).codecs.length).toBeGreaterThan(0);

      const audioCodec = (caps as any).codecs.find((c: any) => c.kind === 'audio');
      expect(audioCodec).toBeDefined();
      expect(audioCodec.mimeType).toBe('audio/opus');

      const videoCodec = (caps as any).codecs.find((c: any) => c.mimeType === 'video/VP8');
      expect(videoCodec).toBeDefined();
    });
  });

  describe('Multi-room management', () => {
    it('should manage multiple rooms independently', async () => {
      const room1 = await sfuService.createRoom('room-1');
      const room2 = await sfuService.createRoom('room-2');

      room1.addParticipant('user-A');
      room2.addParticipant('user-B');
      room2.addParticipant('user-C');

      expect(room1.getParticipantCount()).toBe(1);
      expect(room2.getParticipantCount()).toBe(2);
      expect(sfuService.getRoomCount()).toBe(2);

      await sfuService.closeRoom('room-1');
      expect(sfuService.getRoomCount()).toBe(1);
      expect(room2.getParticipantCount()).toBe(2);
    });
  });
});
