import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}

/*
 * When: Health module is imported
 * if: module dependencies are available
 * then: register health endpoint for service status checks
 */
