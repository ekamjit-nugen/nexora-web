import { Schema, Document } from 'mongoose';

export interface IDndSchedule {
  enabled: boolean;
  schedule?: {
    type: string;
    daily?: { start: string; end: string };
    customDays?: Record<string, { start: string; end: string }>;
  };
  allowUrgent: boolean;
  allowFromList: string[];
}

export interface IOooConfig {
  enabled: boolean;
  message?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface IUserPresence extends Document {
  userId: string;
  organizationId: string;
  status: string;
  customEmoji?: string;
  customText?: string;
  customStatusExpiresAt?: Date;
  ooo: IOooConfig;
  dndSchedule: IDndSchedule;
  lastActiveAt: Date;
  lastHeartbeatAt: Date;
  updatedAt: Date;
}

export const UserPresenceSchema = new Schema<IUserPresence>(
  {
    userId: { type: String, required: true },
    organizationId: { type: String, required: true },
    status: {
      type: String,
      enum: ['online', 'away', 'busy', 'dnd', 'in_meeting', 'in_call', 'presenting', 'offline', 'ooo'],
      default: 'offline',
    },
    customEmoji: { type: String, default: null },
    customText: { type: String, default: null, maxlength: 100 },
    customStatusExpiresAt: { type: Date, default: null },
    ooo: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: null },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    dndSchedule: {
      enabled: { type: Boolean, default: false },
      schedule: { type: Schema.Types.Mixed, default: null },
      allowUrgent: { type: Boolean, default: true },
      allowFromList: [{ type: String }],
    },
    lastActiveAt: { type: Date, default: Date.now },
    lastHeartbeatAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

UserPresenceSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
