import { Schema, Document } from 'mongoose';

export interface IIntegrationField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  required: boolean;
  mapping: string;
}

export interface IIntegration extends Document {
  productId: string;
  name: string;
  description: string;
  provider: string; // Slack, GitHub, Jira, etc.
  status: 'active' | 'inactive' | 'error';
  configuration: Record<string, any>;
  fieldMappings: IIntegrationField[];
  webhookUrl: string;
  webhookSecret: string;
  lastSync: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const IntegrationFieldSchema = new Schema({
  name: String,
  type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'array'] },
  required: Boolean,
  mapping: String,
});

export const IntegrationSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    provider: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive', 'error'], default: 'active' },
    configuration: Schema.Types.Mixed,
    fieldMappings: [IntegrationFieldSchema],
    webhookUrl: String,
    webhookSecret: String,
    lastSync: Date,
    errorMessage: String,
  },
  { timestamps: true },
);

IntegrationSchema.index({ productId: 1, provider: 1 });
IntegrationSchema.index({ status: 1 });
