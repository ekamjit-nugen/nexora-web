import { Schema, Document } from 'mongoose';

export interface IDeviceToken extends Document {
  userId: string;
  platform: string;
  token: string;
  deviceId: string;
  appVersion?: string;
  lastUsedAt: Date;
  failCount: number;
  createdAt: Date;
}

export const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: String, required: true, index: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
    token: { type: String, required: true },
    deviceId: { type: String, required: true },
    appVersion: { type: String, default: null },
    lastUsedAt: { type: Date, default: Date.now },
    failCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

DeviceTokenSchema.index({ userId: 1, platform: 1 });
DeviceTokenSchema.index({ token: 1 }, { unique: true });
