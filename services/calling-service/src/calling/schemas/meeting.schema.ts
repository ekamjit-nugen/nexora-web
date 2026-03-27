import { Schema, Document } from 'mongoose';

export interface IMeetingParticipant {
  userId?: string;
  displayName: string;
  isAnonymous: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface ITranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: Date;
}

export interface IMeeting extends Document {
  organizationId: string;
  meetingId: string; // UUID used in shareable link
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  hostId: string;
  hostName: string;
  participantIds: string[]; // invited registered user IDs
  participants: IMeetingParticipant[]; // actively joined (includes anonymous)
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  recordingEnabled: boolean;
  isRecording: boolean;
  recordingStartedAt?: Date;
  transcript: ITranscriptEntry[];
  startedAt?: Date;
  endedAt?: Date;
  sprintId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MeetingSchema = new Schema<IMeeting>(
  {
    organizationId: { type: String, required: true, index: true },
    meetingId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String, required: true },
    participantIds: { type: [String], default: [] },
    participants: [
      {
        userId: String,
        displayName: { type: String, required: true },
        isAnonymous: { type: Boolean, default: false },
        joinedAt: Date,
        leftAt: Date,
        audioEnabled: { type: Boolean, default: true },
        videoEnabled: { type: Boolean, default: false },
      },
    ],
    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    recordingEnabled: { type: Boolean, default: false },
    isRecording: { type: Boolean, default: false },
    recordingStartedAt: Date,
    transcript: [
      {
        speakerId: String,
        speakerName: String,
        text: String,
        timestamp: Date,
      },
    ],
    startedAt: Date,
    endedAt: Date,
    sprintId: { type: String, index: true },
  },
  { timestamps: true },
);

MeetingSchema.index({ organizationId: 1, scheduledAt: -1 });
MeetingSchema.index({ hostId: 1, status: 1 });
MeetingSchema.index({ participantIds: 1, status: 1 });
MeetingSchema.index({ sprintId: 1 });
