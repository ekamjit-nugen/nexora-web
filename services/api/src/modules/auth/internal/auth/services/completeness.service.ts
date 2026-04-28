import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IOrganization } from '../schemas/organization.schema';
import { IOrgMembership } from '../schemas/org-membership.schema';
import { IUser } from '../schemas/user.schema';

export interface PostLoginRoute {
  route: string;
  reason: string;
  organizationId?: string;
  organizations?: string[];
}

@Injectable()
export class CompletenessService {
  private readonly logger = new Logger(CompletenessService.name);

  constructor(
    @InjectModel('Organization', 'nexora_auth') private organizationModel: Model<IOrganization>,
    @InjectModel('OrgMembership', 'nexora_auth') private orgMembershipModel: Model<IOrgMembership>,
  ) {}

  /**
   * Calculate setup completeness for an organization.
   * Returns a weighted percentage across 6 categories plus a suggested next action.
   */
  async calculateSetupCompleteness(orgId: string): Promise<{
    percentage: number;
    categories: Record<string, { weight: number; complete: boolean }>;
    nextAction: string;
  }> {
    const org = await this.organizationModel.findOne({ _id: orgId, isDeleted: false });
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const memberCount = await this.orgMembershipModel.countDocuments({ organizationId: orgId, status: 'active' });

    const checks = {
      basicInfo: { weight: 15, complete: !!(org.name && (org as any).type && org.size && (org as any).country) },
      businessDetails: { weight: 20, complete: !!((org as any).business?.registeredAddress?.city && (org as any).business?.registeredAddress?.pincode && (org as any).business?.pan) },
      payrollSetup: { weight: 25, complete: !!((org as any).payroll?.pfConfig?.registrationNumber && (org as any).payroll?.tdsConfig?.tanNumber) },
      workConfig: { weight: 15, complete: !!((org as any).workPreferences?.workingDays?.length > 0 && (org as any).workPreferences?.workingHours?.start && (org as any).workPreferences?.holidays?.length > 0) },
      branding: { weight: 10, complete: !!((org as any).branding?.logo) },
      teamSetup: { weight: 15, complete: memberCount >= 2 },
    };

    const percentage = Object.values(checks).reduce((sum, c) => sum + (c.complete ? c.weight : 0), 0);

    let nextAction = '';
    if (!checks.basicInfo.complete) nextAction = 'Complete basic organization info in General Settings';
    else if (!checks.teamSetup.complete) nextAction = 'Invite at least 2 team members';
    else if (!checks.businessDetails.complete) nextAction = 'Add business details to enable payroll';
    else if (!checks.workConfig.complete) nextAction = 'Configure working hours and holidays';
    else if (!checks.payrollSetup.complete) nextAction = 'Set up payroll configuration';
    else if (!checks.branding.complete) nextAction = 'Upload your organization logo';

    return { percentage, categories: checks, nextAction };
  }

  /**
   * Post-login routing engine — determines where a user should be redirected after authentication.
   * Handles 7 cases: new user, invited user, org created, profile complete, single org, multi-org, no org.
   */
  async determinePostLoginRoute(user: IUser): Promise<PostLoginRoute> {
    const memberships = await this.orgMembershipModel.find({
      userId: user._id.toString(),
      status: { $in: ['active', 'pending', 'invited'] },
    });

    // Case 0: Platform admin — they don't belong to any org and shouldn't
    // be pushed through tenant-onboarding. Without this short-circuit they
    // hit Case 7 (`/auth/setup-organization`) just like a fresh tenant
    // signup with no memberships, which is wrong for super admins.
    if (user.isPlatformAdmin === true) {
      return { route: '/platform/organizations', reason: 'platform_admin' };
    }

    // Case 1: Brand new user — no org, no memberships
    if (user.setupStage === 'otp_verified' && memberships.length === 0) {
      return { route: '/auth/setup-organization', reason: 'new_user' };
    }

    // Case 2: Invited user — has pending/invited membership, first login
    if (user.setupStage === 'invited' && memberships.some(m => m.status === 'pending' || m.status === 'invited')) {
      const pendingMembership = memberships.find(m => m.status === 'pending' || m.status === 'invited');
      return {
        route: '/auth/accept-invite',
        reason: 'pending_invite',
        organizationId: pendingMembership.organizationId,
      };
    }

    // Case 3: Org created but profile incomplete
    if (user.setupStage === 'org_created') {
      return { route: '/auth/setup-profile', reason: 'incomplete_profile' };
    }

    // Case 4: Profile done but team invite step skipped/incomplete
    if (user.setupStage === 'profile_complete') {
      return { route: '/auth/invite-team', reason: 'incomplete_setup' };
    }

    // Case 5: Fully onboarded, single org
    if (user.setupStage === 'complete' && memberships.length === 1) {
      const org = memberships[0];
      if (org.status === 'deactivated') {
        return { route: '/auth/access-denied', reason: 'membership_deactivated' };
      }
      return {
        route: '/dashboard',
        reason: 'active_user',
        organizationId: org.organizationId,
      };
    }

    // Case 6: Multi-org user
    if (user.setupStage === 'complete' && memberships.length > 1) {
      const activeOrgs = memberships.filter(m => m.status === 'active');
      if (activeOrgs.length === 0) {
        return { route: '/auth/access-denied', reason: 'all_memberships_deactivated' };
      }
      if (activeOrgs.length === 1) {
        return {
          route: '/dashboard',
          reason: 'single_active_org',
          organizationId: activeOrgs[0].organizationId,
        };
      }
      return {
        route: '/auth/select-organization',
        reason: 'multi_org',
        organizations: activeOrgs.map(m => m.organizationId),
      };
    }

    // Case 7: User exists but all orgs removed/deleted
    if (user.setupStage === 'complete' && memberships.length === 0) {
      return { route: '/auth/setup-organization', reason: 'no_active_org' };
    }

    // Fallback
    return { route: '/auth/login', reason: 'unknown_state' };
  }
}
