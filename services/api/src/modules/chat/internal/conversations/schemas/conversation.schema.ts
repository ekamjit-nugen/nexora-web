import { Schema, Document } from 'mongoose';

export interface IParticipant {
  userId: string;
  role: string;
  memberStatus: string; // 'active' | 'invited' | 'pending' — tracks if user has joined the platform
  joinedAt: Date;
  lastReadAt: Date;
  lastReadMessageId?: string;
  muted: boolean;
  mutedUntil?: Date;
  isPinned?: boolean;
  isStarred?: boolean;
  notifyPreference?: string;
}

export interface ILastMessage {
  _id?: string;
  content: string;
  senderId: string;
  senderName?: string;
  type?: string;
  sentAt: Date;
}

export interface IChannelSettings {
  whoCanPost?: string;
  whoCanMention?: string;
  whoCanPin?: string;
  threadRequirement?: string;
  slowModeSeconds?: number;
  autoArchiveDays?: number;
}

export interface IGuestAccess {
  enabled: boolean;
  guestIds: string[];
  inviteLink?: string;
  linkExpiresAt?: Date;
}

export interface IConversation extends Document {
  organizationId: string;
  type: string;
  channelType?: string;
  name: string;
  description: string;
  avatar: string;
  icon?: string;
  topic?: string;
  categoryId?: string;
  participants: IParticipant[];
  lastMessage: ILastMessage;
  messageCount: number;
  settings?: IChannelSettings;
  meetingId?: string;
  guestAccess?: IGuestAccess;
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
      enum: ['direct', 'group', 'channel', 'meeting_chat', 'self'],
      default: 'direct',
    },
    channelType: {
      type: String,
      enum: ['public', 'private', 'announcement', 'shared', null],
      default: null,
    },
    name: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
    avatar: { type: String, default: null },
    icon: { type: String, default: null },
    topic: { type: String, default: null, trim: true, maxlength: 250 },
    categoryId: { type: String, default: null, index: true },
    participants: [
      {
        userId: { type: String, required: true },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member'],
          default: 'member',
        },
        memberStatus: {
          type: String,
          enum: ['active', 'invited', 'pending'],
          default: 'active',
        },
        joinedAt: { type: Date, default: Date.now },
        lastReadAt: { type: Date, default: Date.now },
        lastReadMessageId: { type: String, default: null },
        muted: { type: Boolean, default: false },
        mutedUntil: { type: Date, default: null },
        isPinned: { type: Boolean, default: false },
        isStarred: { type: Boolean, default: false },
        notifyPreference: {
          type: String,
          enum: ['all', 'mentions', 'nothing'],
          default: 'all',
        },
      },
    ],
    lastMessage: {
      _id: { type: String, default: null },
      content: { type: String, default: null },
      senderId: { type: String, default: null },
      senderName: { type: String, default: null },
      type: { type: String, default: null },
      sentAt: { type: Date, default: null },
    },
    messageCount: { type: Number, default: 0 },
    settings: {
      whoCanPost: { type: String, enum: ['everyone', 'admins', null], default: null },
      whoCanMention: { type: String, enum: ['everyone', 'admins', null], default: null },
      whoCanPin: { type: String, enum: ['everyone', 'admins', null], default: null },
      threadRequirement: { type: String, enum: ['off', 'encouraged', 'required', null], default: null },
      slowModeSeconds: { type: Number, default: 0 },
      autoArchiveDays: { type: Number, default: 0 },
    },
    meetingId: { type: String, default: null },
    guestAccess: {
      enabled: { type: Boolean, default: false },
      guestIds: [{ type: String }],
      inviteLink: { type: String, default: null },
      linkExpiresAt: { type: Date, default: null },
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
ConversationSchema.index({ organizationId: 1, channelType: 1 });
ConversationSchema.index({ meetingId: 1 });
// Additional indexes from enhancement2 audit
ConversationSchema.index({ 'participants.userId': 1, 'lastMessage.sentAt': -1 });
ConversationSchema.index({ organizationId: 1, channelType: 1, isArchived: 1 });
ConversationSchema.index({ categoryId: 1, organizationId: 1 });
