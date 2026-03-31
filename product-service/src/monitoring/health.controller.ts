import { Controller, Post, Get, Delete, Param } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Check health
   */
  @Post('product/:productId/check')
  async checkHealth(@Param('productId') productId: string) {
    return this.healthService.checkHealth(productId);
  }

  /**
   * Get health
   */
  @Get('product/:productId')
  async getHealth(@Param('productId') productId: string) {
    return this.healthService.getHealth(productId);
  }

  /**
   * Get active alerts
   */
  @Get('product/:productId/alerts')
  async getActiveAlerts(@Param('productId') productId: string) {
    return this.healthService.getActiveAlerts(productId);
  }

  /**
   * Resolve alert
   */
  @Post('product/:productId/alerts/:alertId/resolve')
  async resolveAlert(
    @Param('productId') productId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.healthService.resolveAlert(productId, alertId);
  }

  /**
   * Get trends
   */
  @Get('product/:productId/trends')
  async getHealthTrends(@Param('productId') productId: string) {
    return this.healthService.getHealthTrends(productId);
  }

  /**
   * Get dashboard
   */
  @Get('product/:productId/dashboard')
  async getDashboardSummary(@Param('productId') productId: string) {
    return this.healthService.getDashboardSummary(productId);
  }

  /**
   * Delete health data
   */
  @Delete('product/:productId')
  async deleteHealth(@Param('productId') productId: string) {
    await this.healthService.deleteHealth(productId);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('status/check')
  async health() {
    return { status: 'healthy', service: 'monitoring' };
  }
}
