import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MeetingGateway } from './meeting.gateway';
import { MeetingService } from './meeting.service';

// ── Helpers ──

function createMockSocket(overrides: Partial<any> = {}): any {
  const rooms = new Set<string>();
  return {
    id: overrides.id || `socket-${Math.random().toString(36).slice(2, 8)}`,
    handshake: overrides.handshake || { auth: {}, headers: {} },
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
  // chain: server.to(room).emit(...)
  mock.to.mockReturnValue(mock);
  return mock;
}

const HOST_USER_ID = 'host-user-1';
const REGULAR_USER_ID = 'regular-user-2';
const COHOST_USER_ID = 'cohost-user-3';
const MEETING_ID = 'meeting-abc';

function makeMeeting(overrides: any = {}) {
  return {
    meetingId: MEETING_ID,
    title: 'Standup',
    hostId: HOST_USER_ID,
    coHostIds: [COHOST_USER_ID],
    status: 'active',
    isRecording: false,
    recordingEnabled: false,
    participants: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MeetingGateway', () => {
  let gateway: MeetingGateway;
  let jwtService: JwtService;
  let meetingService: jest.Mocked<MeetingService>;
  let server: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: MeetingService,
          useValue: {
            joinMeeting: jest.fn(),
            leaveMeeting: jest.fn(),
            getMeeting: jest.fn(),
            addTranscript: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get(MeetingGateway);
    jwtService = module.get(JwtService);
    meetingService = module.get(MeetingService) as jest.Mocked<MeetingService>;

    server = createMockServer();
    (gateway as any).server = server;
  });

  afterEach(() => {
    // Clear internal maps between tests
    (gateway as any).socketParticipants.clear();
    (gateway as any).userSockets.clear();
    (gateway as any).meetingRooms.clear();
    (gateway as any).transcriptRateLimit.clear();
  });

  // ─────────────────────────── handleConnection ───────────────────────────

  describe('handleConnection', () => {
    it('should authenticate user with valid JWT and emit meeting:connected', async () => {
      const client = createMockSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} },
      });
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: HOST_USER_ID,
        firstName: 'John',
        lastName: 'Doe',
      });

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(client.emit).toHaveBeenCalledWith('meeting:connected', {
        userId: HOST_USER_ID,
        displayName: 'John Doe',
      });
      expect((gateway as any).socketParticipants.get(client.id)).toMatchObject({
        userId: HOST_USER_ID,
        isAnonymous: false,
      });
    });

    it('should disconnect client with invalid JWT', async () => {
      const client = createMockSocket({
        handshake: { auth: { token: 'bad-token' }, headers: {} },
      });
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('meeting:error', {
        message: 'Invalid or expired authentication token',
      });
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should allow anonymous connection when no token is provided', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, headers: {} },
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('meeting:connected', { anonymous: true });
      const info = (gateway as any).socketParticipants.get(client.id);
      expect(info.isAnonymous).toBe(true);
      expect(info.displayName).toBe('Guest');
    });

    it('should extract token from Authorization header if not in auth', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, headers: { authorization: 'Bearer header-token' } },
      });
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-from-header',
        email: 'test@example.com',
      });

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('header-token');
      expect(client.emit).toHaveBeenCalledWith('meeting:connected', {
        userId: 'user-from-header',
        displayName: 'test@example.com',
      });
    });

    it('should track multiple sockets for same userId', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'same-user' });

      const c1 = createMockSocket({ handshake: { auth: { token: 't1' }, headers: {} } });
      const c2 = createMockSocket({ handshake: { auth: { token: 't2' }, headers: {} } });

      await gateway.handleConnection(c1);
      await gateway.handleConnection(c2);

      const sockets = (gateway as any).userSockets.get('same-user');
      expect(sockets.size).toBe(2);
      expect(sockets.has(c1.id)).toBe(true);
      expect(sockets.has(c2.id)).toBe(true);
    });
  });

  // ─────────────────────────── meeting:join ───────────────────────────

  describe('meeting:join', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 'tok' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);
    });

    it('should join meeting and emit meeting:joined with participants', async () => {
      const meeting = makeMeeting();
      meetingService.joinMeeting.mockResolvedValue(meeting as any);

      await gateway.handleJoin(client, { meetingId: MEETING_ID });

      expect(meetingService.joinMeeting).toHaveBeenCalledWith(
        MEETING_ID, REGULAR_USER_ID, 'Jane', false,
      );
      expect(client.join).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(client.emit).toHaveBeenCalledWith('meeting:joined', expect.objectContaining({
        meetingId: MEETING_ID,
        participants: expect.any(Array),
        yourSocketId: client.id,
      }));
    });

    it('should broadcast participant-joined to existing participants', async () => {
      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);

      await gateway.handleJoin(client, { meetingId: MEETING_ID });

      expect(client.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      // The broadcast uses client.to().emit
      expect(client.emit).toHaveBeenCalledWith(
        'meeting:participant-joined',
        expect.objectContaining({ userId: REGULAR_USER_ID }),
      );
    });

    it('should emit error when joinMeeting throws', async () => {
      meetingService.joinMeeting.mockRejectedValue(new Error('Meeting full'));

      await gateway.handleJoin(client, { meetingId: MEETING_ID });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Meeting full' });
    });

    it('should update anonymous displayName when provided', async () => {
      // Create anonymous socket
      const anonClient = createMockSocket({ handshake: { auth: {}, headers: {} } });
      await gateway.handleConnection(anonClient);
      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);

      await gateway.handleJoin(anonClient, { meetingId: MEETING_ID, displayName: 'Bob' });

      const info = (gateway as any).socketParticipants.get(anonClient.id);
      expect(info.displayName).toBe('Bob');
    });
  });

  // ─────────────────────────── meeting:leave ───────────────────────────

  describe('meeting:leave', () => {
    it('should leave meeting and emit participant-left', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);

      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleJoin(client, { meetingId: MEETING_ID });

      meetingService.leaveMeeting.mockResolvedValue(undefined as any);
      await gateway.handleLeave(client, { meetingId: MEETING_ID });

      expect(client.leave).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(meetingService.leaveMeeting).toHaveBeenCalledWith(MEETING_ID, REGULAR_USER_ID, 'Jane');
    });
  });

  // ─────────────────────────── meeting:media-state ───────────────────────────

  describe('meeting:media-state', () => {
    it('should broadcast media state to room', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      gateway.handleMediaState(client, {
        meetingId: MEETING_ID,
        audioEnabled: true,
        videoEnabled: false,
      });

      expect(client.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(client.emit).toHaveBeenCalledWith('meeting:media-state', {
        socketId: client.id,
        audioEnabled: true,
        videoEnabled: false,
      });
    });
  });

  // ─────────────────────────── meeting:screen-share ───────────────────────────

  describe('meeting:screen-share-start/stop', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);
    });

    it('should broadcast screen-share-started', () => {
      gateway.handleScreenShareStart(client, { meetingId: MEETING_ID });

      expect(client.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(client.emit).toHaveBeenCalledWith('meeting:screen-share-started', expect.objectContaining({
        socketId: client.id,
        userId: REGULAR_USER_ID,
      }));
    });

    it('should broadcast screen-share-stopped', () => {
      gateway.handleScreenShareStop(client, { meetingId: MEETING_ID });

      expect(client.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(client.emit).toHaveBeenCalledWith('meeting:screen-share-stopped', { socketId: client.id });
    });
  });

  // ─────────────────────────── meeting:chat ───────────────────────────

  describe('meeting:chat', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);
      // Simulate the client being in the meeting room
      client.rooms.add(`meeting:${MEETING_ID}`);
    });

    it('should broadcast chat message to room', () => {
      gateway.handleChat(client, { meetingId: MEETING_ID, text: 'Hello!' });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:chat', expect.objectContaining({
        text: 'Hello!',
        userId: REGULAR_USER_ID,
        displayName: 'Jane',
      }));
    });

    it('should reject chat message exceeding 5000 characters', () => {
      const longText = 'x'.repeat(5001);
      gateway.handleChat(client, { meetingId: MEETING_ID, text: longText });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Invalid message content' });
      expect(server.to).not.toHaveBeenCalled();
    });

    it('should reject empty chat message', () => {
      gateway.handleChat(client, { meetingId: MEETING_ID, text: '' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Invalid message content' });
    });

    it('should reject chat if client is not in the meeting room', () => {
      client.rooms.delete(`meeting:${MEETING_ID}`);
      gateway.handleChat(client, { meetingId: MEETING_ID, text: 'Hi' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'You are not in this meeting' });
    });
  });

  // ─────────────────────────── meeting:hand-raise / lower ───────────────────────────

  describe('meeting:hand-raise and meeting:hand-lower', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);
      client.rooms.add(`meeting:${MEETING_ID}`);
    });

    it('should emit participant-updated with handRaised=true on raise', async () => {
      await gateway.handleHandRaise(client, { meetingId: MEETING_ID });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:participant-updated', expect.objectContaining({
        userId: REGULAR_USER_ID,
        handRaised: true,
      }));
    });

    it('should emit participant-updated with handRaised=false on lower', async () => {
      await gateway.handleHandLower(client, { meetingId: MEETING_ID });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:participant-updated', {
        userId: REGULAR_USER_ID,
        handRaised: false,
      });
    });

    it('should not emit if client is not in the meeting room', async () => {
      client.rooms.delete(`meeting:${MEETING_ID}`);
      await gateway.handleHandRaise(client, { meetingId: MEETING_ID });

      expect(server.to).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────── meeting:hand-lower-all ───────────────────────────

  describe('meeting:hand-lower-all', () => {
    it('should lower all hands when called by host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleHandLowerAll(client, { meetingId: MEETING_ID });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:hands-lowered', {});
    });

    it('should emit error when called by non-host/non-cohost', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleHandLowerAll(client, { meetingId: MEETING_ID });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });
  });

  // ─────────────────────────── meeting:reaction ───────────────────────────

  describe('meeting:reaction', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);
    });

    it('should broadcast valid reaction', async () => {
      await gateway.handleReaction(client, { meetingId: MEETING_ID, emoji: '👍' });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:reaction:broadcast', expect.objectContaining({
        emoji: '👍',
        userId: REGULAR_USER_ID,
      }));
    });

    it('should reject emoji exceeding 10 characters', async () => {
      await gateway.handleReaction(client, { meetingId: MEETING_ID, emoji: 'a'.repeat(11) });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid emoji: must be 1-10 characters',
      });
      expect(server.to).not.toHaveBeenCalled();
    });

    it('should reject empty emoji', async () => {
      await gateway.handleReaction(client, { meetingId: MEETING_ID, emoji: '' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid emoji: must be 1-10 characters',
      });
    });
  });

  // ─────────────────────────── meeting:transcript ───────────────────────────

  describe('meeting:transcript', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);
      meetingService.addTranscript.mockResolvedValue(undefined as any);
    });

    it('should add transcript and broadcast', async () => {
      await gateway.handleTranscript(client, {
        meetingId: MEETING_ID,
        text: 'Hello world',
        speakerName: 'Jane',
      });

      expect(meetingService.addTranscript).toHaveBeenCalledWith(
        MEETING_ID,
        REGULAR_USER_ID,
        expect.objectContaining({ text: 'Hello world', speakerName: 'Jane' }),
      );
      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:transcript-entry', expect.objectContaining({
        meetingId: MEETING_ID,
        text: 'Hello world',
      }));
    });

    it('should reject transcript exceeding 5000 characters', async () => {
      await gateway.handleTranscript(client, {
        meetingId: MEETING_ID,
        text: 'x'.repeat(5001),
        speakerName: 'Jane',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Transcript text must be between 1 and 5000 characters',
      });
      expect(meetingService.addTranscript).not.toHaveBeenCalled();
    });

    it('should reject empty transcript text', async () => {
      await gateway.handleTranscript(client, {
        meetingId: MEETING_ID,
        text: '',
        speakerName: 'Jane',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Transcript text must be between 1 and 5000 characters',
      });
    });

    it('should rate-limit transcripts to 1 per second', async () => {
      await gateway.handleTranscript(client, {
        meetingId: MEETING_ID,
        text: 'First',
        speakerName: 'Jane',
      });

      // Second call within 1 second should be rate limited
      await gateway.handleTranscript(client, {
        meetingId: MEETING_ID,
        text: 'Second',
        speakerName: 'Jane',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Transcript rate limit exceeded (max 1 per second)',
      });
      expect(meetingService.addTranscript).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────── Lobby events ───────────────────────────

  describe('meeting:lobby-admit', () => {
    it('should admit user when called by host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleLobbyAdmit(client, { meetingId: MEETING_ID, userId: 'user-to-admit' });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:lobby-updated', {
        action: 'admitted',
        userId: 'user-to-admit',
      });
    });

    it('should reject when called by non-host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleLobbyAdmit(client, { meetingId: MEETING_ID, userId: 'user-to-admit' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });
  });

  describe('meeting:lobby-admit-all', () => {
    it('should admit all users when called by co-host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: COHOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleLobbyAdmitAll(client, {
        meetingId: MEETING_ID,
        userIds: ['u1', 'u2'],
      });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:lobby-updated', { action: 'admitted-all' });
    });
  });

  describe('meeting:lobby-deny', () => {
    it('should deny user when called by host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleLobbyDeny(client, { meetingId: MEETING_ID, userId: 'u1' });

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:lobby-updated', { action: 'denied', userId: 'u1' });
    });

    it('should reject when called by non-host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleLobbyDeny(client, { meetingId: MEETING_ID, userId: 'u1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });
  });

  // ─────────────────────────── Breakout room events ───────────────────────────

  describe('meeting:breakout-open', () => {
    it('should open breakout rooms when called by host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleBreakoutOpen(client, { meetingId: MEETING_ID });

      expect(server.emit).toHaveBeenCalledWith('meeting:breakout-opened', {});
    });

    it('should reject when called by regular user', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleBreakoutOpen(client, { meetingId: MEETING_ID });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });
  });

  describe('meeting:breakout-close', () => {
    it('should close breakout rooms when called by host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleBreakoutClose(client, { meetingId: MEETING_ID });

      expect(server.emit).toHaveBeenCalledWith('meeting:breakout-closed', {});
    });
  });

  describe('meeting:breakout-move', () => {
    it('should move participant when called by co-host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: COHOST_USER_ID });
      await gateway.handleConnection(client);

      // Register target user so notifyUser has sockets
      (gateway as any).userSockets.set('target-user', new Set(['target-sock']));

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleBreakoutMove(client, {
        meetingId: MEETING_ID,
        userId: 'target-user',
        roomId: 'room-1',
      });

      expect(server.to).toHaveBeenCalledWith('target-sock');
      expect(server.emit).toHaveBeenCalledWith('meeting:breakout-assigned', {
        meetingId: MEETING_ID,
        roomId: 'room-1',
      });
    });
  });

  describe('meeting:breakout-broadcast', () => {
    it('should broadcast message to all breakout participants', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleBreakoutBroadcast(client, {
        meetingId: MEETING_ID,
        message: 'Time to wrap up',
      });

      expect(server.emit).toHaveBeenCalledWith('meeting:breakout-broadcast', {
        message: 'Time to wrap up',
      });
    });
  });

  // ─────────────────────────── meeting:mute-participant ───────────────────────────

  describe('meeting:mute-participant', () => {
    it('should mute participant when called by host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      // Register target user
      (gateway as any).userSockets.set('target-user', new Set(['target-sock']));

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleMuteParticipant(client, {
        meetingId: MEETING_ID,
        userId: 'target-user',
      });

      expect(server.to).toHaveBeenCalledWith('target-sock');
      expect(server.emit).toHaveBeenCalledWith('meeting:muted-by-host', {
        meetingId: MEETING_ID,
      });
    });

    it('should reject when called by non-host', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleMuteParticipant(client, {
        meetingId: MEETING_ID,
        userId: 'someone',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });
  });

  // ─────────────────────────── handleDisconnect ───────────────────────────

  describe('handleDisconnect', () => {
    it('should clean up participant and notify room on disconnect', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID, firstName: 'Jane' });
      await gateway.handleConnection(client);

      // Simulate joining a meeting
      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleJoin(client, { meetingId: MEETING_ID });
      meetingService.leaveMeeting.mockResolvedValue(undefined as any);

      gateway.handleDisconnect(client);

      expect(server.to).toHaveBeenCalledWith(`meeting:${MEETING_ID}`);
      expect(server.emit).toHaveBeenCalledWith('meeting:participant-left', expect.objectContaining({
        meetingId: MEETING_ID,
        userId: REGULAR_USER_ID,
      }));
      expect((gateway as any).socketParticipants.has(client.id)).toBe(false);
    });

    it('should trigger host transfer when host disconnects (UC-015)', async () => {
      // Host connects and joins
      const hostClient = createMockSocket({ id: 'host-sock', handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(hostClient);

      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleJoin(hostClient, { meetingId: MEETING_ID });

      // Second participant connects and joins
      const otherClient = createMockSocket({ id: 'other-sock', handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: COHOST_USER_ID });
      await gateway.handleConnection(otherClient);

      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleJoin(otherClient, { meetingId: MEETING_ID });

      // getMeeting returns meeting with host as disconnected user
      const meeting = makeMeeting({ participants: [{ userId: COHOST_USER_ID, joinedAt: new Date() }] });
      meetingService.getMeeting.mockResolvedValue(meeting as any);
      meetingService.leaveMeeting.mockResolvedValue(undefined as any);

      gateway.handleDisconnect(hostClient);

      // Allow async handleHostTransferOnDisconnect to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(meeting.save).toHaveBeenCalled();
      expect(meeting.hostId).toBe(COHOST_USER_ID);
      expect(server.emit).toHaveBeenCalledWith('meeting:host-transferred', expect.objectContaining({
        meetingId: MEETING_ID,
        previousHostId: HOST_USER_ID,
        newHostId: COHOST_USER_ID,
      }));
    });

    it('should remove empty meeting rooms on last disconnect', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);

      meetingService.joinMeeting.mockResolvedValue(makeMeeting() as any);
      await gateway.handleJoin(client, { meetingId: MEETING_ID });
      meetingService.leaveMeeting.mockResolvedValue(undefined as any);

      gateway.handleDisconnect(client);

      expect((gateway as any).meetingRooms.has(MEETING_ID)).toBe(false);
    });

    it('should do nothing for unknown socket', () => {
      const client = createMockSocket();
      // Not registered — should not throw
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  // ─────────────────────────── Non-host admin action errors ───────────────────────────

  describe('non-host trying admin actions', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: REGULAR_USER_ID });
      await gateway.handleConnection(client);
      meetingService.getMeeting.mockResolvedValue(makeMeeting() as any);
    });

    it('meeting:lobby-admit-all emits error for non-host', async () => {
      await gateway.handleLobbyAdmitAll(client, { meetingId: MEETING_ID, userIds: ['u1'] });
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });

    it('meeting:breakout-close emits error for non-host', async () => {
      await gateway.handleBreakoutClose(client, { meetingId: MEETING_ID });
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });

    it('meeting:breakout-broadcast emits error for non-host', async () => {
      await gateway.handleBreakoutBroadcast(client, { meetingId: MEETING_ID, message: 'hi' });
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Only the host or co-host can perform this action',
      });
    });
  });

  // ─────────────────────────── requireHostOrCoHost edge cases ───────────────────────────

  describe('requireHostOrCoHost', () => {
    it('should emit error when anonymous user tries admin action', async () => {
      const anonClient = createMockSocket({ handshake: { auth: {}, headers: {} } });
      await gateway.handleConnection(anonClient);

      await gateway.handleHandLowerAll(anonClient, { meetingId: MEETING_ID });

      expect(anonClient.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required for this action',
      });
    });

    it('should emit error when meeting is not found', async () => {
      const client = createMockSocket({ handshake: { auth: { token: 't' }, headers: {} } });
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: HOST_USER_ID });
      await gateway.handleConnection(client);

      meetingService.getMeeting.mockRejectedValue(new Error('not found'));
      await gateway.handleMuteParticipant(client, { meetingId: 'nonexistent', userId: 'u' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Meeting not found' });
    });
  });
});
