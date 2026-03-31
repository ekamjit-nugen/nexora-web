import { Test, TestingModule } from '@nestjs/testing';
import { OrgManagementService } from './org-management.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';

describe('OrgManagementService', () => {
  let service: OrgManagementService;
  let mockOrgModel: any;
  let mockMembershipModel: any;

  beforeEach(async () => {
    mockOrgModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ _id: 'org1' }),
    }));
    mockOrgModel.findById = jest.fn();
    mockOrgModel.find = jest.fn();
    mockOrgModel.countDocuments = jest.fn();
    mockOrgModel.findByIdAndUpdate = jest.fn();

    mockMembershipModel = jest.fn();
    mockMembershipModel.countDocuments = jest.fn();
    mockMembershipModel.find = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgManagementService,
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

    service = module.get<OrgManagementService>(OrgManagementService);
  });

  describe('getOrgDetails', () => {
    it('should get organization details', async () => {
      const mockOrg = { _id: 'org1', name: 'Acme Inc', toObject: () => ({ _id: 'org1', name: 'Acme Inc' }) };
      mockOrgModel.findById.mockResolvedValue(mockOrg);
      mockMembershipModel.countDocuments.mockResolvedValue(10);

      const result = await service.getOrgDetails('org1');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('memberCount');
    });

    it('should throw error if org not found', async () => {
      mockOrgModel.findById.mockResolvedValue(null);

      await expect(service.getOrgDetails('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listOrganizations', () => {
    it('should list organizations with pagination', async () => {
      mockOrgModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([{ _id: 'org1' }, { _id: 'org2' }]),
            }),
          }),
        }),
      });
      mockOrgModel.countDocuments.mockResolvedValue(2);

      const result = await service.listOrganizations(1, 20);

      expect(result.organizations).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('suspendOrg', () => {
    it('should suspend organization', async () => {
      const mockOrg = { _id: 'org1', isActive: false };
      mockOrgModel.findByIdAndUpdate.mockResolvedValue(mockOrg);

      const result = await service.suspendOrg('org1', 'Policy violation');

      expect(result.isActive).toBe(false);
    });
  });

  describe('activateOrg', () => {
    it('should activate organization', async () => {
      const mockOrg = { _id: 'org1', isActive: true };
      mockOrgModel.findByIdAndUpdate.mockResolvedValue(mockOrg);

      const result = await service.activateOrg('org1');

      expect(result.isActive).toBe(true);
    });
  });

  describe('getOrgStats', () => {
    it('should get organization statistics', async () => {
      const mockOrg = { _id: 'org1', name: 'Acme Inc', plan: 'enterprise', createdAt: new Date() };
      mockOrgModel.findById.mockResolvedValue(mockOrg);
      mockMembershipModel.countDocuments.mockResolvedValue(50);

      const result = await service.getOrgStats('org1');

      expect(result).toHaveProperty('totalMembers');
      expect(result).toHaveProperty('activeMembers');
      expect(result).toHaveProperty('daysActive');
    });
  });

  describe('isOrgActive', () => {
    it('should return true if org is active', async () => {
      mockOrgModel.findById.mockResolvedValue({ _id: 'org1', isActive: true });

      const result = await service.isOrgActive('org1');

      expect(result).toBe(true);
    });

    it('should return false if org is suspended', async () => {
      mockOrgModel.findById.mockResolvedValue({ _id: 'org1', isActive: false });

      const result = await service.isOrgActive('org1');

      expect(result).toBe(false);
    });
  });

  describe('getOrgUsageMetrics', () => {
    it('should get organization usage metrics', async () => {
      const mockOrg = { _id: 'org1', plan: 'enterprise', features: {} };
      mockOrgModel.findById.mockResolvedValue(mockOrg);
      mockMembershipModel.countDocuments.mockResolvedValue(75);

      const result = await service.getOrgUsageMetrics('org1');

      expect(result).toHaveProperty('memberUsage');
      expect(result.memberUsage.current).toBe(75);
    });
  });
});
