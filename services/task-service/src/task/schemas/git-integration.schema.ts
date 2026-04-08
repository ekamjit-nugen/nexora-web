import { Schema, Document } from 'mongoose';

export interface IGitLink {
  _id?: any;
  type: 'commit' | 'pull_request' | 'branch';
  provider: 'github' | 'gitlab' | 'bitbucket';
  url: string;
  title: string;
  status?: string;
  author: string;
  authorAvatar?: string;
  sha?: string;
  number?: number;
  repository: string;
  branch?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGitIntegrationConfig extends Document {
  organizationId: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  webhookSecret: string;
  webhookUrl?: string;
  isActive: boolean;
  lastWebhookAt?: Date;
  autoTransition: boolean;
  autoTransitionTarget: string;
  createdAt: Date;
  updatedAt: Date;
}

export const GitLinkSubSchema = {
  type: {
    type: String,
    enum: ['commit', 'pull_request', 'branch'],
    required: true,
  },
  provider: {
    type: String,
    enum: ['github', 'gitlab', 'bitbucket'],
    required: true,
  },
  url: { type: String, required: true },
  title: { type: String, required: true },
  status: { type: String, default: null },
  author: { type: String, required: true },
  authorAvatar: { type: String, default: null },
  sha: { type: String, default: null },
  number: { type: Number, default: null },
  repository: { type: String, required: true },
  branch: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
};

export const GitIntegrationConfigSchema = new Schema<IGitIntegrationConfig>(
  {
    organizationId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: ['github', 'gitlab', 'bitbucket'],
      required: true,
    },
    webhookSecret: { type: String, required: true },
    webhookUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastWebhookAt: { type: Date, default: null },
    autoTransition: { type: Boolean, default: false },
    autoTransitionTarget: { type: String, default: 'done' },
  },
  { timestamps: true },
);

GitIntegrationConfigSchema.index({ organizationId: 1, provider: 1 }, { unique: true });
