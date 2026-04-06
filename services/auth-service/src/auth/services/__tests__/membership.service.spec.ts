import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipService } from '../membership.service';
import { AuditService } from '../../audit.service';
import { HrSyncService } from '../hr-sync.service';

describe('MembershipService', () => {
  let service: MembershipService;
  let mockOrgMembershipModel: any;
  let mockUserModel: any;
  let mockSessionModel: any;
  let mockAuditService: { log: jest.Mock };

  beforeEach(async () => {
    mockOrgMembershipModel = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockUserModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      find: jest.fn(),
    };

    mockSessionModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };

    mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: getModelToken('OrgMembership'), useValue: mockOrgMembershipModel },
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: getModelToken('Session'), useValue: mockSessionModel },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: HrSyncService,
          useValue: {
            provisionEmployee: jest.fn().mockResolvedValue(undefined),
            syncEmployeeName: jest.fn().mockResolvedValue(undefined),
            syncEmployeeStatus: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deactivateMember', () => {
    it('should set status to deactivated and revoke sessions', async () => {
      const membership = {
        _id: 'mem-1',
        userId: 'target-user',
        organizationId: 'org-1',
        status: 'active',
        deactivatedAt: null,
        deactivatedBy: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockOrgMembershipModel.findOne.mockResolvedValue(membership);

      const result = await service.deactivateMember('org-1', 'target-user', 'admin-user');

      expect(result.status).toBe('deactivated');
      expect(result.deactivatedAt).toBeInstanceOf(Date);
      expect(result.deactivatedBy).toBe('admin-user');
      expect(membership.save).toHaveBeenCalled();
      expect(mockSessionModel.updateMany).toHaveBeenCalledWith(
        { userId: 'target-user', isRevoked: false },
        { $set: { isRevoked: true } },
      );
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw for non-active membership', async () => {
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateMember('org-1', 'target-user', 'admin-user'),
      ).rejects.toThrow(HttpException);
      await expect(
        service.deactivateMember('org-1', 'target-user', 'admin-user'),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('reactivateMember', () => {
    it('should set status back to active', async () => {
      const membership = {
        _id: 'mem-1',
        userId: 'target-user',
        organizationId: 'org-1',
        status: 'deactivated',
        deactivatedAt: new Date(),
        deactivatedBy: 'admin-user',
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockOrgMembershipModel.findOne.mockResolvedValue(membership);

      const result = await service.reactivateMember('org-1', 'target-user', 'admin-user');

      expect(result.status).toBe('active');
      expect(result.deactivatedAt).toBeNull();
      expect(result.deactivatedBy).toBeNull();
      expect(membership.save).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw for non-deactivated membership', async () => {
      mockOrgMembershipModel.findOne.mockResolvedValue(null);

      await expect(
        service.reactivateMember('org-1', 'target-user', 'admin-user'),
      ).rejects.toThrow(HttpException);
      await expect(
        service.reactivateMember('org-1', 'target-user', 'admin-user'),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('getOrgMembers', () => {
    it('should return members with user details', async () => {
      const memberships = [
        {
          _id: 'mem-1',
          userId: 'user-1',
          email: null,
          organizationId: 'org-1',
          role: 'admin',
          status: 'active',
          invitedBy: 'inviter-1',
          invitedAt: new Date('2026-01-01'),
          joinedAt: new Date('2026-01-02'),
        },
        {
          _id: 'mem-2',
          userId: null,
          email: 'pending@example.com',
          organizationId: 'org-1',
          role: 'employee',
          status: 'pending',
          invitedBy: 'inviter-1',
          invitedAt: new Date('2026-03-01'),
          joinedAt: null,
        },
      ];
      const users = [
        {
          _id: { toString: () => 'user-1' },
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          avatar: null,
        },
      ];

      mockOrgMembershipModel.find.mockResolvedValue(memberships);
      mockUserModel.find.mockResolvedValue(users);

      const result = await service.getOrgMembers('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].user).toEqual({
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        avatar: null,
      });
      // Pending member with email but no userId
      expect(result[1].user).toEqual({
        email: 'pending@example.com',
        firstName: null,
        lastName: null,
        avatar: null,
      });
    });
  });
});
