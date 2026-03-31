import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { getModelToken } from '@nestjs/mongoose';

describe('PlatformAnalyticsService', () => {
  let service: PlatformAnalyticsService;
  let mockUserModel: any;
  let mockOrgModel: any;
  let mockMembershipModel: any;

  beforeEach(async () => {
    mockUserModel = jest.fn();
    mockUserModel.countDocuments = jest.fn();
    mockUserModel.aggregate = jest.fn();

    mockOrgModel = jest.fn();
    mockOrgModel.countDocuments = jest.fn();
    mockOrgModel.find = jest.fn();
    mockOrgModel.aggregate = jest.fn();

    mockMembershipModel = jest.fn();
    mockMembershipModel.countDocuments = jest.fn();
    mockMembershipModel.aggregate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAnalyticsService,
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken('Organization'),
          useValue: mockOrgModel,
        },
        {
          provide: getModelToken('OrgMembership'),
          useValue: mockMembershipModel,
        },
      ],
    }).compile();

    service = module.get<PlatformAnalyticsService>(PlatformAnalyticsService);
  });

  describe('getPlatformAnalytics', () => {
    it('should return platform analytics dashboard', async () => {
      mockUserModel.countDocuments.mockResolvedValueOnce(1000); // total
      mockUserModel.countDocuments.mockResolvedValueOnce(800); // active
      mockOrgModel.countDocuments.mockResolvedValueOnce(50); // total orgs
      mockOrgModel.countDocuments.mockResolvedValueOnce(45); // active orgs
      mockUserModel.countDocuments.mockResolvedValueOnce(10); // platform admins

      const result = await service.getPlatformAnalytics();

      expect(result.overview).toBeDefined();
      expect(result.overview.totalUsers).toBe(1000);
      expect(result.overview.activeUsers).toBe(800);
      expect(result.overview.platformAdmins).toBe(10);
    });
  });

  describe('getUsageTrends', () => {
    it('should return usage trends', async () => {
      mockUserModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: { day: 1 }, count: 5 }]),
      });
      mockOrgModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: { day: 1 }, count: 2 }]),
      });

      const result = await service.getUsageTrends(30);

      expect(result.period).toBeDefined();
      expect(result.userSignups).toBeDefined();
      expect(result.organizationCreations).toBeDefined();
    });
  });

  describe('getGrowthMetrics', () => {
    it('should return growth metrics', async () => {
      mockUserModel.countDocuments
        .mockResolvedValueOnce(100) // this period
        .mockResolvedValueOnce(80); // last period
      mockOrgModel.countDocuments
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);

      const result = await service.getGrowthMetrics(90);

      expect(result.userGrowth).toBeDefined();
      expect(result.organizationGrowth).toBeDefined();
      expect(result.thisPerformance).toBeDefined();
    });
  });

  describe('getTopOrganizations', () => {
    it('should return top organizations by user count', async () => {
      mockOrgModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { _id: 'org1', name: 'Org 1' },
              { _id: 'org2', name: 'Org 2' },
            ]),
          }),
        }),
      });
      mockMembershipModel.countDocuments
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(30);

      const result = await service.getTopOrganizations(10);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getSystemHealthScore', () => {
    it('should return system health score', async () => {
      mockUserModel.countDocuments.mockResolvedValueOnce(1000); // total
      mockUserModel.countDocuments.mockResolvedValueOnce(900); // active
      mockOrgModel.countDocuments.mockResolvedValueOnce(50); // total
      mockOrgModel.countDocuments.mockResolvedValueOnce(45); // active

      const result = await service.getSystemHealthScore();

      expect(result.overallScore).toBeDefined();
      expect(result.userHealthScore).toBe(90);
      expect(result.organizationHealthScore).toBe(90);
      expect(result.status).toBe('healthy');
    });
  });

  describe('getPlanDistribution', () => {
    it('should return plan distribution', async () => {
      mockOrgModel.aggregate.mockResolvedValue([
        { _id: 'enterprise', count: 30 },
        { _id: 'professional', count: 15 },
        { _id: 'starter', count: 5 },
      ]);

      const result = await service.getPlanDistribution();

      expect(result.distribution).toBeDefined();
      expect(result.total).toBe(50);
    });
  });
});
