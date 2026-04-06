import { Schema, Document } from 'mongoose';

export interface IMeetingParticipant {
  userId?: string;
  displayName: string;
  email?: string;
  isAnonymous: boolean;
  isGuest?: boolean;
  role?: string;
  joinedAt?: Date;
  leftAt?: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised?: boolean;
  handRaisedAt?: Date;
}

export interface ITranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: Date;
}

export interface ILobbySettings {
  enabled: boolean;
  autoAdmit?: string;
  message?: string;
}

export interface ILobbyEntry {
  userId?: string;
  name: string;
  email?: string;
  requestedAt: Date;
}

export interface IRecurrencePattern {
  frequency: string;
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  endType: string;
  endAfterOccurrences?: number;
  endDate?: Date;
  exceptions?: Date[];
  timeZone?: string;
}

export interface IMeetingRecording {
  fileId?: string;
  type?: string;
  startedBy?: string;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
}

export interface IBreakoutRoom {
  id: string;
  name: string;
  participants: string[];
  status: string;
}

export interface IBreakoutSettings {
  autoAssign: boolean;
  allowReturn: boolean;
  timer?: number;
  hostCanJoinAny: boolean;
}

export interface IMeetingSettings {
  lobby: ILobbySettings;
  recording?: { autoStart: boolean; allowParticipantStart: boolean };
  allowAnonymous: boolean;
  maxParticipants: number;
  muteOnEntry: boolean;
  videoOffOnEntry: boolean;
  allowScreenShare: boolean;
  allowChat: boolean;
  allowReactions: boolean;
}

export interface IMeeting extends Document {
  organizationId: string;
  meetingId: string;
  title: string;
  description?: string;
  type: string;
  scheduledAt: Date;
  durationMinutes: number;
  timeZone?: string;
  hostId: string;
  hostName: string;
  coHostIds: string[];
  participantIds: string[];
  participants: IMeetingParticipant[];
  settings: IMeetingSettings;
  lobbyQueue: ILobbyEntry[];
  status: string;
  recordingEnabled: boolean;
  isRecording: boolean;
  recordingStartedAt?: Date;
  recordings: IMeetingRecording[];
  transcript: ITranscriptEntry[];
  chatConversationId?: string;
  joinPassword?: string;
  recurrence?: IRecurrencePattern;
  breakoutRooms: IBreakoutRoom[];
  breakoutSettings?: IBreakoutSettings;
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
    description: { type: String, default: null },
    type: {
      type: String,
      enum: ['instant', 'scheduled', 'recurring', 'webinar'],
      default: 'scheduled',
    },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    timeZone: { type: String, default: null },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String, default: null },
    coHostIds: [{ type: String }],
    participantIds: [{ type: String, index: true }],
    participants: [{
      userId: { type: String, default: null },
      displayName: { type: String, required: true },
      email: { type: String, default: null },
      isAnonymous: { type: Boolean, default: false },
      isGuest: { type: Boolean, default: false },
      role: { type: String, enum: ['host', 'co-host', 'presenter', 'attendee', null], default: 'attendee' },
      joinedAt: { type: Date, default: null },
      leftAt: { type: Date, default: null },
      audioEnabled: { type: Boolean, default: true },
      videoEnabled: { type: Boolean, default: true },
      handRaised: { type: Boolean, default: false },
      handRaisedAt: { type: Date, default: null },
    }],
    settings: {
      lobby: {
        enabled: { type: Boolean, default: false },
        autoAdmit: { type: String, enum: ['org_members', 'no_one', 'everyone', null], default: 'org_members' },
        message: { type: String, default: null },
      },
      recording: {
        autoStart: { type: Boolean, default: false },
        allowParticipantStart: { type: Boolean, default: false },
      },
      allowAnonymous: { type: Boolean, default: true },
      maxParticipants: { type: Number, default: 100 },
      muteOnEntry: { type: Boolean, default: false },
      videoOffOnEntry: { type: Boolean, default: false },
      allowScreenShare: { type: Boolean, default: true },
      allowChat: { type: Boolean, default: true },
      allowReactions: { type: Boolean, default: true },
    },
    lobbyQueue: [{
      userId: { type: String, default: null },
      name: { type: String, required: true },
      email: { type: String, default: null },
      requestedAt: { type: Date, default: Date.now },
    }],
    status: {
      type: String,
      enum: ['scheduled', 'lobby_open', 'active', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    recordingEnabled: { type: Boolean, default: false },
    isRecording: { type: Boolean, default: false },
    recordingStartedAt: { type: Date, default: null },
    recordings: [{
      fileId: { type: String, default: null },
      type: { type: String, default: null },
      startedBy: { type: String, default: null },
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      duration: { type: Number, default: null },
    }],
    transcript: [{
      speakerId: { type: String, required: true },
      speakerName: { type: String, required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    }],
    chatConversationId: { type: String, default: null },
    joinPassword: { type: String, default: null },
    recurrence: {
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly', null], default: null },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: String }],
      dayOfMonth: { type: Number, default: null },
      endType: { type: String, enum: ['never', 'after', 'on_date', null], default: null },
      endAfterOccurrences: { type: Number, default: null },
      endDate: { type: Date, default: null },
      exceptions: [{ type: Date }],
      timeZone: { type: String, default: null },
    },
    breakoutRooms: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      participants: [{ type: String }],
      status: { type: String, enum: ['pending', 'active', 'closed'], default: 'pending' },
    }],
    breakoutSettings: {
      autoAssign: { type: Boolean, default: false },
      allowReturn: { type: Boolean, default: true },
      timer: { type: Number, default: null },
      hostCanJoinAny: { type: Boolean, default: true },
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    sprintId: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

MeetingSchema.index({ organizationId: 1, scheduledAt: -1 });
MeetingSchema.index({ hostId: 1, status: 1 });
MeetingSchema.index({ participantIds: 1, status: 1 });
// Enhancement2 audit
MeetingSchema.index({ organizationId: 1, scheduledAt: 1, status: 1 });
MeetingSchema.index({ participantIds: 1, scheduledAt: 1 });
MeetingSchema.index({ 'recurrence.frequency': 1 });
