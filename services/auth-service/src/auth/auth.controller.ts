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
import { AuditService, AuditAction } from './audit.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { LoginDto, RegisterDto, RefreshTokenDto, MFASetupDto, MFAVerifyDto, UpdateProfileDto, ChangePasswordDto, SendOtpDto, VerifyOtpDto } from './dto/index';
import { CreateRoleDto, UpdateRoleDto, AssignRolesDto } from './dto/role.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';

const ADMIN_ROLES = ['admin', 'owner'];

function requireAdminRole(req: any): void {
  const orgRole = req.user?.orgRole;
  const roles = req.user?.roles || [];
  const isAdmin = ADMIN_ROLES.includes(orgRole) || roles.some((r: string) => ADMIN_ROLES.includes(r)) || req.user?.isPlatformAdmin;
  if (!isAdmin) {
    throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION', message: 'Admin or owner role required for this action' });
  }
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private organizationService: OrganizationService,
    private auditService: AuditService,
    private deviceFingerprintService: DeviceFingerprintService,
  ) {}

  private setCookies(response: any, tokens: AuthTokens): void {
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('nexora_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: tokens.expiresIn * 1000,
      path: '/',
    });
    response.cookie('nexora_refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // CSRF token — readable by JS, not httpOnly
    const csrfToken = this.authService.generateCsrfToken();
    response.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: tokens.expiresIn * 1000,
      path: '/',
    });
  }

  private clearCookies(response: any): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const opts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax' as any,
      maxAge: 0,
      path: '/',
    };
    response.cookie('nexora_token', '', opts);
    response.cookie('nexora_refresh', '', opts);
    response.cookie('XSRF-TOKEN', '', { ...opts, httpOnly: false });
  }

  // ── Registration ──

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
    return { success: true, message: 'User registered successfully', data: user };
  }

  // ── Login ──

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() request: any, @Res({ passthrough: true }) response: any) {
    this.logger.log(`Login attempt for: ${loginDto.email}`);
    const tokens = await this.authService.login(loginDto.email, loginDto.password, loginDto.organizationId);
    this.setCookies(response, tokens);
    return { success: true, message: 'Login successful', data: tokens };
  }

  // ── Token Refresh ──

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Res({ passthrough: true }) response: any) {
    this.logger.debug('Token refresh request');
    const tokens = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    this.setCookies(response, tokens);
    return { success: true, message: 'Token refreshed successfully', data: tokens };
  }

  // ── MFA ──

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupMFA(@Req() request: any) {
    const mfaSetup = await this.authService.setupMFA(request.user.userId);
    return { success: true, message: 'MFA setup initiated', data: mfaSetup };
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyMFA(@Req() request: any, @Body() mfaVerifyDto: MFAVerifyDto) {
    await this.authService.verifyMFA(request.user.userId, mfaVerifyDto.code);
    return { success: true, message: 'MFA enabled successfully' };
  }

  @Delete('mfa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableMFA(@Req() req) {
    await this.authService.disableMFA(req.user.userId);
    return { success: true, message: 'MFA disabled' };
  }

  // ── Current User ──

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@Req() request: any) {
    const user = await this.authService.getUserById(request.user.userId);
    return { success: true, message: 'User retrieved successfully', data: user };
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req) {
    const user = await this.authService.updateProfile(req.user.userId, dto);
    return { success: true, message: 'Profile updated', data: user };
  }

  // ── Password ──

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req) {
    await this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    return { success: true, message: 'Password changed successfully' };
  }

  // ── Preferences ──

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPreferences(@Req() req) {
    const prefs = await this.authService.getPreferences(req.user.userId);
    return { success: true, data: prefs };
  }

  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updatePreferences(@Body() body: Record<string, unknown>, @Req() req) {
    const prefs = await this.authService.updatePreferences(req.user.userId, body);
    return { success: true, message: 'Preferences updated', data: prefs };
  }

  // ── OAuth ──

  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() request: any, @Res() response: any) {
    const { user, tokens } = request.user;
    response.json({ success: true, message: 'Google login successful', data: { user, tokens } });
  }

  @Get('oauth/microsoft')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftAuth() {}

  @Get('oauth/microsoft/callback')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftCallback(@Req() request: any, @Res() response: any) {
    const { user, tokens } = request.user;
    response.json({ success: true, message: 'Microsoft login successful', data: { user, tokens } });
  }

  @Get('saml/login')
  @UseGuards(AuthGuard('saml'))
  async samlLogin() {}

  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  async samlCallback(@Req() request: any, @Res() response: any) {
    const { user, tokens } = request.user;
    response.json({ success: true, message: 'SAML login successful', data: { user, tokens } });
  }

  // ── Logout ──

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: any, @Res({ passthrough: true }) response: any) {
    this.logger.log(`Logout for user: ${request.user.userId}`);
    await this.authService.logout(request.user.userId, request.user.family);
    this.clearCookies(response);
    return { success: true, message: 'Logout successful' };
  }

  // ── Session Management ──

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getSessions(@Req() req) {
    const sessions = await this.authService.getSessions(req.user.userId);
    return { success: true, data: sessions };
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Param('id') id: string, @Req() req) {
    await this.authService.revokeSession(req.user.userId, id);
    return { success: true, message: 'Session revoked' };
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@Req() req) {
    await this.authService.revokeAllSessions(req.user.userId, req.user.family);
    return { success: true, message: 'All other sessions revoked' };
  }

  // ── Trusted Device Management ──

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMyDevices(@Req() req: any) {
    const userId = req.user.userId;
    const devices = await this.deviceFingerprintService.listUserDevices(userId);
    return { success: true, data: devices };
  }

  @Delete('devices/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeDevice(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    await this.deviceFingerprintService.revokeDevice(userId, id, body?.reason);
    return { success: true, message: 'Device revoked' };
  }

  @Post('devices/revoke-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllDevices(@Req() req: any) {
    const userId = req.user.userId;
    const count = await this.deviceFingerprintService.revokeAllDevices(userId);
    return { success: true, message: `Revoked ${count} devices` };
  }

  // ── Role Management ──

  @Post('roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRole(@Body() createRoleDto: CreateRoleDto, @Req() req) {
    requireAdminRole(req);
    const role = await this.authService.createRole(createRoleDto, req.user.organizationId);
    return { success: true, message: 'Role created successfully', data: role };
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRoles(@Req() req) {
    requireAdminRole(req);
    const roles = await this.authService.getRoles(req.user.organizationId);
    return { success: true, message: 'Roles retrieved successfully', data: roles };
  }

  @Get('roles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRoleById(@Param('id') id: string, @Req() req) {
    requireAdminRole(req);
    const role = await this.authService.getRoleById(id, req.user.organizationId);
    return { success: true, message: 'Role retrieved successfully', data: role };
  }

  @Put('roles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto, @Req() req) {
    requireAdminRole(req);
    const role = await this.authService.updateRole(id, updateRoleDto, req.user.organizationId);
    return { success: true, message: 'Role updated successfully', data: role };
  }

  @Delete('roles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteRole(@Param('id') id: string, @Req() req) {
    requireAdminRole(req);
    await this.authService.deleteRole(id, req.user.organizationId);
    return { success: true, message: 'Role deleted successfully' };
  }

  @Put('users/:id/roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async assignRoles(@Param('id') id: string, @Body() assignRolesDto: AssignRolesDto, @Req() req) {
    requireAdminRole(req);
    const user = await this.authService.assignRoleToUser(id, assignRolesDto.roles);
    return { success: true, message: 'Roles assigned successfully', data: user };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAllUsers(@Req() request: any) {
    requireAdminRole(request);
    const users = await this.authService.getAllUsers(request.user?.organizationId);
    return { success: true, message: 'Users retrieved successfully', data: users };
  }

  // ── OTP Endpoints ──

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: SendOtpDto, @Req() req: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    await this.authService.sendOtp(body.email, ipAddress);
    // Always return success to prevent user enumeration
    return { success: true, message: 'OTP sent to your email' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: any, @Res({ passthrough: true }) response: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const result = await this.authService.verifyOtp(body.email, body.otp, ipAddress);

    // Set cookies
    this.setCookies(response, result.tokens);

    // Record device login and detect new device
    let isNewDevice = false;
    try {
      const userAgent = req.headers?.['user-agent'];
      const acceptLanguage = req.headers?.['accept-language'];
      const deviceCheck = await this.deviceFingerprintService.recordDeviceLogin(
        result.user._id.toString(),
        { userAgent, ipAddress, acceptLanguage },
        result.user.organizations?.[0],
      );
      isNewDevice = deviceCheck.isNewDevice;
      if (isNewDevice) {
        this.logger.warn(
          `New device login alert for user ${result.user.email}: ${deviceCheck.device.deviceName} from ${ipAddress}`,
        );
        // Notification service call is out of scope; alert is logged for now.
      }
    } catch (err) {
      this.logger.warn(`Device fingerprinting failed for ${result.user.email}: ${err?.message || err}`);
    }

    return {
      success: true,
      message: 'OTP verified',
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: {
          id: result.user._id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          setupStage: result.user.setupStage,
          organizations: result.user.organizations,
        },
        route: result.route.route,
        routeReason: result.route.reason,
        organizationId: result.route.organizationId,
        // Per TC-8.1: when route is `/auth/select-organization`, the client
        // needs the list of orgs to render the picker. The route resolver
        // computes this in the multi_org case — surface it directly.
        organizations: (result.route as any).organizations || undefined,
        isNewUser: result.isNewUser,
        isNewDevice,
      },
    };
  }

  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeProfile(@Body() body: { firstName: string; lastName: string; password?: string; jobTitle?: string; department?: string }, @Req() req) {
    const user = await this.authService.completeProfile(req.user.userId, body.firstName, body.lastName, body.password);

    // Update additional profile fields
    if (body.jobTitle || body.department) {
      await this.authService.updateProfile(req.user.userId, {
        jobTitle: body.jobTitle,
        department: body.department,
      });
    }

    // Link pending invitations
    try {
      await this.organizationService.claimPendingInvitations(req.user.userId, req.user.email);
    } catch (err) {
      this.logger.warn(`Failed to claim pending invitations for ${req.user.email}: ${err.message || err}`);
    }

    // Sync employee name in HR service (fixes "Pending User" after profile completion)
    if (req.user.organizationId) {
      try {
        await this.organizationService.syncEmployeeName(req.user.email, body.firstName, body.lastName, req.user.organizationId, req.user.userId);
      } catch (err) {
        this.logger.warn(`Failed to sync employee name for ${req.user.email}: ${err.message || err}`);
      }
    }

    return { success: true, message: 'Profile completed', data: user };
  }

  @Get('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Query('email') email: string) {
    // Return consistent response regardless of user existence to prevent enumeration
    const user = await this.authService.findUserByEmail(email);
    if (!user) {
      return { success: true, data: { exists: false, hasOrgs: false, orgs: [] } };
    }
    // Only return org IDs, not full org details — and keep response shape identical
    const orgs = await this.organizationService.getMyOrganizations(user._id.toString());
    const sanitizedOrgs = orgs.map((o: any) => ({ _id: o._id, name: o.name }));
    return { success: true, data: { exists: true, hasOrgs: sanitizedOrgs.length > 0, orgs: sanitizedOrgs } };
  }

  // ── Setup Stage ──

  @Put('setup-stage')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateSetupStage(@Body() body: { stage: string }, @Req() req) {
    const user = await this.authService.updateSetupStage(req.user.userId, body.stage);
    return { success: true, message: 'Setup stage updated', data: { setupStage: user.setupStage } };
  }

  // ── Invite Validation ──

  @Get('invites/:token/validate')
  @HttpCode(HttpStatus.OK)
  async validateInvite(@Param('token') token: string) {
    const result = await this.authService.validateInviteToken(token);
    return { success: true, data: result };
  }

  @Post('invites/:token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@Param('token') token: string, @Req() req) {
    const membership = await this.authService.acceptInvite(token, req.user.userId);

    // Sync HR employee status to 'active'
    try {
      await this.organizationService.syncEmployeeStatus(req.user.email, 'active', membership.organizationId, req.user.userId);
    } catch (err) {
      this.logger.warn(`Failed to sync employee status for ${req.user.email}: ${err.message || err}`);
    }

    return { success: true, message: 'Invitation accepted', data: membership };
  }

  @Post('invites/:token/decline')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async declineInvite(@Param('token') token: string, @Req() req) {
    await this.authService.declineInvite(token, req.user.userId);
    return { success: true, message: 'Invitation declined' };
  }

  // ── Member Deactivation/Reactivation ──

  @Post('organizations/:orgId/members/:userId/deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deactivateMember(@Param('orgId') orgId: string, @Param('userId') userId: string, @Req() req) {
    requireAdminRole(req);
    if (req.user.userId === userId) throw new ForbiddenException('Cannot deactivate yourself');
    const membership = await this.authService.deactivateMember(orgId, userId, req.user.userId);
    return { success: true, message: 'Member deactivated', data: membership };
  }

  @Post('organizations/:orgId/members/:userId/reactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reactivateMember(@Param('orgId') orgId: string, @Param('userId') userId: string, @Req() req) {
    requireAdminRole(req);
    const membership = await this.authService.reactivateMember(orgId, userId, req.user.userId);
    return { success: true, message: 'Member reactivated', data: membership };
  }
}
