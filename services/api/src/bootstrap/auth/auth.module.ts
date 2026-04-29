import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from './jwt-auth.guard';
import { FeatureGuard, FeatureLookupService } from './feature.guard';
import { OrganizationSchema } from '../../modules/auth/internal/auth/schemas/organization.schema';
import { AUTH_DB } from '../database/database.tokens';

/**
 * Global JWT setup. Exposes JwtService to every feature module so each
 * module can inject the same guard, sign tokens, etc.
 *
 * Marked @Global() so feature modules don't need to import it explicitly.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: {
          // `expiresIn` accepts a `ms`-style string ("15m", "7d") or a
          // number of seconds; @nestjs/jwt v11 narrowed the type to a
          // template literal, so we cast to satisfy the compiler while
          // keeping the runtime behaviour identical.
          expiresIn: (cfg.get<string>('JWT_EXPIRY') || '15m') as any,
        },
      }),
    }),
    // FeatureLookupService reads org.features.<key>.enabled. Cached
    // 30s — see feature.guard.ts.
    MongooseModule.forFeature(
      [{ name: 'Organization', schema: OrganizationSchema }],
      AUTH_DB,
    ),
  ],
  providers: [
    JwtAuthGuard,
    FeatureGuard,
    FeatureLookupService,
    // NOTE: we deliberately do NOT register JwtAuthGuard as APP_GUARD
    // because too much of the existing surface is intentionally public
    // (OTP send, health, webhooks). Each controller/handler opts in via
    // `@UseGuards(JwtAuthGuard)`. Use `@Public()` on individual handlers
    // if we ever flip the default.
  ],
  exports: [JwtModule, JwtAuthGuard, FeatureGuard, FeatureLookupService],
})
export class BootstrapAuthModule {}
