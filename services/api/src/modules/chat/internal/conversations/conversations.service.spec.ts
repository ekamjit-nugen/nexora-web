import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConversationsService } from './conversations.service';
import { CacheService } from '../common/cache/cache.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

// ── Helpers ──────────────────────────────────────────────────────────────

function createMockConversation(overrides: any = {}) {
  return {
    _id: 'conv-1',
    type: 'group',
    name: 'Test Group',
    isDeleted: false,
    isArchived: false,
    organizationId: 'org-1',
    participants: [
      { userId: 'user-1', role: 'owner', muted: false, isPinned: false },
      { userId: 'user-2', role: 'member', muted: false, isPinned: false },
    ],
    createdBy: 'user-1',
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

function mockModel(defaultDoc: any = {}) {
  const model: any = jest.fn().mockImplementation((data) => {
    const doc = {
      ...defaultDoc,
      ...data,
      _id: data._id || 'conv-new',
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockImplementation(function () { return this; }),
      toString: jest.fn().mockReturnValue(data._id || 'conv-new'),
    };
    return doc;
  });
  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.findOneAndUpdate = jest.fn();
  model.find = jest.fn();
  model.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
  return model;
}

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationModel: any;
  let cacheService: any;

  beforeEach(async () => {
    conversationModel = mockModel();
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: getModelToken('Conversation'), useValue: conversationModel },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  // ── createDirectConversation ───────────────────────────────────────────

  describe('createDirectConversation', () => {
    it('should create a new direct conversation', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      const result = await service.createDirectConversation('user-1', 'user-2', 'org-1');

      expect(result).toBeDefined();
      expect(result.type).toBe('direct');
      expect(result.save).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should return existing conversation instead of creating duplicate', async () => {
      const existing = createMockConversation({ type: 'direct' });
      conversationModel.findOne.mockResolvedValue(existing);

      const result = await service.createDirectConversation('user-1', 'user-2');

      expect(result).toBe(existing);
      // save should NOT have been called on a new document
      expect(existing.save).not.toHaveBeenCalled();
    });

    it('should set organizationId on new conversation', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      const result = await service.createDirectConversation('user-1', 'user-2', 'org-99');

      expect(result.organizationId).toBe('org-99');
    });
  });

  // ── createGroup ────────────────────────────────────────────────────────

  describe('createGroup', () => {
    it('should create a group with participants where creator is owner', async () => {
      const result = await service.createGroup('Dev Team', 'Team chat', ['user-2', 'user-3'], 'user-1');

      expect(result).toBeDefined();
      expect(result.type).toBe('group');
      expect(result.name).toBe('Dev Team');
      expect(result.save).toHaveBeenCalled();

      const creatorParticipant = result.participants.find((p: any) => p.userId === 'user-1');
      expect(creatorParticipant.role).toBe('owner');

      const memberParticipant = result.participants.find((p: any) => p.userId === 'user-2');
      expect(memberParticipant.role).toBe('member');
    });

    it('should deduplicate creator from member list', async () => {
      const result = await service.createGroup('Team', '', ['user-1', 'user-2'], 'user-1');

      const userIds = result.participants.map((p: any) => p.userId);
      const uniqueIds = [...new Set(userIds)];
      expect(userIds).toHaveLength(uniqueIds.length);
    });
  });

  // ── createChannel ──────────────────────────────────────────────────────

  describe('createChannel', () => {
    it('should create a channel with channelType', async () => {
      const result = await service.createChannel('general', 'General chat', 'user-1', ['user-2'], 'public');

      expect(result.type).toBe('channel');
      expect(result.channelType).toBe('public');
      expect(result.save).toHaveBeenCalled();
    });

    it('should default channelType to public', async () => {
      const result = await service.createChannel('random', 'Random', 'user-1');

      expect(result.channelType).toBe('public');
    });

    it('should set creator as owner', async () => {
      const result = await service.createChannel('dev', 'Dev channel', 'user-1', ['user-2']);

      const creator = result.participants.find((p: any) => p.userId === 'user-1');
      expect(creator.role).toBe('owner');
    });
  });

  // ── pinConversation ────────────────────────────────────────────────────

  describe('pinConversation', () => {
    it('should toggle pin from false to true', async () => {
      const conv = createMockConversation();
      conversationModel.findOne.mockResolvedValue(conv);
      conversationModel.findOneAndUpdate.mockResolvedValue(undefined);

      const result = await service.pinConversation('conv-1', 'user-1');

      expect(result.data.isPinned).toBe(true);
      expect(conversationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'conv-1', 'participants.userId': 'user-1' },
        { $set: { 'participants.$.isPinned': true } },
      );
    });

    it('should toggle pin from true to false', async () => {
      const conv = createMockConversation({
        participants: [
          { userId: 'user-1', role: 'owner', isPinned: true },
          { userId: 'user-2', role: 'member', isPinned: false },
        ],
      });
      conversationModel.findOne.mockResolvedValue(conv);
      conversationModel.findOneAndUpdate.mockResolvedValue(undefined);

      const result = await service.pinConversation('conv-1', 'user-1');

      expect(result.data.isPinned).toBe(false);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      await expect(
        service.pinConversation('conv-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addParticipants ────────────────────────────────────────────────────

  describe('addParticipants', () => {
    it('should add new participants', async () => {
      const conv = createMockConversation();
      conversationModel.findOne.mockResolvedValue(conv);
      const updatedConv = { ...conv, participants: [...conv.participants, { userId: 'user-3', role: 'member' }] };
      conversationModel.findByIdAndUpdate.mockResolvedValue(updatedConv);

      const result = await service.addParticipants('conv-1', ['user-3'], 'user-1');

      expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv-1',
        { $push: { participants: { $each: expect.arrayContaining([expect.objectContaining({ userId: 'user-3', role: 'member' })]) } } },
        { new: true },
      );
    });

    it('should skip already-existing participants (prevent duplicates)', async () => {
      const conv = createMockConversation();
      conversationModel.findOne.mockResolvedValue(conv);

      const result = await service.addParticipants('conv-1', ['user-1', 'user-2'], 'user-1');

      // All provided users already exist — returns conversation without update
      expect(result).toBe(conv);
      expect(conversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for direct conversations', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({ type: 'direct' }));

      await expect(
        service.addParticipants('conv-1', ['user-3'], 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if adder is not a participant', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());

      await expect(
        service.addParticipants('conv-1', ['user-3'], 'stranger'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── leaveConversation ──────────────────────────────────────────────────

  describe('leaveConversation', () => {
    it('should remove participant from group conversation', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
      conversationModel.findByIdAndUpdate.mockResolvedValue(undefined);

      const result = await service.leaveConversation('conv-1', 'user-2');

      expect(result.message).toBe('Left conversation successfully');
      expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv-1',
        { $pull: { participants: { userId: 'user-2' } } },
      );
    });

    it('should prevent leaving a direct conversation', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({ type: 'direct' }));

      await expect(
        service.leaveConversation('conv-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing conversation', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      await expect(
        service.leaveConversation('conv-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-participant', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());

      await expect(
        service.leaveConversation('conv-1', 'stranger'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
