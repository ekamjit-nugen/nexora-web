import { Schema, Document } from 'mongoose';

export interface IRetentionPolicy extends Document {
  organizationId: string;
  name: string;
  retentionDays: number;       // 0 = forever, 30/60/90/365/1095/1825/2555
  scope: string;                // 'all' | 'channels' | 'direct' | 'specific'
  conversationIds?: string[];   // If scope = 'specific'
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RetentionPolicySchema = new Schema<IRetentionPolicy>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    retentionDays: { type: Number, required: true, default: 0 },
    scope: { type: String, enum: ['all', 'channels', 'direct', 'specific'], default: 'all' },
    conversationIds: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

export interface ILegalHold extends Document {
  organizationId: string;
  name: string;
  description?: string;
  scope: string;                // 'user' | 'conversation' | 'org'
  targetUserIds?: string[];
  targetConversationIds?: string[];
  isActive: boolean;
  createdBy: string;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const LegalHoldSchema = new Schema<ILegalHold>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    scope: { type: String, enum: ['user', 'conversation', 'org'], default: 'conversation' },
    targetUserIds: [{ type: String }],
    targetConversationIds: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

LegalHoldSchema.index({ organizationId: 1, isActive: 1 });

export interface IDlpRule extends Document {
  organizationId: string;
  name: string;
  pattern: string;              // Regex pattern
  action: string;               // 'block' | 'warn' | 'flag' | 'redact'
  scope: string;                // 'all' | 'external' | 'channels_only'
  message?: string;             // User-facing message
  isActive: boolean;
  createdBy: string;
  triggeredCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const DlpRuleSchema = new Schema<IDlpRule>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    pattern: { type: String, required: true },
    action: { type: String, enum: ['block', 'warn', 'flag', 'redact'], default: 'flag' },
    scope: { type: String, enum: ['all', 'external', 'channels_only'], default: 'all' },
    message: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    triggeredCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
