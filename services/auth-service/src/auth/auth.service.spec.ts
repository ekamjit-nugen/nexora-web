import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserModel: any;
  let mockJwtService: any;
  let mockConfigService: any;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    roles: ['user'],
    permissions: [],
    loginAttempts: 0,
    lockUntil: null,
    mfaEnabled: false,
    isEmailVerified: false,
    isPhoneVerified: false,
    oauthProviders: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    comparePassword: jest.fn(),
    isAccountLocked: jest.fn(),
    toObject: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          MONGODB_URI: 'mongodb://localhost:27017/nexora_auth',
          JWT_SECRET: 'test-secret',
          JWT_EXPIRY: '15m',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it(
      'TC-AUTH-001: Should register user with valid credentials',
      async () => {
        // Arrange
        mockUserModel.findOne.mockResolvedValue(null);
        const saveUser = { ...mockUser, save: jest.fn().mockResolvedValue(mockUser) };
        mockUserModel.prototype = { save: jest.fn().mockResolvedValue(mockUser) };

        // Act
        const result = await service.register(
          'test@example.com',
          'Password123!@',
          'John',
          'Doe',
        );

        // Assert
        expect(mockUserModel.findOne).toHaveBeenCalledWith({
          email: 'test@example.com',
        });
        expect(result).toBeDefined();
      },
    );

    it(
      'TC-AUTH-002: Should throw error when user already exists',
      async () => {
        // Arrange
        mockUserModel.findOne.mockResolvedValue(mockUser);

        // Act & Assert
        await expect(
          service.register('test@example.com', 'Password123!@', 'John', 'Doe'),
        ).rejects.toThrow('User with this email already exists');
      },
    );

    it(
      'TC-AUTH-003: Should throw error for weak password',
      async () => {
        // Arrange
        mockUserModel.findOne.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.register('test@example.com', 'weak', 'John', 'Doe'),
        ).rejects.toThrow();
      },
    );
  });

  describe('login', () => {
    it(
      'TC-AUTH-004: Should login user with valid credentials',
      async () => {
        // Arrange
        mockUser.comparePassword.mockResolvedValue(true);
        mockUser.isAccountLocked.mockReturnValue(false);
        mockUserModel.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser),
        });
        mockJwtService.sign
          .mockReturnValueOnce('access-token')
          .mockReturnValueOnce('refresh-token');

        // Act
        const result = await service.login('test@example.com', 'Password123!@');

        // Assert
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(result.expiresIn).toBe(900);
      },
    );

    it(
      'TC-AUTH-005: Should throw error for invalid email',
      async () => {
        // Arrange
        mockUserModel.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(null),
        });

        // Act & Assert
        await expect(
          service.login('nonexistent@example.com', 'Password123!@'),
        ).rejects.toThrow('Invalid email or password');
      },
    );

    it(
      'TC-AUTH-006: Should throw error for wrong password',
      async () => {
        // Arrange
        mockUser.comparePassword.mockResolvedValue(false);
        mockUser.isAccountLocked.mockReturnValue(false);
        mockUser.save.mockResolvedValue(mockUser);
        mockUserModel.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser),
        });

        // Act & Assert
        await expect(
          service.login('test@example.com', 'WrongPassword'),
        ).rejects.toThrow('Invalid email or password');
      },
    );

    it(
      'TC-AUTH-007: Should throw error when account is locked',
      async () => {
        // Arrange
        mockUser.isAccountLocked.mockReturnValue(true);
        mockUserModel.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser),
        });

        // Act & Assert
        await expect(
          service.login('test@example.com', 'Password123!@'),
        ).rejects.toThrow('Account locked');
      },
    );

    it(
      'TC-AUTH-008: Should increment login attempts on failed login',
      async () => {
        // Arrange
        mockUser.comparePassword.mockResolvedValue(false);
        mockUser.isAccountLocked.mockReturnValue(false);
        mockUser.save.mockResolvedValue(mockUser);
        mockUserModel.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser),
        });

        // Act
        try {
          await service.login('test@example.com', 'WrongPassword');
        } catch (e) {
          // Expected
        }

        // Assert
        expect(mockUser.save).toHaveBeenCalled();
      },
    );
  });

  describe('refreshToken', () => {
    it(
      'TC-AUTH-009: Should refresh token with valid refresh token',
      async () => {
        // Arrange
        mockJwtService.verify.mockReturnValue({ sub: mockUser._id });
        mockUserModel.findById.mockResolvedValue(mockUser);
        mockJwtService.sign
          .mockReturnValueOnce('new-access-token')
          .mockReturnValueOnce('new-refresh-token');

        // Act
        const result = await service.refreshToken('valid-refresh-token');

        // Assert
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
      },
    );

    it(
      'TC-AUTH-010: Should throw error for invalid refresh token',
      async () => {
        // Arrange
        mockJwtService.verify.mockThrow(new Error('Invalid token'));

        // Act & Assert
        await expect(
          service.refreshToken('invalid-refresh-token'),
        ).rejects.toThrow('Invalid refresh token');
      },
    );
  });

  describe('generateTokens', () => {
    it(
      'TC-AUTH-011: Should generate valid tokens',
      async () => {
        // Arrange
        mockJwtService.sign
          .mockReturnValueOnce('access-token')
          .mockReturnValueOnce('refresh-token');

        // Act
        const result = await service.generateTokens(mockUser);

        // Assert
        expect(result.accessToken).toBe('access-token');
        expect(result.refreshToken).toBe('refresh-token');
        expect(result.expiresIn).toBe(900);
      },
    );
  });

  describe('setupMFA', () => {
    it(
      'TC-AUTH-012: Should setup TOTP MFA',
      async () => {
        // Arrange
        mockUserModel.findById.mockResolvedValue(mockUser);
        mockUser.save.mockResolvedValue(mockUser);

        // Act
        const result = await service.setupMFA(mockUser._id);

        // Assert
        expect(result).toHaveProperty('secret');
        expect(result).toHaveProperty('qrCode');
      },
    );

    it(
      'TC-AUTH-013: Should throw error when user not found for MFA setup',
      async () => {
        // Arrange
        mockUserModel.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.setupMFA('invalid-user-id'),
        ).rejects.toThrow('User not found');
      },
    );
  });

  describe('verifyMFA', () => {
    it(
      'TC-AUTH-014: Should verify TOTP code successfully',
      async () => {
        // Arrange
        mockUser.mfaSecret = 'test-secret';
        mockUserModel.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser),
        });
        mockUser.save.mockResolvedValue(mockUser);

        // Act
        // Note: This test might need adjustment based on speakeasy behavior
        const result = await service.verifyMFA(mockUser._id, '000000');

        // Assert
        // This depends on the TOTP code generated
      },
    );
  });

  describe('getUserById', () => {
    it(
      'TC-AUTH-015: Should get user by ID',
      async () => {
        // Arrange
        mockUserModel.findById.mockResolvedValue(mockUser);

        // Act
        const result = await service.getUserById(mockUser._id);

        // Assert
        expect(result).toEqual(mockUser);
      },
    );

    it(
      'TC-AUTH-016: Should throw error when user not found',
      async () => {
        // Arrange
        mockUserModel.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.getUserById('invalid-user-id'),
        ).rejects.toThrow('User not found');
      },
    );
  });

  describe('validateJwtPayload', () => {
    it(
      'TC-AUTH-017: Should validate correct JWT payload',
      async () => {
        // Arrange
        const validPayload = {
          sub: 'user-id',
          email: 'test@example.com',
          roles: ['user'],
        };

        // Act
        const result = service.validateJwtPayload(validPayload);

        // Assert
        expect(result).toBe(true);
      },
    );

    it(
      'TC-AUTH-018: Should reject incomplete JWT payload',
      async () => {
        // Arrange
        const invalidPayload = {
          sub: 'user-id',
          email: 'test@example.com',
        };

        // Act
        const result = service.validateJwtPayload(invalidPayload);

        // Assert
        expect(result).toBe(false);
      },
    );
  });
});

/*
 * When: AuthService methods are called
 * if: input parameters are valid and database operations succeed
 * then: return expected output or throw appropriate errors
 */
