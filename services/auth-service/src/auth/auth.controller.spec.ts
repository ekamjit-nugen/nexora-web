import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    setupMFA: jest.fn(),
    verifyMFA: jest.fn(),
    getUserById: jest.fn(),
    logout: jest.fn(),
    handleOAuthCallback: jest.fn(),
  };

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    roles: ['user'],
  };

  const mockTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 900,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it(
      'TC-CTRL-001: Should register user successfully',
      async () => {
        // Arrange
        mockAuthService.register.mockResolvedValue(mockUser);

        // Act
        const result = await controller.register({
          email: 'test@example.com',
          password: 'Password123!@',
          firstName: 'John',
          lastName: 'Doe',
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockUser);
        expect(mockAuthService.register).toHaveBeenCalledWith(
          'test@example.com',
          'Password123!@',
          'John',
          'Doe',
        );
      },
    );
  });

  describe('login', () => {
    it(
      'TC-CTRL-002: Should login user successfully',
      async () => {
        // Arrange
        mockAuthService.login.mockResolvedValue(mockTokens);

        // Act
        const result = await controller.login(
          {
            email: 'test@example.com',
            password: 'Password123!@',
            rememberMe: false,
          },
          { headers: { 'x-forwarded-for': '127.0.0.1' } },
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockTokens);
        expect(mockAuthService.login).toHaveBeenCalledWith(
          'test@example.com',
          'Password123!@',
        );
      },
    );
  });

  describe('refreshToken', () => {
    it(
      'TC-CTRL-003: Should refresh token successfully',
      async () => {
        // Arrange
        mockAuthService.refreshToken.mockResolvedValue(mockTokens);

        // Act
        const result = await controller.refreshToken({
          refreshToken: 'old-refresh-token',
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockTokens);
        expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
          'old-refresh-token',
        );
      },
    );
  });

  describe('setupMFA', () => {
    it(
      'TC-CTRL-004: Should setup MFA successfully',
      async () => {
        // Arrange
        const mfaSetup = {
          secret: 'test-secret',
          qrCode: 'data:image/png;base64,...',
        };
        mockAuthService.setupMFA.mockResolvedValue(mfaSetup);

        // Act
        const result = await controller.setupMFA({
          user: { userId: mockUser._id },
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mfaSetup);
        expect(mockAuthService.setupMFA).toHaveBeenCalledWith(mockUser._id);
      },
    );
  });

  describe('verifyMFA', () => {
    it(
      'TC-CTRL-005: Should verify MFA successfully',
      async () => {
        // Arrange
        mockAuthService.verifyMFA.mockResolvedValue(true);

        // Act
        const result = await controller.verifyMFA(
          { user: { userId: mockUser._id } },
          {
            code: '123456',
            rememberThisDevice: false,
          },
        );

        // Assert
        expect(result.success).toBe(true);
        expect(mockAuthService.verifyMFA).toHaveBeenCalledWith(
          mockUser._id,
          '123456',
        );
      },
    );
  });

  describe('getCurrentUser', () => {
    it(
      'TC-CTRL-006: Should get current user successfully',
      async () => {
        // Arrange
        mockAuthService.getUserById.mockResolvedValue(mockUser);

        // Act
        const result = await controller.getCurrentUser({
          user: { userId: mockUser._id },
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockUser);
        expect(mockAuthService.getUserById).toHaveBeenCalledWith(mockUser._id);
      },
    );
  });

  describe('googleCallback', () => {
    it(
      'TC-CTRL-007: Should handle Google OAuth callback',
      async () => {
        // Arrange
        const mockRequest = {
          user: {
            user: mockUser,
            tokens: mockTokens,
          },
        };
        const mockResponse = {
          json: jest.fn(),
        };

        // Act
        await controller.googleCallback(mockRequest, mockResponse);

        // Assert
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Google login successful',
          data: {
            user: mockUser,
            tokens: mockTokens,
          },
        });
      },
    );
  });

  describe('microsoftCallback', () => {
    it(
      'TC-CTRL-008: Should handle Microsoft OAuth callback',
      async () => {
        // Arrange
        const mockRequest = {
          user: {
            user: mockUser,
            tokens: mockTokens,
          },
        };
        const mockResponse = {
          json: jest.fn(),
        };

        // Act
        await controller.microsoftCallback(mockRequest, mockResponse);

        // Assert
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Microsoft login successful',
          data: {
            user: mockUser,
            tokens: mockTokens,
          },
        });
      },
    );
  });

  describe('logout', () => {
    it(
      'TC-CTRL-009: Should logout user successfully',
      async () => {
        // Arrange
        mockAuthService.logout.mockResolvedValue(undefined);

        // Act
        const result = await controller.logout({
          user: { userId: mockUser._id },
          headers: { authorization: 'Bearer token' },
        });

        // Assert
        expect(result.success).toBe(true);
        expect(mockAuthService.logout).toHaveBeenCalled();
      },
    );
  });
});

/*
 * When: Controller endpoint is called
 * if: request is valid and service layer succeeds
 * then: return success response with appropriate data
 */
