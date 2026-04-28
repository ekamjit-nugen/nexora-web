import { Schema, Document } from 'mongoose';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface IIntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  webhookSecret?: string;
}

export interface IIntegration extends Document {
  organizationId: string;
  provider: string;
  status: IntegrationStatus;
  connectedAt?: Date;
  connectedBy: string;
  credentials: IIntegrationCredentials;
  config: Record<string, unknown>;
  events: string[];
  lastSyncAt?: Date;
  lastError?: string;
  errorCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const IntegrationSchema = new Schema<IIntegration>(
  {
    organizationId: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'pending'],
      default: 'pending',
    },
    connectedAt: { type: Date, default: null },
    connectedBy: { type: String, default: null },
    credentials: {
      accessToken: { type: String, select: false, default: null },
      refreshToken: { type: String, select: false, default: null },
      expiresAt: { type: Date, default: null },
      webhookSecret: { type: String, select: false, default: null },
    },
    config: { type: Schema.Types.Mixed, default: {} },
    events: { type: [String], default: [] },
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    errorCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

IntegrationSchema.index(
  { organizationId: 1, provider: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
IntegrationSchema.index({ organizationId: 1, status: 1 });
IntegrationSchema.index({ isDeleted: 1 });
