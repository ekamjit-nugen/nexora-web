import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SessionService } from '../session.service';

describe('SessionService', () => {
  let service: SessionService;
  let mockSessionModel: any;

  beforeEach(async () => {
    mockSessionModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: getModelToken('Session'), useValue: mockSessionModel },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessions', () => {
    it('should return non-revoked, non-expired sessions sorted by lastUsedAt', async () => {
      const userId = 'user-123';
      const mockSessions = [
        { _id: 's1', userId, isRevoked: false, lastUsedAt: new Date('2026-03-30') },
        { _id: 's2', userId, isRevoked: false, lastUsedAt: new Date('2026-03-28') },
      ];

      const sortMock = jest.fn().mockResolvedValue(mockSessions);
      mockSessionModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.getSessions(userId);

      expect(mockSessionModel.find).toHaveBeenCalledWith({
        userId,
        isRevoked: false,
        expiresAt: { $gt: expect.any(Date) },
      });
      expect(sortMock).toHaveBeenCalledWith({ lastUsedAt: -1 });
      expect(result).toEqual(mockSessions);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no active sessions exist', async () => {
      const sortMock = jest.fn().mockResolvedValue([]);
      mockSessionModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.getSessions('user-no-sessions');

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should mark session as revoked', async () => {
      const mockSession = {
        _id: 'session-1',
        userId: 'user-123',
        isRevoked: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockSessionModel.findOne.mockResolvedValue(mockSession);

      await service.revokeSession('user-123', 'session-1');

      expect(mockSessionModel.findOne).toHaveBeenCalledWith({
        _id: 'session-1',
        userId: 'user-123',
      });
      expect(mockSession.isRevoked).toBe(true);
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND for invalid session', async () => {
      mockSessionModel.findOne.mockResolvedValue(null);

      await expect(
        service.revokeSession('user-123', 'nonexistent-session'),
      ).rejects.toThrow(HttpException);

      await expect(
        service.revokeSession('user-123', 'nonexistent-session'),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should throw NOT_FOUND when session belongs to a different user', async () => {
      mockSessionModel.findOne.mockResolvedValue(null);

      await expect(
        service.revokeSession('user-456', 'session-owned-by-user-123'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('revokeAllSessions', () => {
    it('should update all non-revoked sessions for the user', async () => {
      mockSessionModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

      await service.revokeAllSessions('user-123');

      expect(mockSessionModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-123', isRevoked: false },
        { $set: { isRevoked: true } },
      );
    });

    it('should exclude the current session when exceptFamily is provided', async () => {
      mockSessionModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await service.revokeAllSessions('user-123', 'family-abc');

      expect(mockSessionModel.updateMany).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          isRevoked: false,
          refreshTokenFamily: { $ne: 'family-abc' },
        },
        { $set: { isRevoked: true } },
      );
    });

    it('should handle case where no sessions to revoke', async () => {
      mockSessionModel.updateMany.mockResolvedValue({ modifiedCount: 0 });

      await expect(service.revokeAllSessions('user-no-sessions')).resolves.not.toThrow();
    });
  });
});
