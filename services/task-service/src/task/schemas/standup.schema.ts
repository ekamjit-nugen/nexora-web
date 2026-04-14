import { Schema, Document } from 'mongoose';

// ── Standup Config ──

export interface IStandupSchedule {
  frequency: 'daily' | 'weekdays' | 'custom';
  time: string;
  timezone: string;
  daysOfWeek?: number[];
}

export interface IStandup extends Document {
  organizationId: string;
  projectId: string;
  name: string;
  schedule: IStandupSchedule;
  questions: string[];
  participants: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const StandupSchema = new Schema<IStandup>(
  {
    organizationId: { type: String, required: true, index: true },
    projectId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    schedule: {
      frequency: { type: String, enum: ['daily', 'weekdays', 'custom'], default: 'weekdays' },
      time: { type: String, default: '09:00' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      daysOfWeek: [{ type: Number }],
    },
    questions: {
      type: [String],
      default: ['What did you do yesterday?', 'What will you do today?', 'Any blockers?'],
    },
    participants: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

StandupSchema.index({ organizationId: 1, isActive: 1 });
StandupSchema.index({ participants: 1 });

// ── Standup Response ──

export interface IStandupAnswer {
  question: string;
  answer: string;
}

export interface IStandupResponse extends Document {
  organizationId: string;
  standupId: string;
  userId: string;
  userName: string;
  date: Date;
  answers: IStandupAnswer[];
  submittedAt: Date;
  linkedTaskIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const StandupResponseSchema = new Schema<IStandupResponse>(
  {
    organizationId: { type: String, required: true, index: true },
    standupId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
    date: { type: Date, required: true },
    answers: [
      {
        question: { type: String, required: true },
        answer: { type: String, default: '' },
      },
    ],
    submittedAt: { type: Date, default: Date.now },
    linkedTaskIds: [{ type: String }],
  },
  { timestamps: true },
);

StandupResponseSchema.index({ standupId: 1, date: 1 });
StandupResponseSchema.index({ standupId: 1, userId: 1, date: 1 }, { unique: true });
