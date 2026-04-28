import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITenant, ITenantContext, IDataSegmentation } from './tenant.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel('Tenant', 'nexora_projects') private tenantModel: Model<ITenant>,
  ) {}

  /**
   * Create tenant with isolation configuration
   */
  async createTenant(
    productId: string,
    organizationId: string,
    tenantData: {
      name: string;
      isolationLevel: 'strict' | 'shared' | 'hybrid';
      dataSegmentation?: IDataSegmentation;
      maxUsers?: number;
      features?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<ITenant> {
    const tenantId = uuidv4();

    const defaultSegmentation: IDataSegmentation = tenantData.dataSegmentation || {
      level: tenantData.isolationLevel,
      segregateByTenant: true,
      segregateByOrganization: true,
      sharedResources: [],
    };

    const tenant = new this.tenantModel({
      productId,
      tenantId,
      organizationId,
      name: tenantData.name,
      isolationLevel: tenantData.isolationLevel,
      dataSegmentation: defaultSegmentation,
      maxUsers: tenantData.maxUsers || 100,
      currentUsers: 0,
      features: tenantData.features || [],
      metadata: tenantData.metadata || {},
      status: 'active',
    });

    return tenant.save();
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<ITenant> {
    const tenant = await this.tenantModel.findOne({ tenantId });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  /**
   * Get product tenants
   */
  async getProductTenants(productId: string): Promise<ITenant[]> {
    return this.tenantModel.find({ productId, status: 'active' }).exec();
  }

  /**
   * Get organization tenants
   */
  async getOrganizationTenants(productId: string, organizationId: string): Promise<ITenant[]> {
    return this.tenantModel
      .find({ productId, organizationId, status: 'active' })
      .exec();
  }

  /**
   * Update tenant isolation settings
   */
  async updateTenantIsolation(
    tenantId: string,
    updates: {
      isolationLevel?: 'strict' | 'shared' | 'hybrid';
      dataSegmentation?: IDataSegmentation;
    },
  ): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);

    if (updates.isolationLevel) {
      tenant.isolationLevel = updates.isolationLevel;
    }

    if (updates.dataSegmentation) {
      tenant.dataSegmentation = {
        ...tenant.dataSegmentation,
        ...updates.dataSegmentation,
      };
    }

    return tenant.save();
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(tenantId: string, userId: string): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);

    if (tenant.currentUsers >= tenant.maxUsers) {
      throw new BadRequestException('Tenant user limit reached');
    }

    if (!tenant.metadata.users) {
      tenant.metadata.users = [];
    }

    if (tenant.metadata.users.includes(userId)) {
      throw new BadRequestException('User already assigned to tenant');
    }

    tenant.metadata.users.push(userId);
    tenant.currentUsers = tenant.metadata.users.length;

    return tenant.save();
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(tenantId: string, userId: string): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);

    if (!tenant.metadata.users || !tenant.metadata.users.includes(userId)) {
      throw new BadRequestException('User not assigned to tenant');
    }

    tenant.metadata.users = tenant.metadata.users.filter((id: string) => id !== userId);
    tenant.currentUsers = tenant.metadata.users.length;

    return tenant.save();
  }

  /**
   * Build isolated query context
   */
  buildIsolationQuery(context: ITenantContext, baseQuery: Record<string, any> = {}): Record<string, any> {
    const { tenantId, productId, organizationId } = context;
    const query = { ...baseQuery };

    query.productId = productId;
    query.tenantId = tenantId;

    return query;
  }

  /**
   * Enforce data isolation on query results
   */
  enforceDataIsolation(
    data: any[],
    context: ITenantContext,
    tenant: ITenant,
  ): any[] {
    if (tenant.isolationLevel === 'strict') {
      // Strict isolation: only return data for this tenant
      return data.filter(item => item.tenantId === context.tenantId);
    }

    if (tenant.isolationLevel === 'shared') {
      // Shared isolation: return organization-level data
      return data.filter(
        item =>
          item.tenantId === context.tenantId ||
          (item.organizationId === context.organizationId &&
            tenant.dataSegmentation.sharedResources?.includes(item.resourceType)),
      );
    }

    if (tenant.isolationLevel === 'hybrid') {
      // Hybrid: strict for sensitive, shared for non-sensitive
      return data.filter(item => {
        if (item.tenantId === context.tenantId) return true;
        if (item.sensitivity === 'public' && item.organizationId === context.organizationId) return true;
        return false;
      });
    }

    return data;
  }

  /**
   * Get tenant metrics
   */
  async getTenantMetrics(tenantId: string): Promise<any> {
    const tenant = await this.getTenant(tenantId);

    return {
      tenantId: tenant.tenantId,
      name: tenant.name,
      status: tenant.status,
      isolationLevel: tenant.isolationLevel,
      userCount: tenant.currentUsers,
      maxUsers: tenant.maxUsers,
      utilizationPercentage: (tenant.currentUsers / tenant.maxUsers) * 100,
      features: tenant.features.length,
      issuedAt: new Date(),
    };
  }

  /**
   * Validate tenant context
   */
  async validateTenantContext(context: ITenantContext): Promise<boolean> {
    const tenant = await this.tenantModel.findOne({
      tenantId: context.tenantId,
      productId: context.productId,
    });

    if (!tenant || tenant.status !== 'active') {
      throw new ForbiddenException('Invalid or inactive tenant context');
    }

    if (tenant.metadata.users && !tenant.metadata.users.includes(context.userId)) {
      throw new ForbiddenException('User not authorized for this tenant');
    }

    return true;
  }

  /**
   * Enable feature for tenant
   */
  async enableFeature(tenantId: string, featureName: string): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);

    if (tenant.features.includes(featureName)) {
      throw new BadRequestException('Feature already enabled');
    }

    tenant.features.push(featureName);
    return tenant.save();
  }

  /**
   * Disable feature for tenant
   */
  async disableFeature(tenantId: string, featureName: string): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);

    tenant.features = tenant.features.filter(f => f !== featureName);
    return tenant.save();
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);
    tenant.status = 'suspended';
    return tenant.save();
  }

  /**
   * Reactivate tenant
   */
  async reactivateTenant(tenantId: string): Promise<ITenant> {
    const tenant = await this.getTenant(tenantId);
    tenant.status = 'active';
    return tenant.save();
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    tenant.status = 'deleted';
    await tenant.save();
  }
}
