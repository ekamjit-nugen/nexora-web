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

    // Per-org membership breakdown (active vs inactive). The platform
    // dashboard surfaces both — "active seats" drives billing, but the
    // total is needed to spot orgs with abnormal exited-employee
    // ratios (a sign of mass turnover or migration drift).
    const orgIds = organizations.map((o) => o._id.toString());
    const memberAgg = await this.orgMembershipModel.aggregate([
      { $match: { organizationId: { $in: orgIds } } },
      { $group: { _id: { organizationId: '$organizationId', status: '$status' }, count: { $sum: 1 } } },
    ]);
    const memberMap: Record<string, { active: number; inactive: number; total: number }> = {};
    for (const m of memberAgg) {
      const id = m._id.organizationId;
      memberMap[id] = memberMap[id] || { active: 0, inactive: 0, total: 0 };
      if (m._id.status === 'active') memberMap[id].active = m.count;
      else memberMap[id].inactive = m.count;
      memberMap[id].total += m.count;
    }

    const items = organizations.map((org) => {
      const breakdown = memberMap[org._id.toString()] || { active: 0, inactive: 0, total: 0 };
      return {
        ...org.toObject(),
        memberCount: breakdown.active,
        members: breakdown,
      };
    });

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get organization detail with comprehensive cross-tenant stats.
   *
   * Pulls counts from every tenant-scoped database (HR, attendance,
   * task) so the platform admin gets a single-pane view of what's
   * happening inside the org. Cross-DB queries reuse the existing
   * Mongoose connection's `useDb()` cache — no separate connection
   * pool, no HTTP round trips to other services.
   *
   * Each cross-DB call is wrapped so a missing collection (e.g. a
   * fresh org with no attendance yet, or a partially-deployed
   * environment) returns zeroes rather than failing the whole detail
   * load. Failure of any one cross-tenant query gets logged but
   * doesn't bubble up — the platform admin still sees the org
   * record + whatever stats DID succeed.
   */
  async getOrganizationDetail(orgId: string) {
    const org = await this.organizationModel.findById(orgId);
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    // ── Membership breakdown (auth DB) ──
    const [membersActive, membersInactive] = await Promise.all([
      this.orgMembershipModel.countDocuments({ organizationId: orgId, status: 'active' }),
      this.orgMembershipModel.countDocuments({ organizationId: orgId, status: 'inactive' }),
    ]);

    // Full member roster (capped). The Overview tab shows the entire
    // list — active first, then inactive — so platform admins can
    // search/filter without round-tripping for a dedicated members
    // page. Cap at 200 to keep payloads sane for very large tenants;
    // anything above that should pivot to a paginated /members route.
    const allMemberships = await this.orgMembershipModel
      .find({ organizationId: orgId })
      .sort({ status: 1, joinedAt: -1 }) // 'active' < 'inactive' alphabetically, so this puts active first
      .limit(200)
      .lean();
    const allUserIds = Array.from(new Set(allMemberships.map((m) => m.userId)));
    const allUsers = await this.userModel
      .find({ _id: { $in: allUserIds } })
      .select('email firstName lastName avatar lastLogin isActive')
      .lean();
    const userById: Record<string, any> = {};
    for (const u of allUsers) userById[String(u._id)] = u;

    const members = allMemberships.map((m) => {
      const u = userById[m.userId];
      return {
        userId: m.userId,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        email: u?.email || null,
        firstName: u?.firstName || null,
        lastName: u?.lastName || null,
        avatar: u?.avatar || null,
        lastLogin: u?.lastLogin || null,
      };
    });

    // Admin/owner subset — drives the dedicated Admins panel that
    // appears next to People. Derived from the full roster so we
    // don't issue a second query.
    const admins = members
      .filter((m) => ['owner', 'admin', 'hr'].includes(m.role) && m.status === 'active')
      .sort((a, b) => {
        // owner first, then admin, then hr — keeps the most-privileged
        // contact at the top of the panel.
        const order = { owner: 0, admin: 1, hr: 2 } as Record<string, number>;
      return (order[a.role] ?? 9) - (order[b.role] ?? 9);
    });

    // ── Cross-DB stats (HR + attendance + task) ──
    // We piggy-back on the auth-service's existing Mongoose connection
    // and hop databases via useDb(). The collections are read raw —
    // no Mongoose schema needed since we only need counts/groupings.
    const conn = this.userModel.db;
    const stats = {
      employees: { total: 0, active: 0, exited: 0, onLeave: 0, probation: 0, onNotice: 0 },
      designations: 0,
      departments: 0,
      clients: 0,
      invoices: { total: 0, draft: 0, sent: 0, paid: 0, overdue: 0, outstanding: 0 },
      attendance: { total: 0, last30Days: 0 },
      holidays: 0,
      tasks: { total: 0, todo: 0, inProgress: 0, done: 0, blocked: 0 },
    };

    try {
      const hrDb = conn.useDb('nexora_hr', { useCache: true });
      const empAgg = await hrDb.collection('employees').aggregate([
        { $match: { organizationId: orgId, isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray();
      for (const r of empAgg) {
        stats.employees.total += r.count;
        if (r._id === 'active') stats.employees.active = r.count;
        else if (r._id === 'exited') stats.employees.exited = r.count;
        else if (r._id === 'on_leave') stats.employees.onLeave = r.count;
        else if (r._id === 'probation') stats.employees.probation = r.count;
        else if (r._id === 'on_notice') stats.employees.onNotice = r.count;
      }
      stats.designations = await hrDb.collection('designations').countDocuments({
        organizationId: orgId, isDeleted: { $ne: true },
      });
      stats.departments = await hrDb.collection('departments').countDocuments({
        organizationId: orgId, isDeleted: { $ne: true },
      });
      stats.clients = await hrDb.collection('clients').countDocuments({
        organizationId: orgId, isDeleted: { $ne: true },
      });

      // Invoice stats — count + status breakdown + outstanding amount.
      // outstanding = sum(balanceDue) on non-paid, non-cancelled invoices.
      const invAgg = await hrDb.collection('invoices').aggregate([
        { $match: { organizationId: orgId, isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 }, balance: { $sum: '$balanceDue' } } },
      ]).toArray();
      for (const r of invAgg) {
        stats.invoices.total += r.count;
        if (r._id === 'draft') stats.invoices.draft = r.count;
        else if (r._id === 'sent') stats.invoices.sent = r.count;
        else if (r._id === 'paid') stats.invoices.paid = r.count;
        else if (r._id === 'overdue') stats.invoices.overdue = r.count;
        if (r._id !== 'paid' && r._id !== 'cancelled') {
          stats.invoices.outstanding += (r.balance || 0);
        }
      }
    } catch (err) {
      this.logger.warn(`HR stats lookup failed for org ${orgId}: ${(err as any)?.message || err}`);
    }

    try {
      const attDb = conn.useDb('nexora_attendance', { useCache: true });
      stats.attendance.total = await attDb.collection('attendances').countDocuments({
        organizationId: orgId, isDeleted: { $ne: true },
      });
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
      stats.attendance.last30Days = await attDb.collection('attendances').countDocuments({
        organizationId: orgId, isDeleted: { $ne: true },
        date: { $gte: thirtyDaysAgo },
      });
      stats.holidays = await attDb.collection('holidays').countDocuments({
        organizationId: orgId, isDeleted: { $ne: true },
      });
    } catch (err) {
      this.logger.warn(`Attendance stats lookup failed for org ${orgId}: ${(err as any)?.message || err}`);
    }

    try {
      const taskDb = conn.useDb('nexora_task', { useCache: true });
      const taskAgg = await taskDb.collection('tasks').aggregate([
        { $match: { organizationId: orgId, isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray();
      for (const r of taskAgg) {
        stats.tasks.total += r.count;
        if (r._id === 'todo') stats.tasks.todo = r.count;
        else if (r._id === 'in_progress') stats.tasks.inProgress = r.count;
        else if (r._id === 'done') stats.tasks.done = r.count;
        else if (r._id === 'blocked') stats.tasks.blocked = r.count;
      }
    } catch (err) {
      this.logger.warn(`Task stats lookup failed for org ${orgId}: ${(err as any)?.message || err}`);
    }

    return {
      ...org.toObject(),
      memberCount: membersActive,
      members: {
        active: membersActive,
        inactive: membersInactive,
        total: membersActive + membersInactive,
      },
      // Full hydrated member roster (capped at 200, active first).
      // The Overview page shows this in a searchable / filterable list
      // alongside the Admins panel. Property name kept distinct from
      // the `members` count breakdown above so the existing frontend
      // typing (members: {active, inactive, total}) keeps working.
      memberList: members,
      admins,
      stats,
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
   * Update organization feature flags
   */
  async updateOrganizationFeatures(
    orgId: string,
    features: Record<string, { enabled: boolean }>,
    performedBy: string,
    ip: string,
  ) {
    const org = await this.organizationModel.findById(orgId);
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    // Merge incoming feature flags with existing ones
    const current = (org as any).features || {};
    const updated: Record<string, { enabled: boolean }> = { ...current };
    for (const [key, val] of Object.entries(features)) {
      if (typeof val?.enabled === 'boolean') {
        updated[key] = { ...((current[key] as any) || {}), enabled: val.enabled };
      }
    }
    (org as any).features = updated;
    org.markModified('features');
    await org.save();

    await this.logAudit('organization.features_update', performedBy, 'organization', orgId, { features: updated }, ip);

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
