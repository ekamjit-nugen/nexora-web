import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// The legacy project-service had 9 sub-modules under src/. Each is
// already a NestModule; we just import them all here. The forFeature
// calls inside each sub-module have been bulk-patched to use the
// PROJECT_DB ('nexora_projects') named connection so reads/writes go
// to the same DB the legacy service uses.
import { ProjectModule as InternalProjectModule } from './internal/project/project.module';
import { RoleModule } from './internal/rbac/role.module';
import { TenantModule } from './internal/multi-tenant/tenant.module';
import { VersionModule } from './internal/versioning/version.module';
import { CollaborationModule } from './internal/collaboration/collaboration.module';
import { PWAModule } from './internal/pwa/pwa.module';
import { AuditModule } from './internal/audit-blockchain/audit.module';
import { ProjectTemplateModule } from './internal/project-template/project-template.module';

import { HealthController } from './internal/health/health.controller';

import { ProjectSchema } from './internal/project/schemas/project.schema';
import { PROJECT_PUBLIC_API } from './public-api';
import { ProjectPublicApiImpl } from './public-api/project-public-api.impl';
import { PROJECT_DB } from '../../bootstrap/database/database.tokens';

@Module({
  imports: [
    ProjectTemplateModule,
    InternalProjectModule,
    RoleModule,
    TenantModule,
    VersionModule,
    CollaborationModule,
    PWAModule,
    AuditModule,
    // Wrapper-scoped schema reg so ProjectPublicApiImpl can inject it.
    MongooseModule.forFeature(
      [{ name: 'Project', schema: ProjectSchema }],
      PROJECT_DB,
    ),
  ],
  controllers: [HealthController],
  providers: [
    { provide: PROJECT_PUBLIC_API, useClass: ProjectPublicApiImpl },
  ],
  exports: [PROJECT_PUBLIC_API],
})
export class ProjectModule {}
