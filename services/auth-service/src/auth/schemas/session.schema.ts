import { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: string;
  refreshTokenFamily: string;
  deviceInfo: string;
  ipAddress: string;
  isRevoked: boolean;
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export const SessionSchema = new Schema<ISession>(
  {
    userId: { type: String, required: true, index: true },
    refreshTokenFamily: { type: String, required: true, unique: true },
    deviceInfo: { type: String, default: 'Unknown' },
    ipAddress: { type: String, default: null },
    isRevoked: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Auto-cleanup expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ userId: 1, isRevoked: 1 });
