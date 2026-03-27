import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser } from './schemas/user.schema';
import { IOrganization } from './schemas/organization.schema';
import { IOrgMembership } from './schemas/org-membership.schema';
import { IAuditLog } from './schemas/audit-log.schema';

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
    @InjectModel('Organization') private organizationModel: Model<IOrganization>,
    @InjectModel('OrgMembership') private orgMembershipModel: Model<IOrgMembership>,
    @InjectModel('AuditLog') private auditLogModel: Model<IAuditLog>,
  ) {}

  /**
   * Log an audit action
   */
  private async logAudit(
    action: string,
    performedBy: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown>,
    ipAddress: string,
  ): Promise<void> {
    const log = new this.auditLogModel({
      action,
      performedBy,
      targetType,
      targetId,
      details,
      ipAddress,
    });
    await log.save();
    this.logger.log(`Audit: ${action} on ${targetType}:${targetId} by ${performedBy}`);
  }

  /**
   * Get all organizations with pagination and search
   */
  async getAllOrganizations(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
  ) {
    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
      ];
    }

    if (status === 'active') query.isActive = true;
    if (status === 'suspended') query.isActive = false;

    const skip = (page - 1) * limit;
    const [organizations, total] = await Promise.all([
      this.organizationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.organizationModel.countDocuments(query),
    ]);

    // Get member counts for each org
    const orgIds = organizations.map((o) => o._id.toString());
    const memberCounts = await this.orgMembershipModel.aggregate([
      { $match: { organizationId: { $in: orgIds }, status: 'active' } },
      { $group: { _id: '$organizationId', count: { $sum: 1 } } },
    ]);
    const countMap = memberCounts.reduce((acc, m) => ({ ...acc, [m._id]: m.count }), {});

    const items = organizations.map((org) => ({
      ...org.toObject(),
      memberCount: countMap[org._id.toString()] || 0,
    }));

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get organization detail
   */
  async getOrganizationDetail(orgId: string) {
    const org = await this.organizationModel.findById(orgId);
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const memberCount = await this.orgMembershipModel.countDocuments({
      organizationId: orgId,
      status: 'active',
    });

    return {
      ...org.toObject(),
      memberCount,
    };
  }

  /**
   * Suspend an organization
   */
  async suspendOrganization(orgId: string, performedBy: string, ip: string) {
    const org = await this.organizationModel.findById(orgId);
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    org.isActive = false;
    await org.save();

    await this.logAudit('organization.suspend', performedBy, 'organization', orgId, { name: org.name }, ip);

    return org;
  }

  /**
   * Activate an organization
   */
  async activateOrganization(orgId: string, performedBy: string, ip: string) {
    const org = await this.organizationModel.findById(orgId);
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    org.isActive = true;
    await org.save();

    await this.logAudit('organization.activate', performedBy, 'organization', orgId, { name: org.name }, ip);

    return org;
  }

  /**
   * Update organization plan
   */
  async updateOrganizationPlan(orgId: string, plan: string, performedBy: string, ip: string) {
    const org = await this.organizationModel.findById(orgId);
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const previousPlan = org.plan;
    org.plan = plan;
    await org.save();

    await this.logAudit('organization.plan_update', performedBy, 'organization', orgId, { previousPlan, newPlan: plan }, ip);

    return org;
  }

  /**
   * Get all platform users with pagination and search
   */
  async getAllUsers(page: number = 1, limit: number = 20, search?: string) {
    const query: any = { deletedAt: null };

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.userModel.countDocuments(query),
    ]);

    return {
      items: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get user detail with org memberships
   */
  async getUserDetail(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const memberships = await this.orgMembershipModel.find({ userId }).lean();

    // Get org details for each membership
    const orgIds = memberships.map((m) => m.organizationId);
    const orgs = await this.organizationModel.find({ _id: { $in: orgIds } }).lean();
    const orgMap = orgs.reduce((acc, o) => ({ ...acc, [o._id.toString()]: o }), {});

    const membershipsWithOrg = memberships.map((m) => ({
      ...m,
      organization: orgMap[m.organizationId] || null,
    }));

    return {
      ...user.toObject(),
      memberships: membershipsWithOrg,
    };
  }

  /**
   * Disable a user
   */
  async disableUser(userId: string, performedBy: string, ip: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    user.isActive = false;
    await user.save();

    await this.logAudit('user.disable', performedBy, 'user', userId, { email: user.email }, ip);

    return user;
  }

  /**
   * Enable a user
   */
  async enableUser(userId: string, performedBy: string, ip: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    user.isActive = true;
    await user.save();

    await this.logAudit('user.enable', performedBy, 'user', userId, { email: user.email }, ip);

    return user;
  }

  /**
   * Reset user auth (clear MFA, reset login attempts, clear lock)
   */
  async resetUserAuth(userId: string, performedBy: string, ip: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = [];
    user.mfaMethod = undefined;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await this.logAudit('user.reset_auth', performedBy, 'user', userId, { email: user.email }, ip);

    return user;
  }

  /**
   * Get platform analytics
   */
  async getPlatformAnalytics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalOrgs,
      activeOrgs,
      newOrgsThisMonth,
      usersByPlan,
    ] = await Promise.all([
      this.userModel.countDocuments({ deletedAt: null }),
      this.organizationModel.countDocuments({ isDeleted: false }),
      this.organizationModel.countDocuments({ isDeleted: false, isActive: true }),
      this.organizationModel.countDocuments({ isDeleted: false, createdAt: { $gte: startOfMonth } }),
      this.organizationModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
    ]);

    const planMap = usersByPlan.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {});

    return {
      totalUsers,
      totalOrgs,
      activeOrgs,
      suspendedOrgs: totalOrgs - activeOrgs,
      newOrgsThisMonth,
      orgsByPlan: planMap,
    };
  }

  /**
   * Get audit logs with pagination and filters
   */
  async getAuditLogs(
    page: number = 1,
    limit: number = 20,
    action?: string,
    targetType?: string,
  ) {
    const query: any = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.auditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.auditLogModel.countDocuments(query),
    ]);

    return {
      items: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}

/*
 * When: Platform admin accesses management endpoints
 * if: user has isPlatformAdmin flag
 * then: perform cross-organization management operations with audit logging
 */
