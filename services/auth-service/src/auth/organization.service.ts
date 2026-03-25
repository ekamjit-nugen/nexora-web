import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import { IOrganization } from './schemas/organization.schema';
import { IOrgMembership } from './schemas/org-membership.schema';
import { IUser } from './schemas/user.schema';
import { IRole } from './schemas/role.schema';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);
  private readonly mailTransporter: nodemailer.Transporter;
  private readonly frontendUrl: string;

  constructor(
    @InjectModel('Organization') private organizationModel: Model<IOrganization>,
    @InjectModel('OrgMembership') private orgMembershipModel: Model<IOrgMembership>,
    @InjectModel('User') private userModel: Model<IUser>,
    @InjectModel('Role') private roleModel: Model<IRole>,
    private jwtService: JwtService,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mailhog',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      ignoreTLS: true,
    });
  }

  /**
   * Generate a URL-friendly slug from organization name
   */
  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /**
   * Ensure slug is unique by appending a counter if needed
   */
  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (await this.organizationModel.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    return slug;
  }

  /**
   * Create a new organization and set the creator as owner
   */
  async createOrganization(dto: CreateOrganizationDto, userId: string): Promise<{ organization: IOrganization; membership: IOrgMembership }> {
    this.logger.debug(`Creating organization: ${dto.name} by user: ${userId}`);

    const baseSlug = this.generateSlug(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const organization = new this.organizationModel({
      name: dto.name,
      slug,
      industry: dto.industry || 'other',
      size: dto.size || '1-10',
      domain: dto.domain || null,
      createdBy: userId,
    });

    await organization.save();

    // Create admin membership (org creator is always admin)
    const membership = new this.orgMembershipModel({
      userId,
      organizationId: organization._id.toString(),
      role: 'admin',
      status: 'active',
      joinedAt: new Date(),
    });

    await membership.save();

    // Update user's organizations array, default org, and ensure admin role
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { organizations: organization._id.toString(), roles: 'admin' },
      $set: { defaultOrganizationId: organization._id.toString() },
    });

    // Seed default roles for this organization
    await this.seedDefaultRoles(organization._id.toString(), userId);

    // Provision employee record for the org creator
    const creator = await this.userModel.findById(userId);
    if (creator) {
      await this.provisionEmployee(creator.email, creator.firstName, creator.lastName, organization._id.toString(), userId);
    }

    this.logger.log(`Organization created: ${organization.name} (${slug})`);
    return { organization, membership };
  }

  /**
   * Seed default roles for a new organization
   */
  /**
   * Provision an employee record in the HR service for a user joining an org.
   * This is best-effort — failure does not block the org/invite flow.
   */
  private async provisionEmployee(email: string, firstName: string, lastName: string, orgId: string, createdBy: string): Promise<void> {
    try {
      const hrUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';

      // Generate a temporary JWT with org context for the HR service
      const tempPayload = {
        sub: createdBy,
        email,
        firstName,
        lastName,
        roles: ['admin'],
        organizationId: orgId,
      };
      const tempToken = this.jwtService.sign(tempPayload, { expiresIn: '1m' });

      const http = await import('http');
      const postData = JSON.stringify({
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        email,
        joiningDate: new Date().toISOString().split('T')[0],
      });

      await new Promise<void>((resolve) => {
        const req = http.request(
          `${hrUrl}/api/v1/employees`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tempToken}`,
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 5000,
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              if (res.statusCode === 201 || res.statusCode === 200) {
                this.logger.log(`Employee provisioned for ${email} in org ${orgId}`);
              } else if (res.statusCode === 409) {
                this.logger.debug(`Employee already exists for ${email} in org ${orgId}`);
              } else {
                this.logger.warn(`Employee provisioning returned ${res.statusCode} for ${email}: ${body}`);
              }
              resolve();
            });
          },
        );
        req.on('error', (err) => {
          this.logger.warn(`Employee provisioning failed for ${email}: ${err.message}`);
          resolve();
        });
        req.on('timeout', () => {
          req.destroy();
          this.logger.warn(`Employee provisioning timed out for ${email}`);
          resolve();
        });
        req.write(postData);
        req.end();
      });
    } catch (err) {
      this.logger.warn(`Employee provisioning error for ${email}: ${err.message || err}`);
    }
  }

  private async seedDefaultRoles(orgId: string, createdBy: string): Promise<void> {
    const allActions = ['view', 'create', 'edit', 'delete', 'export', 'assign'];
    const allResources = [
      'employees', 'attendance', 'leaves', 'projects', 'tasks',
      'departments', 'roles', 'policies', 'reports', 'invoices',
      'expenses', 'clients', 'settings',
    ];

    const defaultRoles = [
      {
        name: 'admin',
        displayName: 'Admin',
        description: 'Full access to all organization resources',
        color: '#EF4444',
        permissions: allResources.map((resource) => ({ resource, actions: [...allActions] })),
      },
      {
        name: 'hr',
        displayName: 'HR Manager',
        description: 'Manage employees, attendance, leaves, and policies',
        color: '#8B5CF6',
        permissions: [
          { resource: 'employees', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'attendance', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'leaves', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'departments', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'policies', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'reports', actions: ['view', 'export'] },
          { resource: 'settings', actions: ['view', 'edit'] },
          { resource: 'projects', actions: ['view'] },
          { resource: 'tasks', actions: ['view'] },
          { resource: 'roles', actions: ['view'] },
          { resource: 'invoices', actions: ['view'] },
          { resource: 'expenses', actions: ['view'] },
          { resource: 'clients', actions: ['view'] },
        ],
      },
      {
        name: 'manager',
        displayName: 'Manager',
        description: 'Manage projects, tasks, and team members',
        color: '#F59E0B',
        permissions: [
          { resource: 'projects', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'tasks', actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'] },
          { resource: 'employees', actions: ['view', 'assign'] },
          { resource: 'attendance', actions: ['view'] },
          { resource: 'leaves', actions: ['view', 'assign'] },
          { resource: 'reports', actions: ['view', 'export'] },
          { resource: 'clients', actions: ['view', 'create', 'edit'] },
          { resource: 'departments', actions: ['view'] },
          { resource: 'policies', actions: ['view'] },
          { resource: 'invoices', actions: ['view'] },
          { resource: 'expenses', actions: ['view'] },
        ],
      },
      {
        name: 'developer',
        displayName: 'Developer',
        description: 'Work on tasks, log time, and manage own attendance',
        color: '#3B82F6',
        permissions: [
          { resource: 'tasks', actions: ['view', 'create', 'edit', 'export'] },
          { resource: 'projects', actions: ['view'] },
          { resource: 'attendance', actions: ['view', 'create'] },
          { resource: 'leaves', actions: ['view', 'create'] },
          { resource: 'reports', actions: ['view'] },
        ],
      },
      {
        name: 'designer',
        displayName: 'Designer',
        description: 'Work on tasks, log time, and manage own attendance',
        color: '#EC4899',
        permissions: [
          { resource: 'tasks', actions: ['view', 'create', 'edit', 'export'] },
          { resource: 'projects', actions: ['view'] },
          { resource: 'attendance', actions: ['view', 'create'] },
          { resource: 'leaves', actions: ['view', 'create'] },
          { resource: 'reports', actions: ['view'] },
        ],
      },
      {
        name: 'employee',
        displayName: 'Employee',
        description: 'Basic access to own attendance, leaves, and assigned tasks',
        color: '#6B7280',
        permissions: [
          { resource: 'attendance', actions: ['view', 'create'] },
          { resource: 'leaves', actions: ['view', 'create'] },
          { resource: 'tasks', actions: ['view'] },
          { resource: 'projects', actions: ['view'] },
        ],
      },
    ];

    try {
      for (const roleDef of defaultRoles) {
        const existing = await this.roleModel.findOne({
          name: roleDef.name,
          organizationId: orgId,
        });
        if (!existing) {
          const role = new this.roleModel({
            ...roleDef,
            organizationId: orgId,
            createdBy,
          });
          await role.save();
        }
      }
      this.logger.log(`Default roles seeded for org: ${orgId}`);
    } catch (err) {
      this.logger.warn(`Failed to seed default roles for org ${orgId}: ${err.message || err}`);
    }
  }

  /**
   * Get all organizations the user belongs to
   */
  async getMyOrganizations(userId: string): Promise<any[]> {
    this.logger.debug(`Getting organizations for user: ${userId}`);

    const memberships = await this.orgMembershipModel.find({
      userId,
      status: { $in: ['active', 'invited'] },
    });

    const orgIds = memberships.map((m) => m.organizationId);
    const organizations = await this.organizationModel.find({
      _id: { $in: orgIds },
      isDeleted: false,
    });

    // Combine org data with membership role
    return organizations.map((org) => {
      const membership = memberships.find((m) => m.organizationId === org._id.toString());
      return {
        ...org.toObject(),
        memberRole: membership?.role,
        memberStatus: membership?.status,
      };
    });
  }

  /**
   * Get a single organization by ID
   */
  async getOrganization(orgId: string): Promise<IOrganization> {
    const organization = await this.organizationModel.findOne({
      _id: orgId,
      isDeleted: false,
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    return organization;
  }

  /**
   * Update organization details
   */
  async updateOrganization(orgId: string, dto: UpdateOrganizationDto): Promise<IOrganization> {
    this.logger.debug(`Updating organization: ${orgId}`);

    const organization = await this.organizationModel.findOne({
      _id: orgId,
      isDeleted: false,
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    // If name is changing, regenerate slug
    if (dto.name && dto.name !== organization.name) {
      const baseSlug = this.generateSlug(dto.name);
      const slug = await this.ensureUniqueSlug(baseSlug);
      (organization as any).slug = slug;
    }

    // Update settings (merge, don't replace)
    if (dto.settings) {
      organization.settings = {
        ...organization.settings,
        ...dto.settings,
      } as any;
      delete dto.settings;
    }

    Object.assign(organization, dto);
    await organization.save();

    this.logger.log(`Organization updated: ${organization.name}`);
    return organization;
  }

  /**
   * Check if an email domain matches any organization
   */
  async checkEmailDomain(email: string): Promise<IOrganization[]> {
    const domain = email.split('@')[1];
    if (!domain) {
      return [];
    }

    return this.organizationModel.find({
      domain,
      isDeleted: false,
      isActive: true,
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
      // Fully provision the user if names provided (e.g. admin inviting with details)
      if (firstName) {
        user.firstName = firstName;
        user.lastName = lastName || '';
      }
      // Activate and link to org if not already
      if (!user.isActive) user.isActive = true;
      if (!user.organizations) user.organizations = [];
      if (!user.organizations.includes(orgId)) user.organizations.push(orgId);
      if (!user.defaultOrganizationId) user.defaultOrganizationId = orgId;
      // Set appropriate role
      const roleName = role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'employee';
      if (!user.roles) user.roles = [];
      if (!user.roles.includes(roleName)) user.roles.push(roleName);
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

      // Create a fully active user account if firstName/lastName provided
      if (firstName) {
        user = new this.userModel({
          email,
          firstName,
          lastName: lastName || '',
          password: 'invited-' + Date.now(), // placeholder — user authenticates via OTP
          isActive: true,
          isEmailVerified: true,
          roles: [role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'employee'],
          organizations: [orgId],
          defaultOrganizationId: orgId,
        });
        await user.save();
        this.logger.log(`Active user account created for ${email}`);
      }
    }

    const membership = new this.orgMembershipModel({
      userId: user ? user._id.toString() : null,
      email: user ? null : email,
      organizationId: orgId,
      role: role || 'member',
      status: user ? 'active' : 'invited',
      invitedBy,
      invitedAt: new Date(),
      joinedAt: user ? new Date() : null,
    });

    await membership.save();

    // Provision employee record in HR service
    const empFirstName = firstName || (user ? user.firstName : email.split('@')[0]);
    const empLastName = lastName || (user ? user.lastName : '');
    await this.provisionEmployee(email, empFirstName, empLastName, orgId, invitedBy);

    // Send invitation email
    await this.sendInvitationEmail(email, organization, orgId);

    this.logger.log(`Invitation sent to ${email} for org: ${organization.name}`);
    return membership;
  }

  /**
   * Send a branded invitation email
   */
  private async sendInvitationEmail(email: string, organization: IOrganization, orgId: string): Promise<void> {
    const inviteLink = `${this.frontendUrl}/invite?email=${encodeURIComponent(email)}&org=${orgId}`;

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
      await this.provisionEmployee(joiningUser.email, joiningUser.firstName, joiningUser.lastName, orgId, userId);
    }

    this.logger.log(`User ${userId} joined org: ${orgId} with role: ${roleName}`);
    return membership;
  }

  /**
   * Switch the active organization context and generate new JWT tokens
   */
  async switchOrganization(userId: string, orgId: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    this.logger.debug(`User ${userId} switching to org: ${orgId}`);

    // Validate membership
    const membership = await this.orgMembershipModel.findOne({
      userId,
      organizationId: orgId,
      status: 'active',
    });

    if (!membership) {
      throw new HttpException('You are not an active member of this organization', HttpStatus.FORBIDDEN);
    }

    // Get user data
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Update user's default organization
    user.defaultOrganizationId = orgId;
    await user.save();

    // Generate new tokens with org context
    const payload = {
      sub: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      organizationId: orgId,
    };

    const jwtExpiry = process.env.JWT_EXPIRY || '7d';
    const accessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiry });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      expiresIn: 604800,
    };
  }

  /**
   * Update onboarding progress for an organization
   */
  async updateOnboardingStep(orgId: string, step: number, completed?: boolean): Promise<IOrganization> {
    this.logger.debug(`Updating onboarding for org: ${orgId}, step: ${step}`);

    const organization = await this.organizationModel.findOne({
      _id: orgId,
      isDeleted: false,
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    organization.onboardingStep = step;
    if (completed !== undefined) {
      organization.onboardingCompleted = completed;
    }

    await organization.save();
    return organization;
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
   * Soft-delete an organization (only admin/owner can delete)
   */
  async deleteOrganization(orgId: string, userId: string): Promise<void> {
    const org = await this.organizationModel.findOne({ _id: orgId, isDeleted: false });
    if (!org) throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    // Only the creator or an admin can delete
    const membership = await this.orgMembershipModel.findOne({ userId, organizationId: orgId, role: { $in: ['admin', 'owner'] } });
    if (!membership) throw new HttpException('Only admins can delete organizations', HttpStatus.FORBIDDEN);
    org.isDeleted = true;
    org.isActive = false;
    await org.save();
    this.logger.log(`Organization deleted: ${org.name} by user ${userId}`);
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
}
