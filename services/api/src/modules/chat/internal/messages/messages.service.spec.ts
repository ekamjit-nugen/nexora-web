import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MessagesService } from './messages.service';
import { ModerationService } from '../moderation/moderation.service';
import { ConversationsService } from '../conversations/conversations.service';
import { LinkPreviewService } from './link-preview.service';
import { DlpService } from '../compliance/dlp.service';
import { LegalHoldService } from '../compliance/legal-hold.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

// ── Helpers ──────────────────────────────────────────────────────────────

function createMockMessage(overrides: any = {}) {
  return {
    _id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Hello world',
    contentPlainText: 'Hello world',
    type: 'text',
    status: 'sent',
    isDeleted: false,
    reactions: [],
    readBy: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockConversation(overrides: any = {}) {
  return {
    _id: 'conv-1',
    type: 'group',
    isDeleted: false,
    isArchived: false,
    organizationId: 'org-1',
    participants: [
      { userId: 'user-1', role: 'owner' },
      { userId: 'user-2', role: 'member' },
    ],
    settings: {},
    ...overrides,
  };
}

// ── Mock factories ───────────────────────────────────────────────────────

function mockModel(defaultDoc: any = {}) {
  const instances: any[] = [];
  const model: any = jest.fn().mockImplementation((data) => {
    const doc = { ...defaultDoc, ...data, save: jest.fn().mockResolvedValue(undefined) };
    instances.push(doc);
    return doc;
  });
  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.find = jest.fn();
  model.countDocuments = jest.fn();
  model.updateMany = jest.fn().mockResolvedValue({});
  model.aggregate = jest.fn();
  model._instances = instances;
  return model;
}

describe('MessagesService', () => {
  let service: MessagesService;
  let messageModel: any;
  let conversationModel: any;
  let flaggedMessageModel: any;
  let moderationService: any;
  let conversationsService: any;
  let linkPreviewService: any;
  let dlpService: any;
  let legalHoldService: any;

  beforeEach(async () => {
    messageModel = mockModel({ _id: 'msg-new' });
    conversationModel = mockModel();
    flaggedMessageModel = mockModel();

    moderationService = { checkMessage: jest.fn().mockResolvedValue({ flagged: false }) };
    conversationsService = {
      updateLastMessage: jest.fn().mockResolvedValue(undefined),
      markAsRead: jest.fn().mockResolvedValue(undefined),
    };
    linkPreviewService = { fetchAndAttachPreviews: jest.fn().mockResolvedValue(undefined) };
    dlpService = { checkMessage: jest.fn().mockResolvedValue({ allowed: true }) };
    legalHoldService = { isUnderHold: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getModelToken('Message'), useValue: messageModel },
        { provide: getModelToken('Conversation'), useValue: conversationModel },
        { provide: getModelToken('FlaggedMessage'), useValue: flaggedMessageModel },
        { provide: ModerationService, useValue: moderationService },
        { provide: ConversationsService, useValue: conversationsService },
        { provide: LinkPreviewService, useValue: linkPreviewService },
        { provide: DlpService, useValue: dlpService },
        { provide: LegalHoldService, useValue: legalHoldService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  // ── sendMessage ────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    beforeEach(() => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
    });

    it('should send a normal text message', async () => {
      const result = await service.sendMessage('conv-1', 'user-1', 'Hello');

      expect(result).toBeDefined();
      expect(result.save).toHaveBeenCalled();
      expect(conversationsService.updateLastMessage).toHaveBeenCalledWith('conv-1', result);
    });

    it('should sanitize HTML content (strip dangerous tags)', async () => {
      const result = await service.sendMessage(
        'conv-1', 'user-1', '<script>alert("xss")</script><b>safe</b>',
      );

      // DOMPurify strips <script> tags
      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('<b>safe</b>');
    });

    it('should return existing message for duplicate idempotency key', async () => {
      const existing = createMockMessage({ idempotencyKey: 'idem-1' });
      messageModel.findOne.mockResolvedValue(existing);

      const result = await service.sendMessage('conv-1', 'user-1', 'Hello', 'text', undefined, undefined, undefined, 'idem-1');

      expect(result).toBe(existing);
      // Should NOT have created a new message
      expect(conversationsService.updateLastMessage).not.toHaveBeenCalled();
    });

    it('should block message when DLP action is block', async () => {
      dlpService.checkMessage.mockResolvedValue({ allowed: false, action: 'block', rule: 'SSN' });

      await expect(
        service.sendMessage('conv-1', 'user-1', 'My SSN is 123-45-6789'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should redact content when DLP action is redact', async () => {
      dlpService.checkMessage.mockResolvedValue({
        allowed: true, action: 'redact', rule: 'CC', redactedContent: 'card ****',
      });

      const result = await service.sendMessage('conv-1', 'user-1', 'card 4111-1111-1111-1111');

      expect(result.content).toBe('card ****');
    });

    it('should reject messages to archived conversations', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({ isArchived: true }));

      await expect(
        service.sendMessage('conv-1', 'user-1', 'Hello'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject whitespace-only text messages', async () => {
      await expect(
        service.sendMessage('conv-1', 'user-1', '   \n\t  '),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if conversation does not exist', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      await expect(
        service.sendMessage('conv-missing', 'user-1', 'Hello'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if sender is not a participant', async () => {
      await expect(
        service.sendMessage('conv-1', 'user-stranger', 'Hello'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce whoCanPost=admins on channels', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        type: 'channel',
        settings: { whoCanPost: 'admins' },
      }));

      await expect(
        service.sendMessage('conv-1', 'user-2', 'Hello'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin/owner to post when whoCanPost=admins', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        type: 'channel',
        settings: { whoCanPost: 'admins' },
      }));

      // user-1 is owner
      const result = await service.sendMessage('conv-1', 'user-1', 'Admin post');
      expect(result).toBeDefined();
      expect(result.save).toHaveBeenCalled();
    });
  });

  // ── editMessage ────────────────────────────────────────────────────────

  describe('editMessage', () => {
    it('should allow owner to edit their message', async () => {
      const msg = createMockMessage();
      messageModel.findOne.mockResolvedValue(msg);
      messageModel.findByIdAndUpdate.mockResolvedValue({ ...msg, content: 'Updated', isEdited: true });

      const result = await service.editMessage('msg-1', 'user-1', 'Updated');

      expect(messageModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'msg-1',
        expect.objectContaining({ content: 'Updated', isEdited: true }),
        { new: true },
      );
      expect(result.isEdited).toBe(true);
    });

    it('should reject edit from non-owner', async () => {
      messageModel.findOne.mockResolvedValue(createMockMessage({ senderId: 'user-1' }));

      await expect(
        service.editMessage('msg-1', 'user-2', 'Hacked'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should sanitize edited content', async () => {
      const msg = createMockMessage();
      messageModel.findOne.mockResolvedValue(msg);
      messageModel.findByIdAndUpdate.mockImplementation((_id, update, _opts) => {
        return Promise.resolve({ ...msg, ...update, content: update.content });
      });

      const result = await service.editMessage('msg-1', 'user-1', '<img onerror="alert(1)">safe');

      expect(result.content).not.toContain('onerror');
    });

    it('should throw NotFoundException for missing message', async () => {
      messageModel.findOne.mockResolvedValue(null);

      await expect(
        service.editMessage('msg-gone', 'user-1', 'new'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteMessage ──────────────────────────────────────────────────────

  describe('deleteMessage', () => {
    it('should allow owner to delete their message', async () => {
      messageModel.findOne.mockResolvedValue(createMockMessage());
      conversationModel.findById.mockResolvedValue(createMockConversation());
      messageModel.findByIdAndUpdate.mockResolvedValue(undefined);

      const result = await service.deleteMessage('msg-1', 'user-1');
      expect(result.message).toBe('Message deleted successfully');
      expect(messageModel.findByIdAndUpdate).toHaveBeenCalledWith('msg-1', expect.objectContaining({ isDeleted: true }));
    });

    it('should reject delete from non-owner', async () => {
      messageModel.findOne.mockResolvedValue(createMockMessage({ senderId: 'user-1' }));

      await expect(
        service.deleteMessage('msg-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent deletion when under legal hold', async () => {
      messageModel.findOne.mockResolvedValue(createMockMessage());
      conversationModel.findById.mockResolvedValue(createMockConversation());
      legalHoldService.isUnderHold.mockResolvedValue(true);

      await expect(
        service.deleteMessage('msg-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing message', async () => {
      messageModel.findOne.mockResolvedValue(null);

      await expect(
        service.deleteMessage('msg-gone', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMessages ────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
      const mockQuery = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([createMockMessage()]) };
      messageModel.find.mockReturnValue(mockQuery);
      messageModel.countDocuments.mockResolvedValue(1);

      const result = await service.getMessages('conv-1', 'user-1', 1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 1, limit: 50, total: 1, pages: 1 });
    });

    it('should clamp limit to 200', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
      const mockQuery = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
      messageModel.find.mockReturnValue(mockQuery);
      messageModel.countDocuments.mockResolvedValue(0);

      const result = await service.getMessages('conv-1', 'user-1', 1, 999);

      expect(result.pagination.limit).toBe(200);
      expect(mockQuery.limit).toHaveBeenCalledWith(200);
    });

    it('should throw ForbiddenException for non-participant', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      await expect(
        service.getMessages('conv-1', 'stranger', 1, 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── addReaction ────────────────────────────────────────────────────────

  describe('addReaction', () => {
    it('should add a new reaction', async () => {
      const msg = createMockMessage({ reactions: [] });
      messageModel.findById.mockResolvedValue(msg);

      const result = await service.addReaction('msg-1', 'user-1', '👍');

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].emoji).toBe('👍');
      expect(result.reactions[0].count).toBe(1);
      expect(msg.save).toHaveBeenCalled();
    });

    it('should toggle off an existing reaction from the same user', async () => {
      const msg = createMockMessage({
        reactions: [{
          emoji: '👍',
          users: [{ userId: 'user-1', createdAt: new Date() }],
          count: 1,
        }],
      });
      messageModel.findById.mockResolvedValue(msg);

      const result = await service.addReaction('msg-1', 'user-1', '👍');

      // Reaction removed entirely since count dropped to 0
      expect(result.reactions).toHaveLength(0);
    });

    it('should add a second user to an existing reaction', async () => {
      const msg = createMockMessage({
        reactions: [{
          emoji: '👍',
          users: [{ userId: 'user-1', createdAt: new Date() }],
          count: 1,
        }],
      });
      messageModel.findById.mockResolvedValue(msg);

      const result = await service.addReaction('msg-1', 'user-2', '👍');

      expect(result.reactions[0].count).toBe(2);
      expect(result.reactions[0].users).toHaveLength(2);
    });

    it('should throw NotFoundException for missing message', async () => {
      messageModel.findById.mockResolvedValue(null);

      await expect(
        service.addReaction('msg-gone', 'user-1', '👍'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── markAsRead ─────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should update participant lastReadAt and message readBy', async () => {
      const result = await service.markAsRead('conv-1', 'user-1');

      expect(conversationsService.markAsRead).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(messageModel.updateMany).toHaveBeenCalledTimes(2);
      expect(result.message).toBe('Marked as read');
    });
  });

  // ── searchMessages ─────────────────────────────────────────────────────

  describe('searchMessages', () => {
    it('should search messages with escaped query', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
      const mockChain = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
      messageModel.find.mockReturnValue(mockChain);

      await service.searchMessages('conv-1', 'test query', 'user-1');

      expect(messageModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          isDeleted: false,
          content: { $regex: 'test query', $options: 'i' },
        }),
      );
    });

    it('should escape regex metacharacters to prevent ReDoS', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
      const mockChain = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
      messageModel.find.mockReturnValue(mockChain);

      await service.searchMessages('conv-1', 'test.*+?^${}()|[]\\', 'user-1');

      const calledWith = messageModel.find.mock.calls[0][0];
      expect(calledWith.content.$regex).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should throw ForbiddenException for non-participant', async () => {
      conversationModel.findOne.mockResolvedValue(null);

      await expect(
        service.searchMessages('conv-1', 'test', 'stranger'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
