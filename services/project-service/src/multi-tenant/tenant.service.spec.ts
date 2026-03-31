import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('TenantService', () => {
  let service: TenantService;
  let mockTenantModel: any;

  beforeEach(async () => {
    mockTenantModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ tenantId: 'tenant1' }),
    }));
    mockTenantModel.findOne = jest.fn();
    mockTenantModel.find = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getModelToken('Tenant'),
          useValue: mockTenantModel,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  describe('createTenant', () => {
    it('should create tenant with strict isolation', async () => {
      const result = await service.createTenant('prod1', 'org1', {
        name: 'Tenant A',
        isolationLevel: 'strict',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getTenant', () => {
    it('should get tenant by id', async () => {
      const mockTenant = { tenantId: 'tenant1', name: 'Tenant A' };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      const result = await service.getTenant('tenant1');

      expect(result).toEqual(mockTenant);
    });

    it('should throw error if tenant not found', async () => {
      mockTenantModel.findOne.mockResolvedValue(null);

      await expect(service.getTenant('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductTenants', () => {
    it('should return all active tenants for product', async () => {
      const mockTenants = [
        { tenantId: 'tenant1', status: 'active' },
        { tenantId: 'tenant2', status: 'active' },
      ];
      mockTenantModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTenants),
      });

      const result = await service.getProductTenants('prod1');

      expect(result.length).toBe(2);
    });
  });

  describe('addUserToTenant', () => {
    it('should add user to tenant', async () => {
      const mockTenant = {
        tenantId: 'tenant1',
        currentUsers: 0,
        maxUsers: 100,
        metadata: { users: [] },
        save: jest.fn().mockResolvedValue({}),
      };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      await service.addUserToTenant('tenant1', 'user1');

      expect(mockTenant.save).toHaveBeenCalled();
    });

    it('should throw error if user limit reached', async () => {
      const mockTenant = {
        tenantId: 'tenant1',
        currentUsers: 100,
        maxUsers: 100,
      };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      await expect(service.addUserToTenant('tenant1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeUserFromTenant', () => {
    it('should remove user from tenant', async () => {
      const mockTenant = {
        tenantId: 'tenant1',
        currentUsers: 1,
        metadata: { users: ['user1'] },
        save: jest.fn().mockResolvedValue({}),
      };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      await service.removeUserFromTenant('tenant1', 'user1');

      expect(mockTenant.save).toHaveBeenCalled();
    });
  });

  describe('buildIsolationQuery', () => {
    it('should build isolation query with tenant context', () => {
      const context = { tenantId: 'tenant1', productId: 'prod1', organizationId: 'org1', userId: 'user1' };

      const query = service.buildIsolationQuery(context, { status: 'active' });

      expect(query.productId).toBe('prod1');
      expect(query.tenantId).toBe('tenant1');
      expect(query.status).toBe('active');
    });
  });

  describe('enforceDataIsolation', () => {
    it('should enforce strict isolation', () => {
      const context = { tenantId: 'tenant1', productId: 'prod1', organizationId: 'org1', userId: 'user1' };
      const tenant = {
        isolationLevel: 'strict',
        dataSegmentation: { sharedResources: [] },
      };
      const data = [
        { tenantId: 'tenant1', resourceType: 'items' },
        { tenantId: 'tenant2', resourceType: 'items' },
      ];

      const result = service.enforceDataIsolation(data, context, tenant as any);

      expect(result.length).toBe(1);
      expect(result[0].tenantId).toBe('tenant1');
    });
  });

  describe('enableFeature', () => {
    it('should enable feature for tenant', async () => {
      const mockTenant = {
        tenantId: 'tenant1',
        features: [],
        save: jest.fn().mockResolvedValue({ features: ['analytics'] }),
      };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      await service.enableFeature('tenant1', 'analytics');

      expect(mockTenant.save).toHaveBeenCalled();
    });
  });

  describe('disableFeature', () => {
    it('should disable feature for tenant', async () => {
      const mockTenant = {
        tenantId: 'tenant1',
        features: ['analytics'],
        save: jest.fn().mockResolvedValue({ features: [] }),
      };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      await service.disableFeature('tenant1', 'analytics');

      expect(mockTenant.save).toHaveBeenCalled();
    });
  });

  describe('suspendTenant', () => {
    it('should suspend tenant', async () => {
      const mockTenant = {
        tenantId: 'tenant1',
        status: 'active',
        save: jest.fn().mockResolvedValue({ status: 'suspended' }),
      };
      mockTenantModel.findOne.mockResolvedValue(mockTenant);

      await service.suspendTenant('tenant1');

      expect(mockTenant.save).toHaveBeenCalled();
    });
  });
});
