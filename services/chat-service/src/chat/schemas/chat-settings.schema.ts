import { Schema, Document } from 'mongoose';

export interface IChatSettings extends Document {
  userId: string;
  lastSeenAt: Date;
  readReceipts: {
    showMyReadStatus: boolean;
    showOthersReadStatus: boolean;
  };
  appearance: {
    chatBgColor: string;
    myBubbleColor: string;
    myTextColor: string;
    otherBubbleColor: string;
    otherTextColor: string;
    fontSize: string;
  };
  notifications: {
    sound: boolean;
    desktop: boolean;
    muteAll: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const ChatSettingsSchema = new Schema<IChatSettings>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    lastSeenAt: { type: Date },
    readReceipts: {
      showMyReadStatus: { type: Boolean, default: true },
      showOthersReadStatus: { type: Boolean, default: true },
    },
    appearance: {
      chatBgColor: { type: String, default: '#F8FAFC' },
      myBubbleColor: { type: String, default: '#2E86C1' },
      myTextColor: { type: String, default: '#FFFFFF' },
      otherBubbleColor: { type: String, default: '#F1F5F9' },
      otherTextColor: { type: String, default: '#334155' },
      fontSize: {
        type: String,
        enum: ['small', 'medium', 'large'],
        default: 'medium',
      },
    },
    notifications: {
      sound: { type: Boolean, default: true },
      desktop: { type: Boolean, default: true },
      muteAll: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);
