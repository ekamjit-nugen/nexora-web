import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageController } from './internal/storage.controller';
import { StorageService } from './internal/storage.service';
import { StorageFileSchema } from './internal/schemas/storage-file.schema';
import { OrganizationSchema } from '../auth/internal/auth/schemas/organization.schema';
import { STORAGE_PUBLIC_API } from './public-api';
import { StoragePublicApiImpl } from './public-api/storage-public-api.impl';
import { STORAGE_DB, AUTH_DB } from '../../bootstrap/database/database.tokens';

/**
 * Storage module — per-tenant cloud file storage with quota.
 *
 * NOTE on the cross-module schema import:
 *   StorageService injects the Organization model (auth DB) to read
 *   and update org.storage.quotaGb / usedBytes. This is a justified
 *   exception to the boundary rule because:
 *     (a) we register the schema on the AUTH_DB connection here, so
 *         we don't double-write — auth-module's writes go to the
 *         same connection and stay consistent.
 *     (b) we only TOUCH the `storage` sub-document, not other org
 *         fields. The auth module owns the rest of the org doc.
 *   Long-term cleanup: expose `auth.publicApi.setOrgStorageQuota()`
 *   so storage doesn't import auth's schema. For now, this single
 *   exception is documented and ESLint-justified.
 */
@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'StorageFile', schema: StorageFileSchema }],
      STORAGE_DB,
    ),
    MongooseModule.forFeature(
      [{ name: 'Organization', schema: OrganizationSchema }],
      AUTH_DB,
    ),
  ],
  controllers: [StorageController],
  providers: [
    StorageService,
    { provide: STORAGE_PUBLIC_API, useClass: StoragePublicApiImpl },
  ],
  exports: [STORAGE_PUBLIC_API, StorageService],
})
export class StorageModule {}
