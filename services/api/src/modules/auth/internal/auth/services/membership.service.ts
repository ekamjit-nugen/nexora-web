import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { IOrgMembership } from '../schemas/org-membership.schema';
import { IUser } from '../schemas/user.schema';
import { ISession } from '../schemas/session.schema';
import { AuditService, AuditAction } from '../audit.service';
import { HrSyncService } from './hr-sync.service';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectModel('OrgMembership', 'nexora_auth') private orgMembershipModel: Model<IOrgMembership>,
    @InjectModel('User', 'nexora_auth') private userModel: Model<IUser>,
    @InjectModel('Session', 'nexora_auth') private sessionModel: Model<ISession>,
    private jwtService: JwtService,
    private auditService: AuditService,
    private hrSyncService: HrSyncService,
  ) {}

  /**
   * Accept an invitation and join an organization
   */
  async joinOrganization(orgId: string, userId: string): Promise<IOrgMembership> {
    this.logger.debug(`User ${userId} joining org: ${orgId}`);

    const membership = await this.orgMembershipModel.findOne({
      userId,
      organizationId: orgId,
      status: 'invited',
    });

    if (!membership) {
      throw new HttpException('No pending invitation found', HttpStatus.NOT_FOUND);
    }

    membership.status = 'active';
    membership.joinedAt = new Date();
    await membership.save();

    // Add org to user's organizations array and the membership role to user's roles
    const roleName = membership.role || 'member';
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { organizations: orgId, roles: roleName },
    });

    // Provision employee record if not already exists
    const joiningUser = await this.userModel.findById(userId);
    if (joiningUser) {
      await this.hrSyncService.provisionEmployee(joiningUser.email, joiningUser.firstName, joiningUser.lastName, orgId, userId);
    }

    this.logger.log(`User ${userId} joined org: ${orgId} with role: ${roleName}`);
    return membership;
  }

  /**
   * Claim pending invitations for a newly registered user.
   * Finds all OrgMembership records matching the email with no userId and links them.
   */
  async claimPendingInvitations(userId: string, email: string): Promise<number> {
    this.logger.debug(`Claiming pending invitations for ${email} (userId: ${userId})`);

    const result = await this.orgMembershipModel.updateMany(
      { email, userId: null },
      { $set: { userId } },
    );

    const count = result.modifiedCount || 0;
    if (count > 0) {
      this.logger.log(`Claimed ${count} pending invitation(s) for ${email}`);
    }
    return count;
  }

  /**
   * Update a member's role in an organization
   */
  async updateMemberRole(orgId: string, memberId: string, role: string): Promise<IOrgMembership> {
    const membership = await this.orgMembershipModel.findOne({ _id: memberId, organizationId: orgId });
    if (!membership) throw new HttpException('Member not found', HttpStatus.NOT_FOUND);
    membership.role = role;
    await membership.save();
    return membership;
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    const membership = await this.orgMembershipModel.findOne({ _id: memberId, organizationId: orgId });
    if (!membership) throw new HttpException('Member not found', HttpStatus.NOT_FOUND);
    // Remove org from user's organizations array
    if (membership.userId) {
      await this.userModel.findByIdAndUpdate(membership.userId, {
        $pull: { organizations: orgId },
      });
      // If this was their default org, clear it
      const user = await this.userModel.findById(membership.userId);
      if (user && user.defaultOrganizationId === orgId) {
        user.defaultOrganizationId = null;
        await user.save();
      }
    }
    await this.orgMembershipModel.findByIdAndDelete(memberId);
  }

  /**
   * Get all members of an organization
   */
  async getOrgMembers(orgId: string): Promise<any[]> {
    this.logger.debug(`Getting members for org: ${orgId}`);

    const memberships = await this.orgMembershipModel.find({
      organizationId: orgId,
    });

    const userIds = memberships.filter((m) => m.userId).map((m) => m.userId);
    const users = await this.userModel.find({ _id: { $in: userIds } });

    return memberships.map((membership) => {
      const user = membership.userId
        ? users.find((u) => u._id.toString() === membership.userId)
        : null;
      return {
        membershipId: membership._id,
        userId: membership.userId,
        email: membership.email,
        organizationId: membership.organizationId,
        role: membership.role,
        status: membership.status,
        invitedBy: membership.invitedBy,
        invitedAt: membership.invitedAt,
        joinedAt: membership.joinedAt,
        user: user
          ? {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              avatar: user.avatar,
            }
          : membership.email
            ? { email: membership.email, firstName: null, lastName: null, avatar: null }
            : null,
      };
    });
  }

  /**
   * Sync an employee's name to the HR service (best-effort delegate)
   */
  async syncEmployeeName(email: string, firstName: string, lastName: string, orgId: string, userId: string): Promise<void> {
    return this.hrSyncService.syncEmployeeName(email, firstName, lastName, orgId, userId);
  }

  /**
   * Sync an employee's status to the HR service (best-effort delegate)
   */
  async syncEmployeeStatus(email: string, status: string, orgId: string, userId: string): Promise<void> {
    return this.hrSyncService.syncEmployeeStatus(email, status, orgId, userId);
  }

  /**
   * Deactivate a member in an organization — revokes all sessions
   */
  async deactivateMember(orgId: string, targetUserId: string, performedBy: string): Promise<IOrgMembership> {
    const membership = await this.orgMembershipModel.findOne({
      userId: targetUserId,
      organizationId: orgId,
      status: 'active',
    });
    if (!membership) throw new HttpException('Active membership not found', HttpStatus.NOT_FOUND);

    membership.status = 'deactivated';
    membership.deactivatedAt = new Date();
    membership.deactivatedBy = performedBy;
    await membership.save();

    // Revoke all sessions for this user
    await this.sessionModel.updateMany(
      { userId: targetUserId, isRevoked: false },
      { $set: { isRevoked: true } },
    );

    await this.auditService.log({
      action: AuditAction.MEMBER_DEACTIVATED,
      userId: performedBy,
      targetUserId,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: orgId,
    });

    return membership;
  }

  /**
   * Reactivate a previously deactivated member
   */
  async reactivateMember(orgId: string, targetUserId: string, performedBy: string): Promise<IOrgMembership> {
    const membership = await this.orgMembershipModel.findOne({
      userId: targetUserId,
      organizationId: orgId,
      status: 'deactivated',
    });
    if (!membership) throw new HttpException('Deactivated membership not found', HttpStatus.NOT_FOUND);

    membership.status = 'active';
    membership.deactivatedAt = null;
    membership.deactivatedBy = null;
    await membership.save();

    await this.auditService.log({
      action: AuditAction.MEMBER_REACTIVATED,
      userId: performedBy,
      targetUserId,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: orgId,
    });

    return membership;
  }
}
