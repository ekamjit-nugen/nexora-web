import { Schema, Document } from 'mongoose';

export interface ISurveyQuestion {
  id: string;
  type: string;
  question: string;
  options?: string[];
  required: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface ISurveyStats {
  totalInvited: number;
  totalResponses: number;
  responseRate: number;
  lastResponseAt?: Date;
  enpsScore?: number;
  avgRating?: number;
}

export interface ISurvey extends Document {
  organizationId: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  isAnonymous: boolean;
  targetAudience: string;
  departments: string[];
  designations: string[];
  employeeIds: string[];
  questions: ISurveyQuestion[];
  startDate: Date;
  endDate: Date;
  allowComments: boolean;
  showResults: string;
  stats: ISurveyStats;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SurveySchema = new Schema<ISurvey>(
  {
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    type: {
      type: String,
      enum: ['poll', 'pulse', 'enps', '360_feedback', 'exit', 'engagement', 'custom'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed', 'archived'],
      default: 'draft',
    },
    isAnonymous: { type: Boolean, default: false },
    targetAudience: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    departments: { type: [String], default: [] },
    designations: { type: [String], default: [] },
    employeeIds: { type: [String], default: [] },
    questions: [
      {
        id: { type: String, required: true },
        type: {
          type: String,
          enum: ['single_choice', 'multi_choice', 'rating', 'nps', 'text', 'yes_no', 'scale'],
          required: true,
        },
        question: { type: String, required: true },
        options: { type: [String], default: [] },
        required: { type: Boolean, default: true },
        minValue: { type: Number, default: null },
        maxValue: { type: Number, default: null },
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    allowComments: { type: Boolean, default: true },
    showResults: {
      type: String,
      enum: ['never', 'after_submit', 'after_close', 'always'],
      default: 'after_close',
    },
    stats: {
      totalInvited: { type: Number, default: 0 },
      totalResponses: { type: Number, default: 0 },
      responseRate: { type: Number, default: 0 },
      lastResponseAt: { type: Date, default: null },
      enpsScore: { type: Number, default: null },
      avgRating: { type: Number, default: null },
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

SurveySchema.index({ organizationId: 1, status: 1 });
SurveySchema.index({ organizationId: 1, type: 1, startDate: -1 });
SurveySchema.index({ isDeleted: 1 });
