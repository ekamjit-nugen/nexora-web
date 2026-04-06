import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../token.service';

describe('TokenService', () => {
  let service: TokenService;
  let mockUserModel: any;
  let mockOrgMembershipModel: any;
  let mockSessionModel: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockUserModel = {
      findById: jest.fn(),
    };

    mockOrgMembershipModel = {
      findOne: jest.fn(),
    };

    mockSessionModel = {
      create: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('15m'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: getModelToken('OrgMembership'), useValue: mockOrgMembershipModel },
        { provide: getModelToken('Session'), useValue: mockSessionModel },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    _id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roles: ['user'],
    setupStage: 'complete',
    isPlatformAdmin: false,
    defaultOrganizationId: null,
    isActive: true,
  } as any;

  describe('generateTokens', () => {
    it('should return accessToken, refreshToken, and expiresIn', async () => {
      mockJwtService.sign
        .mockReturnValueOnce('access-token-value')
        .mockReturnValueOnce('refresh-token-value');
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      const result = await service.generateTokens(mockUser);

      expect(result).toHaveProperty('accessToken', 'access-token-value');
      expect(result).toHaveProperty('refreshToken', 'refresh-token-value');
      expect(result).toHaveProperty('expiresIn', 604800);
    });

    it('should create a session record', async () => {
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      await service.generateTokens(mockUser);

      expect(mockSessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          deviceInfo: 'Unknown',
        }),
      );
    });

    it('should look up org role from membership when orgId is provided', async () => {
      mockOrgMembershipModel.findOne.mockResolvedValue({ role: 'admin' });

      await service.generateTokens(mockUser, 'org-456');

      expect(mockOrgMembershipModel.findOne).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 'org-456',
        status: 'active',
      });
      // The payload passed to sign should contain orgRole: 'admin'
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ orgRole: 'admin', organizationId: 'org-456' }),
        expect.any(Object),
      );
    });
  });

  describe('generateTokensWithOrg', () => {
    it('should call generateTokens with user and orgId', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      const result = await service.generateTokensWithOrg('user-123', 'org-456');

      expect(mockUserModel.findById).toHaveBeenCalledWith('user-123');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for a valid refresh token', async () => {
      const session = {
        refreshTokenFamily: 'family-abc',
        isRevoked: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockJwtService.verify.mockReturnValue({ sub: 'user-123', family: 'family-abc' });
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockSessionModel.findOne.mockResolvedValue(session);
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw for an invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(HttpException);
      await expect(service.refreshToken('bad-token')).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('should revoke old session on rotation', async () => {
      const session = {
        refreshTokenFamily: 'family-abc',
        isRevoked: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockJwtService.verify.mockReturnValue({ sub: 'user-123', family: 'family-abc' });
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockSessionModel.findOne.mockResolvedValue(session);
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      await service.refreshToken('valid-refresh-token');

      expect(session.isRevoked).toBe(true);
      expect(session.save).toHaveBeenCalled();
    });
  });

  describe('generateCsrfToken', () => {
    it('should return a hex string', () => {
      const token = service.generateCsrfToken();

      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[0-9a-f]+$/);
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('validateCsrfToken', () => {
    it('should return true for matching tokens', () => {
      const token = 'abc123def456';
      const result = service.validateCsrfToken(token, token);
      expect(result).toBe(true);
    });

    it('should return false for mismatched tokens', () => {
      const result = service.validateCsrfToken('token-a-value', 'token-b-value');
      expect(result).toBe(false);
    });
  });
});
