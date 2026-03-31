import { Schema, Document } from 'mongoose';

export interface IParticipant {
  userId: string;
  role: string;
  joinedAt: Date;
  lastReadAt: Date;
  muted: boolean;
  isPinned?: boolean;
}

export interface ILastMessage {
  content: string;
  senderId: string;
  sentAt: Date;
}

export interface IConversation extends Document {
  organizationId: string;
  type: string;
  name: string;
  description: string;
  avatar: string;
  participants: IParticipant[];
  lastMessage: ILastMessage;
  isArchived: boolean;
  createdBy: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = new Schema<IConversation>(
  {
    organizationId: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ['direct', 'group', 'channel'],
      default: 'direct',
    },
    name: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
    avatar: { type: String, default: null },
    participants: [
      {
        userId: { type: String, required: true },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member'],
          default: 'member',
        },
        joinedAt: { type: Date, default: Date.now },
        lastReadAt: { type: Date, default: Date.now },
        muted: { type: Boolean, default: false },
        isPinned: { type: Boolean, default: false },
      },
    ],
    lastMessage: {
      content: { type: String, default: null },
      senderId: { type: String, default: null },
      sentAt: { type: Date, default: null },
    },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ConversationSchema.index({ 'participants.userId': 1 });
ConversationSchema.index({ type: 1 });
ConversationSchema.index({ isDeleted: 1 });
ConversationSchema.index({ 'lastMessage.sentAt': -1 });
ConversationSchema.index({ 'participants.userId': 1, type: 1, isDeleted: 1 });
