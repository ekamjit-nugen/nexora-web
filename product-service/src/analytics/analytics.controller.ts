import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Generate velocity report
   */
  @Post('reports/velocity')
  async generateVelocityReport(@Body() body: any) {
    return this.analyticsService.generateVelocityReport(
      body.productId,
      new Date(body.startDate),
      new Date(body.endDate),
    );
  }

  /**
   * Generate burndown report
   */
  @Post('reports/burndown')
  async generateBurndownReport(@Body() body: any) {
    return this.analyticsService.generateBurndownReport(
      body.productId,
      new Date(body.startDate),
      new Date(body.endDate),
    );
  }

  /**
   * Generate trend report
   */
  @Post('reports/trend')
  async generateTrendReport(@Body() body: any) {
    return this.analyticsService.generateTrendReport(
      body.productId,
      body.metricName,
      new Date(body.startDate),
      new Date(body.endDate),
    );
  }

  /**
   * Generate forecast report
   */
  @Post('reports/forecast')
  async generateForecastReport(@Body() body: any) {
    return this.analyticsService.generateForecastReport(
      body.productId,
      new Date(body.startDate),
      new Date(body.endDate),
    );
  }

  /**
   * Get report
   */
  @Get('reports/:id')
  async getReport(@Param('id') id: string) {
    return this.analyticsService.getReport(id);
  }

  /**
   * Get product reports
   */
  @Get('product/:productId/reports')
  async getProductReports(
    @Param('productId') productId: string,
    @Query('type') type?: string,
  ) {
    return this.analyticsService.getProductReports(productId, type);
  }

  /**
   * Get summary
   */
  @Get('product/:productId/summary')
  async getSummary(@Param('productId') productId: string) {
    return this.analyticsService.getSummary(productId);
  }

  /**
   * Delete report
   */
  @Delete('reports/:id')
  async deleteReport(@Param('id') id: string) {
    await this.analyticsService.deleteReport(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'analytics' };
  }
}
