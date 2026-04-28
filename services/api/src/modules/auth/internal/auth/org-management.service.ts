import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IOrganization } from './schemas/organization.schema';
import { IOrgMembership } from './schemas/org-membership.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrgManagementService {
  constructor(
    @InjectModel('Organization') private orgModel: Model<IOrganization>,
    @InjectModel('OrgMembership') private membershipModel: Model<IOrgMembership>,
  ) {}

  /**
   * Get organization by ID with full details
   */
  async getOrgDetails(orgId: string): Promise<any> {
    const org = await this.orgModel.findById(orgId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const memberCount = await this.membershipModel.countDocuments({
      organizationId: orgId,
      status: 'active',
    });

    const activeCount = await this.membershipModel.countDocuments({
      organizationId: orgId,
      status: 'active',
    });

    return {
      ...org.toObject(),
      memberCount,
      activeCount,
      stats: {
        totalMembers: memberCount,
        createdAt: org.createdAt,
        lastUpdated: org.updatedAt,
      },
    };
  }

  /**
   * List organizations with filters
   */
  async listOrganizations(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: 'active' | 'suspended';
      plan?: string;
      search?: string;
    },
  ): Promise<any> {
    const query: any = {};

    if (filters?.status === 'active') {
      query.isActive = true;
    } else if (filters?.status === 'suspended') {
      query.isActive = false;
    }

    if (filters?.plan) {
      query.plan = filters.plan;
    }

    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { slug: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const total = await this.orgModel.countDocuments(query);
    const orgs = await this.orgModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return {
      organizations: orgs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update organization settings
   */
  async updateOrgSettings(
    orgId: string,
    updates: {
      plan?: string;
      features?: any;
      settings?: Record<string, any>;
    },
  ): Promise<IOrganization> {
    const org = await this.orgModel.findByIdAndUpdate(
      orgId,
      {
        ...(updates.plan && { plan: updates.plan }),
        ...(updates.features && { features: updates.features }),
        ...(updates.settings && { settings: updates.settings }),
      },
      { new: true },
    );

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Suspend organization (disable all operations)
   */
  async suspendOrg(orgId: string, reason?: string): Promise<IOrganization> {
    const org = await this.orgModel.findByIdAndUpdate(
      orgId,
      {
        isActive: false,
        suspendedAt: new Date(),
        suspendReason: reason,
      },
      { new: true },
    );

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Activate suspended organization
   */
  async activateOrg(orgId: string): Promise<IOrganization> {
    const org = await this.orgModel.findByIdAndUpdate(
      orgId,
      {
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
      },
      { new: true },
    );

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Get organization members
   */
  async getOrgMembers(
    orgId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<any> {
    const query: any = { organizationId: orgId };

    if (search) {
      // Note: In real implementation, you'd join with User collection
      query.$or = [{ email: { $regex: search, $options: 'i' } }];
    }

    const total = await this.membershipModel.countDocuments(query);
    const members = await this.membershipModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ joinedAt: -1 })
      .exec();

    return {
      members,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get organization statistics
   */
  async getOrgStats(orgId: string): Promise<any> {
    const org = await this.orgModel.findById(orgId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const totalMembers = await this.membershipModel.countDocuments({
      organizationId: orgId,
    });

    const activeMembers = await this.membershipModel.countDocuments({
      organizationId: orgId,
      status: 'active',
    });

    const admins = await this.membershipModel.countDocuments({
      organizationId: orgId,
      role: { $in: ['admin', 'super_admin'] },
    });

    return {
      organizationId: orgId,
      name: org.name,
      plan: org.plan,
      totalMembers,
      activeMembers,
      admins,
      isActive: org.isActive,
      createdAt: org.createdAt,
      daysActive: Math.floor((Date.now() - org.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  /**
   * Check if organization exists and is active
   */
  async isOrgActive(orgId: string): Promise<boolean> {
    const org = await this.orgModel.findById(orgId);
    return !!(org && org.isActive);
  }

  /**
   * Get organization usage metrics
   */
  async getOrgUsageMetrics(orgId: string): Promise<any> {
    const org = await this.orgModel.findById(orgId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const memberCount = await this.membershipModel.countDocuments({
      organizationId: orgId,
      status: 'active',
    });

    return {
      organizationId: orgId,
      plan: org.plan,
      memberUsage: {
        current: memberCount,
      },
      features: org.features || {},
      status: org.isActive ? 'active' : 'suspended',
    };
  }

  /**
   * Update organization feature flags
   */
  async updateFeatureFlags(
    orgId: string,
    features: any,
  ): Promise<IOrganization> {
    const org = await this.orgModel.findById(orgId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (features) {
      Object.assign(org.features || {}, features);
    }

    return org.save();
  }
}
