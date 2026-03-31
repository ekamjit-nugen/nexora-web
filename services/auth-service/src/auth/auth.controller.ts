import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, AuthTokens } from './auth.service';
import { OrganizationService } from './organization.service';
import { LoginDto, RegisterDto, RefreshTokenDto, MFASetupDto, MFAVerifyDto, UpdateProfileDto, ChangePasswordDto } from './dto/index';
import { CreateRoleDto, UpdateRoleDto, AssignRolesDto } from './dto/role.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private organizationService: OrganizationService,
  ) {}

  /**
   * User registration
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Registration attempt for: ${registerDto.email}`);
    const user = await this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.firstName,
      registerDto.lastName,
    );
    return {
      success: true,
      message: 'User registered successfully',
      data: user,
    };
  }

  /**
   * User login with email and password
   * Wave 1.1: Sets httpOnly cookie for browser clients while still returning
   * tokens in the response body for API/script clients.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() request: any, @Res({ passthrough: true }) response: any) {
    this.logger.log(`Login attempt for: ${loginDto.email}`);
    const tokens = await this.authService.login(
      loginDto.email,
      loginDto.password,
      loginDto.organizationId,
    );

    // Set httpOnly cookie for browser clients (XSS mitigation — Wave 1.1)
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('nexora_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: tokens.expiresIn * 1000,
      path: '/',
    });

    return {
      success: true,
      message: 'Login successful',
      data: tokens,
    };
  }

  /**
   * Refresh JWT token
   * Wave 1.1: Also refreshes the httpOnly cookie.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Res({ passthrough: true }) response: any) {
    this.logger.debug('Token refresh request');
    const tokens = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
    );

    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('nexora_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: tokens.expiresIn * 1000,
      path: '/',
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: tokens,
    };
  }

  /**
   * Setup MFA
   */
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupMFA(@Req() request: any) {
    this.logger.debug(`MFA setup for user: ${request.user.userId}`);
    const mfaSetup = await this.authService.setupMFA(request.user.userId);
    return {
      success: true,
      message: 'MFA setup initiated. Scan QR code and verify with code.',
      data: mfaSetup,
    };
  }

  /**
   * Verify MFA
   */
  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyMFA(
    @Req() request: any,
    @Body() mfaVerifyDto: MFAVerifyDto,
  ) {
    this.logger.debug(`MFA verification for user: ${request.user.userId}`);
    await this.authService.verifyMFA(request.user.userId, mfaVerifyDto.code);
    return {
      success: true,
      message: 'MFA enabled successfully',
    };
  }

  /**
   * Get current user
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@Req() request: any) {
    this.logger.debug(`Get current user: ${request.user.userId}`);
    const user = await this.authService.getUserById(request.user.userId);
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }

  /**
   * Google OAuth login redirect
   */
  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Redirect to Google login
  }

  /**
   * Google OAuth callback
   */
  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() request: any, @Res() response: any) {
    this.logger.log(`Google OAuth callback for: ${request.user.user.email}`);
    const { user, tokens } = request.user;
    
    // In production, redirect to frontend with tokens in URL params or session
    response.json({
      success: true,
      message: 'Google login successful',
      data: {
        user,
        tokens,
      },
    });
  }

  /**
   * Microsoft OAuth login redirect
   */
  @Get('oauth/microsoft')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftAuth() {
    // Redirect to Microsoft login
  }

  /**
   * Microsoft OAuth callback
   */
  @Get('oauth/microsoft/callback')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftCallback(@Req() request: any, @Res() response: any) {
    this.logger.log(`Microsoft OAuth callback for: ${request.user.user.email}`);
    const { user, tokens } = request.user;
    
    response.json({
      success: true,
      message: 'Microsoft login successful',
      data: {
        user,
        tokens,
      },
    });
  }

  /**
   * SAML login request
   */
  @Get('saml/login')
  @UseGuards(AuthGuard('saml'))
  async samlLogin() {
    // Redirect to SAML provider
  }

  /**
   * SAML callback
   */
  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  async samlCallback(@Req() request: any, @Res() response: any) {
    this.logger.log(`SAML callback for: ${request.user.user.email}`);
    const { user, tokens } = request.user;
    
    response.json({
      success: true,
      message: 'SAML login successful',
      data: {
        user,
        tokens,
      },
    });
  }

  /**
   * Logout
   * Wave 1.1: Clears httpOnly cookie in addition to server-side token invalidation.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: any, @Res({ passthrough: true }) response: any) {
    this.logger.log(`Logout for user: ${request.user.userId}`);
    await this.authService.logout(request.headers.authorization);

    // Clear httpOnly cookie (Wave 1.1)
    response.cookie('nexora_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 0,
      path: '/',
    });

    return {
      success: true,
      message: 'Logout successful',
    };
  }

  /**
   * Update profile
   */
  @Put('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req) {
    const user = await this.authService.updateProfile(req.user.userId, dto);
    return { success: true, message: 'Profile updated', data: user };
  }

  /**
   * Change password
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req) {
    await this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    return { success: true, message: 'Password changed successfully' };
  }

  /**
   * Disable MFA
   */
  @Delete('mfa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableMFA(@Req() req) {
    await this.authService.disableMFA(req.user.userId);
    return { success: true, message: 'MFA disabled' };
  }

  /**
   * Get user preferences
   */
  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPreferences(@Req() req) {
    const prefs = await this.authService.getPreferences(req.user.userId);
    return { success: true, data: prefs };
  }

  /**
   * Update user preferences
   */
  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updatePreferences(@Body() body: Record<string, unknown>, @Req() req) {
    const prefs = await this.authService.updatePreferences(req.user.userId, body);
    return { success: true, message: 'Preferences updated', data: prefs };
  }

  // ── Role Management Endpoints ──

  /**
   * Create a new role
   */
  @Post('roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRole(@Body() createRoleDto: CreateRoleDto, @Req() req) {
    this.logger.log(`Creating role: ${createRoleDto.name}`);
    const role = await this.authService.createRole(createRoleDto, req.user.organizationId);
    return {
      success: true,
      message: 'Role created successfully',
      data: role,
    };
  }

  /**
   * List all roles
   */
  @Get('roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRoles(@Req() req) {
    const roles = await this.authService.getRoles(req.user.organizationId);
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: roles,
    };
  }

  /**
   * Get a single role by ID
   */
  @Get('roles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRoleById(@Param('id') id: string, @Req() req) {
    const role = await this.authService.getRoleById(id, req.user.organizationId);
    return {
      success: true,
      message: 'Role retrieved successfully',
      data: role,
    };
  }

  /**
   * Update a role
   */
  @Put('roles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto, @Req() req) {
    this.logger.log(`Updating role: ${id}`);
    const role = await this.authService.updateRole(id, updateRoleDto, req.user.organizationId);
    return {
      success: true,
      message: 'Role updated successfully',
      data: role,
    };
  }

  /**
   * Delete a role (soft delete)
   */
  @Delete('roles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteRole(@Param('id') id: string, @Req() req) {
    this.logger.log(`Deleting role: ${id}`);
    await this.authService.deleteRole(id, req.user.organizationId);
    return {
      success: true,
      message: 'Role deleted successfully',
    };
  }

  /**
   * Assign roles to a user
   */
  @Put('users/:id/roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async assignRoles(@Param('id') id: string, @Body() assignRolesDto: AssignRolesDto) {
    this.logger.log(`Assigning roles to user: ${id}`);
    const user = await this.authService.assignRoleToUser(id, assignRolesDto.roles);
    return {
      success: true,
      message: 'Roles assigned successfully',
      data: user,
    };
  }

  /**
   * List all users with their roles
   */
  @Get('users')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAllUsers(@Req() request: any) {
    const users = await this.authService.getAllUsers(request.user?.organizationId);
    return {
      success: true,
      message: 'Users retrieved successfully',
      data: users,
    };
  }

  // ── OTP Endpoints ──

  /**
   * Send OTP to email (no auth required)
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: { email: string }) {
    const result = await this.authService.sendOtp(body.email);
    return { success: true, message: 'OTP sent to your email', data: result };
  }

  /**
   * Verify OTP and return tokens + orgs (no auth required)
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    const result = await this.authService.verifyOtp(body.email, body.otp);
    // Also get orgs
    let orgs = [];
    try {
      orgs = await this.organizationService.getMyOrganizations(result.user._id.toString());
    } catch {}
    // If the user has orgs (e.g. invited via directory), they are NOT a new user
    // even if isActive was false (old provisioning flow).
    const isNewUser = result.isNewUser && orgs.length === 0;

    // Auto-activate invited users who already belong to an org
    if (!isNewUser && !result.user.isActive && orgs.length > 0) {
      try {
        result.user.isActive = true;
        await result.user.save();
      } catch {}
    }

    return {
      success: true,
      message: 'OTP verified',
      data: {
        ...result,
        orgs,
        isNewUser,
      },
    };
  }

  /**
   * Complete profile for new users after OTP verification
   */
  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeProfile(@Body() body: { firstName: string; lastName: string; password: string }, @Req() req) {
    const user = await this.authService.completeProfile(req.user.userId, body.firstName, body.lastName, body.password);

    // Link any pending org invitations sent to this email before the user registered
    try {
      await this.organizationService.claimPendingInvitations(req.user.userId, req.user.email);
    } catch (err) {
      this.logger.warn(`Failed to claim pending invitations for ${req.user.email}: ${err.message || err}`);
    }

    return { success: true, message: 'Profile completed', data: user };
  }

  /**
   * Check if an email exists and return user's organizations (public endpoint)
   */
  @Get('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Query('email') email: string) {
    this.logger.log(`Email check for: ${email}`);
    const user = await this.authService.findUserByEmail(email);
    if (!user) {
      return { success: true, data: { exists: false, hasOrgs: false, orgs: [] } };
    }
    const orgs = await this.organizationService.getMyOrganizations(user._id.toString());
    return { success: true, data: { exists: true, hasOrgs: orgs.length > 0, orgs } };
  }
}

/*
 * When: User performs authentication operation
 * if: credentials/tokens are valid and user is authorized
 * then: return user data and JWT tokens for authenticated operations
 */
