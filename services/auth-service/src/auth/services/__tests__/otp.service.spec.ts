import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';
import { OtpService } from '../otp.service';
import { AuditService } from '../../audit.service';

describe('OtpService', () => {
  let service: OtpService;
  let mockUserModel: any;
  let mockAuditService: { log: jest.Mock };

  const makeSaveableUser = (data: Record<string, any>): any => ({
    ...data,
    save: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    const savedInstances: any[] = [];

    mockUserModel = jest.fn().mockImplementation((dto) => {
      const instance = makeSaveableUser({ ...dto, _id: 'new-user-id' });
      savedInstances.push(instance);
      return instance;
    });
    mockUserModel.findOne = jest.fn();

    mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    it('should create a pending user for a new email', async () => {
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const result = await service.sendOtp('new@example.com');

      expect(result).toEqual({ sent: true, isNewUser: true });
      expect(mockUserModel).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          isActive: false,
          setupStage: 'otp_verified',
          otpAttempts: 0,
          otpRequestCount: 1,
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should reuse existing user and update OTP', async () => {
      const existingUser = makeSaveableUser({
        _id: 'existing-id',
        email: 'existing@example.com',
        otp: '111111',
        otpExpiresAt: new Date(),
        otpAttempts: 2,
        otpLastRequestedAt: new Date(Date.now() - 60 * 1000), // 60 seconds ago
        otpRequestCount: 1,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(existingUser) });

      const result = await service.sendOtp('existing@example.com');

      expect(result).toEqual({ sent: true, isNewUser: false });
      expect(existingUser.otpAttempts).toBe(0);
      expect(existingUser.otpRequestCount).toBe(2);
      expect(existingUser.save).toHaveBeenCalled();
      expect(mockUserModel).not.toHaveBeenCalled(); // should not create new user
    });

    it('should enforce rate limit of 5 requests per hour', async () => {
      const rateLimitedUser = makeSaveableUser({
        _id: 'rate-limited-id',
        email: 'limited@example.com',
        otpLastRequestedAt: new Date(Date.now() - 10 * 1000), // 10 seconds ago (within the hour)
        otpRequestCount: 5,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(rateLimitedUser) });

      await expect(service.sendOtp('limited@example.com')).rejects.toThrow(HttpException);
      await expect(service.sendOtp('limited@example.com')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should enforce resend cooldown of 30 seconds', async () => {
      const cooldownUser = makeSaveableUser({
        _id: 'cooldown-id',
        email: 'cooldown@example.com',
        otpLastRequestedAt: new Date(Date.now() - 5 * 1000), // 5 seconds ago
        otpRequestCount: 1,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(cooldownUser) });

      await expect(service.sendOtp('cooldown@example.com')).rejects.toThrow(HttpException);
      await expect(service.sendOtp('cooldown@example.com')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('verifyOtp', () => {
    it('should return verified user for correct OTP', async () => {
      const user = makeSaveableUser({
        _id: 'user-id',
        email: 'user@example.com',
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        isActive: true,
        setupStage: 'complete',
        lockUntil: null,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      const result = await service.verifyOtp('user@example.com', '123456');

      expect(result.verified).toBe(true);
      expect(result.user).toBeDefined();
      expect(user.otp).toBeUndefined();
      expect(user.otpAttempts).toBe(0);
      expect(user.save).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw for wrong OTP and increment attempts', async () => {
      const user = makeSaveableUser({
        _id: 'user-id',
        email: 'user@example.com',
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 1,
        lockUntil: null,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await expect(service.verifyOtp('user@example.com', '999999')).rejects.toThrow(HttpException);

      expect(user.otpAttempts).toBe(2);
      expect(user.save).toHaveBeenCalled();
    });

    it('should throw for expired OTP', async () => {
      const user = makeSaveableUser({
        _id: 'user-id',
        email: 'user@example.com',
        otp: '123456',
        otpExpiresAt: new Date(Date.now() - 1000), // expired
        otpAttempts: 0,
        lockUntil: null,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await expect(service.verifyOtp('user@example.com', '123456')).rejects.toThrow(HttpException);
      await expect(service.verifyOtp('user@example.com', '123456')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should lock account after max attempts', async () => {
      const user = makeSaveableUser({
        _id: 'user-id',
        email: 'user@example.com',
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 5, // at max
        lockUntil: null,
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await expect(service.verifyOtp('user@example.com', '999999')).rejects.toThrow(HttpException);

      expect(user.lockUntil).toBeInstanceOf(Date);
      expect(user.save).toHaveBeenCalled();
    });

    it('should throw for locked account', async () => {
      const user = makeSaveableUser({
        _id: 'user-id',
        email: 'user@example.com',
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        lockUntil: new Date(Date.now() + 15 * 60 * 1000), // locked for 15 more minutes
      });
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await expect(service.verifyOtp('user@example.com', '123456')).rejects.toThrow(HttpException);
      await expect(service.verifyOtp('user@example.com', '123456')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });
});
