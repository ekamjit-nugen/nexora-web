import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

// Module-private CSRF middleware (was wired globally in the legacy
// auth-service AppModule; in the monolith it stays scoped to the
// routes registered by this module).
import { CsrfMiddleware } from './internal/common/middleware/csrf.middleware';

// Schemas — registered against the named connection AUTH_DB so that
// when this module is split out tomorrow, only the connection URI
// changes (not the schema declarations).
import { UserSchema } from './internal/auth/schemas/user.schema';
import { RoleSchema } from './internal/auth/schemas/role.schema';
import { OrganizationSchema } from './internal/auth/schemas/organization.schema';
import { OrgMembershipSchema } from './internal/auth/schemas/org-membership.schema';
import { SessionSchema } from './internal/auth/schemas/session.schema';
import { AuditLogSchema } from './internal/auth/schemas/audit-log.schema';
import { ReportTemplateSchema } from './internal/auth/schemas/report-template.schema';
import { ScheduledReportSchema } from './internal/auth/schemas/scheduled-report.schema';
import { TrustedDeviceSchema } from './internal/auth/schemas/trusted-device.schema';
import { ApiKeySchema } from './internal/auth/schemas/api-key.schema';
import { IntegrationSchema } from './internal/auth/schemas/integration.schema';
import { WebhookEndpointSchema } from './internal/auth/schemas/webhook-endpoint.schema';
import { BugReportSchema } from './internal/auth/schemas/bug-report.schema';

// Auth domain
import { AuthController } from './internal/auth/auth.controller';
import { AuthService } from './internal/auth/auth.service';

// GDPR
import { GdprController } from './internal/auth/gdpr.controller';
import { GdprService } from './internal/auth/gdpr.service';

// Organization
import { OrganizationController } from './internal/auth/organization.controller';
import { OrganizationService } from './internal/auth/organization.service';

// Settings
import { SettingsController } from './internal/auth/settings.controller';

// SCIM 2.0
import { ScimController } from './internal/auth/scim.controller';
import { ScimService } from './internal/auth/scim.service';

// Sub-services
import { OtpService } from './internal/auth/services/otp.service';
import { TokenService } from './internal/auth/services/token.service';
import { SessionService } from './internal/auth/services/session.service';
import { InviteService } from './internal/auth/services/invite.service';
import { MembershipService } from './internal/auth/services/membership.service';
import { CompletenessService } from './internal/auth/services/completeness.service';
import { HrSyncService } from './internal/auth/services/hr-sync.service';
import { DeviceFingerprintService } from './internal/auth/device-fingerprint.service';

// Audit
import { AuditService } from './internal/auth/audit.service';

// Developer / Integration marketplace
import { DeveloperController } from './internal/auth/developer.controller';
import { ApiKeyService } from './internal/auth/api-key.service';
import { WebhookEndpointService } from './internal/auth/webhook-endpoint.service';

// Platform
import { PlatformAdminController } from './internal/auth/platform-admin.controller';
import { BugReportController } from './internal/auth/bug-report.controller';
import { BugReportService } from './internal/auth/bug-report.service';
import { PlatformAdminService } from './internal/auth/platform-admin.service';
import { SystemHealthController } from './internal/auth/system-health.controller';
import { SystemHealthService } from './internal/auth/system-health.service';
import { ReportingController } from './internal/auth/reporting.controller';
import { ReportingService } from './internal/auth/reporting.service';

// Strategies
import { JwtStrategy } from './internal/auth/strategies/jwt.strategy';
import { GoogleStrategy } from './internal/auth/strategies/google.strategy';
import { MicrosoftStrategy } from './internal/auth/strategies/microsoft.strategy';
import { SamlStrategy } from './internal/auth/strategies/saml.strategy';

// Module-local guard (kept alongside the global one in bootstrap/auth/
// because auth-service's own controllers wire to this exact import path).
import { JwtAuthGuard } from './internal/auth/guards/jwt-auth.guard';

// Module-local health controller (was its own NestModule; here we
// import it as a plain controller).
import { HealthController } from './internal/health/health.controller';

// Public-API contract — the ONLY surface other modules may import.
import { AUTH_PUBLIC_API } from './public-api';
import { AuthPublicApiImpl } from './public-api/auth-public-api.impl';

import { AUTH_DB } from '../../bootstrap/database/database.tokens';

/**
 * AuthModule — first migrated module in the monolith.
 *
 * Mirrors the controllers/providers of the legacy services/auth-service/
 * AppModule but with three meaningful changes:
 *
 *  1. ConfigModule.forRoot, MongooseModule.forRoot, JwtModule.registerAsync,
 *     and PassportModule.register are NOT imported here — they are
 *     provided globally by BootstrapModule. Removing the duplication is
 *     the main perf win of monolith mode (no 18× duplicate connection
 *     pools / decoder instances).
 *
 *  2. MongooseModule.forFeature(...) takes AUTH_DB as its second arg
 *     so this module's schemas live on a named connection. Splitting
 *     the module to its own service later = swap one URI env var.
 *
 *  3. Exports AUTH_PUBLIC_API so other modules can call into auth WITHOUT
 *     importing internal/. Today's binding is the in-process impl;
 *     post-split, swap it for an HTTP client at the consumer side and
 *     no caller code changes.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Each module uses its OWN named Mongo connection (DatabaseModule
    // registers one per module with the right DB name appended to the
    // base MONGODB_URI). Same Mongo instance today; per-module URI
    // override env var ready when a module wants its own cluster
    // post-split. CRITICAL: every internal `@InjectModel('Name')` MUST
    // also pass AUTH_DB as the connection name — otherwise the model
    // resolves on the default (un-named) connection and reads/writes
    // go to the WRONG database.
    MongooseModule.forFeature(
      [
        { name: 'User', schema: UserSchema },
        { name: 'Role', schema: RoleSchema },
        { name: 'Organization', schema: OrganizationSchema },
        { name: 'OrgMembership', schema: OrgMembershipSchema },
        { name: 'Session', schema: SessionSchema },
        { name: 'AuditLog', schema: AuditLogSchema },
        { name: 'ReportTemplate', schema: ReportTemplateSchema },
        { name: 'ScheduledReport', schema: ScheduledReportSchema },
        { name: 'TrustedDevice', schema: TrustedDeviceSchema },
        { name: 'ApiKey', schema: ApiKeySchema },
        { name: 'Integration', schema: IntegrationSchema },
        { name: 'WebhookEndpoint', schema: WebhookEndpointSchema },
        { name: 'BugReport', schema: BugReportSchema },
      ],
      AUTH_DB,
    ),
  ],

  controllers: [
    AuthController,
    GdprController,
    OrganizationController,
    SettingsController,
    ScimController,
    DeveloperController,
    PlatformAdminController,
    SystemHealthController,
    ReportingController,
    BugReportController,
    HealthController,
  ],

  providers: [
    // Auth
    AuthService,
    // GDPR
    GdprService,
    // Organizations
    OrganizationService,
    // SCIM 2.0
    ScimService,
    // Developer / Integration Marketplace
    ApiKeyService,
    WebhookEndpointService,
    // Sub-services
    OtpService,
    TokenService,
    SessionService,
    InviteService,
    MembershipService,
    CompletenessService,
    HrSyncService,
    DeviceFingerprintService,
    // Audit
    AuditService,
    // Platform
    PlatformAdminService,
    BugReportService,
    SystemHealthService,
    ReportingService,
    // Strategies
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
    SamlStrategy,
    // Guards
    JwtAuthGuard,

    // === The split lever ===
    // Bind the public-API symbol to the in-process impl. When this
    // module is extracted to its own service, OTHER modules' app.module
    // change this to `useClass: AuthPublicApiHttpClient` — nothing here
    // moves.
    { provide: AUTH_PUBLIC_API, useClass: AuthPublicApiImpl },
  ],

  exports: [
    // Surface the public-API token for cross-module DI.
    AUTH_PUBLIC_API,
    // Legacy export kept for the duration of the monolith migration so
    // any in-monolith caller that hasn't been refactored to public-API
    // yet still works. Once all callers go through AUTH_PUBLIC_API,
    // remove this and the inline imports become impossible (which is
    // exactly what the boundary linter wants).
    AuthService,
    OrganizationService,
    AuditService,
    ReportingService,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CSRF protection — same wildcard scope as the legacy service.
    // Re-scope to specific routes if it ever interferes with bearer-
    // token-only modules (it shouldn't — CSRF only fires on cookie
    // auth flows).
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
