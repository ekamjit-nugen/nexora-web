import { Schema, Document } from 'mongoose';

export interface INotificationPreferences extends Document {
  userId: string;
  organizationId: string;
  global: {
    desktop: boolean;
    mobile: boolean;
    sound: boolean;
    emailDigest: string;
  };
  dnd: {
    enabled: boolean;
    schedule: any;
    allowUrgent: boolean;
    allowFromList: string[];
  };
  overrides: Array<{
    conversationId: string;
    notify: string;
    sound: boolean;
    mutedUntil?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    userId: { type: String, required: true },
    organizationId: { type: String, required: true },
    global: {
      desktop: { type: Boolean, default: true },
      mobile: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      emailDigest: { type: String, enum: ['off', '15min', 'hourly', 'daily'], default: 'off' },
    },
    dnd: {
      enabled: { type: Boolean, default: false },
      schedule: { type: Schema.Types.Mixed, default: null },
      allowUrgent: { type: Boolean, default: true },
      allowFromList: [{ type: String }],
    },
    overrides: [{
      conversationId: { type: String, required: true },
      notify: { type: String, enum: ['all', 'mentions', 'nothing'], default: 'all' },
      sound: { type: Boolean, default: true },
      mutedUntil: { type: Date, default: null },
    }],
  },
  { timestamps: true },
);

NotificationPreferencesSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
