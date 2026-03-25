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
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
  SwitchOrgDto,
  UpdateOnboardingDto,
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateMemberRole(@Param('id') orgId: string, @Param('memberId') memberId: string, @Body() body: { role: string }) {
    const result = await this.organizationService.updateMemberRole(orgId, memberId, body.role);
    return { success: true, message: 'Member role updated', data: result };
  }

  /**
   * Remove member from an organization
   */
  @Delete('organizations/:id/members/:memberId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeMember(@Param('id') orgId: string, @Param('memberId') memberId: string) {
    await this.organizationService.removeMember(orgId, memberId);
    return { success: true, message: 'Member removed' };
  }

  /**
   * Delete organization (soft delete)
   */
  @Delete('organizations/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteOrganization(@Param('id') orgId: string, @Req() req) {
    await this.organizationService.deleteOrganization(orgId, req.user.userId);
    return { success: true, message: 'Organization deleted' };
  }
}
