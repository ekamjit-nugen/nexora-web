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
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../common/guards/org-membership.guard';
import { OrganizationService } from './organization.service';

const ADMIN_ROLES = ['admin', 'owner'];
function requireAdminRole(req: any): void {
  const orgRole = req.user?.orgRole;
  const roles = req.user?.roles || [];
  const isAdmin = ADMIN_ROLES.includes(orgRole) || roles.some((r: string) => ADMIN_ROLES.includes(r)) || req.user?.isPlatformAdmin;
  if (!isAdmin) throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION', message: 'Admin or owner role required' });
}
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
  SwitchOrgDto,
  UpdateOnboardingDto,
  UpdateMemberRoleDto,
} from './dto/organization.dto';

@Controller('auth')
export class OrganizationController {
  private readonly logger = new Logger(OrganizationController.name);

  constructor(private organizationService: OrganizationService) {}

  /**
   * Create a new organization
   */
  @Post('organizations')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrganization(@Body() dto: CreateOrganizationDto, @Req() req: any) {
    this.logger.log(`Creating organization: ${dto.name}`);
    const result = await this.organizationService.createOrganization(dto, req.user.userId);
    return {
      success: true,
      message: 'Organization created successfully',
      data: result,
    };
  }

  /**
   * List organizations the current user belongs to
   */
  @Get('organizations/my')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMyOrganizations(@Req() req: any) {
    const organizations = await this.organizationService.getMyOrganizations(req.user.userId);
    return {
      success: true,
      message: 'Organizations retrieved successfully',
      data: organizations,
    };
  }

  /**
   * Check if an email domain matches any organization
   */
  @Get('organizations/check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmailDomain(@Query('email') email: string) {
    const organizations = await this.organizationService.checkEmailDomain(email);
    return {
      success: true,
      message: 'Domain check completed',
      data: organizations,
    };
  }

  /**
   * Get a single organization by ID
   */
  @Get('organizations/:id')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async getOrganization(@Param('id') id: string) {
    const organization = await this.organizationService.getOrganization(id);
    return {
      success: true,
      message: 'Organization retrieved successfully',
      data: organization,
    };
  }

  /**
   * Update an organization
   */
  @Put('organizations/:id')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    this.logger.log(`Updating organization: ${id}`);
    const organization = await this.organizationService.updateOrganization(id, dto);
    return {
      success: true,
      message: 'Organization updated successfully',
      data: organization,
    };
  }

  /**
   * Invite a member to an organization
   */
  @Post('organizations/:id/invite')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(@Param('id') id: string, @Body() dto: InviteMemberDto, @Req() req: any) {
    this.logger.log(`Inviting ${dto.email} to organization: ${id}`);
    const membership = await this.organizationService.inviteMember(id, dto.email, dto.role || 'member', req.user.userId, dto.firstName, dto.lastName);
    return {
      success: true,
      message: 'Invitation sent successfully',
      data: membership,
    };
  }

  /**
   * Join an organization (accept invitation)
   */
  @Post('organizations/:id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async joinOrganization(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`User ${req.user.userId} joining organization: ${id}`);
    const membership = await this.organizationService.joinOrganization(id, req.user.userId);
    return {
      success: true,
      message: 'Successfully joined organization',
      data: membership,
    };
  }

  /**
   * Switch active organization (returns new tokens)
   */
  @Post('switch-org')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async switchOrganization(@Body() dto: SwitchOrgDto, @Req() req: any) {
    this.logger.log(`User ${req.user.userId} switching to organization: ${dto.organizationId}`);
    const tokens = await this.organizationService.switchOrganization(req.user.userId, dto.organizationId);
    return {
      success: true,
      message: 'Organization switched successfully',
      data: tokens,
    };
  }

  /**
   * Update onboarding step for an organization
   */
  @Put('organizations/:id/onboarding')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async updateOnboarding(@Param('id') id: string, @Body() dto: UpdateOnboardingDto) {
    this.logger.log(`Updating onboarding for organization: ${id}`);
    const organization = await this.organizationService.updateOnboardingStep(id, dto.step, dto.completed);
    return {
      success: true,
      message: 'Onboarding updated successfully',
      data: organization,
    };
  }

  /**
   * List all members of an organization
   */
  @Get('organizations/:id/members')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async getOrgMembers(@Param('id') id: string) {
    const members = await this.organizationService.getOrgMembers(id);
    return {
      success: true,
      message: 'Members retrieved successfully',
      data: members,
    };
  }

  /**
   * Update member role in an organization
   */
  @Put('organizations/:id/members/:memberId')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async updateMemberRole(@Param('id') orgId: string, @Param('memberId') memberId: string, @Body() body: UpdateMemberRoleDto, @Req() req: any) {
    // OrgMembershipGuard already validates user belongs to this org
    // Verify the user's admin role is specifically in this organization
    const membership = req.orgMembership;
    if (!req.user?.isPlatformAdmin && (!membership || !['admin', 'owner'].includes(membership.role))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION', message: 'Admin or owner role required in this organization' });
    }
    const result = await this.organizationService.updateMemberRole(orgId, memberId, body.role);
    return { success: true, message: 'Member role updated', data: result };
  }

  /**
   * Resend invitation to a pending member
   */
  @Post('organizations/:id/resend-invite')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async resendInvite(@Param('id') orgId: string, @Body() body: { email: string }, @Req() req: any) {
    this.logger.log(`Resending invite to ${body.email} for org: ${orgId}`);
    const membership = await this.organizationService.resendInvite(orgId, body.email, req.user.userId);
    return { success: true, message: 'Invitation resent successfully', data: membership };
  }

  /**
   * Remove member from an organization
   */
  @Delete('organizations/:id/members/:memberId')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async removeMember(@Param('id') orgId: string, @Param('memberId') memberId: string, @Req() req: any) {
    requireAdminRole(req);
    await this.organizationService.removeMember(orgId, memberId);
    return { success: true, message: 'Member removed' };
  }

  /**
   * Delete organization (soft delete)
   */
  @Delete('organizations/:id')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async deleteOrganization(@Param('id') orgId: string, @Req() req) {
    await this.organizationService.deleteOrganization(orgId, req.user.userId);
    return { success: true, message: 'Organization deleted' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // SCIM 2.0 enterprise provisioning
  //
  // Only org owners/admins may issue, rotate, or disable the SCIM token.
  // The plaintext token is returned exactly ONCE on enable/rotate and is
  // never retrievable again. Customers store it in their IdP (Okta,
  // Azure AD, OneLogin) configuration.
  // ──────────────────────────────────────────────────────────────────────

  @Get('organizations/:id/scim')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async getScimStatus(@Param('id') orgId: string, @Req() req: any) {
    requireAdminRole(req);
    const status = await this.organizationService.getScimStatus(orgId);
    return { success: true, data: status };
  }

  @Post('organizations/:id/scim/enable')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async enableScim(@Param('id') orgId: string, @Req() req: any) {
    requireAdminRole(req);
    const result = await this.organizationService.enableScim(orgId, req.user.userId);
    return {
      success: true,
      message:
        'SCIM enabled. Store this token in your IdP — it will not be shown again.',
      data: result,
    };
  }

  @Post('organizations/:id/scim/rotate')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async rotateScimToken(@Param('id') orgId: string, @Req() req: any) {
    requireAdminRole(req);
    const result = await this.organizationService.rotateScimToken(orgId, req.user.userId);
    return {
      success: true,
      message:
        'SCIM token rotated. Update your IdP with the new token — the old one has been invalidated.',
      data: result,
    };
  }

  @Post('organizations/:id/scim/disable')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @HttpCode(HttpStatus.OK)
  async disableScim(@Param('id') orgId: string, @Req() req: any) {
    requireAdminRole(req);
    await this.organizationService.disableScim(orgId, req.user.userId);
    return { success: true, message: 'SCIM disabled for this organization' };
  }
}
