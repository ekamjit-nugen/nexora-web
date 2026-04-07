import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check() {
    // MS-010: Check MongoDB connection state instead of returning healthy unconditionally
    const dbState = this.connection.readyState;
    const dbConnected = dbState === 1; // 1 = connected
    const status = dbConnected ? 'healthy' : 'unhealthy';

    return {
      status,
      service: 'media-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        mongodb: dbConnected ? 'connected' : 'disconnected',
      },
    };
  }
}
