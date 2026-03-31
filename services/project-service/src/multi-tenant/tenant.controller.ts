import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ITenantContext } from './tenant.model';

@Controller('api/v1/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Create tenant
   */
  @Post()
  async createTenant(@Body() body: any) {
    return this.tenantService.createTenant(
      body.productId,
      body.organizationId,
      {
        name: body.name,
        isolationLevel: body.isolationLevel,
        dataSegmentation: body.dataSegmentation,
        maxUsers: body.maxUsers,
        features: body.features,
        metadata: body.metadata,
      },
    );
  }

  /**
   * Get tenant
   */
  @Get(':tenantId')
  async getTenant(@Param('tenantId') tenantId: string) {
    return this.tenantService.getTenant(tenantId);
  }

  /**
   * Get product tenants
   */
  @Get('product/:productId/all')
  async getProductTenants(@Param('productId') productId: string) {
    return this.tenantService.getProductTenants(productId);
  }

  /**
   * Get organization tenants
   */
  @Get('product/:productId/organization/:organizationId')
  async getOrganizationTenants(
    @Param('productId') productId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.tenantService.getOrganizationTenants(productId, organizationId);
  }

  /**
   * Update tenant isolation settings
   */
  @Put(':tenantId/isolation')
  async updateTenantIsolation(@Param('tenantId') tenantId: string, @Body() body: any) {
    return this.tenantService.updateTenantIsolation(tenantId, {
      isolationLevel: body.isolationLevel,
      dataSegmentation: body.dataSegmentation,
    });
  }

  /**
   * Add user to tenant
   */
  @Post(':tenantId/users/:userId')
  async addUserToTenant(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.tenantService.addUserToTenant(tenantId, userId);
  }

  /**
   * Remove user from tenant
   */
  @Delete(':tenantId/users/:userId')
  async removeUserFromTenant(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.tenantService.removeUserFromTenant(tenantId, userId);
  }

  /**
   * Get tenant metrics
   */
  @Get(':tenantId/metrics')
  async getTenantMetrics(@Param('tenantId') tenantId: string) {
    return this.tenantService.getTenantMetrics(tenantId);
  }

  /**
   * Validate tenant context
   */
  @Post('validate')
  async validateTenantContext(@Body() context: ITenantContext) {
    await this.tenantService.validateTenantContext(context);
    return { valid: true };
  }

  /**
   * Enable feature for tenant
   */
  @Post(':tenantId/features/:featureName/enable')
  async enableFeature(
    @Param('tenantId') tenantId: string,
    @Param('featureName') featureName: string,
  ) {
    return this.tenantService.enableFeature(tenantId, featureName);
  }

  /**
   * Disable feature for tenant
   */
  @Post(':tenantId/features/:featureName/disable')
  async disableFeature(
    @Param('tenantId') tenantId: string,
    @Param('featureName') featureName: string,
  ) {
    return this.tenantService.disableFeature(tenantId, featureName);
  }

  /**
   * Suspend tenant
   */
  @Post(':tenantId/suspend')
  async suspendTenant(@Param('tenantId') tenantId: string) {
    return this.tenantService.suspendTenant(tenantId);
  }

  /**
   * Reactivate tenant
   */
  @Post(':tenantId/reactivate')
  async reactivateTenant(@Param('tenantId') tenantId: string) {
    return this.tenantService.reactivateTenant(tenantId);
  }

  /**
   * Delete tenant
   */
  @Delete(':tenantId')
  async deleteTenant(@Param('tenantId') tenantId: string) {
    await this.tenantService.deleteTenant(tenantId);
    return { success: true };
  }

  /**
   * Build isolation query
   */
  @Post('isolation-query')
  async buildIsolationQuery(@Body() body: any) {
    return {
      query: this.tenantService.buildIsolationQuery(body.context, body.baseQuery),
    };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'multi-tenant' };
  }
}
