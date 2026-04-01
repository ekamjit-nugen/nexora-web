import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { UserSchema } from './auth/schemas/user.schema';
import { RoleSchema } from './auth/schemas/role.schema';
import { OrganizationSchema } from './auth/schemas/organization.schema';
import { OrgMembershipSchema } from './auth/schemas/org-membership.schema';
import { OrganizationController } from './auth/organization.controller';
import { OrganizationService } from './auth/organization.service';
import { PlatformAdminController } from './auth/platform-admin.controller';
import { PlatformAdminService } from './auth/platform-admin.service';
import { SystemHealthController } from './auth/system-health.controller';
import { SystemHealthService } from './auth/system-health.service';
import { ReportingController } from './auth/reporting.controller';
import { ReportingService } from './auth/reporting.service';
import { AuditLogSchema } from './auth/schemas/audit-log.schema';
import { ReportTemplateSchema } from './auth/schemas/report-template.schema';
import { ScheduledReportSchema } from './auth/schemas/scheduled-report.schema';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { MicrosoftStrategy } from './auth/strategies/microsoft.strategy';
import { SamlStrategy } from './auth/strategies/saml.strategy';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
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
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Role', schema: RoleSchema },
      { name: 'Organization', schema: OrganizationSchema },
      { name: 'OrgMembership', schema: OrgMembershipSchema },
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'ReportTemplate', schema: ReportTemplateSchema },
      { name: 'ScheduledReport', schema: ScheduledReportSchema },
    ]),
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
    HealthModule,
  ],
  controllers: [AuthController, OrganizationController, PlatformAdminController, SystemHealthController, ReportingController],
  providers: [
    AuthService,
    OrganizationService,
    PlatformAdminService,
    SystemHealthService,
    ReportingService,
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
    SamlStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, OrganizationService, ReportingService, JwtModule],
})
export class AppModule {}

/*
 * When: Application module initialization
 * if: Configuration and database modules are available
 * then: Register all auth providers, strategies, and controllers
 */
