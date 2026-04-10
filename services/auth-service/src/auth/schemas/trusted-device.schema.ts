import { Schema, Document } from 'mongoose';

export interface ITrustedDevice extends Document {
  userId: string;
  organizationId?: string;
  deviceFingerprint: string;
  deviceName: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  loginCount: number;
  isTrusted: boolean;
  trustRevokedAt?: Date;
  trustRevokedBy?: string;
  trustRevokedReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TrustedDeviceSchema = new Schema<ITrustedDevice>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, default: null },
    deviceFingerprint: { type: String, required: true },
    deviceName: { type: String, required: true },
    browser: { type: String, default: null },
    browserVersion: { type: String, default: null },
    os: { type: String, default: null },
    osVersion: { type: String, default: null },
    ipAddress: { type: String, default: null },
    country: { type: String, default: null },
    city: { type: String, default: null },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    loginCount: { type: Number, default: 1 },
    isTrusted: { type: Boolean, default: true },
    trustRevokedAt: { type: Date, default: null },
    trustRevokedBy: { type: String, default: null },
    trustRevokedReason: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Indexes
TrustedDeviceSchema.index({ userId: 1, deviceFingerprint: 1 }, { unique: true });
TrustedDeviceSchema.index({ userId: 1, lastSeenAt: -1 });
TrustedDeviceSchema.index({ isDeleted: 1 });
