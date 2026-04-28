import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { BootstrapAuthModule } from './auth/auth.module';
import { EventBusModule } from './events/event-bus.module';

/**
 * Aggregates all the cross-module infrastructure into a single import.
 * Feature modules don't import these directly — they import BootstrapModule
 * once at the app root, and inherit JwtService / EventBus / connections
 * via the @Global() declarations on the inner modules.
 *
 * Things in here are SHARED INFRASTRUCTURE. Things in src/modules/ are
 * BUSINESS DOMAINS. Don't blur the line — that's the rule that keeps
 * "monolith with split levers" from drifting into "ball of mud".
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    BootstrapAuthModule,
    EventBusModule,
  ],
  exports: [
    ConfigModule,
    DatabaseModule,
    BootstrapAuthModule,
    EventBusModule,
  ],
})
export class BootstrapModule {}
