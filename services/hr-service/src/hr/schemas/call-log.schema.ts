import { Schema, Document } from 'mongoose';

export interface ICallLog extends Document {
  organizationId?: string;
  callerId: string;
  receiverId: string;
  callerName?: string;
  receiverName?: string;

  type: string; // 'audio' | 'video'
  status: string; // 'initiated' | 'ringing' | 'answered' | 'missed' | 'declined' | 'ended' | 'failed'

  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds

  notes?: string;

  // For future WebRTC
  roomId?: string;

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CallLogSchema = new Schema<ICallLog>(
  {
    organizationId: { type: String, default: null, index: true },
    callerId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    callerName: { type: String, default: null },
    receiverName: { type: String, default: null },

    type: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio',
    },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'answered', 'missed', 'declined', 'ended', 'failed'],
      default: 'initiated',
    },

    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: null },

    notes: { type: String, default: null },

    roomId: { type: String, default: null },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CallLogSchema.index({ callerId: 1, startTime: -1 });
CallLogSchema.index({ receiverId: 1, startTime: -1 });
CallLogSchema.index({ organizationId: 1, startTime: -1 });
CallLogSchema.index({ status: 1 });
