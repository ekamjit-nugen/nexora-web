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
import { AuditLogSchema } from './auth/schemas/audit-log.schema';
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
  controllers: [AuthController, OrganizationController, PlatformAdminController],
  providers: [
    AuthService,
    OrganizationService,
    PlatformAdminService,
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
    SamlStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, OrganizationService, JwtModule],
})
export class AppModule {}

/*
 * When: Application module initialization
 * if: Configuration and database modules are available
 * then: Register all auth providers, strategies, and controllers
 */
