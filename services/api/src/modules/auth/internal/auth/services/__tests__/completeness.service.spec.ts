import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CompletenessService } from '../completeness.service';

describe('CompletenessService', () => {
  let service: CompletenessService;
  let mockOrganizationModel: any;
  let mockOrgMembershipModel: any;

  beforeEach(async () => {
    mockOrganizationModel = {
      findOne: jest.fn(),
    };

    mockOrgMembershipModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletenessService,
        { provide: getModelToken('Organization'), useValue: mockOrganizationModel },
        { provide: getModelToken('OrgMembership'), useValue: mockOrgMembershipModel },
      ],
    }).compile();

    service = module.get<CompletenessService>(CompletenessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSetupCompleteness', () => {
    it('should return 15% when only basic info is complete', async () => {
      const mockOrg = {
        _id: 'org-1',
        name: 'Test Org',
        type: 'Product Company',
        size: '11-50',
        country: 'IN',
        isDeleted: false,
        business: {},
        payroll: {},
        workPreferences: {},
        branding: {},
      };
      mockOrganizationModel.findOne.mockResolvedValue(mockOrg);
      mockOrgMembershipModel.countDocuments.mockResolvedValue(0);

      const result = await service.calculateSetupCompleteness('org-1');

      expect(result.percentage).toBe(15);
      expect(result.categories.basicInfo.complete).toBe(true);
      expect(result.categories.businessDetails.complete).toBe(false);
      expect(result.categories.payrollSetup.complete).toBe(false);
      expect(result.categories.workConfig.complete).toBe(false);
      expect(result.categories.branding.complete).toBe(false);
      expect(result.categories.teamSetup.complete).toBe(false);
    });

    it('should return 100% when all categories are complete', async () => {
      const mockOrg = {
        _id: 'org-1',
        name: 'Complete Org',
        type: 'Product Company',
        size: '11-50',
        country: 'IN',
        isDeleted: false,
        business: {
          registeredAddress: { city: 'Mumbai', pincode: '400001' },
          pan: 'ABCDE1234F',
        },
        payroll: {
          pfConfig: { registrationNumber: 'PF123' },
          tdsConfig: { tanNumber: 'TAN123' },
        },
        workPreferences: {
          workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          workingHours: { start: '09:00', end: '18:00' },
          holidays: [{ date: '2026-01-26', name: 'Republic Day' }],
        },
        branding: { logo: 'https://example.com/logo.png' },
      };
      mockOrganizationModel.findOne.mockResolvedValue(mockOrg);
      mockOrgMembershipModel.countDocuments.mockResolvedValue(5);

      const result = await service.calculateSetupCompleteness('org-1');

      expect(result.percentage).toBe(100);
      Object.values(result.categories).forEach((cat) => {
        expect(cat.complete).toBe(true);
      });
      expect(result.nextAction).toBe('');
    });

    it('should return correct nextAction for each incomplete category', async () => {
      // Only basic info complete, team incomplete => next action should be about team
      const mockOrg = {
        _id: 'org-1',
        name: 'Test Org',
        type: 'Product Company',
        size: '11-50',
        country: 'IN',
        isDeleted: false,
        business: {},
        payroll: {},
        workPreferences: {},
        branding: {},
      };
      mockOrganizationModel.findOne.mockResolvedValue(mockOrg);
      mockOrgMembershipModel.countDocuments.mockResolvedValue(0);

      const result = await service.calculateSetupCompleteness('org-1');

      expect(result.nextAction).toBe('Invite at least 2 team members');
    });

    it('should throw NOT_FOUND when organization does not exist', async () => {
      mockOrganizationModel.findOne.mockResolvedValue(null);

      await expect(
        service.calculateSetupCompleteness('nonexistent-org'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('determinePostLoginRoute', () => {
    it('should route new user to /auth/setup-organization', async () => {
      const user = { _id: 'user-1', setupStage: 'otp_verified' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/setup-organization');
      expect(result.reason).toBe('new_user');
    });

    it('should route complete user with 1 active org to /dashboard', async () => {
      const user = { _id: 'user-1', setupStage: 'complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'active' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/dashboard');
      expect(result.reason).toBe('active_user');
      expect(result.organizationId).toBe('org-1');
    });

    it('should route invited user to /auth/accept-invite', async () => {
      const user = { _id: 'user-1', setupStage: 'invited' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'pending' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/accept-invite');
      expect(result.reason).toBe('pending_invite');
      expect(result.organizationId).toBe('org-1');
    });

    it('should route multi-org user to /auth/select-organization', async () => {
      const user = { _id: 'user-1', setupStage: 'complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'active' },
        { userId: 'user-1', organizationId: 'org-2', status: 'active' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/select-organization');
      expect(result.reason).toBe('multi_org');
      expect(result.organizations).toEqual(['org-1', 'org-2']);
    });

    it('should route deactivated single-org member to /auth/access-denied', async () => {
      const user = { _id: 'user-1', setupStage: 'complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'deactivated' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/access-denied');
      expect(result.reason).toBe('membership_deactivated');
    });

    it('should route user with org_created stage to /auth/setup-profile', async () => {
      const user = { _id: 'user-1', setupStage: 'org_created' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'active' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/setup-profile');
      expect(result.reason).toBe('incomplete_profile');
    });

    it('should route user with profile_complete stage to /auth/invite-team', async () => {
      const user = { _id: 'user-1', setupStage: 'profile_complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'active' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/invite-team');
      expect(result.reason).toBe('incomplete_setup');
    });

    it('should route complete user with no memberships to /auth/setup-organization', async () => {
      const user = { _id: 'user-1', setupStage: 'complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/setup-organization');
      expect(result.reason).toBe('no_active_org');
    });

    it('should route multi-org user with all deactivated to /auth/access-denied', async () => {
      const user = { _id: 'user-1', setupStage: 'complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'deactivated' },
        { userId: 'user-1', organizationId: 'org-2', status: 'deactivated' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/auth/access-denied');
      expect(result.reason).toBe('all_memberships_deactivated');
    });

    it('should route multi-org user with single active to /dashboard', async () => {
      const user = { _id: 'user-1', setupStage: 'complete' } as any;
      mockOrgMembershipModel.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', status: 'active' },
        { userId: 'user-1', organizationId: 'org-2', status: 'deactivated' },
      ]);

      const result = await service.determinePostLoginRoute(user);

      expect(result.route).toBe('/dashboard');
      expect(result.reason).toBe('single_active_org');
      expect(result.organizationId).toBe('org-1');
    });
  });
});
