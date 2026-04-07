import { CallingService } from './calling.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CallType } from './dto/index';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function createMockCall(overrides: Record<string, any> = {}) {
  const call: any = {
    callId: 'nxr-call-test-uuid',
    organizationId: 'org-1',
    initiatorId: 'user-a',
    participantIds: ['user-a', 'user-b'],
    type: CallType.AUDIO,
    status: 'initiated',
    conversationId: 'conv-1',
    participants: [
      { userId: 'user-a', joinedAt: new Date(), audioEnabled: true, videoEnabled: false },
    ],
    metadata: {},
    startTime: null,
    endTime: null,
    duration: null,
    rejectionReason: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return call;
}

function buildMockModel() {
  const mockModel: any = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };
  return mockModel;
}

function chainableFindResult(docs: any[]) {
  return {
    sort: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(docs),
        }),
      }),
    }),
  };
}

function chainableMissedResult(docs: any[]) {
  return {
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(docs),
      }),
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CallingService', () => {
  let service: CallingService;
  let callModel: any;

  beforeEach(() => {
    callModel = buildMockModel();
    service = new CallingService(callModel);
  });

  // ── initiateCall ──────────────────────────────────────────────────────────

  describe('initiateCall', () => {
    it('should create a call with UUID prefix, status "initiated", and correct participants', async () => {
      callModel.create.mockImplementation((data: any) => Promise.resolve(data));

      const result = await service.initiateCall('user-a', 'org-1', {
        recipientId: 'user-b',
        type: CallType.AUDIO,
        conversationId: 'conv-1',
      });

      expect(callModel.create).toHaveBeenCalledTimes(1);
      const arg = callModel.create.mock.calls[0][0];
      expect(arg.callId).toMatch(/^nxr-call-/);
      expect(arg.status).toBe('initiated');
      expect(arg.participantIds).toEqual(['user-a', 'user-b']);
      expect(arg.initiatorId).toBe('user-a');
      expect(arg.organizationId).toBe('org-1');
    });

    it('should set videoEnabled based on call type', async () => {
      callModel.create.mockImplementation((data: any) => Promise.resolve(data));

      await service.initiateCall('user-a', 'org-1', {
        recipientId: 'user-b',
        type: CallType.VIDEO,
      });

      const arg = callModel.create.mock.calls[0][0];
      expect(arg.participants[0].videoEnabled).toBe(true);
    });

    it('should set videoEnabled=false for audio calls', async () => {
      callModel.create.mockImplementation((data: any) => Promise.resolve(data));

      await service.initiateCall('user-a', 'org-1', {
        recipientId: 'user-b',
        type: CallType.AUDIO,
      });

      const arg = callModel.create.mock.calls[0][0];
      expect(arg.participants[0].videoEnabled).toBe(false);
    });
  });

  // ── answerCall ────────────────────────────────────────────────────────────

  describe('answerCall', () => {
    it('should transition status to "connected" and set startTime', async () => {
      const call = createMockCall({ status: 'initiated' });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.answerCall('nxr-call-test-uuid', 'user-b');

      expect(call.status).toBe('connected');
      expect(call.startTime).toBeInstanceOf(Date);
      expect(call.participants).toHaveLength(2);
      expect(call.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown call', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.answerCall('nxr-call-missing', 'user-b')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const call = createMockCall({ status: 'initiated' });
      callModel.findOne.mockResolvedValue(call);
      await expect(service.answerCall('nxr-call-test-uuid', 'user-stranger')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-initiated status that is not "connected"', async () => {
      const call = createMockCall({ status: 'ended' });
      callModel.findOne.mockResolvedValue(call);
      await expect(service.answerCall('nxr-call-test-uuid', 'user-b')).rejects.toThrow(BadRequestException);
    });

    it('should allow joining an already connected call without duplicating participant', async () => {
      const call = createMockCall({
        status: 'connected',
        participants: [
          { userId: 'user-a', joinedAt: new Date(), audioEnabled: true, videoEnabled: false },
          { userId: 'user-b', joinedAt: new Date(), audioEnabled: true, videoEnabled: false },
        ],
      });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.answerCall('nxr-call-test-uuid', 'user-b');

      // Should not add a duplicate participant
      expect(result.participants).toHaveLength(2);
    });
  });

  // ── rejectCall ────────────────────────────────────────────────────────────

  describe('rejectCall', () => {
    it('should set status to "rejected" and store reason', async () => {
      const call = createMockCall({ status: 'initiated' });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.rejectCall('nxr-call-test-uuid', 'user-b', 'busy');

      expect(call.status).toBe('rejected');
      expect(call.rejectionReason).toBe('busy');
      expect(call.endTime).toBeInstanceOf(Date);
      expect(call.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown call', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.rejectCall('missing', 'user-b')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const call = createMockCall({ status: 'initiated' });
      callModel.findOne.mockResolvedValue(call);
      await expect(service.rejectCall('nxr-call-test-uuid', 'user-stranger')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if call is not in initiated status', async () => {
      const call = createMockCall({ status: 'connected' });
      callModel.findOne.mockResolvedValue(call);
      await expect(service.rejectCall('nxr-call-test-uuid', 'user-b')).rejects.toThrow(BadRequestException);
    });
  });

  // ── endCall ───────────────────────────────────────────────────────────────

  describe('endCall', () => {
    it('should set status to "ended" and calculate duration for connected calls', async () => {
      const startTime = new Date(Date.now() - 120_000); // 2 minutes ago
      const call = createMockCall({ status: 'connected', startTime });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.endCall('nxr-call-test-uuid', 'user-a');

      expect(call.status).toBe('ended');
      expect(call.endTime).toBeInstanceOf(Date);
      expect(call.duration).toBeGreaterThanOrEqual(119); // ~120s
      expect(call.duration).toBeLessThanOrEqual(121);
      expect(call.save).toHaveBeenCalled();
    });

    it('should set status to "missed" when ending a call that was only initiated', async () => {
      const call = createMockCall({ status: 'initiated', startTime: null });
      callModel.findOne.mockResolvedValue(call);

      await service.endCall('nxr-call-test-uuid', 'user-a');

      expect(call.status).toBe('missed');
    });

    it('should no-op for already ended calls', async () => {
      const call = createMockCall({ status: 'ended' });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.endCall('nxr-call-test-uuid', 'user-a');

      expect(call.save).not.toHaveBeenCalled();
      expect(result).toBe(call);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const call = createMockCall({ status: 'connected' });
      callModel.findOne.mockResolvedValue(call);
      await expect(service.endCall('nxr-call-test-uuid', 'user-stranger')).rejects.toThrow(ForbiddenException);
    });

    it('should mark the ending user participant as left', async () => {
      const participant = { userId: 'user-a', joinedAt: new Date(), audioEnabled: true, videoEnabled: false, leftAt: undefined as any };
      const call = createMockCall({ status: 'connected', startTime: new Date(), participants: [participant] });
      callModel.findOne.mockResolvedValue(call);

      await service.endCall('nxr-call-test-uuid', 'user-a');

      expect(participant.leftAt).toBeInstanceOf(Date);
    });
  });

  // ── getCallHistory ────────────────────────────────────────────────────────

  describe('getCallHistory', () => {
    it('should filter by organizationId and userId, return paginated results', async () => {
      const docs = [createMockCall(), createMockCall()];
      callModel.find.mockReturnValue(chainableFindResult(docs));
      callModel.countDocuments.mockResolvedValue(42);

      const result = await service.getCallHistory('user-a', 'org-1', { limit: 10, page: 2 });

      expect(result.calls).toHaveLength(2);
      expect(result.pagination.total).toBe(42);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.pages).toBe(5); // ceil(42/10)
    });

    it('should clamp limit to 100', async () => {
      callModel.find.mockReturnValue(chainableFindResult([]));
      callModel.countDocuments.mockResolvedValue(0);

      await service.getCallHistory('user-a', 'org-1', { limit: 999, page: 1 });

      const filter = callModel.find.mock.calls[0][0];
      expect(filter.organizationId).toBe('org-1');
      expect(filter.participantIds).toBe('user-a');
    });

    it('should apply optional status and type filters', async () => {
      callModel.find.mockReturnValue(chainableFindResult([]));
      callModel.countDocuments.mockResolvedValue(0);

      await service.getCallHistory('user-a', 'org-1', { status: 'ended', type: CallType.VIDEO, limit: 20, page: 1 });

      const filter = callModel.find.mock.calls[0][0];
      expect(filter.status).toBe('ended');
      expect(filter.type).toBe('video');
    });
  });

  // ── getMissedCalls ────────────────────────────────────────────────────────

  describe('getMissedCalls', () => {
    it('should filter for missed status and exclude self-initiated', async () => {
      const docs = [createMockCall({ status: 'missed', initiatorId: 'user-b' })];
      callModel.find.mockReturnValue(chainableMissedResult(docs));

      const result = await service.getMissedCalls('user-a', 'org-1', 5);

      expect(result).toHaveLength(1);
      const filter = callModel.find.mock.calls[0][0];
      expect(filter.status).toBe('missed');
      expect(filter.initiatorId).toEqual({ $ne: 'user-a' });
      expect(filter.organizationId).toBe('org-1');
    });
  });

  // ── getCallStats ──────────────────────────────────────────────────────────

  describe('getCallStats', () => {
    it('should return correct counts and average duration', async () => {
      callModel.countDocuments
        .mockResolvedValueOnce(10)   // totalToday
        .mockResolvedValueOnce(7)    // completedToday
        .mockResolvedValueOnce(2);   // missedToday
      callModel.aggregate.mockResolvedValue([{ _id: null, avg: 185.5 }]);

      const result = await service.getCallStats('user-a', 'org-1');

      expect(result.totalToday).toBe(10);
      expect(result.completedToday).toBe(7);
      expect(result.missedToday).toBe(2);
      expect(result.avgDuration).toBe(186); // Math.round(185.5)
    });

    it('should return 0 avgDuration when no calls have duration', async () => {
      callModel.countDocuments.mockResolvedValue(0);
      callModel.aggregate.mockResolvedValue([]);

      const result = await service.getCallStats('user-a', 'org-1');

      expect(result.avgDuration).toBe(0);
    });
  });

  // ── findActiveCallForUser ─────────────────────────────────────────────────

  describe('findActiveCallForUser', () => {
    it('should query for initiated or connected calls', async () => {
      const activeCall = createMockCall({ status: 'connected' });
      callModel.findOne.mockResolvedValue(activeCall);

      const result = await service.findActiveCallForUser('user-a');

      expect(result).toBe(activeCall);
      const filter = callModel.findOne.mock.calls[0][0];
      expect(filter.participantIds).toBe('user-a');
      expect(filter.status).toEqual({ $in: ['initiated', 'connected'] });
    });

    it('should return null when no active call exists', async () => {
      callModel.findOne.mockResolvedValue(null);

      const result = await service.findActiveCallForUser('user-a');

      expect(result).toBeNull();
    });
  });
});
