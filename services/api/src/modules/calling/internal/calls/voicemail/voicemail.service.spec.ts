import { VoicemailService } from './voicemail.service';
import { NotFoundException } from '@nestjs/common';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function createMockCall(overrides: Record<string, any> = {}) {
  const call: any = {
    callId: 'call-001',
    organizationId: 'org-1',
    initiatorId: 'user-a',
    participantIds: ['user-a', 'user-b'],
    status: 'missed',
    metadata: {},
    createdAt: new Date(),
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return call;
}

function buildMockModel() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
  } as any;
}

function chainableQuery(docs: any[]) {
  return {
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(docs),
      }),
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VoicemailService', () => {
  let service: VoicemailService;
  let callModel: any;

  beforeEach(() => {
    callModel = buildMockModel();
    service = new VoicemailService(callModel);
  });

  // ── leaveVoicemail ────────────────────────────────────────────────────────

  describe('leaveVoicemail', () => {
    it('should store audio URL, duration, and sender in metadata', async () => {
      const call = createMockCall();
      callModel.findOne.mockResolvedValue(call);

      const result = await service.leaveVoicemail('call-001', 'user-a', 'https://cdn.example.com/audio.ogg', 15);

      const voicemail = (call.metadata as any).voicemail;
      expect(voicemail.audioUrl).toBe('https://cdn.example.com/audio.ogg');
      expect(voicemail.duration).toBe(15);
      expect(voicemail.leftBy).toBe('user-a');
      expect(voicemail.leftAt).toBeInstanceOf(Date);
      expect(voicemail.listened).toBe(false);
      expect(call.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-missed call', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.leaveVoicemail('call-missing', 'user-a', 'url', 10)).rejects.toThrow(NotFoundException);
    });

    it('should query with callId and status=missed', async () => {
      callModel.findOne.mockResolvedValue(null);
      try { await service.leaveVoicemail('call-001', 'user-a', 'url', 10); } catch {}

      expect(callModel.findOne).toHaveBeenCalledWith({ callId: 'call-001', status: 'missed' });
    });
  });

  // ── getVoicemails ─────────────────────────────────────────────────────────

  describe('getVoicemails', () => {
    it('should return voicemails for the user with correct structure', async () => {
      const docs = [
        {
          callId: 'call-001',
          initiatorId: 'user-b',
          metadata: { voicemail: { audioUrl: 'url', duration: 10, leftBy: 'user-b', leftAt: new Date(), listened: false } },
          createdAt: new Date(),
        },
      ];
      callModel.find.mockReturnValue(chainableQuery(docs));

      const result = await service.getVoicemails('user-a', 'org-1');

      expect(result).toHaveLength(1);
      expect(result[0].callId).toBe('call-001');
      expect(result[0].from).toBe('user-b');
      expect(result[0].voicemail.audioUrl).toBe('url');
    });

    it('should return empty array when no voicemails exist', async () => {
      callModel.find.mockReturnValue(chainableQuery([]));

      const result = await service.getVoicemails('user-a', 'org-1');

      expect(result).toEqual([]);
    });

    it('should filter by organizationId, participantIds, and voicemail existence', async () => {
      callModel.find.mockReturnValue(chainableQuery([]));

      await service.getVoicemails('user-a', 'org-1');

      const filter = callModel.find.mock.calls[0][0];
      expect(filter.organizationId).toBe('org-1');
      expect(filter.status).toBe('missed');
      expect(filter.participantIds).toBe('user-a');
      expect(filter['metadata.voicemail']).toEqual({ $exists: true });
    });
  });

  // ── markAsListened ────────────────────────────────────────────────────────

  describe('markAsListened', () => {
    it('should set listened=true and listenedAt', async () => {
      const call = createMockCall({
        metadata: { voicemail: { audioUrl: 'url', duration: 10, leftBy: 'user-b', listened: false } },
      });
      callModel.findOne.mockResolvedValue(call);

      await service.markAsListened('call-001', 'user-a');

      expect((call.metadata as any).voicemail.listened).toBe(true);
      expect((call.metadata as any).voicemail.listenedAt).toBeInstanceOf(Date);
      expect(call.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when voicemail does not exist', async () => {
      const call = createMockCall({ metadata: {} });
      callModel.findOne.mockResolvedValue(call);

      await expect(service.markAsListened('call-001', 'user-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown call', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.markAsListened('missing', 'user-a')).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteVoicemail ───────────────────────────────────────────────────────

  describe('deleteVoicemail', () => {
    it('should remove voicemail from metadata', async () => {
      const call = createMockCall({
        metadata: { voicemail: { audioUrl: 'url', duration: 10 } },
      });
      callModel.findOne.mockResolvedValue(call);

      await service.deleteVoicemail('call-001', 'user-a');

      expect((call.metadata as any).voicemail).toBeUndefined();
      expect(call.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown call', async () => {
      callModel.findOne.mockResolvedValue(null);
      await expect(service.deleteVoicemail('missing', 'user-a')).rejects.toThrow(NotFoundException);
    });

    it('should verify userId is in participantIds', async () => {
      callModel.findOne.mockResolvedValue(null);
      try { await service.deleteVoicemail('call-001', 'user-a'); } catch {}

      expect(callModel.findOne).toHaveBeenCalledWith({ callId: 'call-001', participantIds: 'user-a' });
    });
  });
});
