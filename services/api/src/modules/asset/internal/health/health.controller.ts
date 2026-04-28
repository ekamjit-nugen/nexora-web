import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'asset-service',
      uptime: process.uptime(),
    };
  }
}
