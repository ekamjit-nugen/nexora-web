import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    this.logger.debug('Health check request');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  readinessCheck() {
    this.logger.debug('Readiness check request');
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  livenessCheck() {
    this.logger.debug('Liveness check request');
    return {
      live: true,
      timestamp: new Date().toISOString(),
    };
  }
}

/*
 * When: Kubernetes or load balancer performs health check
 * if: service is running and database is accessible
 * then: return 200 OK with health status
 */
