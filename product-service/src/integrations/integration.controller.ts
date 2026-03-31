import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IIntegrationField } from './integration.model';

@Controller('api/v1/integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Create integration
   */
  @Post()
  async createIntegration(@Body() body: any) {
    return this.integrationService.createIntegration(body.productId, {
      name: body.name,
      description: body.description,
      provider: body.provider,
      configuration: body.configuration,
      fieldMappings: body.fieldMappings,
    });
  }

  /**
   * Get integration
   */
  @Get(':id')
  async getIntegration(@Param('id') id: string) {
    return this.integrationService.getIntegration(id);
  }

  /**
   * Get product integrations
   */
  @Get('product/:productId')
  async getProductIntegrations(@Param('productId') productId: string) {
    return this.integrationService.getProductIntegrations(productId);
  }

  /**
   * Get integrations by provider
   */
  @Get('product/:productId/provider/:provider')
  async getIntegrationsByProvider(
    @Param('productId') productId: string,
    @Param('provider') provider: string,
  ) {
    return this.integrationService.getIntegrationsByProvider(productId, provider);
  }

  /**
   * Update integration
   */
  @Put(':id')
  async updateIntegration(@Param('id') id: string, @Body() body: any) {
    return this.integrationService.updateIntegration(id, body);
  }

  /**
   * Test connection
   */
  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.integrationService.testConnection(id);
  }

  /**
   * Sync integration
   */
  @Post(':id/sync')
  async syncIntegration(@Param('id') id: string) {
    return this.integrationService.syncIntegration(id);
  }

  /**
   * Map fields
   */
  @Post(':id/map-fields')
  async mapFields(@Param('id') id: string, @Body() body: any) {
    return this.integrationService.mapFields(id, body.fieldMappings);
  }

  /**
   * Enable integration
   */
  @Post(':id/enable')
  async enableIntegration(@Param('id') id: string) {
    return this.integrationService.enableIntegration(id);
  }

  /**
   * Disable integration
   */
  @Post(':id/disable')
  async disableIntegration(@Param('id') id: string) {
    return this.integrationService.disableIntegration(id);
  }

  /**
   * Get available providers
   */
  @Get('providers/available')
  async getAvailableProviders() {
    return this.integrationService.getAvailableProviders();
  }

  /**
   * Delete integration
   */
  @Delete(':id')
  async deleteIntegration(@Param('id') id: string) {
    await this.integrationService.deleteIntegration(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'integrations' };
  }
}
