import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAdminService } from './platform-admin.service';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('PlatformAdminService', () => {
  let service: PlatformAdminService;
  let mockUserModel: any;
  let mockOrganizationModel: any;
  let mockOrgMembershipModel: any;
  let mockAuditLogModel: any;

  beforeEach(async () => {
    mockUserModel = jest.fn();
    mockUserModel.find = jest.fn();
    mockUserModel.findById = jest.fn();
    mockUserModel.countDocuments = jest.fn();

    mockOrganizationModel = jest.fn();
    mockOrganizationModel.find = jest.fn();
    mockOrganizationModel.findById = jest.fn();
    mockOrganizationModel.countDocuments = jest.fn();
    mockOrganizationModel.aggregate = jest.fn();

    mockOrgMembershipModel = jest.fn();
    mockOrgMembershipModel.find = jest.fn();
    mockOrgMembershipModel.countDocuments = jest.fn();
    mockOrgMembershipModel.aggregate = jest.fn();

    mockAuditLogModel = jest.fn();
    mockAuditLogModel.prototype.save = jest.fn();
    mockAuditLogModel.find = jest.fn();
    mockAuditLogModel.countDocuments = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAdminService,
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken('Organization'),
          useValue: mockOrganizationModel,
        },
        {
          provide: getModelToken('OrgMembership'),
          useValue: mockOrgMembershipModel,
        },
        {
          provide: getModelToken('AuditLog'),
          useValue: mockAuditLogModel,
        },
      ],
    }).compile();

    service = module.get<PlatformAdminService>(PlatformAdminService);
  });

  describe('getAllUsers', () => {
    it('should list all users with pagination', async () => {
      const mockUsers = [
        { _id: 'user1', email: 'user1@test.com', firstName: 'John', lastName: 'Doe' },
        { _id: 'user2', email: 'user2@test.com', firstName: 'Jane', lastName: 'Smith' },
      ];

      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockUsers),
          }),
        }),
      });
      mockUserModel.countDocuments.mockResolvedValue(2);

      const result = await service.getAllUsers(1, 20);

      expect(result.items).toEqual(mockUsers);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.pages).toBe(1);
    });

    it('should search users by email', async () => {
      const mockUsers = [{ _id: 'user1', email: 'john@test.com' }];

      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockUsers),
          }),
        }),
      });
      mockUserModel.countDocuments.mockResolvedValue(1);

      const result = await service.getAllUsers(1, 20, 'john');

      expect(result.items).toEqual(mockUsers);
      expect(mockUserModel.find).toHaveBeenCalled();
    });
  });

  describe('getUserDetail', () => {
    it('should get user details with memberships', async () => {
      const mockUser = {
        _id: 'user1',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Doe',
        toObject: () => ({ _id: 'user1', email: 'user@test.com' }),
      };

      const mockMemberships = [{ _id: 'mem1', organizationId: 'org1', userId: 'user1' }];
      const mockOrgs = [{ _id: 'org1', name: 'Acme Inc' }];

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockOrgMembershipModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMemberships),
      });
      mockOrganizationModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrgs),
      });

      const result = await service.getUserDetail('user1');

      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('memberships');
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(service.getUserDetail('invalid')).rejects.toThrow(HttpException);
    });
  });

  describe('disableUser', () => {
    it('should disable a user', async () => {
      const mockUser = {
        _id: 'user1',
        email: 'user@test.com',
        isActive: false,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.disableUser('user1', 'admin', '127.0.0.1');

      expect(mockUser.isActive).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(service.disableUser('invalid', 'admin', '127.0.0.1')).rejects.toThrow(HttpException);
    });
  });

  describe('enableUser', () => {
    it('should enable a user', async () => {
      const mockUser = {
        _id: 'user1',
        email: 'user@test.com',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.enableUser('user1', 'admin', '127.0.0.1');

      expect(mockUser.isActive).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('resetUserAuth', () => {
    it('should reset user authentication', async () => {
      const mockUser = {
        _id: 'user1',
        email: 'user@test.com',
        mfaEnabled: false,
        mfaSecret: undefined,
        mfaBackupCodes: [],
        loginAttempts: 0,
        lockUntil: null,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.resetUserAuth('user1', 'admin', '127.0.0.1');

      expect(mockUser.mfaEnabled).toBe(false);
      expect(mockUser.loginAttempts).toBe(0);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should clear MFA and login attempts for locked user', async () => {
      const mockUser = {
        _id: 'user1',
        email: 'user@test.com',
        mfaEnabled: true,
        mfaSecret: 'secret',
        mfaBackupCodes: ['code1', 'code2'],
        loginAttempts: 5,
        lockUntil: new Date(Date.now() + 3600000),
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      await service.resetUserAuth('user1', 'admin', '127.0.0.1');

      expect(mockUser.mfaEnabled).toBe(false);
      expect(mockUser.loginAttempts).toBe(0);
      expect(mockUser.lockUntil).toBeNull();
    });
  });

  describe('getAllOrganizations', () => {
    it('should list all organizations with pagination', async () => {
      const mockOrgs = [
        { _id: 'org1', name: 'Acme Inc', toObject: () => ({ _id: 'org1', name: 'Acme Inc' }) },
        { _id: 'org2', name: 'Tech Corp', toObject: () => ({ _id: 'org2', name: 'Tech Corp' }) },
      ];

      mockOrganizationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockOrgs),
          }),
        }),
      });
      mockOrganizationModel.countDocuments.mockResolvedValue(2);
      mockOrgMembershipModel.aggregate.mockResolvedValue([
        { _id: 'org1', count: 10 },
        { _id: 'org2', count: 20 },
      ]);

      const result = await service.getAllOrganizations(1, 20);

      expect(result.items).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });

    it('should filter organizations by status', async () => {
      const mockOrgs = [
        {
          _id: 'org1',
          name: 'Acme Inc',
          isActive: true,
          toObject: () => ({ _id: 'org1', name: 'Acme Inc', isActive: true }),
        },
      ];

      mockOrganizationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockOrgs),
          }),
        }),
      });
      mockOrganizationModel.countDocuments.mockResolvedValue(1);
      mockOrgMembershipModel.aggregate.mockResolvedValue([{ _id: 'org1', count: 10 }]);

      const result = await service.getAllOrganizations(1, 20, '', 'active');

      expect(result.items).toBeDefined();
      expect(mockOrganizationModel.find).toHaveBeenCalled();
    });
  });

  describe('getOrganizationDetail', () => {
    it('should get organization details', async () => {
      const mockOrg = {
        _id: 'org1',
        name: 'Acme Inc',
        toObject: () => ({ _id: 'org1', name: 'Acme Inc' }),
      };

      mockOrganizationModel.findById.mockResolvedValue(mockOrg);
      mockOrgMembershipModel.countDocuments.mockResolvedValue(10);

      const result = await service.getOrganizationDetail('org1');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('memberCount');
      expect(result.memberCount).toBe(10);
    });

    it('should throw error if organization not found', async () => {
      mockOrganizationModel.findById.mockResolvedValue(null);

      await expect(service.getOrganizationDetail('invalid')).rejects.toThrow(HttpException);
    });
  });

  describe('suspendOrganization', () => {
    it('should suspend an organization', async () => {
      const mockOrg = {
        _id: 'org1',
        name: 'Acme Inc',
        isActive: false,
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrganizationModel.findById.mockResolvedValue(mockOrg);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.suspendOrganization('org1', 'admin', '127.0.0.1');

      expect(mockOrg.isActive).toBe(false);
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });

  describe('activateOrganization', () => {
    it('should activate an organization', async () => {
      const mockOrg = {
        _id: 'org1',
        name: 'Acme Inc',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrganizationModel.findById.mockResolvedValue(mockOrg);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.activateOrganization('org1', 'admin', '127.0.0.1');

      expect(mockOrg.isActive).toBe(true);
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });

  describe('updateOrganizationPlan', () => {
    it('should update organization plan', async () => {
      const mockOrg = {
        _id: 'org1',
        name: 'Acme Inc',
        plan: 'enterprise',
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrganizationModel.findById.mockResolvedValue(mockOrg);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.updateOrganizationPlan('org1', 'enterprise', 'admin', '127.0.0.1');

      expect(mockOrg.plan).toBe('enterprise');
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });

  describe('updateOrganizationFeatures', () => {
    it('should update organization feature flags', async () => {
      const mockOrg = {
        _id: 'org1',
        name: 'Acme Inc',
        features: { sso: { enabled: false } },
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrganizationModel.findById.mockResolvedValue(mockOrg);
      mockAuditLogModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
      }));

      const newFeatures = { sso: { enabled: true }, mfa: { enabled: true } };
      const result = await service.updateOrganizationFeatures('org1', newFeatures, 'admin', '127.0.0.1');

      expect(mockOrg.markModified).toHaveBeenCalledWith('features');
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });

  describe('getPlatformAnalytics', () => {
    it('should get platform analytics', async () => {
      mockUserModel.countDocuments.mockResolvedValue(1000);
      mockOrganizationModel.countDocuments
        .mockResolvedValueOnce(50) // totalOrgs
        .mockResolvedValueOnce(45) // activeOrgs
        .mockResolvedValueOnce(5); // newOrgsThisMonth

      mockOrganizationModel.aggregate.mockResolvedValue([
        { _id: 'enterprise', count: 20 },
        { _id: 'starter', count: 30 },
      ]);

      const result = await service.getPlatformAnalytics();

      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalOrgs');
      expect(result).toHaveProperty('activeOrgs');
      expect(result).toHaveProperty('suspendedOrgs');
      expect(result.totalUsers).toBe(1000);
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with pagination', async () => {
      const mockLogs = [
        { _id: 'log1', action: 'user.disable', targetType: 'user', targetId: 'user1' },
        { _id: 'log2', action: 'organization.suspend', targetType: 'organization', targetId: 'org1' },
      ];

      mockAuditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });
      mockAuditLogModel.countDocuments.mockResolvedValue(2);

      const result = await service.getAuditLogs(1, 20);

      expect(result.items).toEqual(mockLogs);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter audit logs by action', async () => {
      const mockLogs = [{ _id: 'log1', action: 'user.disable' }];

      mockAuditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });
      mockAuditLogModel.countDocuments.mockResolvedValue(1);

      const result = await service.getAuditLogs(1, 20, 'user.disable');

      expect(result.items).toEqual(mockLogs);
      expect(mockAuditLogModel.find).toHaveBeenCalled();
    });
  });
});
