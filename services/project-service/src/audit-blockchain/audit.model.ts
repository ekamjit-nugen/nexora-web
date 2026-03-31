import { Schema, Document } from 'mongoose';

export interface IAuditBlock {
  blockNumber: number;
  blockHash: string;
  previousHash: string;
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  changes: Record<string, any>;
  nonce: number;
  merkleRoot: string;
}

export interface IAuditChain extends Document {
  productId: string;
  chainId: string;
  blocks: IAuditBlock[];
  lastBlockHash: string;
  totalBlocks: number;
  integrity: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLog extends Document {
  productId: string;
  blockNumber: number;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  resourceType: string;
  resourceId: string;
  userId: string;
  userName: string;
  changes: Record<string, any>;
  ipAddress: string;
  status: 'success' | 'failed';
  reason?: string;
  timestamp: Date;
  blockHash: string;
  createdAt: Date;
}

export interface IAuditVerification extends Document {
  productId: string;
  chainId: string;
  blockNumber: number;
  verified: boolean;
  verificationHash: string;
  verificationMethod: 'sha256' | 'merkle-tree' | 'timestamp';
  verifiedAt: Date;
  createdAt: Date;
}

const IAuditBlockSchema = {
  blockNumber: { type: Number, required: true },
  blockHash: { type: String, required: true },
  previousHash: String,
  timestamp: { type: Date, required: true },
  action: String,
  resourceType: String,
  resourceId: String,
  userId: String,
  changes: Schema.Types.Mixed,
  nonce: Number,
  merkleRoot: String,
};

export const AuditChainSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    chainId: { type: String, required: true, unique: true },
    blocks: [IAuditBlockSchema],
    lastBlockHash: String,
    totalBlocks: { type: Number, default: 0 },
    integrity: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const AuditLogSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    blockNumber: { type: Number, required: true },
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'execute'],
      required: true,
    },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: String,
    changes: Schema.Types.Mixed,
    ipAddress: String,
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    reason: String,
    timestamp: { type: Date, required: true },
    blockHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const AuditVerificationSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    chainId: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    verified: { type: Boolean, default: false },
    verificationHash: String,
    verificationMethod: {
      type: String,
      enum: ['sha256', 'merkle-tree', 'timestamp'],
    },
    verifiedAt: Date,
  },
  { timestamps: true },
);

AuditLogSchema.index({ productId: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });
AuditVerificationSchema.index({ productId: 1, chainId: 1 });
