import { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  organizationId?: string;
  userId: string;
  performedBy?: string; // alias for userId (backward compat)
  targetUserId?: string;
  action: string;
  resource: string;
  targetType?: string; // alias for resource (backward compat)
  resourceId?: string;
  targetId?: string; // alias for resourceId (backward compat)
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  createdAt: Date;
}

export const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: String, default: null, index: true },
    userId: { type: String, default: null, index: true },
    performedBy: { type: String, default: null, index: true }, // backward compat
    targetUserId: { type: String, default: null },
    action: { type: String, required: true, index: true },
    resource: { type: String, default: null },
    targetType: { type: String, default: null }, // backward compat
    resourceId: { type: String, default: null },
    targetId: { type: String, default: null }, // backward compat
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1 });
// TTL: 365 days retention
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
