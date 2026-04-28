import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LegalHoldService } from './legal-hold.service';
import { NotFoundException } from '@nestjs/common';

// ── Helpers ──────────────────────────────────────────────────────────────

function mockModel() {
  const model: any = jest.fn().mockImplementation((data) => {
    const doc = { ...data, save: jest.fn().mockResolvedValue(undefined) };
    return doc;
  });
  model.findById = jest.fn();
  model.find = jest.fn();
  return model;
}

describe('LegalHoldService', () => {
  let service: LegalHoldService;
  let legalHoldModel: any;

  beforeEach(async () => {
    legalHoldModel = mockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalHoldService,
        { provide: getModelToken('LegalHold'), useValue: legalHoldModel },
      ],
    }).compile();

    service = module.get<LegalHoldService>(LegalHoldService);
  });

  // ── isUnderHold ────────────────────────────────────────────────────────

  describe('isUnderHold', () => {
    it('should return true for org-wide hold', async () => {
      legalHoldModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { scope: 'org', isActive: true, name: 'Org Hold' },
        ]),
      });

      const result = await service.isUnderHold('org-1', 'conv-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return true for conversation-specific hold', async () => {
      legalHoldModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { scope: 'conversation', isActive: true, targetConversationIds: ['conv-1', 'conv-2'] },
        ]),
      });

      const result = await service.isUnderHold('org-1', 'conv-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return true for user-specific hold', async () => {
      legalHoldModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { scope: 'user', isActive: true, targetUserIds: ['user-1', 'user-3'] },
        ]),
      });

      const result = await service.isUnderHold('org-1', 'conv-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return false when no active holds exist', async () => {
      legalHoldModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await service.isUnderHold('org-1', 'conv-1', 'user-1');
      expect(result).toBe(false);
    });

    it('should return false when holds do not match conversation or user', async () => {
      legalHoldModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { scope: 'conversation', isActive: true, targetConversationIds: ['conv-99'] },
          { scope: 'user', isActive: true, targetUserIds: ['user-99'] },
        ]),
      });

      const result = await service.isUnderHold('org-1', 'conv-1', 'user-1');
      expect(result).toBe(false);
    });
  });

  // ── createHold ─────────────────────────────────────────────────────────

  describe('createHold', () => {
    it('should create a hold with scope and save it', async () => {
      const result = await service.createHold('org-1', {
        name: 'Investigation Hold',
        scope: 'conversation' as any,
        targetConversationIds: ['conv-1'],
      }, 'admin-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Investigation Hold');
      expect(result.scope).toBe('conversation');
      expect(result.organizationId).toBe('org-1');
      expect(result.createdBy).toBe('admin-1');
      expect(result.startedAt).toBeDefined();
      expect(result.save).toHaveBeenCalled();
    });

    it('should create an org-wide hold', async () => {
      const result = await service.createHold('org-1', {
        name: 'Full Org Hold',
        scope: 'org' as any,
      }, 'admin-1');

      expect(result.scope).toBe('org');
      expect(result.save).toHaveBeenCalled();
    });
  });

  // ── releaseHold ────────────────────────────────────────────────────────

  describe('releaseHold', () => {
    it('should mark hold as inactive and set endedAt', async () => {
      const hold = {
        _id: 'hold-1',
        name: 'Old Hold',
        isActive: true,
        endedAt: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      legalHoldModel.findById.mockResolvedValue(hold);

      const result = await service.releaseHold('hold-1', 'admin-1');

      expect(result.isActive).toBe(false);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(hold.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing hold', async () => {
      legalHoldModel.findById.mockResolvedValue(null);

      await expect(
        service.releaseHold('hold-missing', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
