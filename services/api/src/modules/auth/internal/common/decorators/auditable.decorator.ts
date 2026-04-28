import { SetMetadata } from '@nestjs/common';
export const AUDIT_KEY = 'audit';
export interface AuditMetadata { action: string; resource: string; }
export const Auditable = (action: string, resource: string) =>
  SetMetadata(AUDIT_KEY, { action, resource } as AuditMetadata);
