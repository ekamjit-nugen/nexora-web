import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { IUser } from './schemas/user.schema';
import { IRole } from './schemas/role.schema';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 30 * 60 * 1000; // 30 minutes

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
    @InjectModel('Role') private roleModel: Model<IRole>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user with email and password
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<IUser> {
    this.logger.debug(`Registering new user: ${email}`);

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new HttpException(
        'User with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    // Validate password strength
    if (!this.isStrongPassword(password)) {
      throw new HttpException(
        'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create new user
    const user = new this.userModel({
      email,
      password,
      firstName,
      lastName,
      roles: ['user'],
      permissions: [],
    });

    await user.save();
    this.logger.log(`User registered successfully: ${email}`);

    // Remove sensitive fields
    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse as IUser;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    this.logger.debug(`Login attempt: ${email}`);

    // Find user by email and select password field
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) {
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      throw new HttpException(
        'Account locked due to multiple failed login attempts',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new HttpException(
        'Account is inactive',
        HttpStatus.FORBIDDEN,
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;
      if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + this.LOCK_TIME);
      }
      await user.save();
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    user.lastLoginIp = null; // Will be set by controller from request IP
    await user.save();

    this.logger.log(`User logged in successfully: ${email}`);

    return this.generateTokens(user);
  }

  /**
   * Generate JWT tokens for user
   */
  async generateTokens(user: IUser, orgId?: string): Promise<AuthTokens> {
    const payload: any = {
      sub: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      organizationId: orgId || user.defaultOrganizationId || null,
    };

    const jwtExpiry = process.env.JWT_EXPIRY || '7d';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: jwtExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 604800, // 7 days in seconds (dev)
    };
  }

  /**
   * Generate tokens with organization context
   */
  async generateTokensWithOrg(userId: string, orgId: string): Promise<AuthTokens> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return this.generateTokens(user, orgId);
  }

  /**
   * Refresh JWT token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    this.logger.debug('Token refresh attempt');

    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userModel.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new HttpException(
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return this.generateTokens(user, payload.organizationId || user.defaultOrganizationId);
    } catch (error) {
      throw new HttpException(
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Setup TOTP for MFA
   */
  async setupMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    this.logger.debug(`Setting up MFA for user: ${userId}`);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException(
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Nexora (${user.email})`,
      issuer: 'Nexora',
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (will be confirmed with verification)
    user.mfaSecret = secret.base32;
    await user.save();

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  /**
   * Verify TOTP code
   */
  async verifyMFA(userId: string, code: string): Promise<boolean> {
    this.logger.debug(`Verifying MFA for user: ${userId}`);

    const user = await this.userModel.findById(userId).select('+mfaSecret');
    if (!user || !user.mfaSecret) {
      throw new HttpException(
        'MFA not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new HttpException(
        'Invalid MFA code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Enable MFA
    user.mfaEnabled = true;
    user.mfaMethod = 'TOTP';
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );
    user.mfaBackupCodes = backupCodes;
    
    await user.save();
    this.logger.log(`MFA enabled for user: ${userId}`);

    return true;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    provider: 'google' | 'microsoft' | 'saml',
    profile: any,
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    this.logger.debug(`OAuth callback from ${provider}`);

    let user = await this.userModel.findOne({
      [`oauthProviders.${provider}.id`]: profile.id,
    });

    if (!user) {
      // Try to find by email
      user = await this.userModel.findOne({ email: profile.email });

      if (!user) {
        // Create new user
        user = new this.userModel({
          email: profile.email,
          firstName: profile.given_name || profile.firstName || 'User',
          lastName: profile.family_name || profile.lastName || '',
          isEmailVerified: true,
          roles: ['user'],
          permissions: [],
        });
      }
    }

    // Update OAuth provider
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

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException(
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  /**
   * Validate JWT payload
   */
  validateJwtPayload(payload: any): boolean {
    return !!(payload.sub && payload.email && payload.roles);
  }

  /**
   * Check password strength
   */
  private isStrongPassword(password: string): boolean {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    return hasUppercase && hasLowercase && hasNumbers && hasSpecialChar && isLongEnough;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; avatar?: string; phoneNumber?: string }): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.avatar !== undefined) user.avatar = data.avatar;
    if (data.phoneNumber !== undefined) user.phoneNumber = data.phoneNumber;
    await user.save();
    return user;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) throw new HttpException('Current password is incorrect', HttpStatus.BAD_REQUEST);
    if (!this.isStrongPassword(newPassword)) throw new HttpException('New password does not meet strength requirements', HttpStatus.BAD_REQUEST);
    user.password = newPassword;
    await user.save();
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = [];
    user.mfaMethod = undefined;
    await user.save();
  }

  /**
   * Logout user (token blacklist)
   */
  async logout(token: string): Promise<void> {
    this.logger.debug('User logout');
    // In production, add token to Redis blacklist
    // For now, client should discard token
  }

  // ── Role Management ──

  /**
   * Create a new role
   */
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

  /**
   * Get all roles (non-deleted)
   */
  async getRoles(organizationId?: string): Promise<IRole[]> {
    return this.roleModel.find({
      isDeleted: false,
      $or: [
        { organizationId: organizationId || null },
        { isSystem: true },
      ],
    }).sort({ isSystem: -1, name: 1 });
  }

  /**
   * Get a single role by ID
   */
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

  /**
   * Update a role
   */
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

  /**
   * Soft-delete a role (system roles cannot be deleted)
   */
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

    role.isDeleted = true;
    role.isActive = false;
    await role.save();
    this.logger.log(`Role deleted: ${role.name}`);
  }

  /**
   * Assign roles to a user
   */
  async assignRoleToUser(userId: string, roleNames: string[]): Promise<IUser> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Verify all roles exist
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

  /**
   * Get all users with a specific role
   */
  async getUsersByRole(roleName: string): Promise<IUser[]> {
    return this.userModel.find({
      roles: roleName.toLowerCase(),
      isActive: true,
      deletedAt: null,
    });
  }

  /**
   * Get all users (for admin listing)
   */
  async getAllUsers(): Promise<IUser[]> {
    return this.userModel.find({ deletedAt: null }).sort({ createdAt: -1 });
  }

  /**
   * Find a user by email (public — used by check-email endpoint)
   */
  async findUserByEmail(email: string): Promise<IUser | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return (user.preferences as Record<string, unknown>) || {};
  }

  /**
   * Update user preferences (merge with existing)
   */
  async updatePreferences(userId: string, preferences: Record<string, unknown>): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    // Merge with existing preferences (don't replace entirely)
    user.preferences = { ...((user.preferences as Record<string, unknown>) || {}), ...preferences };
    user.markModified('preferences');
    await user.save();
    return user.preferences as Record<string, unknown>;
  }

  // ── OTP Methods ──

  /**
   * Send OTP to user's email
   */
  async sendOtp(email: string): Promise<{ sent: boolean; isNewUser: boolean }> {
    // DEV_ONLY: Fixed OTP for development. In production, use random: Math.floor(100000 + Math.random() * 900000).toString()
    const otp = '000000';
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    let user = await this.userModel.findOne({ email: email.toLowerCase() });
    const isNewUser = !user;

    if (!user) {
      // Don't create account yet — just store OTP temporarily
      // Create user with isActive: false
      user = new this.userModel({
        email: email.toLowerCase(),
        password: 'pending-otp-' + otp, // placeholder, will be set later
        firstName: 'Pending',
        lastName: 'User',
        otp,
        otpExpiresAt,
        otpAttempts: 0,
        isActive: false, // Not fully registered yet
      });
      await user.save();
    } else {
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      await user.save();
    }

    // DEV_ONLY: Log OTP to console (in production, send via email)
    this.logger.log(`OTP for ${email}: ${otp}`);

    // TODO: Send OTP via email (MailHog in dev)
    // await this.emailService.sendOtp(email, otp);

    return { sent: true, isNewUser };
  }

  /**
   * Verify OTP and return tokens
   */
  async verifyOtp(email: string, otp: string): Promise<{ verified: boolean; user: IUser; tokens: AuthTokens; isNewUser: boolean; orgs: any[] }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt +otpAttempts');

    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    if (user.otpAttempts >= 5) {
      throw new HttpException('Too many attempts. Request a new OTP.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!user.otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new HttpException('OTP expired. Request a new one.', HttpStatus.BAD_REQUEST);
    }

    if (user.otp !== otp) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      throw new HttpException('Invalid OTP', HttpStatus.BAD_REQUEST);
    }

    // OTP verified — clear it
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;

    const isNewUser = !user.isActive;
    if (!user.isActive) {
      // Mark as needing completion (name, password)
      // Don't set active yet — that happens after profile completion
    }

    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return { verified: true, user, tokens, isNewUser, orgs: [] };
  }

  /**
   * Complete profile for new users after OTP verification
   */
  async completeProfile(userId: string, firstName: string, lastName: string, password?: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    user.firstName = firstName;
    user.lastName = lastName;
    if (password) {
      user.password = password; // Will be hashed by pre-save hook
    }
    user.isActive = true;
    await user.save();

    return user;
  }
}

/*
 * When: User attempts authentication action
 * if: credentials are valid and account is not locked
 * then: return JWT tokens and update last login timestamp
 */
