import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { IOrganization } from './schemas/organization.schema';
import { IOrgMembership } from './schemas/org-membership.schema';
import { IUser } from './schemas/user.schema';
import { IRole } from './schemas/role.schema';
import { AuditService, AuditAction } from './audit.service';
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
    private auditService: AuditService,
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

    // Case-insensitive uniqueness check on name. Two orgs with identical display names
    // cause confusion in directory/invite flows and break the implicit "slug derived from name"
    // contract. Reject with 409 so the client can prompt the user to pick a different name.
    // (Bug #6 in auth QA 2026-04-17.)
    const trimmedName = dto.name?.trim() || '';
    if (!trimmedName) {
      throw new HttpException('Organization name is required', HttpStatus.BAD_REQUEST);
    }
    const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicate = await this.organizationModel.findOne({
      name: { $regex: `^${escaped}$`, $options: 'i' },
      isDeleted: { $ne: true },
    });
    if (duplicate) {
      throw new HttpException(
        { success: false, error: { code: 'ORG_NAME_TAKEN', message: 'An organization with this name already exists' } },
        HttpStatus.CONFLICT,
      );
    }

    const baseSlug = this.generateSlug(trimmedName);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const organization = new this.organizationModel({
      name: trimmedName,
      slug,
      industry: dto.industry || 'other',
      size: dto.size || '1-10',
      domain: dto.domain || null,
      type: dto.type || null,
      createdBy: userId,
      settings: {
        timezone: dto.timezone || null,
        currency: dto.currency || null,
      },
    });

    await organization.save();

    // Create owner membership (org creator is always owner)
    const membership = new this.orgMembershipModel({
      userId,
      organizationId: organization._id.toString(),
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    await membership.save();

    // Update user's organizations array, default org, setupStage, and ensure admin role
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { organizations: organization._id.toString(), roles: 'admin' },
      $set: {
        defaultOrganizationId: organization._id.toString(),
        lastOrgId: organization._id.toString(),
        setupStage: 'org_created',
      },
    });

    await this.auditService.log({
      action: AuditAction.ORG_CREATED,
      userId,
      resource: 'organization',
      resourceId: organization._id.toString(),
      organizationId: organization._id.toString(),
      details: { name: organization.name, slug },
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
  private async provisionEmployee(email: string, firstName: string, lastName: string, orgId: string, createdBy: string, status: string = 'active'): Promise<void> {
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
        status,
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

  /**
   * Update an employee's name in the HR service (best-effort).
   * Used after profile completion to sync the name.
   */
  async syncEmployeeName(email: string, firstName: string, lastName: string, orgId: string, userId: string): Promise<void> {
    try {
      const hrUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';
      const tempToken = this.jwtService.sign({
        sub: userId, email, firstName, lastName, roles: ['admin'], organizationId: orgId,
      }, { expiresIn: '1m' });

      const http = await import('http');

      // First, find the employee by email
      const employees: any[] = await new Promise((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees?search=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tempToken}` },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(body)?.data || []); } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
        req.end();
      });

      const emp = employees.find((e: any) => e.email === email);
      if (!emp?._id) {
        this.logger.debug(`No HR employee found for ${email} to update name`);
        return;
      }

      // Update the employee name
      const putData = JSON.stringify({ firstName, lastName });
      await new Promise<void>((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees/${emp._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tempToken}`,
            'Content-Length': Buffer.byteLength(putData),
          },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              this.logger.log(`Employee name updated for ${email}: ${firstName} ${lastName}`);
            } else {
              this.logger.warn(`Employee name update returned ${res.statusCode} for ${email}: ${body}`);
            }
            resolve();
          });
        });
        req.on('error', (err) => { this.logger.warn(`Employee name sync failed: ${err.message}`); resolve(); });
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.write(putData);
        req.end();
      });
    } catch (err) {
      this.logger.warn(`Employee name sync error for ${email}: ${err.message || err}`);
    }
  }

  /**
   * Update an employee's status in the HR service (best-effort).
   * Used after invite acceptance to change status from 'invited' to 'active'.
   */
  async syncEmployeeStatus(email: string, status: string, orgId: string, userId: string): Promise<void> {
    try {
      const hrUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';
      const tempToken = this.jwtService.sign({
        sub: userId, email, roles: ['admin'], organizationId: orgId,
      }, { expiresIn: '1m' });

      const http = await import('http');

      // Find employee by email
      const employees: any[] = await new Promise((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees?search=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tempToken}` },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(body)?.data || []); } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
        req.end();
      });

      const emp = employees.find((e: any) => e.email === email);
      if (!emp?._id) {
        this.logger.debug(`No HR employee found for ${email} to update status`);
        return;
      }

      const putData = JSON.stringify({ status });
      await new Promise<void>((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees/${emp._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tempToken}`,
            'Content-Length': Buffer.byteLength(putData),
          },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              this.logger.log(`Employee status updated to '${status}' for ${email}`);
            } else {
              this.logger.warn(`Employee status update returned ${res.statusCode} for ${email}: ${body}`);
            }
            resolve();
          });
        });
        req.on('error', (err) => { this.logger.warn(`Employee status sync failed: ${err.message}`); resolve(); });
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.write(putData);
        req.end();
      });
    } catch (err) {
      this.logger.warn(`Employee status sync error for ${email}: ${err.message || err}`);
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
        name: 'owner',
        displayName: 'Owner',
        description: 'Organization creator. Full unrestricted access.',
        color: '#7C3AED',
        isSystem: true,
        permissions: allResources.map((resource) => ({ resource, actions: [...allActions] })),
      },
      {
        name: 'admin',
        displayName: 'Admin',
        description: 'Full administrative access. Can manage members, roles, settings.',
        color: '#EF4444',
        isSystem: true,
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
        password: 'invited-' + uuidv4(),
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
    await this.provisionEmployee(email, empFirstName, empLastName, orgId, invitedBy, 'invited');

    // Send invitation email
    await this.sendInvitationEmail(email, organization, orgId, user ? undefined : inviteToken);

    this.logger.log(`Invitation sent to ${email} for org: ${organization.name}`);
    return membership;
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
   * Resend invitation to a pending member — generates a new invite token with fresh 7-day expiry
   */
  async resendInvite(orgId: string, memberEmail: string, performedBy: string): Promise<IOrgMembership> {
    this.logger.debug(`Resending invite to ${memberEmail} for org: ${orgId}`);

    // First try finding by email on the membership
    let membership = await this.orgMembershipModel.findOne({
      organizationId: orgId,
      status: { $in: ['pending', 'invited'] },
      email: memberEmail,
    });

    // If not found, look up the user by email and find membership by userId
    if (!membership) {
      const user = await this.userModel.findOne({ email: memberEmail.toLowerCase() });
      if (user) {
        membership = await this.orgMembershipModel.findOne({
          organizationId: orgId,
          status: { $in: ['pending', 'invited'] },
          userId: user._id.toString(),
        });
      }
    }

    if (!membership) {
      throw new HttpException('No pending invitation found for this email', HttpStatus.NOT_FOUND);
    }

    // Generate new invite token with fresh expiry
    const newToken = uuidv4();
    membership.inviteToken = newToken;
    membership.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    membership.invitedAt = new Date();
    await membership.save();

    // Get org for email
    const organization = await this.organizationModel.findById(orgId);
    if (organization) {
      await this.sendInvitationEmail(memberEmail, organization, orgId, newToken);
    }

    this.logger.log(`[DEV] Resend invite link for ${memberEmail}: ${this.frontendUrl}/auth/accept-invite?token=${newToken}`);

    await this.auditService.log({
      action: AuditAction.INVITE_RESENT,
      userId: performedBy,
      targetUserId: membership.userId || undefined,
      resource: 'membership',
      resourceId: membership._id.toString(),
      organizationId: orgId,
      details: { email: memberEmail },
    });

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
    // Only the owner can delete
    const membership = await this.orgMembershipModel.findOne({ userId, organizationId: orgId, role: 'owner' });
    if (!membership) throw new HttpException('Only the organization owner can delete it', HttpStatus.FORBIDDEN);
    org.isDeleted = true;
    org.isActive = false;
    await org.save();
    this.logger.log(`Organization deleted: ${org.name} by user ${userId}`);
  }

  /**
   * Get all members of an organization
   */
  /**
   * Calculate setup completeness for an organization
   */
  async calculateSetupCompleteness(orgId: string): Promise<{ percentage: number; categories: Record<string, { weight: number; complete: boolean }>; nextAction: string }> {
    const org = await this.getOrganization(orgId);
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
   * Add a holiday to workPreferences.holidays
   */
  async addHoliday(orgId: string, holiday: any): Promise<IOrganization> {
    const org = await this.getOrganization(orgId);
    if (!(org as any).workPreferences) (org as any).workPreferences = {};
    if (!(org as any).workPreferences.holidays) (org as any).workPreferences.holidays = [];
    (org as any).workPreferences.holidays.push(holiday);
    org.markModified('workPreferences');
    await org.save();
    return org;
  }

  /**
   * Update a holiday at a given index
   */
  async updateHoliday(orgId: string, holidayIndex: string, data: any): Promise<IOrganization> {
    const org = await this.getOrganization(orgId);
    const idx = parseInt(holidayIndex, 10);
    if (!(org as any).workPreferences?.holidays?.[idx]) {
      throw new HttpException('Holiday not found', HttpStatus.NOT_FOUND);
    }
    (org as any).workPreferences.holidays[idx] = { ...(org as any).workPreferences.holidays[idx], ...data };
    org.markModified('workPreferences');
    await org.save();
    return org;
  }

  /**
   * Remove a holiday at a given index
   */
  async removeHoliday(orgId: string, holidayIndex: string): Promise<IOrganization> {
    const org = await this.getOrganization(orgId);
    const idx = parseInt(holidayIndex, 10);
    if (!(org as any).workPreferences?.holidays?.[idx]) {
      throw new HttpException('Holiday not found', HttpStatus.NOT_FOUND);
    }
    (org as any).workPreferences.holidays.splice(idx, 1);
    org.markModified('workPreferences');
    await org.save();
    return org;
  }

  /**
   * Add a leave type to workPreferences.leaveTypes
   */
  async addLeaveType(orgId: string, leaveType: any): Promise<IOrganization> {
    const org = await this.getOrganization(orgId);
    if (!(org as any).workPreferences) (org as any).workPreferences = {};
    if (!(org as any).workPreferences.leaveTypes) (org as any).workPreferences.leaveTypes = [];
    (org as any).workPreferences.leaveTypes.push(leaveType);
    org.markModified('workPreferences');
    await org.save();
    return org;
  }

  /**
   * Update a leave type at a given index
   */
  async updateLeaveType(orgId: string, leaveTypeIndex: string, data: any): Promise<IOrganization> {
    const org = await this.getOrganization(orgId);
    const idx = parseInt(leaveTypeIndex, 10);
    if (!(org as any).workPreferences?.leaveTypes?.[idx]) {
      throw new HttpException('Leave type not found', HttpStatus.NOT_FOUND);
    }
    (org as any).workPreferences.leaveTypes[idx] = { ...(org as any).workPreferences.leaveTypes[idx], ...data };
    org.markModified('workPreferences');
    await org.save();
    return org;
  }

  /**
   * Remove a leave type at a given index
   */
  async removeLeaveType(orgId: string, leaveTypeIndex: string): Promise<IOrganization> {
    const org = await this.getOrganization(orgId);
    const idx = parseInt(leaveTypeIndex, 10);
    if (!(org as any).workPreferences?.leaveTypes?.[idx]) {
      throw new HttpException('Leave type not found', HttpStatus.NOT_FOUND);
    }
    (org as any).workPreferences.leaveTypes.splice(idx, 1);
    org.markModified('workPreferences');
    await org.save();
    return org;
  }

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

  // ──────────────────────────────────────────────────────────────────────
  // SCIM 2.0 enterprise provisioning
  //
  // Organizations opt in to SCIM by calling `enableScim`, which generates a
  // cryptographically random secret, persists its sha256 hash on the org,
  // and returns the plaintext token ONCE. The token format is
  // `scim_<orgId>_<secret>` — the same format `ScimService.validateToken`
  // verifies against `organization.scimTokenHash` using timingSafeEqual.
  //
  // The plaintext is never retrievable again. If the customer loses it,
  // they must call `rotateScimToken` which invalidates the old hash and
  // returns a new token.
  // ──────────────────────────────────────────────────────────────────────

  private generateScimTokenPair(orgId: string): { token: string; hash: string; secret: string } {
    // 32 random bytes → 64 hex chars. Prefix is `scim_<orgId>_`. The secret
    // must be at least 16 chars per ScimService.validateToken.
    const secret = crypto.randomBytes(32).toString('hex');
    const token = `scim_${orgId}_${secret}`;
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    return { token, hash, secret };
  }

  async enableScim(
    orgId: string,
    performedBy: string,
  ): Promise<{ token: string; issuedAt: Date }> {
    const org = await this.organizationModel.findById(orgId);
    if (!org || org.isDeleted) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const { token, hash } = this.generateScimTokenPair(orgId);
    const now = new Date();
    (org as any).scimEnabled = true;
    (org as any).scimTokenHash = hash;
    (org as any).scimTokenIssuedAt = now;
    (org as any).scimTokenIssuedBy = performedBy;
    await org.save();

    this.auditService
      .log({
        action: AuditAction.ORG_UPDATED,
        resource: 'organization',
        resourceId: orgId,
        organizationId: orgId,
        userId: performedBy,
        details: { scimEnabled: true, scimTokenIssuedAt: now.toISOString() },
      })
      .catch((err: Error) =>
        this.logger.warn(`SCIM enable audit log failed: ${err.message}`),
      );

    this.logger.log(`SCIM enabled for org ${orgId} by ${performedBy}`);
    return { token, issuedAt: now };
  }

  async rotateScimToken(
    orgId: string,
    performedBy: string,
  ): Promise<{ token: string; issuedAt: Date }> {
    const org = await this.organizationModel.findById(orgId);
    if (!org || org.isDeleted) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }
    if (!(org as any).scimEnabled) {
      throw new HttpException(
        'SCIM is not enabled for this organization',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { token, hash } = this.generateScimTokenPair(orgId);
    const now = new Date();
    (org as any).scimTokenHash = hash;
    (org as any).scimTokenIssuedAt = now;
    (org as any).scimTokenIssuedBy = performedBy;
    await org.save();

    this.auditService
      .log({
        action: AuditAction.ORG_UPDATED,
        resource: 'organization',
        resourceId: orgId,
        organizationId: orgId,
        userId: performedBy,
        details: { scimTokenRotated: true, scimTokenIssuedAt: now.toISOString() },
      })
      .catch((err: Error) =>
        this.logger.warn(`SCIM rotate audit log failed: ${err.message}`),
      );

    this.logger.warn(`SCIM token rotated for org ${orgId} by ${performedBy}`);
    return { token, issuedAt: now };
  }

  async disableScim(orgId: string, performedBy: string): Promise<void> {
    const org = await this.organizationModel.findById(orgId);
    if (!org || org.isDeleted) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }
    (org as any).scimEnabled = false;
    (org as any).scimTokenHash = null;
    (org as any).scimTokenIssuedAt = null;
    (org as any).scimTokenIssuedBy = null;
    await org.save();

    this.auditService
      .log({
        action: AuditAction.ORG_UPDATED,
        resource: 'organization',
        resourceId: orgId,
        organizationId: orgId,
        userId: performedBy,
        details: { scimDisabled: true },
      })
      .catch((err: Error) =>
        this.logger.warn(`SCIM disable audit log failed: ${err.message}`),
      );

    this.logger.warn(`SCIM disabled for org ${orgId} by ${performedBy}`);
  }

  async getScimStatus(
    orgId: string,
  ): Promise<{ enabled: boolean; issuedAt: Date | null; issuedBy: string | null }> {
    const org = await this.organizationModel.findById(orgId).lean();
    if (!org || (org as any).isDeleted) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }
    return {
      enabled: Boolean((org as any).scimEnabled),
      issuedAt: (org as any).scimTokenIssuedAt || null,
      issuedBy: (org as any).scimTokenIssuedBy || null,
    };
  }
}
