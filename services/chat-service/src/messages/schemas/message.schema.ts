import { Schema, Document } from 'mongoose';

export interface IMention {
  type: string;
  targetId: string;
  displayName: string;
  offset: number;
  length: number;
}

export interface ILinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  fetchedAt: Date;
}

export interface IReactionUser {
  userId: string;
  createdAt: Date;
}

export interface IReaction {
  emoji: string;
  users: IReactionUser[];
  count: number;
}

export interface IAttachment {
  fileId?: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  mimeType?: string;
  size: number;
}

export interface IReadReceipt {
  userId: string;
  readAt: Date;
}

export interface IThreadInfo {
  replyCount: number;
  participantIds: string[];
  lastReplyAt?: Date;
  lastReplyBy?: string;
  followers: string[];
}

export interface IEditHistoryEntry {
  content: string;
  editedAt: Date;
}

export interface IForwardedFrom {
  messageId: string;
  conversationId: string;
  conversationName?: string;
  senderId: string;
  senderName?: string;
}

export interface IPollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface IPoll {
  question: string;
  options: IPollOption[];
  settings: {
    multipleChoice: boolean;
    anonymous: boolean;
    expiresAt?: Date;
    allowAddOptions: boolean;
  };
  closedAt?: Date;
}

export interface ICardAction {
  type: string;
  text: string;
  url?: string;
  style?: string;
}

export interface ICardField {
  title: string;
  value: string;
  short?: boolean;
}

export interface ICard {
  title: string;
  text?: string;
  color?: string;
  actions?: ICardAction[];
  fields?: ICardField[];
}

export interface IDeliveryReceipt {
  userId: string;
  deliveredAt: Date;
}

export interface IMessage extends Document {
  conversationId: string;
  threadId?: string;
  senderId: string;
  senderName?: string;
  content?: string;
  contentPlainText?: string;
  type: string;
  replyTo: string;
  idempotencyKey?: string;
  status: string;
  deliveredTo: IDeliveryReceipt[];
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  attachments: IAttachment[];
  mentions: IMention[];
  linkPreviews: ILinkPreview[];
  reactions: IReaction[];
  readBy: IReadReceipt[];
  threadInfo?: IThreadInfo;
  editHistory: IEditHistoryEntry[];
  forwardedFrom?: IForwardedFrom;
  poll?: IPoll;
  card?: ICard;
  isEdited: boolean;
  editedAt: Date;
  isDeleted: boolean;
  deletedAt: Date;
  deletedBy?: string;
  isPinned: boolean;
  pinnedBy?: string;
  pinnedAt?: Date;
  priority: string;
  scheduledAt?: Date;
  isScheduled: boolean;
  isFlagged: boolean;
  flaggedAt?: Date;
  transcription?: string;
  botId?: string;
  webhookId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MentionSubSchema = new Schema({
  type: { type: String, enum: ['user', 'channel', 'here', 'all'], required: true },
  targetId: { type: String, required: true },
  displayName: { type: String, default: null },
  offset: { type: Number, default: 0 },
  length: { type: Number, default: 0 },
}, { _id: false });

const LinkPreviewSubSchema = new Schema({
  url: { type: String, required: true },
  title: { type: String, default: null },
  description: { type: String, default: null },
  imageUrl: { type: String, default: null },
  siteName: { type: String, default: null },
  fetchedAt: { type: Date, default: Date.now },
}, { _id: false });

const ReactionSubSchema = new Schema({
  emoji: { type: String, required: true },
  users: [{
    userId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  count: { type: Number, default: 0 },
}, { _id: false });

const ThreadInfoSubSchema = new Schema({
  replyCount: { type: Number, default: 0 },
  participantIds: [{ type: String }],
  lastReplyAt: { type: Date, default: null },
  lastReplyBy: { type: String, default: null },
  followers: [{ type: String }],
}, { _id: false });

const PollOptionSubSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  votes: [{ type: String }],
}, { _id: false });

const PollSubSchema = new Schema({
  question: { type: String, required: true },
  options: [PollOptionSubSchema],
  settings: {
    multipleChoice: { type: Boolean, default: false },
    anonymous: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    allowAddOptions: { type: Boolean, default: false },
  },
  closedAt: { type: Date, default: null },
}, { _id: false });

const CardSubSchema = new Schema({
  title: { type: String, required: true },
  text: { type: String, default: null },
  color: { type: String, default: null },
  actions: [{
    type: { type: String, required: true },
    text: { type: String, required: true },
    url: { type: String, default: null },
    style: { type: String, enum: ['primary', 'danger', 'default'], default: 'default' },
  }],
  fields: [{
    title: { type: String, required: true },
    value: { type: String, required: true },
    short: { type: Boolean, default: false },
  }],
}, { _id: false });

export const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    threadId: { type: String, default: null, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, default: null },
    content: { type: String, required: false, default: '' },
    contentPlainText: { type: String, default: null },
    type: {
      type: String,
      enum: ['text', 'file', 'image', 'video', 'audio', 'code', 'poll', 'card', 'meeting', 'call', 'forwarded', 'system', 'standup'],
      default: 'text',
    },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    fileMimeType: { type: String, default: null },
    replyTo: { type: String, default: null },
    idempotencyKey: { type: String },
    status: { type: String, enum: ['sending', 'sent', 'delivered', 'read', 'failed'], default: 'sent' },
    deliveredTo: [{
      userId: { type: String, required: true },
      deliveredAt: { type: Date, default: Date.now },
    }],
    attachments: [{
      fileId: { type: String, default: null },
      name: { type: String, required: true },
      url: { type: String, required: true },
      thumbnailUrl: { type: String, default: null },
      type: { type: String, required: true },
      mimeType: { type: String, default: null },
      size: { type: Number, required: true },
    }],
    mentions: [MentionSubSchema],
    linkPreviews: [LinkPreviewSubSchema],
    reactions: [ReactionSubSchema],
    readBy: [{
      userId: { type: String, required: true },
      readAt: { type: Date, default: Date.now },
    }],
    threadInfo: { type: ThreadInfoSubSchema, default: null },
    editHistory: [{
      content: { type: String, required: true },
      editedAt: { type: Date, default: Date.now },
    }],
    forwardedFrom: {
      messageId: { type: String, default: null },
      conversationId: { type: String, default: null },
      conversationName: { type: String, default: null },
      senderId: { type: String, default: null },
      senderName: { type: String, default: null },
    },
    poll: { type: PollSubSchema, default: null },
    card: { type: CardSubSchema, default: null },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    isPinned: { type: Boolean, default: false },
    pinnedBy: { type: String, default: null },
    pinnedAt: { type: Date, default: null },
    priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
    scheduledAt: { type: Date, default: null },
    isScheduled: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    flaggedAt: { type: Date, default: null },
    transcription: { type: String, default: null },
    botId: { type: String, default: null },
    webhookId: { type: String, default: null },
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, threadId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1 });
MessageSchema.index({ conversationId: 1, isPinned: 1, pinnedAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ contentPlainText: 'text' });
MessageSchema.index({ scheduledAt: 1, isScheduled: 1 });
// Additional indexes from enhancement2 audit
MessageSchema.index({ 'mentions.targetId': 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, type: 1, createdAt: -1 });
MessageSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
