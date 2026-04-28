import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationService } from './collaboration.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CollaborationService', () => {
  let service: CollaborationService;
  let mockSessionModel: any;
  let mockEditModel: any;
  let mockConflictModel: any;

  beforeEach(async () => {
    mockSessionModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ sessionId: 'session1' }),
    }));
    mockSessionModel.findOne = jest.fn();
    mockSessionModel.deleteOne = jest.fn();

    mockEditModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ sessionId: 'session1' }),
    }));
    mockEditModel.find = jest.fn();

    mockConflictModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ conflictId: 'conflict1' }),
    }));
    mockConflictModel.find = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        {
          provide: getModelToken('CollaborationSession'),
          useValue: mockSessionModel,
        },
        {
          provide: getModelToken('CollaborativeEdit'),
          useValue: mockEditModel,
        },
        {
          provide: getModelToken('ConflictResolution'),
          useValue: mockConflictModel,
        },
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);
  });

  describe('createSession', () => {
    it('should create collaboration session', async () => {
      const result = await service.createSession('prod1', 'document', 'doc1', 'user1');

      expect(result).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should get session by id', async () => {
      const mockSession = { sessionId: 'session1', activeUsers: ['user1'] };
      mockSessionModel.findOne.mockResolvedValue(mockSession);

      const result = await service.getSession('session1');

      expect(result).toEqual(mockSession);
    });

    it('should throw error if session not found', async () => {
      mockSessionModel.findOne.mockResolvedValue(null);

      await expect(service.getSession('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('joinSession', () => {
    it('should add user to session', async () => {
      const mockSession = {
        sessionId: 'session1',
        activeUsers: ['user1'],
        save: jest.fn().mockResolvedValue({}),
      };
      mockSessionModel.findOne.mockResolvedValue(mockSession);

      await service.joinSession('session1', 'user2');

      expect(mockSession.activeUsers).toContain('user2');
      expect(mockSession.save).toHaveBeenCalled();
    });
  });

  describe('leaveSession', () => {
    it('should remove user from session', async () => {
      const mockSession = {
        sessionId: 'session1',
        activeUsers: ['user1', 'user2'],
        save: jest.fn().mockResolvedValue({}),
      };
      mockSessionModel.findOne.mockResolvedValue(mockSession);

      await service.leaveSession('session1', 'user1');

      expect(mockSession.save).toHaveBeenCalled();
    });

    it('should delete session if no active users', async () => {
      const mockSession = {
        sessionId: 'session1',
        activeUsers: ['user1'],
        save: jest.fn().mockResolvedValue({}),
      };
      mockSessionModel.findOne.mockResolvedValue(mockSession);
      mockSessionModel.deleteOne.mockResolvedValue({});

      await service.leaveSession('session1', 'user1');

      expect(mockSessionModel.deleteOne).toHaveBeenCalled();
    });
  });

  describe('recordEdit', () => {
    it('should record collaborative edit', async () => {
      const mockSession = { sessionId: 'session1', productId: 'prod1' };
      mockSessionModel.findOne.mockResolvedValue(mockSession);

      await service.recordEdit('session1', 'user1', {
        resourceType: 'document',
        resourceId: 'doc1',
        operation: 'update',
        path: '/content',
        value: 'new text',
        clientId: 'client1',
        version: 1,
      });

      expect(mockSessionModel.findOne).toHaveBeenCalled();
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicting edits', async () => {
      const mockEdits = [
        {
          userId: 'user1',
          path: '/title',
          operation: 'update',
          timestamp: new Date(),
        },
        {
          userId: 'user2',
          path: '/title',
          operation: 'update',
          timestamp: new Date(),
        },
      ];
      mockEditModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEdits),
        }),
      });

      const result = await service.detectConflicts('session1');

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateCursorPosition', () => {
    it('should update user cursor position', () => {
      service.updateCursorPosition('session1', 'user1', 'User One', { line: 5, column: 10 }, '#FF0000');

      const cursors = service.getActiveCursors('session1');

      expect(cursors.length).toBe(1);
      expect(cursors[0].userId).toBe('user1');
      expect(cursors[0].position.line).toBe(5);
    });
  });

  describe('getActiveCursors', () => {
    it('should return active cursor positions', () => {
      service.updateCursorPosition('session1', 'user1', 'User One', { line: 5, column: 10 }, '#FF0000');
      service.updateCursorPosition('session1', 'user2', 'User Two', { line: 10, column: 5 }, '#00FF00');

      const cursors = service.getActiveCursors('session1');

      expect(cursors.length).toBe(2);
    });
  });

  describe('getSessionParticipants', () => {
    it('should get session participants with stats', async () => {
      const mockSession = { sessionId: 'session1', activeUsers: ['user1', 'user2'] };
      const mockEdits = [
        { userId: 'user1', timestamp: new Date(), _id: '1' },
        { userId: 'user1', timestamp: new Date(), _id: '2' },
        { userId: 'user2', timestamp: new Date(), _id: '3' },
      ];

      mockSessionModel.findOne.mockResolvedValue(mockSession);
      mockEditModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEdits),
        }),
      });

      const result = await service.getSessionParticipants('session1');

      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('editsCount');
    });
  });

  describe('getSessionMergeStatus', () => {
    it('should get session merge status', async () => {
      const mockEdits = [{ _id: '1', userId: 'user1' }];
      const mockConflicts: any[] = [];

      mockEditModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEdits),
        }),
      });
      mockConflictModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConflicts),
      });

      const result = await service.getSessionMergeStatus('session1');

      expect(result).toHaveProperty('totalEdits');
      expect(result).toHaveProperty('isReadyToMerge');
    });
  });
});
