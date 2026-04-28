import { CallRecordingService } from './call-recording.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function createMockCall(overrides: Record<string, any> = {}) {
  const call: any = {
    callId: 'valid-call-id',
    status: 'connected',
    participantIds: ['user-a', 'user-b'],
    recording: { enabled: false, startedBy: null, startedAt: null, endedAt: null, fileId: null, duration: null },
    metadata: {},
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return call;
}

function buildMockCallModel() {
  return {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  } as any;
}

function buildMockSfuService() {
  return {
    isAvailable: jest.fn().mockReturnValue(false),
    getRoom: jest.fn().mockReturnValue(null),
    createPlainTransport: jest.fn(),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CallRecordingService', () => {
  let service: CallRecordingService;
  let callModel: any;
  let sfuService: any;

  beforeEach(() => {
    callModel = buildMockCallModel();
    sfuService = buildMockSfuService();
    service = new CallRecordingService(callModel, sfuService);
  });

  // ── sanitizeId ────────────────────────────────────────────────────────────

  describe('sanitizeId (via startRecording)', () => {
    it('should reject path traversal characters', async () => {
      await expect(service.startRecording('../etc/passwd', 'user-a')).rejects.toThrow(BadRequestException);
      await expect(service.startRecording('id/../../hack', 'user-a')).rejects.toThrow(BadRequestException);
      await expect(service.startRecording('id with spaces', 'user-a')).rejects.toThrow(BadRequestException);
      await expect(service.startRecording('', 'user-a')).rejects.toThrow(BadRequestException);
    });

    it('should accept valid IDs with alphanumeric, dashes, and underscores', async () => {
      // Should pass sanitization but fail on findOne (call not found)
      callModel.findOne.mockResolvedValue(null);
      await expect(service.startRecording('valid-call-id_123', 'user-a')).rejects.toThrow(NotFoundException);
    });
  });

  // ── startRecording ────────────────────────────────────────────────────────

  describe('startRecording', () => {
    it('should throw NotFoundException when call is not active', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.startRecording('valid-call-id', 'user-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const call = createMockCall();
      callModel.findOne.mockResolvedValue(call);

      await expect(service.startRecording('valid-call-id', 'user-stranger')).rejects.toThrow(ForbiddenException);
    });

    it('should use atomic findOneAndUpdate to prevent race conditions', async () => {
      const call = createMockCall();
      callModel.findOne.mockResolvedValue(call);

      const updatedCall = createMockCall({ recording: { enabled: true, startedBy: 'user-a', startedAt: new Date() } });
      callModel.findOneAndUpdate.mockResolvedValue(updatedCall);

      const result = await service.startRecording('valid-call-id', 'user-a');

      expect(callModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          callId: 'valid-call-id',
          status: 'connected',
          'recording.enabled': { $ne: true },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            'recording.enabled': true,
            'recording.startedBy': 'user-a',
          }),
        }),
        { new: true },
      );
      expect(result).toBe(updatedCall);
    });

    it('should return existing call when recording already started (race condition)', async () => {
      const existingCall = createMockCall({ recording: { enabled: true, startedBy: 'user-b' } });
      callModel.findOne.mockResolvedValue(existingCall);
      callModel.findOneAndUpdate.mockResolvedValue(null); // Atomic update found nothing to update

      const result = await service.startRecording('valid-call-id', 'user-a');

      expect(result).toBe(existingCall);
    });
  });

  // ── stopRecording ─────────────────────────────────────────────────────────

  describe('stopRecording', () => {
    it('should throw NotFoundException for unknown call', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.stopRecording('valid-call-id', 'user-a')).rejects.toThrow(NotFoundException);
    });

    it('should allow a participant to stop recording', async () => {
      const startedAt = new Date(Date.now() - 60_000);
      const call = createMockCall({
        recording: { enabled: true, startedBy: 'user-b', startedAt, endedAt: null, duration: null },
      });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.stopRecording('valid-call-id', 'user-a');

      expect(call.recording.enabled).toBe(false);
      expect(call.recording.endedAt).toBeInstanceOf(Date);
      expect(call.recording.duration).toBeGreaterThanOrEqual(59);
      expect(call.save).toHaveBeenCalled();
    });

    it('should allow the user who started recording to stop it', async () => {
      const call = createMockCall({
        participantIds: ['user-a'],
        recording: { enabled: true, startedBy: 'user-b', startedAt: new Date() },
      });
      // user-b is not in participantIds but is the recording starter
      callModel.findOne.mockResolvedValue(call);

      // user-b should be allowed because they started it
      const call2 = createMockCall({
        participantIds: ['user-a'],
        recording: { enabled: true, startedBy: 'user-b', startedAt: new Date() },
      });
      callModel.findOne.mockResolvedValue(call2);

      const result = await service.stopRecording('valid-call-id', 'user-b');
      expect(call2.recording.enabled).toBe(false);
    });

    it('should throw ForbiddenException when user is not participant and not recording starter', async () => {
      const call = createMockCall({
        participantIds: ['user-a'],
        recording: { enabled: true, startedBy: 'user-a', startedAt: new Date() },
      });
      callModel.findOne.mockResolvedValue(call);

      await expect(service.stopRecording('valid-call-id', 'user-stranger')).rejects.toThrow(ForbiddenException);
    });

    it('should no-op when recording is not enabled', async () => {
      const call = createMockCall({
        recording: { enabled: false },
      });
      callModel.findOne.mockResolvedValue(call);

      const result = await service.stopRecording('valid-call-id', 'user-a');

      expect(call.save).not.toHaveBeenCalled();
      expect(result).toBe(call);
    });
  });

  // ── onModuleDestroy ───────────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('should clear all active recordings', async () => {
      // Access the internal map via any cast
      const svc = service as any;
      svc.activeRecordings.set('call-1', {
        ffmpegProcess: { on: jest.fn(), kill: jest.fn() },
        transport: { close: jest.fn() },
        filePath: '/tmp/test.mp4',
        sdpPath: '/tmp/test.sdp',
        entityId: 'call-1',
        startedAt: new Date(),
      });
      svc.activeRecordings.set('call-2', {
        ffmpegProcess: { on: jest.fn(), kill: jest.fn() },
        transport: { close: jest.fn() },
        filePath: '/tmp/test2.mp4',
        sdpPath: '/tmp/test2.sdp',
        entityId: 'call-2',
        startedAt: new Date(),
      });

      await service.onModuleDestroy();

      expect(svc.activeRecordings.size).toBe(0);
    });

    it('should handle empty recordings gracefully', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
