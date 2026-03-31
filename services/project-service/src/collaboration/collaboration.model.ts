import { Schema, Document } from 'mongoose';

export interface ICollaborationSession extends Document {
  productId: string;
  sessionId: string;
  resourceType: string;
  resourceId: string;
  activeUsers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICollaborativeEdit extends Document {
  sessionId: string;
  productId: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  operation: 'insert' | 'delete' | 'update' | 'move';
  path: string;
  value: any;
  timestamp: Date;
  clientId: string;
  version: number;
  createdAt: Date;
}

export interface IConflictResolution extends Document {
  productId: string;
  conflictId: string;
  sessionId: string;
  edits: any[];
  strategy: 'last-write-wins' | 'first-write-wins' | 'merge' | 'manual';
  resolution: Record<string, any>;
  resolvedBy: string;
  resolvedAt: Date;
  createdAt: Date;
}

export interface ICursorPosition {
  userId: string;
  username: string;
  position: { line: number; column: number };
  timestamp: Date;
  color: string;
}

export const CollaborationSessionSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    activeUsers: [String],
  },
  { timestamps: true },
);

export const CollaborativeEditSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    operation: { type: String, enum: ['insert', 'delete', 'update', 'move'], required: true },
    path: String,
    value: Schema.Types.Mixed,
    timestamp: Date,
    clientId: String,
    version: Number,
  },
  { timestamps: true },
);

export const ConflictResolutionSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    conflictId: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true },
    edits: [Schema.Types.Mixed],
    strategy: { type: String, enum: ['last-write-wins', 'first-write-wins', 'merge', 'manual'] },
    resolution: Schema.Types.Mixed,
    resolvedBy: String,
    resolvedAt: Date,
  },
  { timestamps: true },
);

CollaborationSessionSchema.index({ productId: 1, resourceType: 1, resourceId: 1 });
CollaborativeEditSchema.index({ sessionId: 1, userId: 1 });
CollaborativeEditSchema.index({ productId: 1, timestamp: -1 });
ConflictResolutionSchema.index({ productId: 1, sessionId: 1 });
