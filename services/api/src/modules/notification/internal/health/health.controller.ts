import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DeliveryService } from '../delivery/delivery.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly deliveryService: DeliveryService,
  ) {}

  @Get()
  check() {
    // NS-004: Check MongoDB and Redis subscriber status
    const dbState = this.connection.readyState;
    const dbConnected = dbState === 1;
    const redisConnected = this.deliveryService.isSubscriberConnected();
    const status = dbConnected && redisConnected ? 'healthy' : 'degraded';

    return {
      status,
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        mongodb: dbConnected ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
      },
    };
  }
}
