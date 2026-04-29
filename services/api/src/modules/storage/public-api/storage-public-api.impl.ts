import { Injectable } from '@nestjs/common';
import { StoragePublicApi } from './storage-public-api';
import { StorageService } from '../internal/storage.service';

@Injectable()
export class StoragePublicApiImpl implements StoragePublicApi {
  constructor(private readonly storage: StorageService) {}
  getQuota(organizationId: string) {
    return this.storage.getQuota(organizationId);
  }
}
