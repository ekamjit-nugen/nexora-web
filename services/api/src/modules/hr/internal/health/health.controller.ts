import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'hr-service',
      uptime: process.uptime(),
    };
  }
}
