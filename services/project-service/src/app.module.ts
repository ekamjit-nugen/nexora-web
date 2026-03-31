import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectModule } from './project/project.module';
import { HealthModule } from './health/health.module';
import { RoleModule } from './rbac/role.module';
import { TenantModule } from './multi-tenant/tenant.module';
import { VersionModule } from './versioning/version.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { PWAModule } from './pwa/pwa.module';
import { AuditModule } from './audit-blockchain/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora_projects',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),
    ProjectModule,
    HealthModule,
    RoleModule,
    TenantModule,
    VersionModule,
    CollaborationModule,
    PWAModule,
    AuditModule,
  ],
})
export class AppModule {}
