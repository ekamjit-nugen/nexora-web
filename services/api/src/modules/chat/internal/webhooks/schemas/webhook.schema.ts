import { Schema, Document } from 'mongoose';

export interface IWebhook extends Document {
  organizationId: string;
  conversationId: string;
  type: string;             // 'incoming' | 'outgoing'
  name: string;
  avatarUrl?: string;
  webhookUrl: string;       // Incoming: the unique URL. Outgoing: the target URL.
  secretKey: string;        // HMAC verification
  events?: string[];        // Outgoing: which events to send
  isActive: boolean;
  lastUsedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const WebhookSchema = new Schema<IWebhook>(
  {
    organizationId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    type: { type: String, enum: ['incoming', 'outgoing'], required: true },
    name: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    webhookUrl: { type: String, required: true, unique: true },
    secretKey: { type: String, required: true },
    events: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

WebhookSchema.index({ webhookUrl: 1 });
