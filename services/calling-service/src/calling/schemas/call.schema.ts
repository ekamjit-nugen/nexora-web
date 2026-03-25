import { Schema, Document } from 'mongoose';

export interface ICallParticipant {
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface ICall extends Document {
  organizationId: string;
  callId: string;
  initiatorId: string;
  participantIds: string[];
  type: 'audio' | 'video';
  status: 'initiated' | 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected';
  startTime?: Date;
  endTime?: Date;
  duration?: number; // in seconds
  participants: ICallParticipant[];
  conversationId?: string;
  rejectionReason?: string;
  notes?: string;
  metadata: {
    callQuality?: 'good' | 'acceptable' | 'poor';
    bitrate?: number;
    frameRate?: number;
    packetLoss?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const CallSchema = new Schema<ICall>(
  {
    organizationId: { type: String, required: true, index: true },
    callId: { type: String, required: true, unique: true, index: true },
    initiatorId: { type: String, required: true, index: true },
    participantIds: { type: [String], required: true, index: true },
    type: { type: String, enum: ['audio', 'video'], required: true },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connected', 'ended', 'missed', 'rejected'],
      default: 'initiated',
      index: true,
    },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number }, // seconds
    participants: [
      {
        userId: String,
        joinedAt: Date,
        leftAt: Date,
        audioEnabled: Boolean,
        videoEnabled: Boolean,
      },
    ],
    conversationId: { type: String },
    rejectionReason: { type: String },
    notes: { type: String },
    metadata: {
      callQuality: { type: String, enum: ['good', 'acceptable', 'poor'] },
      bitrate: Number,
      frameRate: Number,
      packetLoss: Number,
    },
  },
  { timestamps: true },
);

// Compound indexes for common queries
CallSchema.index({ organizationId: 1, createdAt: -1 });
CallSchema.index({ initiatorId: 1, status: 1 });
CallSchema.index({ participantIds: 1, status: 1 });
