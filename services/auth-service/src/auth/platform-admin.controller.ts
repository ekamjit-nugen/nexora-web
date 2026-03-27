import {
  Controller,
  Get,
  Post,
  Put,
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
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  private readonly logger = new Logger(PlatformAdminController.name);

  constructor(private platformAdminService: PlatformAdminService) {}

  /**
   * List all organizations
   */
  @Get('organizations')
  @HttpCode(HttpStatus.OK)
  async getAllOrganizations(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.platformAdminService.getAllOrganizations(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
      status,
    );
    return { success: true, data: result.items, pagination: result.pagination };
  }

  /**
   * Get organization detail
   */
  @Get('organizations/:id')
  @HttpCode(HttpStatus.OK)
  async getOrganizationDetail(@Param('id') id: string) {
    const data = await this.platformAdminService.getOrganizationDetail(id);
    return { success: true, message: 'Organization retrieved successfully', data };
  }

  /**
   * Suspend an organization
   */
  @Post('organizations/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendOrganization(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`Platform admin suspending organization: ${id}`);
    const data = await this.platformAdminService.suspendOrganization(id, req.user.userId, req.ip);
    return { success: true, message: 'Organization suspended successfully', data };
  }

  /**
   * Activate an organization
   */
  @Post('organizations/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateOrganization(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`Platform admin activating organization: ${id}`);
    const data = await this.platformAdminService.activateOrganization(id, req.user.userId, req.ip);
    return { success: true, message: 'Organization activated successfully', data };
  }

  /**
   * Update organization plan
   */
  @Put('organizations/:id/plan')
  @HttpCode(HttpStatus.OK)
  async updateOrganizationPlan(
    @Param('id') id: string,
    @Body() body: { plan: string },
    @Req() req: any,
  ) {
    this.logger.log(`Platform admin updating plan for organization: ${id}`);
    const data = await this.platformAdminService.updateOrganizationPlan(id, body.plan, req.user.userId, req.ip);
    return { success: true, message: 'Organization plan updated successfully', data };
  }

  /**
   * List all platform users
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getAllUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    const result = await this.platformAdminService.getAllUsers(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
    );
    return { success: true, data: result.items, pagination: result.pagination };
  }

  /**
   * Get user detail
   */
  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  async getUserDetail(@Param('id') id: string) {
    const data = await this.platformAdminService.getUserDetail(id);
    return { success: true, message: 'User retrieved successfully', data };
  }

  /**
   * Disable a user
   */
  @Post('users/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableUser(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`Platform admin disabling user: ${id}`);
    const data = await this.platformAdminService.disableUser(id, req.user.userId, req.ip);
    return { success: true, message: 'User disabled successfully', data };
  }

  /**
   * Enable a user
   */
  @Post('users/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableUser(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`Platform admin enabling user: ${id}`);
    const data = await this.platformAdminService.enableUser(id, req.user.userId, req.ip);
    return { success: true, message: 'User enabled successfully', data };
  }

  /**
   * Reset user auth (clear MFA, unlock account)
   */
  @Post('users/:id/reset-auth')
  @HttpCode(HttpStatus.OK)
  async resetUserAuth(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`Platform admin resetting auth for user: ${id}`);
    const data = await this.platformAdminService.resetUserAuth(id, req.user.userId, req.ip);
    return { success: true, message: 'User auth reset successfully', data };
  }

  /**
   * Get platform analytics
   */
  @Get('analytics')
  @HttpCode(HttpStatus.OK)
  async getPlatformAnalytics() {
    const data = await this.platformAdminService.getPlatformAnalytics();
    return { success: true, message: 'Analytics retrieved successfully', data };
  }

  /**
   * Get audit logs
   */
  @Get('audit-logs')
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
  ) {
    const result = await this.platformAdminService.getAuditLogs(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      action,
      targetType,
    );
    return { success: true, data: result.items, pagination: result.pagination };
  }
}

/*
 * When: Platform admin accesses /platform/* endpoints
 * if: user is authenticated and has isPlatformAdmin flag
 * then: route to appropriate platform admin service methods
 */
