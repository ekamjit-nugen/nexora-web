import { Schema, Document } from 'mongoose';

export interface IReaction {
  emoji: string;
  userId: string;
}

export interface IAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface IReadReceipt {
  userId: string;
  readAt: Date;
}

export interface IClipData {
  clipId: string;
  mediaUrl: string;
  thumbnailUrl: string;
  duration: number;
  transcription: string;
}

export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  replyTo: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  clip?: IClipData;
  reactions: IReaction[];
  attachments: IAttachment[];
  isEdited: boolean;
  editedAt: Date;
  isDeleted: boolean;
  deletedAt: Date;
  readBy: IReadReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'file', 'image', 'video', 'clip', 'system'],
      default: 'text',
    },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    fileMimeType: { type: String, default: null },
    clip: {
      type: {
        clipId: { type: String },
        mediaUrl: { type: String },
        thumbnailUrl: { type: String },
        duration: { type: Number },
        transcription: { type: String },
      },
      default: null,
    },
    replyTo: { type: String, default: null },
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: String, required: true },
      },
    ],
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    readBy: [
      {
        userId: { type: String, required: true },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1 });
MessageSchema.index({ content: 'text' });
