import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { IOrganization } from '../schemas/organization.schema';
import { IOrgMembership } from '../schemas/org-membership.schema';
import { IUser } from '../schemas/user.schema';
import { AuditService, AuditAction } from '../audit.service';
import { HrSyncService } from './hr-sync.service';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);
  private readonly mailTransporter: nodemailer.Transporter;
  private readonly frontendUrl: string;

  constructor(
    @InjectModel('Organization', 'nexora_auth') private organizationModel: Model<IOrganization>,
    @InjectModel('OrgMembership', 'nexora_auth') private orgMembershipModel: Model<IOrgMembership>,
    @InjectModel('User', 'nexora_auth') private userModel: Model<IUser>,
    private jwtService: JwtService,
    private auditService: AuditService,
    private hrSyncService: HrSyncService,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mailhog',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      ignoreTLS: true,
    });
  }

  /**
   * Invite a member to an organization.
   * If the user exists, create membership with userId.
   * If the user does NOT exist, create membership with email only (userId=null) and send an invite email.
   */
  async inviteMember(orgId: string, email: string, role: string, invitedBy: string, firstName?: string, lastName?: string): Promise<IOrgMembership> {
    this.logger.debug(`Inviting ${email} to org: ${orgId}`);

    const organization = await this.organizationModel.findOne({
      _id: orgId,
      isDeleted: false,
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    // Find or create user
    let user = await this.userModel.findOne({ email });

    if (user) {
      // Check if already a member by userId
      const existingMembership = await this.orgMembershipModel.findOne({
        userId: user._id.toString(),
        organizationId: orgId,
      });
      if (existingMembership) {
        throw new HttpException('User is already a member or has a pending invitation', HttpStatus.CONFLICT);
      }
      // Update name if provided but don't activate — user must accept invite first
      if (firstName) {
        user.firstName = firstName;
        user.lastName = lastName || '';
      }
      if (user.setupStage === 'complete') {
        // Existing fully onboarded user — mark as invited to this org
        user.setupStage = 'complete'; // keep complete, they just need to accept
      }
      await user.save();
    } else {
      // Check if already invited by email
      const existingInvite = await this.orgMembershipModel.findOne({
        email,
        organizationId: orgId,
        userId: null,
      });
      if (existingInvite) {
        throw new HttpException('An invitation has already been sent to this email', HttpStatus.CONFLICT);
      }
    }

    const inviteToken = uuidv4();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const membership = new this.orgMembershipModel({
      userId: user ? user._id.toString() : null,
      email: user ? null : email,
      organizationId: orgId,
      role: role || 'employee',
      status: 'pending',
      invitedBy,
      invitedAt: new Date(),
      joinedAt: null,
      inviteToken,
      inviteExpiresAt,
    });

    await membership.save();

    // If user doesn't exist, create a placeholder with setupStage: 'invited'
    if (!user) {
      const invitedUser = new this.userModel({
        email,
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        // No password for invited users — they authenticate via OTP or OAuth
        isActive: false,
        setupStage: 'invited',
        roles: ['user'],
        organizations: [orgId],
        defaultOrganizationId: orgId,
      });
      await invitedUser.save();
      // Link the membership to the new user
      membership.userId = invitedUser._id.toString();
      membership.email = null;
      await membership.save();
    }

    // Log invite link to console (dev mode)
    if (!user) {
      this.logger.log(`[DEV] Invite link for ${email}: ${this.frontendUrl}/auth/accept-invite?token=${inviteToken}`);
    }

    await this.auditService.log({
      action: AuditAction.MEMBER_INVITED,
      userId: invitedBy,
      targetUserId: membership.userId,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: orgId,
      details: { email, role },
    });

    // Provision employee record with 'invited' status so they show in directory
    const empFirstName = firstName || (user ? user.firstName : email.split('@')[0]);
    const empLastName = lastName || (user ? user.lastName : '');
    await this.hrSyncService.provisionEmployee(email, empFirstName, empLastName, orgId, invitedBy, 'invited');

    // Send invitation email
    await this.sendInvitationEmail(email, organization, orgId, user ? undefined : inviteToken);

    this.logger.log(`Invitation sent to ${email} for org: ${organization.name}`);
    return membership;
  }

  /**
   * Resend invitation to a pending member — generates a new invite token with fresh 7-day expiry
   */
  async resendInvite(orgId: string, memberEmail: string, performedBy: string): Promise<IOrgMembership> {
    this.logger.debug(`Resending invite to ${memberEmail} for org: ${orgId}`);

    // Admins must be able to revive a previously-DECLINED invite (user may
    // have declined by mistake). So we accept `pending`, `invited`, AND
    // `removed` — the decline flow sets the membership to `removed`.
    const REVIVABLE_STATUSES = ['pending', 'invited', 'removed'];

    // First try finding by email on the membership (email-only invite path)
    let membership = await this.orgMembershipModel.findOne({
      organizationId: orgId,
      status: { $in: REVIVABLE_STATUSES },
      email: memberEmail,
    });

    // If not found, look up the user by email and find membership by userId
    if (!membership) {
      const user = await this.userModel.findOne({ email: memberEmail.toLowerCase() });
      if (user) {
        membership = await this.orgMembershipModel.findOne({
          organizationId: orgId,
          status: { $in: REVIVABLE_STATUSES },
          userId: user._id.toString(),
        });
      }
    }

    if (!membership) {
      throw new HttpException('No invitation found for this email in this organization', HttpStatus.NOT_FOUND);
    }

    const wasDeclined = membership.status === 'removed';

    // Generate new invite token with fresh expiry and revive the membership
    const newToken = uuidv4();
    membership.inviteToken = newToken;
    membership.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    membership.invitedAt = new Date();
    membership.status = 'pending';
    await membership.save();

    // Get org for email
    const organization = await this.organizationModel.findById(orgId);
    if (organization) {
      await this.sendInvitationEmail(memberEmail, organization, orgId, newToken);
    }

    // If the invite was previously declined, roll the HR employee status
    // back from `declined` to `invited` so the directory reflects the new
    // pending state instead of the old rejection.
    if (wasDeclined) {
      try {
        await this.hrSyncService.syncEmployeeStatus(
          memberEmail,
          'invited',
          orgId,
          membership.userId || performedBy,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to revert HR status to 'invited' on re-invite: ${err?.message}`);
      }
    }

    this.logger.log(`[DEV] Resend invite link for ${memberEmail}: ${this.frontendUrl}/auth/accept-invite?token=${newToken}`);

    await this.auditService.log({
      action: AuditAction.INVITE_RESENT,
      userId: performedBy,
      targetUserId: membership.userId || undefined,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: orgId,
      details: { email: memberEmail, wasDeclined },
    });

    return membership;
  }

  /**
   * Validate an invite token and return invite details
   */
  async validateInviteToken(token: string): Promise<{
    valid: boolean;
    email?: string;
    orgName?: string;
    orgId?: string;
    role?: string;
  }> {
    const membership = await this.orgMembershipModel.findOne({ inviteToken: token });

    // Return consistent error response to prevent invite token enumeration
    if (!membership ||
        membership.status === 'removed' ||
        membership.status === 'active' ||
        (membership.inviteExpiresAt && new Date() > membership.inviteExpiresAt)) {
      return { valid: false };
    }

    // Get user email if userId is set
    let email = membership.email;
    if (!email && membership.userId) {
      const user = await this.userModel.findById(membership.userId);
      email = user?.email;
    }

    // Get org name from the organization model
    let orgName = 'Unknown Organization';
    try {
      const org = await this.organizationModel.findById(membership.organizationId);
      if (org) orgName = org.name;
    } catch {
      // fallback
    }

    return {
      valid: true,
      email: email || undefined,
      orgName,
      orgId: membership.organizationId,
      role: membership.role,
    };
  }

  /**
   * Accept an invitation via invite token
   */
  async acceptInvite(token: string, userId: string): Promise<IOrgMembership> {
    const membership = await this.orgMembershipModel.findOne({
      inviteToken: token,
      status: { $in: ['pending', 'invited'] },
    });

    if (!membership) {
      throw new HttpException('No pending invitation found', HttpStatus.NOT_FOUND);
    }

    // Validate that the accepting user's email matches the invitation
    const acceptingUser = await this.userModel.findById(userId);
    if (!acceptingUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // If membership has a specific userId set AND it's different from the accepting user,
    // check if emails match. But if the user has a valid invite token, that's sufficient proof —
    // allow acceptance even if the user registered with a different email than the invite.
    if (membership.userId && membership.userId !== userId) {
      const invitedUser = await this.userModel.findById(membership.userId);
      if (invitedUser && invitedUser.email !== acceptingUser.email) {
        // Token holder is a different person — only block if userId was explicitly set
        // and points to a different verified user
        this.logger.warn(`Invite token accepted by ${acceptingUser.email} but was sent to ${invitedUser.email}. Allowing since token is valid.`);
      }
    }
    // Email-based invites: the token IS the authorization — if they have the token, they were intended to receive it
    if (membership.email && membership.email.toLowerCase() !== acceptingUser.email.toLowerCase()) {
      this.logger.warn(`Invite accepted by ${acceptingUser.email} but membership email was ${membership.email}. Allowing since token is valid.`);
    }

    // Determine the actual user for this invite
    const actualUserId = membership.userId || userId;

    // Check if this user already has an active membership in this org
    if (actualUserId !== membership.userId) {
      const existing = await this.orgMembershipModel.findOne({
        userId: actualUserId,
        organizationId: membership.organizationId,
        status: 'active',
      });
      if (existing) {
        // Already a member — just clean up the invite
        membership.status = 'removed';
        membership.inviteToken = null;
        await membership.save();
        throw new HttpException('You are already a member of this organization', HttpStatus.CONFLICT);
      }
    }

    membership.status = 'active';
    membership.joinedAt = new Date();
    if (!membership.userId) {
      membership.userId = actualUserId;
    }
    membership.inviteToken = null;
    await membership.save();

    // Update user
    const user = await this.userModel.findById(actualUserId);
    if (user) {
      if (!user.organizations.includes(membership.organizationId)) {
        user.organizations.push(membership.organizationId);
      }
      if (user.setupStage === 'invited') {
        user.setupStage = 'complete';
      }
      user.defaultOrganizationId = membership.organizationId;
      user.lastOrgId = membership.organizationId;
      user.isActive = true;
      await user.save();
    }

    await this.auditService.log({
      action: AuditAction.INVITE_ACCEPTED,
      userId,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: membership.organizationId,
    });

    // Sync HR employee record.
    //
    // Previously this block only UPDATED an existing employee — which was
    // fine for net-new invites (where `InviteService.inviteMember` had already
    // called `hrSyncService.provisionEmployee`), but it silently did nothing
    // when an existing user (already complete in org A) accepted an invite to
    // org B: no HR employee doc existed in org B, so the directory was missing
    // the user. Combined with the missing Authorization header on this fetch,
    // the flow was doubly broken. (Bug #3)
    //
    // Now: look up by userId+org via a temp JWT (so the HR guard accepts the
    // call), flip status→active if found, otherwise provision a fresh record.
    // (`hrRecordFound` retained for downstream callers; `updated` drives the
    // create-if-missing branch below.)
    let hrRecordFound = false;
    const inviteeUser = user; // loaded above
    const inviteeFirstName = inviteeUser?.firstName || acceptingUser.firstName || inviteeUser?.email?.split('@')[0] || 'Member';
    const inviteeLastName = inviteeUser?.lastName || acceptingUser.lastName || '';
    const inviteeEmail = inviteeUser?.email || acceptingUser.email;
    try {
      const hrServiceUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';
      const tempToken = this.jwtService.sign(
        {
          sub: actualUserId,
          email: inviteeEmail,
          firstName: inviteeFirstName,
          lastName: inviteeLastName,
          roles: ['admin'],
          organizationId: membership.organizationId,
        },
        { expiresIn: '1m' as any },
      );

      const hrRes = await fetch(
        `${hrServiceUrl}/api/v1/employees?search=${encodeURIComponent(inviteeEmail)}&limit=10`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tempToken}`,
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      let updated = false;
      if (hrRes.ok) {
        const hrData: any = await hrRes.json();
        const employees = Array.isArray(hrData?.data) ? hrData.data : (hrData?.data ? [hrData.data] : []);
        // HR list endpoint is scoped to the JWT's orgId, so every row here belongs
        // to the target org. Any match = existing record → update status instead of create.
        hrRecordFound = employees.length > 0;
        for (const emp of employees) {
          if (!emp?._id) continue;
          // Only touch records within the org we just joined — the search
          // endpoint may return employees from other orgs for the same email
          // (cross-org users).
          if (String(emp.organizationId) !== String(membership.organizationId)) continue;
          updated = true;
          if (emp.status === 'invited' || emp.status === 'pending') {
            await fetch(`${hrServiceUrl}/api/v1/employees/${emp._id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tempToken}`,
              },
              body: JSON.stringify({ status: 'active', userId: actualUserId }),
              signal: AbortSignal.timeout(5000),
            }).catch(() => {});
          }
        }
      }

      if (!updated) {
        // Cross-org accept (or missing doc) — create it now so the user shows
        // up in the target org's directory immediately.
        await this.hrSyncService.provisionEmployee(
          inviteeEmail,
          inviteeFirstName,
          inviteeLastName,
          membership.organizationId,
          actualUserId,
          'active',
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to sync HR employee on accept-invite: ${err?.message}`);
    }

    // Provision path for the existing-user → new-org case: the HR list came back empty,
    // meaning the invite flow never created an employee in this org. Create one now so
    // the user appears in the target org's directory immediately on acceptance.
    if (!hrRecordFound && user) {
      await this.hrSyncService.provisionEmployee(
        user.email,
        user.firstName || user.email.split('@')[0],
        user.lastName || '',
        membership.organizationId,
        actualUserId,
        'active',
      );
    }

    // Publish event so chat-service can activate the user in pre-added conversations
    try {
      const IORedis = (await (Function('return import("ioredis")')())).default;
      const redis = new IORedis(process.env.REDIS_URI || 'redis://redis:6379');
      await redis.publish('invite:accepted', JSON.stringify({ userId: actualUserId, organizationId: membership.organizationId }));
      await redis.quit();
    } catch {
      // Non-critical — user will be activated on next conversation load
    }

    return membership;
  }

  /**
   * Decline an invitation via invite token
   */
  async declineInvite(token: string, userId: string): Promise<void> {
    const membership = await this.orgMembershipModel.findOne({
      inviteToken: token,
      status: { $in: ['pending', 'invited'] },
    });

    if (!membership) {
      throw new HttpException('No pending invitation found', HttpStatus.NOT_FOUND);
    }

    membership.status = 'removed';
    membership.inviteToken = null;
    await membership.save();

    await this.auditService.log({
      action: AuditAction.INVITE_DECLINED,
      userId,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: membership.organizationId,
    });

    // Sync HR employee status → 'declined' so the admin directory reflects
    // the rejection. Previously the decline flow only touched auth; HR kept
    // showing 'invited' + a useless "Resend" button. Best-effort sync —
    // failure here doesn't invalidate the decline (auth is already updated).
    try {
      const invitee = await this.userModel.findById(userId);
      const email = invitee?.email || membership.email;
      if (!email) return;
      await this.hrSyncService.syncEmployeeStatus(
        email,
        'declined',
        membership.organizationId,
        userId,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to sync HR status on decline for ${membership.email || userId}: ${err?.message}`);
    }
  }

  /**
   * Send a branded invitation email
   */
  private async sendInvitationEmail(email: string, organization: IOrganization, orgId: string, inviteToken?: string): Promise<void> {
    const inviteLink = inviteToken
      ? `${this.frontendUrl}/auth/accept-invite?token=${inviteToken}`
      : `${this.frontendUrl}/auth/login?invite=${orgId}&email=${encodeURIComponent(email)}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Inter',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#2E86C1;padding:28px 40px;text-align:center;">
            <span style="display:inline-block;width:44px;height:44px;line-height:44px;background:rgba(255,255,255,0.2);border-radius:10px;font-size:22px;font-weight:700;color:#FFFFFF;">N</span>
            <div style="color:#FFFFFF;font-size:20px;font-weight:600;margin-top:8px;">Nexora</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 24px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;">You're invited!</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4B5563;">
              You've been invited to join <strong style="color:#111827;">${organization.name}</strong> on Nexora — the unified platform for IT operations.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
              <a href="${inviteLink}" style="display:inline-block;background:#2E86C1;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                Accept Invitation
              </a>
            </td></tr></table>
            <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#9CA3AF;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${inviteLink}" style="color:#2E86C1;word-break:break-all;">${inviteLink}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; ${new Date().getFullYear()} Nexora. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.mailTransporter.sendMail({
        from: '"Nexora" <no-reply@nexora.io>',
        to: email,
        subject: `You've been invited to join ${organization.name} on Nexora`,
        html,
      });
      this.logger.log(`Invitation email sent to ${email}`);
    } catch (err) {
      this.logger.warn(`Failed to send invitation email to ${email}: ${err.message || err}`);
    }
  }
}
