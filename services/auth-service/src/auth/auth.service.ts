import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { IUser } from './schemas/user.schema';
import { IRole } from './schemas/role.schema';
import { IOrgMembership } from './schemas/org-membership.schema';
import { ISession } from './schemas/session.schema';
import { IAuditLog } from './schemas/audit-log.schema';
import { AuditService, AuditAction } from './audit.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
// Extracted sub-services
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { InviteService } from './services/invite.service';
import { CompletenessService } from './services/completeness.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PostLoginRoute {
  route: string;
  reason: string;
  organizationId?: string;
  organizations?: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 30 * 60 * 1000; // 30 minutes
  private readonly OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '10', 10);
  private readonly OTP_LOCKOUT_MINUTES = parseInt(process.env.OTP_LOCKOUT_MINUTES || '5', 10);
  private readonly OTP_RATE_LIMIT_PER_HOUR = parseInt(process.env.OTP_RATE_LIMIT_PER_HOUR || '20', 10);
  private readonly OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '10', 10);
  private readonly mailTransporter: nodemailer.Transporter;

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
    @InjectModel('Role') private roleModel: Model<IRole>,
    @InjectModel('OrgMembership') private orgMembershipModel: Model<IOrgMembership>,
    @InjectModel('Session') private sessionModel: Model<ISession>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
    // Extracted sub-services (delegation targets)
    private otpService: OtpService,
    private tokenService: TokenService,
    private sessionService: SessionService,
    private inviteService: InviteService,
    private completenessService: CompletenessService,
  ) {
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mailhog',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      ignoreTLS: true,
    });
  }

  private async sendOtpEmail(email: string, otp: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Inter',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#2E86C1;padding:28px 40px;text-align:center;">
            <span style="display:inline-block;width:44px;height:44px;line-height:44px;background:rgba(255,255,255,0.2);border-radius:10px;font-size:22px;font-weight:700;color:#FFFFFF;">N</span>
            <div style="color:#FFFFFF;font-size:20px;font-weight:600;margin-top:8px;">Nexora</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 24px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;">Your verification code</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4B5563;">
              Use this code to sign in to your Nexora account. It expires in 10 minutes.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <div style="display:inline-block;background:#F8FAFC;border:2px dashed #2E86C1;border-radius:12px;padding:16px 40px;">
                <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0F172A;font-family:monospace;">${otp}</span>
              </div>
            </div>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#9CA3AF;">
              If you didn&rsquo;t request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
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
        subject: `${otp} — Your Nexora verification code`,
        html,
      });
      this.logger.log(`OTP email sent to ${email} via MailHog`);
    } catch (err) {
      this.logger.warn(`Failed to send OTP email to ${email}: ${err.message || err}`);
    }
  }

  // ── Post-OTP Routing Engine ──

  async determinePostLoginRoute(user: IUser): Promise<PostLoginRoute> {
    // Platform admin short-circuit: cross-tenant super admin, never routes through
    // org onboarding. Goes straight to the platform control panel regardless of
    // setupStage or membership state.
    if (user.isPlatformAdmin) {
      return { route: '/platform', reason: 'platform_admin' };
    }

    const memberships = await this.orgMembershipModel.find({
      userId: user._id.toString(),
      status: { $in: ['active', 'pending', 'invited'] },
    });

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

    // Case 2b: Already-onboarded user who has a pending invite to another org.
    // This MUST take priority over the single_active_org / multi_org branches below,
    // otherwise the frontend silently drops them into their existing dashboard and
    // they never learn about the pending invite. (Bug #4 in auth QA 2026-04-17.)
    if (user.setupStage === 'complete') {
      const pendingMembership = memberships.find(m => m.status === 'pending' || m.status === 'invited');
      if (pendingMembership) {
        return {
          route: '/auth/accept-invite',
          reason: 'pending_invite',
          organizationId: pendingMembership.organizationId,
        };
      }
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

  // ── Registration ──

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<IUser> {
    this.logger.debug(`Registering new user: ${email}`);

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new HttpException(
        'User with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    if (!this.isStrongPassword(password)) {
      throw new HttpException(
        'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = new this.userModel({
      email,
      password,
      firstName,
      lastName,
      roles: ['user'],
      permissions: [],
      setupStage: 'complete',
    });

    await user.save();
    this.logger.log(`User registered successfully: ${email}`);

    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse as IUser;
  }

  // ── Login ──

  async login(email: string, password: string, organizationId?: string): Promise<AuthTokens> {
    this.logger.debug(`Login attempt: ${email}`);

    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) {
      throw new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED);
    }

    if (user.isAccountLocked()) {
      throw new HttpException('Account locked due to multiple failed login attempts', HttpStatus.FORBIDDEN);
    }

    if (!user.isActive) {
      throw new HttpException('Account is inactive', HttpStatus.FORBIDDEN);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + this.LOCK_TIME);
      }
      await user.save();
      throw new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED);
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save();

    this.logger.log(`User logged in successfully: ${email}`);
    return this.generateTokens(user, organizationId);
  }

  // ── Token Generation ──

  async generateTokens(user: IUser, orgId?: string): Promise<AuthTokens> {
    const resolvedOrgId = orgId || user.defaultOrganizationId || null;

    let orgRole = 'member';
    if (resolvedOrgId) {
      const membership = await this.orgMembershipModel.findOne({
        userId: user._id.toString(),
        organizationId: resolvedOrgId,
        status: 'active',
      });
      if (membership) {
        orgRole = membership.role;
      }
    }

    const tokenFamily = uuidv4();
    const payload: any = {
      sub: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      organizationId: resolvedOrgId,
      orgRole,
      setupStage: user.setupStage,
      isPlatformAdmin: user.isPlatformAdmin || false,
      family: tokenFamily,
    };

    const jwtExpiry = this.configService.get<string>('JWT_EXPIRY') || '15m';
    const accessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiry });
    const refreshToken = this.jwtService.sign(
      { sub: user._id, family: tokenFamily },
      { expiresIn: '7d' },
    );

    // Create session record
    try {
      await this.sessionModel.create({
        userId: user._id.toString(),
        refreshTokenFamily: tokenFamily,
        deviceInfo: 'Unknown',
        ipAddress: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      this.logger.warn(`Failed to create session: ${err.message || err}`);
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(jwtExpiry),
    };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // default 15m
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  async generateTokensWithOrg(userId: string, orgId: string): Promise<AuthTokens> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return this.generateTokens(user, orgId);
  }

  // ── Token Refresh ──

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    this.logger.debug('Token refresh attempt');

    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userModel.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
      }

      // Check session validity
      if (payload.family) {
        const session = await this.sessionModel.findOne({
          refreshTokenFamily: payload.family,
          isRevoked: false,
        });

        if (!session) {
          // Possible token reuse attack — revoke all sessions for this family
          this.logger.warn(`Refresh token reuse detected for user ${user._id}`);
          throw new HttpException('Session has been revoked', HttpStatus.UNAUTHORIZED);
        }

        // Rotate: revoke old session, create new one
        session.isRevoked = true;
        await session.save();
      }

      return this.generateTokens(user, payload.organizationId || user.defaultOrganizationId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
  }

  // ── Session Management (delegated to SessionService) ──

  async getSessions(userId: string): Promise<ISession[]> {
    return this.sessionService.getSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    return this.sessionService.revokeSession(userId, sessionId);
  }

  async revokeAllSessions(userId: string, exceptFamily?: string): Promise<void> {
    return this.sessionService.revokeAllSessions(userId, exceptFamily);
  }

  // ── CSRF Token Generation ──

  generateCsrfToken(): string {
    return this.tokenService.generateCsrfToken();
  }

  validateCsrfToken(cookieToken: string, headerToken: string): boolean {
    return this.tokenService.validateCsrfToken(cookieToken, headerToken);
  }

  // ── MFA ──

  async setupMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    this.logger.debug(`Setting up MFA for user: ${userId}`);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const secret = speakeasy.generateSecret({
      name: `Nexora (${user.email})`,
      issuer: 'Nexora',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    user.mfaSecret = secret.base32;
    await user.save();

    return { secret: secret.base32, qrCode };
  }

  async verifyMFA(userId: string, code: string): Promise<boolean> {
    this.logger.debug(`Verifying MFA for user: ${userId}`);

    const user = await this.userModel.findById(userId).select('+mfaSecret');
    if (!user || !user.mfaSecret) {
      throw new HttpException('MFA not configured', HttpStatus.BAD_REQUEST);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new HttpException('Invalid MFA code', HttpStatus.UNAUTHORIZED);
    }

    user.mfaEnabled = true;
    user.mfaMethod = 'TOTP';
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );
    user.mfaBackupCodes = backupCodes;
    await user.save();
    this.logger.log(`MFA enabled for user: ${userId}`);

    return true;
  }

  // ── OAuth ──

  async handleOAuthCallback(
    provider: 'google' | 'microsoft' | 'saml',
    profile: any,
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    this.logger.debug(`OAuth callback from ${provider}`);

    let user = await this.userModel.findOne({
      [`oauthProviders.${provider}.id`]: profile.id,
    });

    if (!user) {
      user = await this.userModel.findOne({ email: profile.email });

      if (!user) {
        user = new this.userModel({
          email: profile.email,
          firstName: profile.given_name || profile.firstName || 'User',
          lastName: profile.family_name || profile.lastName || '',
          isEmailVerified: true,
          roles: ['user'],
          permissions: [],
          setupStage: 'otp_verified',
        });
      }
    }

    if (!user.oauthProviders) {
      user.oauthProviders = {};
    }
    user.oauthProviders[provider] = {
      id: profile.id,
      email: profile.email,
    };

    user.lastLogin = new Date();
    await user.save();

    const tokens = await this.generateTokens(user);
    return { user, tokens };
  }

  // ── User CRUD ──

  async getUserById(userId: string): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  validateJwtPayload(payload: any): boolean {
    return !!(
      payload.sub &&
      payload.email &&
      Array.isArray(payload.roles) &&
      (payload.isPlatformAdmin === undefined || typeof payload.isPlatformAdmin === 'boolean') &&
      (payload.orgRole === undefined || payload.orgRole === null || typeof payload.orgRole === 'string')
    );
  }

  private isStrongPassword(password: string): boolean {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;
    return hasUppercase && hasLowercase && hasNumbers && hasSpecialChar && isLongEnough;
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    phoneNumber?: string;
    jobTitle?: string;
    department?: string;
  }): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.avatar !== undefined) user.avatar = data.avatar;
    if (data.phoneNumber !== undefined) user.phoneNumber = data.phoneNumber;
    if (data.jobTitle !== undefined) (user as any).jobTitle = data.jobTitle;
    if (data.department !== undefined) (user as any).department = data.department;
    await user.save();
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) throw new HttpException('Current password is incorrect', HttpStatus.BAD_REQUEST);
    if (!this.isStrongPassword(newPassword)) throw new HttpException('New password does not meet strength requirements', HttpStatus.BAD_REQUEST);
    user.password = newPassword;
    await user.save();
  }

  async disableMFA(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = [];
    user.mfaMethod = undefined;
    await user.save();
  }

  async logout(userId: string, tokenFamily?: string): Promise<void> {
    this.logger.debug(`User logout: ${userId}`);
    if (tokenFamily) {
      await this.sessionModel.updateMany(
        { refreshTokenFamily: tokenFamily },
        { $set: { isRevoked: true } },
      );
    }
    await this.auditService.log({
      action: AuditAction.USER_LOGOUT,
      userId,
      resource: 'session',
    });
  }

  // ── Role Management ──

  async createRole(dto: CreateRoleDto, organizationId?: string): Promise<IRole> {
    this.logger.debug(`Creating role: ${dto.name}`);
    const existing = await this.roleModel.findOne({
      name: dto.name.toLowerCase(),
      organizationId: organizationId || null,
    });
    if (existing) {
      throw new HttpException('Role with this name already exists', HttpStatus.CONFLICT);
    }

    const role = new this.roleModel({
      ...dto,
      name: dto.name.toLowerCase(),
      organizationId: organizationId || null,
    });
    await role.save();
    this.logger.log(`Role created: ${role.name} for org: ${organizationId || 'global'}`);
    return role;
  }

  async getRoles(organizationId?: string): Promise<IRole[]> {
    return this.roleModel.find({
      isDeleted: false,
      $or: [
        { organizationId: organizationId || null },
        { isSystem: true },
      ],
    }).sort({ isSystem: -1, name: 1 });
  }

  async getRoleById(id: string, organizationId?: string): Promise<IRole> {
    const role = await this.roleModel.findOne({
      _id: id,
      isDeleted: false,
      $or: [
        { organizationId: organizationId || null },
        { isSystem: true },
      ],
    });
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto, organizationId?: string): Promise<IRole> {
    const role = await this.roleModel.findOne({
      _id: id,
      isDeleted: false,
      $or: [
        { organizationId: organizationId || null },
        { isSystem: true },
      ],
    });
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }
    Object.assign(role, dto);
    await role.save();
    this.logger.log(`Role updated: ${role.name}`);
    return role;
  }

  async deleteRole(id: string, organizationId?: string): Promise<void> {
    const role = await this.roleModel.findOne({
      _id: id,
      isDeleted: false,
      organizationId: organizationId || null,
    });
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }
    if (role.isSystem) {
      throw new HttpException('System roles cannot be deleted', HttpStatus.FORBIDDEN);
    }

    // Check if role has active members
    const memberCount = await this.orgMembershipModel.countDocuments({
      role: role.name,
      organizationId: organizationId,
      status: { $in: ['active', 'pending'] },
    });
    if (memberCount > 0) {
      throw new HttpException(
        'Cannot delete role with active members. Reassign members first.',
        HttpStatus.BAD_REQUEST,
      );
    }

    role.isDeleted = true;
    role.isActive = false;
    await role.save();
    this.logger.log(`Role deleted: ${role.name}`);
  }

  async assignRoleToUser(userId: string, roleNames: string[]): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    const roles = await this.roleModel.find({
      name: { $in: roleNames.map((r) => r.toLowerCase()) },
      isDeleted: false,
      isActive: true,
    });
    if (roles.length !== roleNames.length) {
      throw new HttpException('One or more roles not found or inactive', HttpStatus.BAD_REQUEST);
    }
    user.roles = roleNames.map((r) => r.toLowerCase());
    await user.save();
    this.logger.log(`Roles assigned to user ${userId}: ${roleNames.join(', ')}`);
    return user;
  }

  async getUsersByRole(roleName: string): Promise<IUser[]> {
    return this.userModel.find({
      roles: roleName.toLowerCase(),
      isActive: true,
      deletedAt: null,
    });
  }

  async getAllUsers(organizationId?: string): Promise<IUser[]> {
    const filter: any = { deletedAt: null, isActive: true };
    if (organizationId) {
      filter.organizations = organizationId;
    }
    return this.userModel
      .find(filter)
      .select('-password -mfaSecret -mfaBackupCodes -otp -otpExpiresAt')
      .sort({ createdAt: -1 });
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  // ── Preferences ──

  async getPreferences(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return (user.preferences as Record<string, unknown>) || {};
  }

  async updatePreferences(userId: string, preferences: Record<string, unknown>): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    user.preferences = { ...((user.preferences as Record<string, unknown>) || {}), ...preferences } as any;
    user.markModified('preferences');
    await user.save();
    return user.preferences as Record<string, unknown>;
  }

  // ── OTP Methods ──

  async sendOtp(email: string, ipAddress?: string): Promise<{ sent: boolean; isNewUser: boolean }> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Hash OTP before storing (bcrypt with 10 rounds)
    const bcrypt = await import('bcrypt');
    const otpHash = await bcrypt.hash(otp, 10);

    let user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt +otpAttempts +otpLastRequestedAt +otpRequestCount');
    const isNewUser = !user;

    if (user) {
      // Rate limiting: max 5 OTP requests per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (user.otpLastRequestedAt && user.otpLastRequestedAt > oneHourAgo && (user.otpRequestCount || 0) >= this.OTP_RATE_LIMIT_PER_HOUR) {
        throw new HttpException(
          { success: false, error: { code: 'RATE_LIMIT_OTP', message: 'Too many OTP requests. Please try again later.' } },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Resend cooldown
      if (user.otpLastRequestedAt) {
        const secondsSinceLastRequest = (Date.now() - user.otpLastRequestedAt.getTime()) / 1000;
        if (secondsSinceLastRequest < this.OTP_RESEND_COOLDOWN_SECONDS) {
          throw new HttpException(
            { success: false, error: { code: 'OTP_COOLDOWN', message: `Please wait ${Math.ceil(this.OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastRequest)} seconds before requesting a new OTP.` } },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      // Reset hourly counter if needed
      if (!user.otpLastRequestedAt || user.otpLastRequestedAt < oneHourAgo) {
        user.otpRequestCount = 0;
      }

      user.otp = otpHash;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      user.otpLastRequestedAt = new Date();
      user.otpRequestCount = (user.otpRequestCount || 0) + 1;
      await user.save();
    } else {
      user = new this.userModel({
        email: email.toLowerCase(),
        password: 'pending-otp-' + uuidv4(),
        firstName: 'Pending',
        lastName: 'User',
        otp: otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        otpLastRequestedAt: new Date(),
        otpRequestCount: 1,
        isActive: false,
        setupStage: 'otp_verified',
      });
      await user.save();
    }

    this.logger.log(`[DEV] OTP for ${email}: ${otp}`);

    // Send plaintext OTP via email BEFORE it's only stored hashed
    await this.sendOtpEmail(email, otp);

    await this.auditService.log({
      action: AuditAction.OTP_REQUESTED,
      userId: user._id.toString(),
      resource: 'user',
      resourceId: user._id.toString(),
      ipAddress,
    });

    return { sent: true, isNewUser };
  }

  async verifyOtp(email: string, otp: string, ipAddress?: string): Promise<{
    verified: boolean;
    user: IUser;
    tokens: AuthTokens;
    isNewUser: boolean;
    route: PostLoginRoute;
  }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt +otpAttempts');

    // Uniform error for unknown email. Returning 404 USER_NOT_FOUND here let an attacker
    // distinguish "no such user" from "wrong OTP" — a cheap email-enumeration oracle.
    // Match the real INVALID_OTP branch below (400) so the two responses are indistinguishable.
    // (Bug #5 in auth QA 2026-04-17.)
    if (!user) throw new HttpException(
      { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP. Please try again.' } },
      HttpStatus.BAD_REQUEST,
    );

    // Check lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(
        { success: false, error: { code: 'ACCOUNT_LOCKED', message: `Too many attempts. Please try again in ${minutesLeft} minutes.`, lockoutMinutes: minutesLeft } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (user.otpAttempts >= this.OTP_MAX_ATTEMPTS) {
      // Lock the account
      user.lockUntil = new Date(Date.now() + this.OTP_LOCKOUT_MINUTES * 60 * 1000);
      await user.save();

      await this.auditService.log({
        action: AuditAction.ACCOUNT_LOCKED,
        userId: user._id.toString(),
        resource: 'user',
        resourceId: user._id.toString(),
        ipAddress,
      });

      throw new HttpException(
        { success: false, error: { code: 'ACCOUNT_LOCKED', message: `Too many attempts. Please try again in ${this.OTP_LOCKOUT_MINUTES} minutes.`, lockoutMinutes: this.OTP_LOCKOUT_MINUTES } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user.otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new HttpException(
        { success: false, error: { code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Compare using bcrypt (OTP is stored hashed)
    const bcrypt = await import('bcrypt');
    const otpMatch = await bcrypt.compare(otp, user.otp);
    if (!otpMatch) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();

      await this.auditService.log({
        action: AuditAction.OTP_FAILED,
        userId: user._id.toString(),
        resource: 'user',
        resourceId: user._id.toString(),
        details: { attemptsRemaining: this.OTP_MAX_ATTEMPTS - user.otpAttempts },
        ipAddress,
      });

      throw new HttpException(
        { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP. Please try again.', attemptsRemaining: this.OTP_MAX_ATTEMPTS - user.otpAttempts } },
        HttpStatus.BAD_REQUEST,
      );
    }

    // OTP verified — clear it
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    user.lockUntil = null;

    const isNewUser = !user.isActive;
    if (isNewUser && user.setupStage === 'otp_verified') {
      user.isActive = true;
    }

    // Auto-activate invited users
    if (user.setupStage === 'invited') {
      user.isActive = true;
    }

    user.lastLogin = new Date();
    await user.save();

    await this.auditService.log({
      action: AuditAction.OTP_VERIFIED,
      userId: user._id.toString(),
      resource: 'user',
      resourceId: user._id.toString(),
      ipAddress,
    });

    // Determine routing
    const route = await this.determinePostLoginRoute(user);

    // Generate tokens with org context if available
    const tokens = await this.generateTokens(user, route.organizationId);

    return { verified: true, user, tokens, isNewUser, route };
  }

  // ── Invite Validation ──

  // ── Invite Validation (delegated to InviteService) ──

  async validateInviteToken(token: string) {
    return this.inviteService.validateInviteToken(token);
  }

  async acceptInvite(token: string, userId: string): Promise<IOrgMembership> {
    return this.inviteService.acceptInvite(token, userId);
  }

  async declineInvite(token: string, userId: string): Promise<void> {
    return this.inviteService.declineInvite(token, userId);
  }

  async completeProfile(userId: string, firstName: string, lastName: string, password?: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    user.firstName = firstName;
    user.lastName = lastName;
    if (password) {
      user.password = password;
    }
    user.isActive = true;

    // Update setupStage based on current stage
    if (user.setupStage === 'org_created') {
      user.setupStage = 'profile_complete';
    }

    await user.save();

    await this.auditService.log({
      action: AuditAction.PROFILE_UPDATED,
      userId,
      resource: 'user',
      resourceId: userId,
    });

    return user;
  }

  // ── Setup Stage Transitions ──

  async updateSetupStage(userId: string, stage: string): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    user.setupStage = stage as any;
    await user.save();

    if (stage === 'complete') {
      await this.auditService.log({
        action: AuditAction.SETUP_COMPLETED,
        userId,
        resource: 'user',
        resourceId: userId,
      });
    }

    return user;
  }

  // ── Member Deactivation/Reactivation ──

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

    // Revoke all sessions for this user+org
    await this.revokeAllSessions(targetUserId);

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
