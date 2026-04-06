import { Schema, Document } from 'mongoose';

export interface ICallParticipant {
  userId: string;
  name?: string;
  status?: string;
  joinedAt: Date;
  leftAt?: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing?: boolean;
}

export interface ITransferEntry {
  fromUserId: string;
  toUserId: string;
  type: string;
  timestamp: Date;
}

export interface ICallRecording {
  enabled: boolean;
  startedBy?: string;
  startedAt?: Date;
  endedAt?: Date;
  fileId?: string;
  duration?: number;
}

export interface IQualityMetric {
  userId: string;
  avgBitrate?: number;
  avgPacketLoss?: number;
  avgLatency?: number;
  avgJitter?: number;
}

export interface ICall extends Document {
  organizationId: string;
  callId: string;
  initiatorId: string;
  participantIds: string[];
  type: string;
  mode: string;
  status: string;
  startTime?: Date;
  connectedAt?: Date;
  endTime?: Date;
  duration?: number;
  endedBy?: string;
  endReason?: string;
  participants: ICallParticipant[];
  transferHistory: ITransferEntry[];
  recording: ICallRecording;
  qualityMetrics: IQualityMetric[];
  conversationId?: string;
  rejectionReason?: string;
  notes?: string;
  metadata: {
    callQuality?: string;
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
    participantIds: [{ type: String, index: true }],
    type: { type: String, enum: ['audio', 'video'], default: 'audio' },
    mode: { type: String, enum: ['p2p', 'group'], default: 'p2p' },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connecting', 'connected', 'ended', 'missed', 'declined', 'failed'],
      default: 'initiated',
      index: true,
    },
    startTime: { type: Date, default: null },
    connectedAt: { type: Date, default: null },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: null },
    endedBy: { type: String, default: null },
    endReason: { type: String, enum: ['user_ended', 'no_answer', 'declined', 'network_error', null], default: null },
    participants: [{
      userId: { type: String, required: true },
      name: { type: String, default: null },
      status: { type: String, enum: ['ringing', 'connected', 'missed', 'declined', 'left', null], default: null },
      joinedAt: { type: Date, default: Date.now },
      leftAt: { type: Date, default: null },
      audioEnabled: { type: Boolean, default: true },
      videoEnabled: { type: Boolean, default: false },
      screenSharing: { type: Boolean, default: false },
    }],
    transferHistory: [{
      fromUserId: { type: String, required: true },
      toUserId: { type: String, required: true },
      type: { type: String, enum: ['cold', 'warm'], required: true },
      timestamp: { type: Date, default: Date.now },
    }],
    recording: {
      enabled: { type: Boolean, default: false },
      startedBy: { type: String, default: null },
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      fileId: { type: String, default: null },
      duration: { type: Number, default: null },
    },
    qualityMetrics: [{
      userId: { type: String, required: true },
      avgBitrate: { type: Number, default: null },
      avgPacketLoss: { type: Number, default: null },
      avgLatency: { type: Number, default: null },
      avgJitter: { type: Number, default: null },
    }],
    conversationId: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    notes: { type: String, default: null },
    metadata: {
      callQuality: { type: String, enum: ['good', 'acceptable', 'poor', null], default: null },
      bitrate: { type: Number, default: null },
      frameRate: { type: Number, default: null },
      packetLoss: { type: Number, default: null },
    },
  },
  { timestamps: true },
);

CallSchema.index({ organizationId: 1, createdAt: -1 });
CallSchema.index({ initiatorId: 1, status: 1 });
CallSchema.index({ participantIds: 1, status: 1 });
CallSchema.index({ mode: 1, status: 1 });
// Enhancement2 audit
CallSchema.index({ 'participants.userId': 1, status: 1, createdAt: -1 });
CallSchema.index({ organizationId: 1, mode: 1, status: 1 });
