/** Cross-module surface — let other modules check quota / store files. */
export interface StoragePublicApi {
  getQuota(organizationId: string): Promise<{
    quotaGb: number;
    quotaBytes: number;
    usedBytes: number;
    usedPercent: number;
    fileCount: number;
  }>;
}

export const STORAGE_PUBLIC_API = Symbol('STORAGE_PUBLIC_API');
