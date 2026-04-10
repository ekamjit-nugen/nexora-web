import { Schema, Document } from 'mongoose';

export interface IWebhookEndpoint extends Document {
  organizationId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  lastTriggeredAt?: Date;
  lastStatus?: number;
  lastError?: string;
  successCount: number;
  failureCount: number;
  createdBy: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const WebhookEndpointSchema = new Schema<IWebhookEndpoint>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    events: { type: [String], default: [] },
    secret: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date, default: null },
    lastStatus: { type: Number, default: null },
    lastError: { type: String, default: null },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    createdBy: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

WebhookEndpointSchema.index({ organizationId: 1, isActive: 1 });
WebhookEndpointSchema.index({ isDeleted: 1 });
