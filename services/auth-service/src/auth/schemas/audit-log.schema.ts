import { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  performedBy: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}

export const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    performedBy: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
