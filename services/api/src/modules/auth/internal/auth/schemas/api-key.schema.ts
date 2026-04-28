import { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  organizationId: string;
  name: string;
  prefix: string;
  keyHash: string;
  /** SHA-256(fullKey) for O(1) lookup. bcrypt keyHash is kept as secondary verification. */
  keyLookupHash?: string;
  scopes: string[];
  createdBy: string;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  expiresAt?: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
  rateLimit: number;
  usageCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ApiKeySchema = new Schema<IApiKey>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    prefix: { type: String, required: true },
    keyHash: { type: String, required: true },
    keyLookupHash: { type: String, default: null, index: true, sparse: true },
    scopes: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: null },
    revokeReason: { type: String, default: null },
    rateLimit: { type: Number, default: 1000 },
    usageCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ApiKeySchema.index({ organizationId: 1, isActive: 1 });
ApiKeySchema.index({ prefix: 1 }, { unique: true });
ApiKeySchema.index({ isDeleted: 1 });
