import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InviteService } from '../invite.service';
import { AuditService } from '../../audit.service';
import { HrSyncService } from '../hr-sync.service';

describe('InviteService', () => {
  let service: InviteService;
  let mockOrgModel: any;
  let mockOrgMembershipModel: any;
  let mockUserModel: any;
  let mockAuditService: { log: jest.Mock };
  let mockHrSyncService: any;

  beforeEach(async () => {
    mockOrgModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    mockOrgMembershipModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: 'membership-id',
      save: jest.fn().mockResolvedValue(undefined),
    }));
    mockOrgMembershipModel.findOne = jest.fn();

    mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };
    mockHrSyncService = {
      provisionEmployee: jest.fn().mockResolvedValue(undefined),
      syncEmployeeName: jest.fn().mockResolvedValue(undefined),
      syncEmployeeStatus: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        { provide: getModelToken('Organization'), useValue: mockOrgModel },
        { provide: getModelToken('OrgMembership'), useValue: mockOrgMembershipModel },
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: AuditService, useValue: mockAuditService },
        { provide: HrSyncService, useValue: mockHrSyncService },
      ],
    }).compile();

    service = module.get<InviteService>(InviteService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateInviteToken', () => {
    it('should return valid for existing pending invite', async () => {
      const membership = {
        _id: 'mem-1',
        status: 'pending',
        organizationId: 'org-1',
        role: 'employee',
        email: 'invited@example.com',
        userId: null,
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockOrgMembershipModel.findOne.mockResolvedValue(membership);
      mockOrgModel.findById.mockResolvedValue({ name: 'Test Org' });

      const result = await service.validateInviteToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('invited@example.com');
      expect(result.orgName).toBe('Test Org');
      expect(result.role).toBe('employee');
    });

    it('should return invalid for non-existent token', async () => {
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      const result = await service.validateInviteToken('nonexistent-token');

      expect(result).toEqual({ valid: false });
    });

    it('should throw INVITE_EXPIRED for expired token', async () => {
      const membership = {
        status: 'pending',
        inviteExpiresAt: new Date(Date.now() - 1000), // expired
      };
      mockOrgMembershipModel.findOne.mockResolvedValue(membership);

      await expect(service.validateInviteToken('expired-token')).rejects.toThrow(HttpException);
      try {
        await service.validateInviteToken('expired-token');
      } catch (e) {
        expect(e.getStatus()).toBe(HttpStatus.GONE);
        const response = e.getResponse();
        expect(response.error.code).toBe('INVITE_EXPIRED');
      }
    });

    it('should throw INVITE_REVOKED for removed invite', async () => {
      const membership = { status: 'removed' };
      mockOrgMembershipModel.findOne.mockResolvedValue(membership);

      await expect(service.validateInviteToken('revoked-token')).rejects.toThrow(HttpException);
      try {
        await service.validateInviteToken('revoked-token');
      } catch (e) {
        expect(e.getStatus()).toBe(HttpStatus.GONE);
        const response = e.getResponse();
        expect(response.error.code).toBe('INVITE_REVOKED');
      }
    });
  });

  describe('acceptInvite', () => {
    it('should activate membership and update user', async () => {
      const membership = {
        _id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-1',
        status: 'pending',
        inviteToken: 'token-abc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      const user = {
        _id: 'user-1',
        organizations: [],
        setupStage: 'invited',
        defaultOrganizationId: null,
        lastOrgId: null,
        isActive: false,
        includes: Array.prototype.includes,
        save: jest.fn().mockResolvedValue(undefined),
      };
      // Make organizations behave like an array
      user.organizations = [] as any;

      mockOrgMembershipModel.findOne.mockResolvedValue(membership);
      mockUserModel.findById.mockResolvedValue(user);

      const result = await service.acceptInvite('token-abc', 'user-1');

      expect(result.status).toBe('active');
      expect(result.joinedAt).toBeInstanceOf(Date);
      expect(result.inviteToken).toBeNull();
      expect(membership.save).toHaveBeenCalled();
      expect(user.isActive).toBe(true);
      expect(user.setupStage).toBe('complete');
      expect(user.save).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw for non-existent invite', async () => {
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      await expect(service.acceptInvite('bad-token', 'user-1')).rejects.toThrow(HttpException);
      await expect(service.acceptInvite('bad-token', 'user-1')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should handle already-member conflict', async () => {
      const membership = {
        _id: 'mem-1',
        userId: null, // email-only invite, no userId linked yet
        organizationId: 'org-1',
        status: 'pending',
        inviteToken: 'token-abc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      const existingActiveMembership = {
        _id: 'mem-existing',
        userId: 'user-already-member',
        organizationId: 'org-1',
        status: 'active',
      };

      // First call for the invite lookup, second call for the existing membership check
      mockOrgMembershipModel.findOne
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(existingActiveMembership);

      await expect(service.acceptInvite('token-abc', 'user-already-member')).rejects.toThrow(HttpException);

      // Reset mocks for second assertion
      mockOrgMembershipModel.findOne
        .mockResolvedValueOnce({ ...membership, save: jest.fn().mockResolvedValue(undefined) })
        .mockResolvedValueOnce(existingActiveMembership);

      await expect(
        service.acceptInvite('token-abc', 'user-already-member'),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });
  });

  describe('declineInvite', () => {
    it('should mark membership as removed', async () => {
      const membership = {
        _id: 'mem-1',
        organizationId: 'org-1',
        status: 'pending',
        inviteToken: 'token-abc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockOrgMembershipModel.findOne.mockResolvedValue(membership);

      await service.declineInvite('token-abc', 'user-1');

      expect(membership.status).toBe('removed');
      expect(membership.inviteToken).toBeNull();
      expect(membership.save).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});
