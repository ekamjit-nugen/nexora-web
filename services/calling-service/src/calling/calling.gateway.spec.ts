import { CallingGateway } from './calling.gateway';
import { CallingService } from './calling.service';
import { VoiceHuddleService } from '../calls/voice-huddle.service';
import { JwtService } from '@nestjs/jwt';
import { CallType } from './dto/index';

// ── Mock helpers ─────────────────────────────────────────────────────────────

function createMockSocket(overrides: Partial<Record<string, any>> = {}): any {
  const rooms = new Set<string>();
  return {
    id: overrides.id || `socket-${Math.random().toString(36).slice(2, 8)}`,
    handshake: overrides.handshake || {
      auth: { token: 'valid-jwt' },
      headers: {},
    },
    data: overrides.data || {},
    rooms,
    emit: jest.fn(),
    join: jest.fn((room: string) => rooms.add(room)),
    leave: jest.fn((room: string) => rooms.delete(room)),
    disconnect: jest.fn(),
    to: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

function createMockServer(): any {
  const toMock = jest.fn();
  const emitMock = jest.fn();

  // Build a chainable .to().emit() mock
  toMock.mockReturnValue({ emit: emitMock, to: toMock });

  return {
    to: toMock,
    emit: emitMock,
    sockets: {
      sockets: new Map<string, any>(),
    },
    // Expose inner mocks for assertions
    _toMock: toMock,
    _emitMock: emitMock,
  };
}

function createMockCall(overrides: Record<string, any> = {}) {
  return {
    callId: 'nxr-call-test-1',
    organizationId: 'org-1',
    initiatorId: 'user-a',
    participantIds: ['user-a', 'user-b'],
    type: CallType.AUDIO,
    status: 'initiated',
    conversationId: 'conv-1',
    participants: [
      { userId: 'user-a', joinedAt: new Date(), audioEnabled: true, videoEnabled: false },
    ],
    duration: null,
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function createDecodedToken(overrides: Record<string, any> = {}) {
  return {
    sub: 'user-a',
    userId: 'user-a',
    firstName: 'John',
    lastName: 'Doe',
    organizationId: 'org-1',
    orgRole: 'member',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CallingGateway', () => {
  let gateway: CallingGateway;
  let jwtService: jest.Mocked<JwtService>;
  let callingService: jest.Mocked<CallingService>;
  let voiceHuddleService: jest.Mocked<VoiceHuddleService>;
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    jest.useFakeTimers();

    jwtService = {
      verify: jest.fn(),
      sign: jest.fn(),
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as any;

    callingService = {
      initiateCall: jest.fn(),
      answerCall: jest.fn(),
      rejectCall: jest.fn(),
      endCall: jest.fn(),
      missCall: jest.fn(),
      leaveCall: jest.fn(),
      getCallDetails: jest.fn(),
      inviteToCall: jest.fn(),
      findActiveCallForUser: jest.fn(),
      updateCallMetrics: jest.fn(),
    } as any;

    voiceHuddleService = {
      startHuddle: jest.fn(),
      joinHuddle: jest.fn(),
      leaveHuddle: jest.fn(),
      getHuddle: jest.fn(),
    } as any;

    gateway = new CallingGateway(jwtService, callingService, voiceHuddleService);

    mockServer = createMockServer();
    (gateway as any).server = mockServer;
    // Prevent actual Redis calls
    (gateway as any).redisPubClient = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Connection lifecycle
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('should track user, set name, and emit connected on valid JWT', async () => {
      const decoded = createDecodedToken();
      jwtService.verify.mockReturnValue(decoded);
      const client = createMockSocket({ id: 'sock-1' });

      await gateway.handleConnection(client);

      expect((gateway as any).socketUsers.get('sock-1')).toBe('user-a');
      expect((gateway as any).userNames.get('user-a')).toBe('John Doe');
      expect((gateway as any).onlineUsers.get('user-a')?.has('sock-1')).toBe(true);
      expect(client.emit).toHaveBeenCalledWith('connected', expect.objectContaining({ userId: 'user-a' }));
    });

    it('should disconnect when no token is provided', async () => {
      const client = createMockSocket({
        id: 'sock-no-token',
        handshake: { auth: {}, headers: {} },
      });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect((gateway as any).socketUsers.has('sock-no-token')).toBe(false);
    });

    it('should disconnect when JWT verification fails', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid token'); });
      const client = createMockSocket({ id: 'sock-bad' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect when token has no userId/sub', async () => {
      jwtService.verify.mockReturnValue({ firstName: 'Ghost' });
      const client = createMockSocket({ id: 'sock-noid' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should support multiple sockets for the same user (multi-tab)', async () => {
      const decoded = createDecodedToken();
      jwtService.verify.mockReturnValue(decoded);

      const s1 = createMockSocket({ id: 'tab-1' });
      const s2 = createMockSocket({ id: 'tab-2' });

      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      const userSockets = (gateway as any).onlineUsers.get('user-a');
      expect(userSockets.size).toBe(2);
      expect(userSockets.has('tab-1')).toBe(true);
      expect(userSockets.has('tab-2')).toBe(true);
    });

    it('should extract token from authorization header when auth.token missing', async () => {
      const decoded = createDecodedToken();
      jwtService.verify.mockReturnValue(decoded);
      const client = createMockSocket({
        id: 'sock-header',
        handshake: { auth: {}, headers: { authorization: 'Bearer header-jwt' } },
      });

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('header-jwt');
      expect(client.emit).toHaveBeenCalledWith('connected', expect.any(Object));
    });
  });

  describe('handleDisconnect', () => {
    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
    });

    it('should clean up socketUsers and onlineUsers maps', async () => {
      const client = createMockSocket({ id: 'sock-dc' });
      await gateway.handleConnection(client);

      gateway.handleDisconnect(client);

      expect((gateway as any).socketUsers.has('sock-dc')).toBe(false);
      expect((gateway as any).onlineUsers.has('user-a')).toBe(false);
    });

    it('should keep onlineUsers entry when other sockets remain', async () => {
      const s1 = createMockSocket({ id: 'tab-a' });
      const s2 = createMockSocket({ id: 'tab-b' });
      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      gateway.handleDisconnect(s1);

      expect((gateway as any).onlineUsers.get('user-a')?.size).toBe(1);
      expect((gateway as any).onlineUsers.get('user-a')?.has('tab-b')).toBe(true);
    });

    it('should start grace period timer for active call when user disconnects but others remain', async () => {
      // Set up two users in a call
      const s1 = createMockSocket({ id: 'caller-sock' });
      const s2 = createMockSocket({ id: 'callee-sock' });
      jwtService.verify
        .mockReturnValueOnce(createDecodedToken({ sub: 'user-a' }))
        .mockReturnValueOnce(createDecodedToken({ sub: 'user-b' }));
      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      // Simulate an active call session
      (gateway as any).callSessions.set('call-1', new Set(['caller-sock', 'callee-sock']));

      gateway.handleDisconnect(s1);

      expect((gateway as any).disconnectGraceTimers.has('call-1:user-a')).toBe(true);
    });

    it('should end call immediately when last participant disconnects', async () => {
      const s1 = createMockSocket({ id: 'solo-sock' });
      await gateway.handleConnection(s1);

      // Simulate solo call session
      (gateway as any).callSessions.set('call-solo', new Set(['solo-sock']));
      callingService.endCall.mockResolvedValue(createMockCall({ callId: 'call-solo', status: 'ended', participantIds: ['user-a'] }) as any);

      gateway.handleDisconnect(s1);

      // endCallCleanup is async — give it a tick
      await Promise.resolve();
      expect(callingService.endCall).toHaveBeenCalledWith('call-solo', 'user-a');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:initiate
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleInitiateCall (call:initiate)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'initiator-sock' });
      await gateway.handleConnection(client);
    });

    it('should create a call, emit call:incoming to recipient, and emit call:initiated to caller', async () => {
      const call = createMockCall();
      callingService.initiateCall.mockResolvedValue(call as any);
      callingService.findActiveCallForUser.mockResolvedValue(null);

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(callingService.initiateCall).toHaveBeenCalledWith('user-a', 'org-1', expect.objectContaining({ recipientId: 'user-b' }));
      expect(client.emit).toHaveBeenCalledWith('call:initiated', expect.objectContaining({ callId: 'nxr-call-test-1' }));
    });

    it('should emit call:incoming to all recipient sockets', async () => {
      // Register recipient sockets
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-b', userId: 'user-b' }));
      const recSock1 = createMockSocket({ id: 'rec-1' });
      const recSock2 = createMockSocket({ id: 'rec-2' });
      await gateway.handleConnection(recSock1);
      await gateway.handleConnection(recSock2);

      const call = createMockCall();
      callingService.initiateCall.mockResolvedValue(call as any);
      callingService.findActiveCallForUser.mockResolvedValue(null);

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      // Should emit to both recipient sockets via server.to(socketId)
      expect(mockServer.to).toHaveBeenCalledWith('rec-1');
      expect(mockServer.to).toHaveBeenCalledWith('rec-2');
    });

    it('should emit error when rate limited (>10 calls per minute)', async () => {
      callingService.initiateCall.mockResolvedValue(createMockCall() as any);
      callingService.findActiveCallForUser.mockResolvedValue(null);

      // Exhaust the rate limit
      for (let i = 0; i < 10; i++) {
        await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });
      }

      // Clear previous emit calls to isolate the 11th call
      client.emit.mockClear();

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('Too many') }));
    });

    it('should auto-miss call when recipient is on DND', async () => {
      // Enable Redis pub client so DND check runs
      (gateway as any).redisPubClient = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify({ status: 'dnd' })),
        publish: jest.fn().mockResolvedValue(undefined),
      };
      callingService.findActiveCallForUser.mockResolvedValue(null);

      const dndCall = createMockCall({ callId: 'dnd-call' });
      callingService.initiateCall.mockResolvedValue(dndCall as any);
      callingService.missCall.mockResolvedValue(dndCall as any);

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(callingService.missCall).toHaveBeenCalledWith('dnd-call');
      expect(client.emit).toHaveBeenCalledWith('call:missed', expect.objectContaining({
        reason: 'User is on Do Not Disturb',
      }));
    });

    it('should reject call when recipient already has an active call (busy)', async () => {
      callingService.findActiveCallForUser.mockResolvedValue(createMockCall() as any);

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'User is currently on another call' }));
      expect(callingService.initiateCall).not.toHaveBeenCalled();
    });

    it('should detect busy via in-memory callSessions even if DB returns null', async () => {
      // user-b is tracked in-memory in a call session
      (gateway as any).socketUsers.set('callee-active-sock', 'user-b');
      (gateway as any).callSessions.set('existing-call', new Set(['callee-active-sock']));
      callingService.findActiveCallForUser.mockResolvedValue(null);

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'User is currently on another call' }));
    });

    it('should emit error when callingService.initiateCall throws', async () => {
      callingService.findActiveCallForUser.mockResolvedValue(null);
      callingService.initiateCall.mockRejectedValue(new Error('DB down'));

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'DB down' });
    });

    it('should not proceed when user is not authenticated (no socketUsers entry)', async () => {
      const unauthClient = createMockSocket({ id: 'unauth-sock' });

      await gateway.handleInitiateCall(unauthClient, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(callingService.initiateCall).not.toHaveBeenCalled();
    });

    it('should reject call initiation for viewer role', async () => {
      client.data = { user: { orgRole: 'viewer', organizationId: 'org-1' } };

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Viewers cannot initiate calls' });
      expect(callingService.initiateCall).not.toHaveBeenCalled();
    });

    it('should start ringing timeout on successful initiation', async () => {
      const call = createMockCall();
      callingService.initiateCall.mockResolvedValue(call as any);
      callingService.findActiveCallForUser.mockResolvedValue(null);

      await gateway.handleInitiateCall(client, { recipientId: 'user-b', type: CallType.AUDIO });

      expect((gateway as any).ringingTimeouts.has('nxr-call-test-1')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:answer
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleAnswerCall (call:answer)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-b', userId: 'user-b' }));
      client = createMockSocket({ id: 'answerer-sock' });
      await gateway.handleConnection(client);
    });

    it('should answer call, emit call:connected to room, and join room', async () => {
      const call = createMockCall({ status: 'connected' });
      callingService.getCallDetails.mockRejectedValue(new Error('not found'));
      callingService.answerCall.mockResolvedValue(call as any);

      await gateway.handleAnswerCall(client, { callId: 'nxr-call-test-1' });

      expect(callingService.answerCall).toHaveBeenCalledWith('nxr-call-test-1', 'user-b', true, false);
      expect(client.join).toHaveBeenCalledWith('call:nxr-call-test-1');
      expect(mockServer.to).toHaveBeenCalledWith('call:nxr-call-test-1');
    });

    it('should emit call:already-answered when call status is already connected', async () => {
      callingService.getCallDetails.mockResolvedValue(createMockCall({ status: 'connected' }) as any);

      await gateway.handleAnswerCall(client, { callId: 'nxr-call-test-1' });

      expect(client.emit).toHaveBeenCalledWith('call:already-answered', { callId: 'nxr-call-test-1' });
      expect(callingService.answerCall).not.toHaveBeenCalled();
    });

    it('should emit error when answerCall service throws', async () => {
      callingService.getCallDetails.mockRejectedValue(new Error('x'));
      callingService.answerCall.mockRejectedValue(new Error('Call not found'));

      await gateway.handleAnswerCall(client, { callId: 'bad-call' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Call not found' });
    });

    it('should dismiss ringing on other tabs of the same user', async () => {
      // Register a second tab for user-b
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-b', userId: 'user-b' }));
      const otherTab = createMockSocket({ id: 'other-tab' });
      await gateway.handleConnection(otherTab);

      const call = createMockCall({ callId: 'multi-tab-call', status: 'connected' });
      callingService.getCallDetails.mockRejectedValue(new Error('x'));
      callingService.answerCall.mockResolvedValue(call as any);

      await gateway.handleAnswerCall(client, { callId: 'multi-tab-call' });

      // Should send dismissed to the other tab, not the answering one
      expect(mockServer.to).toHaveBeenCalledWith('other-tab');
    });

    it('should clear ringing timeout on answer', async () => {
      // Simulate a ringing timeout
      (gateway as any).ringingTimeouts.set('nxr-call-test-1', setTimeout(() => {}, 99999));

      const call = createMockCall({ status: 'connected' });
      callingService.getCallDetails.mockRejectedValue(new Error('x'));
      callingService.answerCall.mockResolvedValue(call as any);

      await gateway.handleAnswerCall(client, { callId: 'nxr-call-test-1' });

      expect((gateway as any).ringingTimeouts.has('nxr-call-test-1')).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:reject
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleRejectCall (call:reject)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-b', userId: 'user-b' }));
      client = createMockSocket({ id: 'rejector-sock' });
      await gateway.handleConnection(client);
    });

    it('should reject call, emit call:rejected to room, and clear ringing timeout', async () => {
      const call = createMockCall({ status: 'rejected' });
      callingService.rejectCall.mockResolvedValue(call as any);
      (gateway as any).ringingTimeouts.set('nxr-call-test-1', setTimeout(() => {}, 99999));

      await gateway.handleRejectCall(client, { callId: 'nxr-call-test-1', reason: 'busy' });

      expect(callingService.rejectCall).toHaveBeenCalledWith('nxr-call-test-1', 'user-b', 'busy');
      expect(mockServer.to).toHaveBeenCalledWith('call:nxr-call-test-1');
      expect((gateway as any).ringingTimeouts.has('nxr-call-test-1')).toBe(false);
      expect((gateway as any).callSessions.has('nxr-call-test-1')).toBe(false);
    });

    it('should dismiss ringing on other tabs of the rejecting user', async () => {
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-b', userId: 'user-b' }));
      const tab2 = createMockSocket({ id: 'reject-tab-2' });
      await gateway.handleConnection(tab2);

      callingService.rejectCall.mockResolvedValue(createMockCall({ status: 'rejected' }) as any);

      await gateway.handleRejectCall(client, { callId: 'nxr-call-test-1', reason: 'declined' });

      expect(mockServer.to).toHaveBeenCalledWith('reject-tab-2');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:end
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleEndCall (call:end)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'ender-sock' });
      await gateway.handleConnection(client);
    });

    it('should end call when last participant leaves and emit call:ended with duration', async () => {
      (gateway as any).callSessions.set('call-end-1', new Set(['ender-sock']));
      const endedCall = createMockCall({ callId: 'call-end-1', status: 'ended', duration: 120, participantIds: ['user-a', 'user-b'] });
      callingService.endCall.mockResolvedValue(endedCall as any);

      await gateway.handleEndCall(client, { callId: 'call-end-1' });

      expect(callingService.endCall).toHaveBeenCalledWith('call-end-1', 'user-a');
    });

    it('should mark user as left but not end call when other participants remain', async () => {
      // Set up two users
      (gateway as any).socketUsers.set('other-user-sock', 'user-b');
      (gateway as any).callSessions.set('call-partial', new Set(['ender-sock', 'other-user-sock']));

      callingService.leaveCall.mockResolvedValue(undefined as any);

      await gateway.handleEndCall(client, { callId: 'call-partial' });

      expect(callingService.leaveCall).toHaveBeenCalledWith('call-partial', 'user-a');
      expect(mockServer.to).toHaveBeenCalledWith('call:call-partial');
    });

    it('should remove user socket from call session and leave room', async () => {
      (gateway as any).callSessions.set('call-leave', new Set(['ender-sock']));
      callingService.endCall.mockResolvedValue(createMockCall({ callId: 'call-leave', status: 'ended', participantIds: ['user-a'] }) as any);

      await gateway.handleEndCall(client, { callId: 'call-leave' });

      expect(client.leave).toHaveBeenCalledWith('call:call-leave');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:rejoin
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleRejoinCall (call:rejoin)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'rejoin-sock' });
      await gateway.handleConnection(client);
    });

    it('should rejoin within grace period — cancels disconnect timer', async () => {
      const graceTimer = setTimeout(() => {}, 99999);
      (gateway as any).disconnectGraceTimers.set('active-call:user-a', graceTimer);

      callingService.getCallDetails.mockResolvedValue(createMockCall({ callId: 'active-call', status: 'connected' }) as any);

      await gateway.handleRejoinCall(client, { callId: 'active-call' });

      expect((gateway as any).disconnectGraceTimers.has('active-call:user-a')).toBe(false);
      expect(client.join).toHaveBeenCalledWith('call:active-call');
      expect(client.emit).toHaveBeenCalledWith('call:rejoined', expect.objectContaining({ callId: 'active-call' }));
      expect(mockServer.to).toHaveBeenCalledWith('call:active-call');
    });

    it('should fail rejoin when call is no longer active (ended)', async () => {
      callingService.getCallDetails.mockResolvedValue(createMockCall({ status: 'ended' }) as any);

      await gateway.handleRejoinCall(client, { callId: 'ended-call' });

      expect(client.emit).toHaveBeenCalledWith('call:rejoin-failed', expect.objectContaining({
        reason: 'Call no longer active',
      }));
    });

    it('should fail rejoin when getCallDetails throws', async () => {
      callingService.getCallDetails.mockRejectedValue(new Error('Call not found'));

      await gateway.handleRejoinCall(client, { callId: 'missing-call' });

      expect(client.emit).toHaveBeenCalledWith('call:rejoin-failed', expect.objectContaining({
        reason: 'Call not found',
      }));
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // WebRTC signaling
  // ────────────────────────────────────────────────────────────────────────────

  describe('WebRTC signaling (call:offer, call:answer-sdp, call:ice-candidate)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'webrtc-sock' });
      await gateway.handleConnection(client);
    });

    it('should relay SDP offer to call room peers', async () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      await gateway.handleOffer(client, { callId: 'call-1', sdp: 'offer-sdp-data', type: 'offer' });

      expect(client.to).toHaveBeenCalledWith('call:call-1');
      expect(toEmit).toHaveBeenCalledWith('call:offer', expect.objectContaining({
        callId: 'call-1',
        sdp: 'offer-sdp-data',
        from: 'user-a',
      }));
    });

    it('should relay SDP answer to call room peers', async () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      await gateway.handleAnswerSdp(client, { callId: 'call-1', sdp: 'answer-sdp-data', type: 'answer' });

      expect(client.to).toHaveBeenCalledWith('call:call-1');
      expect(toEmit).toHaveBeenCalledWith('call:answer-sdp', expect.objectContaining({
        sdp: 'answer-sdp-data',
        from: 'user-a',
      }));
    });

    it('should relay ICE candidate to call room peers', async () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      await gateway.handleIceCandidate(client, {
        callId: 'call-1',
        candidate: 'candidate-string',
        sdpMLineIndex: 0,
        sdpMid: 'audio',
      });

      expect(client.to).toHaveBeenCalledWith('call:call-1');
      expect(toEmit).toHaveBeenCalledWith('call:ice-candidate', expect.objectContaining({
        candidate: 'candidate-string',
        sdpMLineIndex: 0,
        sdpMid: 'audio',
        from: 'user-a',
      }));
    });

    it('should not relay when user is not authenticated', async () => {
      const unauthClient = createMockSocket({ id: 'unauth' });
      unauthClient.to = jest.fn();

      await gateway.handleOffer(unauthClient, { callId: 'call-1', sdp: 'x', type: 'offer' });

      expect(unauthClient.to).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:invite
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleInviteToCall (call:invite)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'inviter-sock' });
      await gateway.handleConnection(client);
    });

    it('should invite participant and emit call:participant-invited to room', async () => {
      const call = createMockCall({ status: 'connected' });
      callingService.inviteToCall.mockResolvedValue(call as any);

      // Register invitee sockets
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-c', userId: 'user-c' }));
      const inviteeSock = createMockSocket({ id: 'invitee-sock' });
      await gateway.handleConnection(inviteeSock);

      await gateway.handleInviteToCall(client, { callId: 'nxr-call-test-1', userId: 'user-c' });

      expect(callingService.inviteToCall).toHaveBeenCalledWith('nxr-call-test-1', 'user-a', 'user-c');
      // Should emit call:incoming to invitee
      expect(mockServer.to).toHaveBeenCalledWith('invitee-sock');
      // Should emit call:participant-invited to call room
      expect(mockServer.to).toHaveBeenCalledWith('call:nxr-call-test-1');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:hold / call:resume
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleHoldCall / handleResumeCall', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'hold-sock' });
      await gateway.handleConnection(client);
    });

    it('should track hold state and emit call:held', () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleHoldCall(client, { callId: 'call-hold' });

      const holdState = (gateway as any).callHoldState.get('call-hold');
      expect(holdState?.has('user-a')).toBe(true);
      expect(toEmit).toHaveBeenCalledWith('call:held', expect.objectContaining({ callId: 'call-hold', userId: 'user-a' }));
      expect(client.emit).toHaveBeenCalledWith('call:held', expect.objectContaining({ callId: 'call-hold' }));
    });

    it('should clear hold state and emit call:resumed on resume', () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      // First hold
      gateway.handleHoldCall(client, { callId: 'call-resume' });
      expect((gateway as any).callHoldState.get('call-resume')?.has('user-a')).toBe(true);

      // Then resume
      gateway.handleResumeCall(client, { callId: 'call-resume' });

      expect((gateway as any).callHoldState.has('call-resume')).toBe(false);
      expect(toEmit).toHaveBeenCalledWith('call:resumed', expect.objectContaining({ callId: 'call-resume' }));
      expect(client.emit).toHaveBeenCalledWith('call:resumed', expect.objectContaining({ callId: 'call-resume' }));
    });

    it('should no-op hold when user is not authenticated', () => {
      const unauthClient = createMockSocket({ id: 'unauth-hold' });
      gateway.handleHoldCall(unauthClient, { callId: 'call-x' });
      expect((gateway as any).callHoldState.has('call-x')).toBe(false);
    });

    it('should no-op when callId is missing', () => {
      gateway.handleHoldCall(client, { callId: '' });
      expect((gateway as any).callHoldState.size).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:annotation-stroke / call:annotation-clear
  // ────────────────────────────────────────────────────────────────────────────

  describe('annotation events', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'anno-sock' });
      await gateway.handleConnection(client);
    });

    it('should broadcast annotation stroke to call room', () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      const stroke = { fromX: 0, fromY: 0, toX: 10, toY: 10, color: '#ff0000', brushSize: 2 };
      gateway.handleAnnotationStroke(client, { callId: 'call-anno', stroke });

      expect(client.to).toHaveBeenCalledWith('call:call-anno');
      expect(toEmit).toHaveBeenCalledWith('call:annotation-stroke', expect.objectContaining({ from: 'user-a', color: '#ff0000' }));
    });

    it('should broadcast annotation clear to call room', () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleAnnotationClear(client, { callId: 'call-anno' });

      expect(client.to).toHaveBeenCalledWith('call:call-anno');
      expect(toEmit).toHaveBeenCalledWith('call:annotation-clear', { from: 'user-a' });
    });

    it('should not broadcast annotation when user is not authenticated', () => {
      const unauthClient = createMockSocket({ id: 'unauth-anno' });
      unauthClient.to = jest.fn();

      gateway.handleAnnotationStroke(unauthClient, { callId: 'call-x', stroke: {} as any });

      expect(unauthClient.to).not.toHaveBeenCalled();
    });

    it('should not broadcast annotation when callId is missing', () => {
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleAnnotationClear(client, { callId: '' });

      expect(client.to).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // call:quality-report
  // ────────────────────────────────────────────────────────────────────────────

  describe('handleQualityReport (call:quality-report)', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'quality-sock' });
      await gateway.handleConnection(client);
    });

    it('should update metrics when participant is in the call room', async () => {
      // Add the call room to client's rooms
      client.rooms.add('call:call-q');

      await gateway.handleQualityReport(client, {
        callId: 'call-q',
        metrics: { callQuality: 'good', bitrate: 1200, packetLoss: 0.5 },
      });

      expect(callingService.updateCallMetrics).toHaveBeenCalledWith('call-q', expect.objectContaining({ callQuality: 'good' }));
    });

    it('should reject quality report when sender is not in call room', async () => {
      // rooms does NOT contain call:call-q
      await gateway.handleQualityReport(client, {
        callId: 'call-q',
        metrics: { callQuality: 'good' },
      });

      expect(callingService.updateCallMetrics).not.toHaveBeenCalled();
    });

    it('should no-op when callId or metrics are missing', async () => {
      await gateway.handleQualityReport(client, { callId: '', metrics: undefined } as any);
      expect(callingService.updateCallMetrics).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Voice Huddles
  // ────────────────────────────────────────────────────────────────────────────

  describe('huddle:start', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'huddle-sock' });
      await gateway.handleConnection(client);
    });

    it('should start huddle and emit huddle:started to channel room', () => {
      const huddleState = { channelId: 'ch-1', participantIds: ['user-a'], participantNames: { 'user-a': 'John Doe' }, startedAt: new Date(), sfuRoomId: 'huddle:ch-1' };
      voiceHuddleService.startHuddle.mockReturnValue(huddleState);

      gateway.handleStartHuddle(client, { channelId: 'ch-1', userName: 'John Doe' });

      expect(voiceHuddleService.startHuddle).toHaveBeenCalledWith('ch-1', 'user-a', 'John Doe');
      expect(client.join).toHaveBeenCalledWith('huddle:ch-1');
      expect(mockServer.to).toHaveBeenCalledWith('channel:ch-1');
    });

    it('should emit error when voiceHuddleService throws', () => {
      voiceHuddleService.startHuddle.mockImplementation(() => { throw new Error('already active'); });

      gateway.handleStartHuddle(client, { channelId: 'ch-1', userName: 'John' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'already active' });
    });
  });

  describe('huddle:join', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken({ sub: 'user-b', userId: 'user-b', firstName: 'Jane' }));
      client = createMockSocket({ id: 'huddle-join-sock' });
      await gateway.handleConnection(client);
    });

    it('should join huddle and emit huddle:joined to channel room', () => {
      const huddleState = { channelId: 'ch-2', participantIds: ['user-a', 'user-b'], participantNames: {}, startedAt: new Date(), sfuRoomId: 'huddle:ch-2' };
      voiceHuddleService.joinHuddle.mockReturnValue(huddleState);

      gateway.handleJoinHuddle(client, { channelId: 'ch-2', userName: 'Jane' });

      expect(voiceHuddleService.joinHuddle).toHaveBeenCalledWith('ch-2', 'user-b', 'Jane');
      expect(client.join).toHaveBeenCalledWith('huddle:ch-2');
      expect(mockServer.to).toHaveBeenCalledWith('channel:ch-2');
    });
  });

  describe('huddle:leave', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'huddle-leave-sock' });
      await gateway.handleConnection(client);
    });

    it('should leave huddle and emit huddle:left to channel room when huddle continues', () => {
      const huddleState = { channelId: 'ch-3', participantIds: ['user-b'], participantNames: {}, startedAt: new Date(), sfuRoomId: 'huddle:ch-3' };
      voiceHuddleService.leaveHuddle.mockReturnValue(huddleState);

      gateway.handleLeaveHuddle(client, { channelId: 'ch-3' });

      expect(client.leave).toHaveBeenCalledWith('huddle:ch-3');
      expect(mockServer.to).toHaveBeenCalledWith('channel:ch-3');
    });

    it('should emit huddle:ended when last participant leaves (null returned)', () => {
      voiceHuddleService.leaveHuddle.mockReturnValue(null);

      gateway.handleLeaveHuddle(client, { channelId: 'ch-ended' });

      expect(client.leave).toHaveBeenCalledWith('huddle:ch-ended');
      // Should emit both huddle:left and huddle:ended
      expect(mockServer.to).toHaveBeenCalledWith('channel:ch-ended');
    });
  });

  describe('huddle:get', () => {
    let client: any;

    beforeEach(async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      client = createMockSocket({ id: 'huddle-get-sock' });
      await gateway.handleConnection(client);
    });

    it('should return current huddle state', () => {
      const huddleState = { channelId: 'ch-4', participantIds: ['user-a'], participantNames: {}, startedAt: new Date(), sfuRoomId: 'huddle:ch-4' };
      voiceHuddleService.getHuddle.mockReturnValue(huddleState);

      gateway.handleGetHuddle(client, { channelId: 'ch-4' });

      expect(voiceHuddleService.getHuddle).toHaveBeenCalledWith('ch-4');
      expect(client.emit).toHaveBeenCalledWith('huddle:state', huddleState);
    });

    it('should not query when channelId is missing', () => {
      gateway.handleGetHuddle(client, { channelId: '' });
      expect(voiceHuddleService.getHuddle).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Notification emission
  // ────────────────────────────────────────────────────────────────────────────

  describe('publishCallNotification', () => {
    it('should publish to Redis notifications channel when redisPubClient is available', async () => {
      const mockRedis = { publish: jest.fn().mockResolvedValue(1) };
      (gateway as any).redisPubClient = mockRedis;

      await (gateway as any).publishCallNotification({
        type: 'incoming_call',
        title: 'John Doe is calling',
        body: 'Incoming voice call',
        userId: 'user-b',
        organizationId: 'org-1',
        senderId: 'user-a',
        priority: 'high',
        data: { callId: 'call-1' },
      });

      expect(mockRedis.publish).toHaveBeenCalledWith('notifications', expect.any(String));
      const payload = JSON.parse(mockRedis.publish.mock.calls[0][1]);
      expect(payload.type).toBe('incoming_call');
      expect(payload.priority).toBe('high');
    });

    it('should no-op when redisPubClient is null', async () => {
      (gateway as any).redisPubClient = null;
      // Should not throw
      await (gateway as any).publishCallNotification({ type: 'test', title: 'x', body: 'y', userId: 'u', organizationId: 'o' });
    });

    it('should default priority to normal when not specified', async () => {
      const mockRedis = { publish: jest.fn().mockResolvedValue(1) };
      (gateway as any).redisPubClient = mockRedis;

      await (gateway as any).publishCallNotification({
        type: 'missed_call',
        title: 'Missed',
        body: 'Missed call',
        userId: 'user-b',
        organizationId: 'org-1',
      });

      const payload = JSON.parse(mockRedis.publish.mock.calls[0][1]);
      expect(payload.priority).toBe('normal');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Utility methods
  // ────────────────────────────────────────────────────────────────────────────

  describe('emitToUser / emitToCall', () => {
    it('emitToUser should emit to all sockets of a user', async () => {
      jwtService.verify.mockReturnValue(createDecodedToken());
      const s1 = createMockSocket({ id: 'eu-1' });
      const s2 = createMockSocket({ id: 'eu-2' });
      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      gateway.emitToUser('user-a', 'some-event', { data: 1 });

      expect(mockServer.to).toHaveBeenCalledWith('eu-1');
      expect(mockServer.to).toHaveBeenCalledWith('eu-2');
    });

    it('emitToCall should emit to call room', () => {
      gateway.emitToCall('call-xyz', 'call:test', { hello: true });

      expect(mockServer.to).toHaveBeenCalledWith('call:call-xyz');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Rate limiting
  // ────────────────────────────────────────────────────────────────────────────

  describe('checkCallRateLimit', () => {
    it('should allow up to 10 calls within the window', () => {
      for (let i = 0; i < 10; i++) {
        expect((gateway as any).checkCallRateLimit('rate-user')).toBe(true);
      }
      expect((gateway as any).checkCallRateLimit('rate-user')).toBe(false);
    });

    it('should reset after the window expires', () => {
      for (let i = 0; i < 10; i++) {
        (gateway as any).checkCallRateLimit('rate-user-2');
      }
      expect((gateway as any).checkCallRateLimit('rate-user-2')).toBe(false);

      // Advance past the 60s window
      jest.advanceTimersByTime(61_000);

      expect((gateway as any).checkCallRateLimit('rate-user-2')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Voicemail notification
  // ────────────────────────────────────────────────────────────────────────────

  describe('sendVoicemailNotification', () => {
    it('should publish voicemail notification with caller name and duration', async () => {
      const mockRedis = { publish: jest.fn().mockResolvedValue(1) };
      (gateway as any).redisPubClient = mockRedis;
      (gateway as any).userNames.set('caller-1', 'Alice Smith');

      await gateway.sendVoicemailNotification('user-b', 'caller-1', 'org-1', { duration: 30, callId: 'vm-call' });

      const payload = JSON.parse(mockRedis.publish.mock.calls[0][1]);
      expect(payload.type).toBe('voicemail');
      expect(payload.body).toContain('Alice Smith');
      expect(payload.body).toContain('30s');
      expect(payload.data.callId).toBe('vm-call');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // DND check
  // ────────────────────────────────────────────────────────────────────────────

  describe('isUserOnDnd', () => {
    it('should return true when presence status is dnd', async () => {
      (gateway as any).redisPubClient = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify({ status: 'dnd' })),
      };

      const result = await (gateway as any).isUserOnDnd('user-b', 'org-1');
      expect(result).toBe(true);
    });

    it('should return false when presence status is online', async () => {
      (gateway as any).redisPubClient = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify({ status: 'online' })),
      };

      const result = await (gateway as any).isUserOnDnd('user-b', 'org-1');
      expect(result).toBe(false);
    });

    it('should return false when no presence data exists', async () => {
      (gateway as any).redisPubClient = {
        hGet: jest.fn().mockResolvedValue(null),
      };

      const result = await (gateway as any).isUserOnDnd('user-b', 'org-1');
      expect(result).toBe(false);
    });

    it('should fail open (return false) when Redis throws', async () => {
      (gateway as any).redisPubClient = {
        hGet: jest.fn().mockRejectedValue(new Error('Redis down')),
      };

      const result = await (gateway as any).isUserOnDnd('user-b', 'org-1');
      expect(result).toBe(false);
    });

    it('should return false when redisPubClient is null', async () => {
      (gateway as any).redisPubClient = null;

      const result = await (gateway as any).isUserOnDnd('user-b', 'org-1');
      expect(result).toBe(false);
    });
  });
});
