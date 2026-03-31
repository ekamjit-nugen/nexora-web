import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { SystemHealthService } from './system-health.service';

@Controller('health')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class SystemHealthController {
  private readonly logger = new Logger(SystemHealthController.name);

  constructor(private systemHealthService: SystemHealthService) {}

  /**
   * Get overall system health status
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getSystemHealth() {
    this.logger.log('Platform admin fetching system health');
    const data = await this.systemHealthService.getSystemHealth();
    return { success: true, message: 'System health retrieved successfully', data };
  }

  /**
   * Get queue metrics (email, notification, analytics)
   */
  @Get('queue')
  @HttpCode(HttpStatus.OK)
  async getQueueMetrics() {
    this.logger.log('Platform admin fetching queue metrics');
    const data = await this.systemHealthService.getQueueMetrics();
    return { success: true, message: 'Queue metrics retrieved successfully', data };
  }

  /**
   * Get database statistics
   */
  @Get('database')
  @HttpCode(HttpStatus.OK)
  async getDatabaseStats() {
    this.logger.log('Platform admin fetching database statistics');
    const data = await this.systemHealthService.getDatabaseStats();
    return { success: true, message: 'Database statistics retrieved successfully', data };
  }

  /**
   * Get service dependency status
   */
  @Get('dependencies')
  @HttpCode(HttpStatus.OK)
  async getServiceDependencies() {
    this.logger.log('Platform admin fetching service dependencies');
    const data = await this.systemHealthService.getServiceDependencies();
    return { success: true, message: 'Service dependencies retrieved successfully', data };
  }

  /**
   * Get uptime statistics
   */
  @Get('uptime')
  @HttpCode(HttpStatus.OK)
  async getUptimeStats() {
    this.logger.log('Platform admin fetching uptime statistics');
    const data = await this.systemHealthService.getUptimeStats();
    return { success: true, message: 'Uptime statistics retrieved successfully', data };
  }

  /**
   * Get performance metrics
   */
  @Get('performance')
  @HttpCode(HttpStatus.OK)
  async getPerformanceMetrics() {
    this.logger.log('Platform admin fetching performance metrics');
    const data = await this.systemHealthService.getPerformanceMetrics();
    return { success: true, message: 'Performance metrics retrieved successfully', data };
  }
}

/*
 * When: Platform admin accesses /health/* endpoints
 * if: user is authenticated and has isPlatformAdmin flag
 * then: route to system health service methods
 */
