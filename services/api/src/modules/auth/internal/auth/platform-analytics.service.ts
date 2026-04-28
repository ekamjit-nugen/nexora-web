import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser } from './schemas/user.schema';
import { IOrganization } from './schemas/organization.schema';
import { IOrgMembership } from './schemas/org-membership.schema';

@Injectable()
export class PlatformAnalyticsService {
  constructor(
    @InjectModel('User', 'nexora_auth') private userModel: Model<IUser>,
    @InjectModel('Organization', 'nexora_auth') private orgModel: Model<IOrganization>,
    @InjectModel('OrgMembership', 'nexora_auth') private membershipModel: Model<IOrgMembership>,
  ) {}

  /**
   * Get platform-wide analytics dashboard
   */
  async getPlatformAnalytics(): Promise<any> {
    const [totalUsers, activeUsers, totalOrgs, activeOrgs, platformAdmins] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true, deletedAt: { $exists: false } }),
      this.orgModel.countDocuments(),
      this.orgModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ isPlatformAdmin: true }),
    ]);

    const avgUsersPerOrg = totalOrgs > 0 ? Math.round(totalUsers / totalOrgs) : 0;

    return {
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalOrganizations: totalOrgs,
        activeOrganizations: activeOrgs,
        suspendedOrganizations: totalOrgs - activeOrgs,
        platformAdmins,
      },
      statistics: {
        userEngagement: Math.round((activeUsers / totalUsers) * 100) + '%',
        avgUsersPerOrg,
        orgHealthScore: Math.round((activeOrgs / totalOrgs) * 100) + '%',
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userTrends = await this.userModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ]);

    const orgTrends = await this.orgModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ]);

    return {
      period: { days, startDate, endDate: new Date() },
      userSignups: userTrends,
      organizationCreations: orgTrends,
    };
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics(days: number = 90): Promise<any> {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [usersThisPeriod, orgsThisPeriod, lastPeriodUsers, lastPeriodOrgs] = await Promise.all([
      this.userModel.countDocuments({ createdAt: { $gte: thresholdDate } }),
      this.orgModel.countDocuments({ createdAt: { $gte: thresholdDate } }),
      this.userModel.countDocuments({
        createdAt: {
          $gte: new Date(thresholdDate.getTime() - days * 24 * 60 * 60 * 1000),
          $lt: thresholdDate,
        },
      }),
      this.orgModel.countDocuments({
        createdAt: {
          $gte: new Date(thresholdDate.getTime() - days * 24 * 60 * 60 * 1000),
          $lt: thresholdDate,
        },
      }),
    ]);

    const userGrowth = lastPeriodUsers > 0 ? Math.round(((usersThisPeriod - lastPeriodUsers) / lastPeriodUsers) * 100) : 0;
    const orgGrowth = lastPeriodOrgs > 0 ? Math.round(((orgsThisPeriod - lastPeriodOrgs) / lastPeriodOrgs) * 100) : 0;

    return {
      period: days,
      userGrowth: userGrowth + '%',
      organizationGrowth: orgGrowth + '%',
      thisPerformance: {
        newUsers: usersThisPeriod,
        newOrganizations: orgsThisPeriod,
      },
      lastPerformance: {
        newUsers: lastPeriodUsers,
        newOrganizations: lastPeriodOrgs,
      },
    };
  }

  /**
   * Get top organizations by user count
   */
  async getTopOrganizations(limit: number = 10): Promise<any[]> {
    const orgs = await this.orgModel.find().sort({ _id: -1 }).limit(limit).exec();

    const orgStats = await Promise.all(
      orgs.map(async (org) => {
        const memberCount = await this.membershipModel.countDocuments({
          organizationId: org._id.toString(),
          status: 'active',
        });

        return {
          organizationId: org._id,
          name: org.name,
          plan: org.plan,
          userCount: memberCount,
          isActive: org.isActive,
          createdAt: org.createdAt,
        };
      }),
    );

    return orgStats.sort((a, b) => b.userCount - a.userCount);
  }

  /**
   * Get user distribution by organization
   */
  async getUserDistribution(): Promise<any> {
    const distribution = await this.membershipModel.aggregate([
      {
        $group: {
          _id: '$organizationId',
          userCount: { $sum: 1 },
        },
      },
      {
        $sort: { userCount: -1 },
      },
    ]);

    const avgUsersPerOrg =
      distribution.length > 0
        ? Math.round(distribution.reduce((sum, d) => sum + d.userCount, 0) / distribution.length)
        : 0;

    return {
      totalOrganizations: distribution.length,
      avgUsersPerOrg,
      distribution: distribution.slice(0, 20), // Top 20 orgs
    };
  }

  /**
   * Get system health score
   */
  async getSystemHealthScore(): Promise<any> {
    const [totalUsers, activeUsers, totalOrgs, activeOrgs] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.orgModel.countDocuments(),
      this.orgModel.countDocuments({ isActive: true }),
    ]);

    const userHealth = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 100;
    const orgHealth = totalOrgs > 0 ? Math.round((activeOrgs / totalOrgs) * 100) : 100;
    const overallHealth = Math.round((userHealth + orgHealth) / 2);

    return {
      overallScore: overallHealth,
      userHealthScore: userHealth,
      organizationHealthScore: orgHealth,
      status: overallHealth >= 80 ? 'healthy' : overallHealth >= 60 ? 'warning' : 'critical',
      timestamp: new Date(),
    };
  }

  /**
   * Get audit log summary
   */
  async getAuditLogSummary(days: number = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Placeholder - would need actual audit log model
    return {
      period: days,
      summary: {
        organizationCreated: 0,
        userCreated: 0,
        organizationSuspended: 0,
        userDisabled: 0,
        planChanged: 0,
        featureToggled: 0,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get plan distribution
   */
  async getPlanDistribution(): Promise<any> {
    const distribution = await this.orgModel.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    return {
      distribution: distribution.map((d) => ({
        plan: d._id || 'Unknown',
        count: d.count,
        percentage: Math.round((d.count / total) * 100) + '%',
      })),
      total,
    };
  }
}
