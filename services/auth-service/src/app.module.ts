import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

// Schemas (shared across all domain modules)
import { UserSchema } from './auth/schemas/user.schema';
import { RoleSchema } from './auth/schemas/role.schema';
import { OrganizationSchema } from './auth/schemas/organization.schema';
import { OrgMembershipSchema } from './auth/schemas/org-membership.schema';
import { SessionSchema } from './auth/schemas/session.schema';
import { AuditLogSchema } from './auth/schemas/audit-log.schema';
import { ReportTemplateSchema } from './auth/schemas/report-template.schema';
import { ScheduledReportSchema } from './auth/schemas/scheduled-report.schema';

// Auth domain
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';

// Organization domain
import { OrganizationController } from './auth/organization.controller';
import { OrganizationService } from './auth/organization.service';

// Settings domain
import { SettingsController } from './auth/settings.controller';

// Extracted sub-services
import { OtpService } from './auth/services/otp.service';
import { TokenService } from './auth/services/token.service';
import { SessionService } from './auth/services/session.service';
import { InviteService } from './auth/services/invite.service';
import { MembershipService } from './auth/services/membership.service';
import { CompletenessService } from './auth/services/completeness.service';
import { HrSyncService } from './auth/services/hr-sync.service';

// Audit domain
import { AuditService } from './auth/audit.service';

// Platform domain
import { PlatformAdminController } from './auth/platform-admin.controller';
import { PlatformAdminService } from './auth/platform-admin.service';
import { SystemHealthController } from './auth/system-health.controller';
import { SystemHealthService } from './auth/system-health.service';
import { ReportingController } from './auth/reporting.controller';
import { ReportingService } from './auth/reporting.service';

// Strategies
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { MicrosoftStrategy } from './auth/strategies/microsoft.strategy';
import { SamlStrategy } from './auth/strategies/saml.strategy';

// Guards
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Health
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora_auth',
        retryAttempts: 5,
        retryDelay: 5000,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),

    // Shared Mongoose schemas (available to all controllers/services)
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Role', schema: RoleSchema },
      { name: 'Organization', schema: OrganizationSchema },
      { name: 'OrgMembership', schema: OrgMembershipSchema },
      { name: 'Session', schema: SessionSchema },
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'ReportTemplate', schema: ReportTemplateSchema },
      { name: 'ScheduledReport', schema: ScheduledReportSchema },
    ]),

    // Auth infrastructure
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRY') || '15m',
        },
      }),
    }),

    // Health
    HealthModule,
  ],

  // Domain controllers
  controllers: [
    // Auth
    AuthController,
    // Organizations
    OrganizationController,
    // Settings
    SettingsController,
    // Platform
    PlatformAdminController,
    SystemHealthController,
    ReportingController,
  ],

  // Domain providers
  providers: [
    // Auth
    AuthService,
    // Organizations
    OrganizationService,
    // Extracted sub-services
    OtpService,
    TokenService,
    SessionService,
    InviteService,
    MembershipService,
    CompletenessService,
    HrSyncService,
    // Audit
    AuditService,
    // Platform
    PlatformAdminService,
    SystemHealthService,
    ReportingService,
    // Strategies
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
    SamlStrategy,
    // Guards
    JwtAuthGuard,
  ],

  // Exports for other modules that might need them
  exports: [AuthService, OrganizationService, AuditService, ReportingService, JwtModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
