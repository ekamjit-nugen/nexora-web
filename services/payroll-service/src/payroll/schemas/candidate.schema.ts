import { Schema, Document } from 'mongoose';

export interface IStageHistoryEntry {
  stage: string;
  enteredAt: Date;
  exitedAt?: Date;
  outcome?: string;
  feedback?: string;
  feedbackBy?: string;
}

export interface IInterviewFeedback {
  rating: number;
  strengths: string;
  weaknesses: string;
  recommendation: string;
  submittedBy: string;
  submittedAt: Date;
}

export interface IInterview {
  round: number;
  type: string;
  scheduledAt: Date;
  interviewerIds: string[];
  status: string;
  feedback?: IInterviewFeedback;
}

export interface IOffer {
  ctc: number;
  joiningDate: Date;
  designation: string;
  letterUrl?: string;
  status: string;
  sentAt?: Date;
  respondedAt?: Date;
}

export interface IParsedResume {
  skills: string[];
  experience: Array<{ company: string; role: string; duration: string }>;
  education: Array<{ institution: string; degree: string; year: number }>;
  totalExperienceYears: number;
  matchScore?: number;
}

export interface ICandidate extends Document {
  organizationId: string;
  jobPostingId: string;
  name: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  parsedResume?: IParsedResume;
  currentStage: string;
  stageHistory: IStageHistoryEntry[];
  interviews: IInterview[];
  offer?: IOffer;
  source: string;
  referredBy?: string;
  convertedToEmployeeId?: string;
  status: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CandidateSchema = new Schema<ICandidate>(
  {
    organizationId: { type: String, required: true, index: true },
    jobPostingId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    resumeUrl: { type: String, default: null },
    linkedinUrl: { type: String, default: null },
    parsedResume: {
      skills: [{ type: String }],
      experience: [
        {
          company: { type: String },
          role: { type: String },
          duration: { type: String },
        },
      ],
      education: [
        {
          institution: { type: String },
          degree: { type: String },
          year: { type: Number },
        },
      ],
      totalExperienceYears: { type: Number, default: 0 },
      matchScore: { type: Number, default: null },
    },
    currentStage: { type: String, default: 'new' },
    stageHistory: [
      {
        stage: { type: String, required: true },
        enteredAt: { type: Date, required: true },
        exitedAt: { type: Date, default: null },
        outcome: {
          type: String,
          enum: ['advanced', 'rejected', 'withdrawn'],
          default: null,
        },
        feedback: { type: String, default: null },
        feedbackBy: { type: String, default: null },
      },
    ],
    interviews: [
      {
        round: { type: Number, required: true },
        type: {
          type: String,
          required: true,
          enum: ['phone', 'video', 'onsite', 'panel', 'technical'],
        },
        scheduledAt: { type: Date, required: true },
        interviewerIds: [{ type: String }],
        status: {
          type: String,
          enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
          default: 'scheduled',
        },
        feedback: {
          rating: { type: Number },
          strengths: { type: String },
          weaknesses: { type: String },
          recommendation: {
            type: String,
            enum: ['strong_hire', 'hire', 'no_hire', 'strong_no_hire'],
          },
          submittedBy: { type: String },
          submittedAt: { type: Date },
        },
      },
    ],
    offer: {
      ctc: { type: Number },
      joiningDate: { type: Date },
      designation: { type: String },
      letterUrl: { type: String, default: null },
      status: {
        type: String,
        enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
        default: 'draft',
      },
      sentAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
    },
    source: {
      type: String,
      enum: ['portal', 'referral', 'linkedin', 'naukri', 'agency', 'direct', 'other'],
      default: 'direct',
    },
    referredBy: { type: String, default: null },
    convertedToEmployeeId: { type: String, default: null },
    status: {
      type: String,
      enum: ['new', 'screening', 'in_process', 'offered', 'hired', 'rejected', 'withdrawn'],
      default: 'new',
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

CandidateSchema.index({ organizationId: 1, jobPostingId: 1, email: 1 }, { unique: true });
CandidateSchema.index({ organizationId: 1, status: 1 });
CandidateSchema.index({ jobPostingId: 1, currentStage: 1 });
CandidateSchema.index({ isDeleted: 1 });
