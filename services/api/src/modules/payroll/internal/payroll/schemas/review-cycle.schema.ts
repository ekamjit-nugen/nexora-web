import { Schema, Document } from 'mongoose';

export interface IRatingGuideEntry {
  rating: number;
  label: string;
  description: string;
}

export interface ICompetency {
  name: string;
  description: string;
  weightage: number;
}

export interface IReviewCycleConfig {
  enableSelfReview: boolean;
  enablePeerReview: boolean;
  enableManagerReview: boolean;
  enable360: boolean;
  minPeerReviewers: number;
  maxPeerReviewers: number;
  ratingScale: number;
  enableCalibration: boolean;
  allowGoalRevisions: boolean;
}

export interface IReviewCycleStats {
  totalEmployees: number;
  goalsSubmitted: number;
  selfReviewsCompleted: number;
  peerReviewsCompleted: number;
  managerReviewsCompleted: number;
  finalized: number;
}

export interface IReviewCycle extends Document {
  organizationId: string;
  name: string;
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  goalSettingDeadline?: Date;
  selfReviewDeadline?: Date;
  peerReviewDeadline?: Date;
  managerReviewDeadline?: Date;
  completionDeadline?: Date;
  applicableTo: string;
  departments: string[];
  designations: string[];
  employeeIds: string[];
  config: IReviewCycleConfig;
  ratingGuide: IRatingGuideEntry[];
  competencies: ICompetency[];
  stats: IReviewCycleStats;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ReviewCycleSchema = new Schema<IReviewCycle>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['annual', 'half_yearly', 'quarterly', 'monthly', 'continuous', 'adhoc'],
      default: 'annual',
    },
    status: {
      type: String,
      enum: [
        'draft',
        'goal_setting',
        'self_review',
        'peer_review',
        'manager_review',
        'calibration',
        'completed',
        'cancelled',
      ],
      default: 'draft',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    goalSettingDeadline: { type: Date, default: null },
    selfReviewDeadline: { type: Date, default: null },
    peerReviewDeadline: { type: Date, default: null },
    managerReviewDeadline: { type: Date, default: null },
    completionDeadline: { type: Date, default: null },
    applicableTo: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    departments: [{ type: String }],
    designations: [{ type: String }],
    employeeIds: [{ type: String }],
    config: {
      enableSelfReview: { type: Boolean, default: true },
      enablePeerReview: { type: Boolean, default: true },
      enableManagerReview: { type: Boolean, default: true },
      enable360: { type: Boolean, default: false },
      minPeerReviewers: { type: Number, default: 3 },
      maxPeerReviewers: { type: Number, default: 5 },
      ratingScale: { type: Number, default: 5 },
      enableCalibration: { type: Boolean, default: false },
      allowGoalRevisions: { type: Boolean, default: true },
    },
    ratingGuide: [
      {
        rating: { type: Number, required: true },
        label: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
    competencies: [
      {
        name: { type: String, required: true },
        description: { type: String, default: '' },
        weightage: { type: Number, default: 0 },
      },
    ],
    stats: {
      totalEmployees: { type: Number, default: 0 },
      goalsSubmitted: { type: Number, default: 0 },
      selfReviewsCompleted: { type: Number, default: 0 },
      peerReviewsCompleted: { type: Number, default: 0 },
      managerReviewsCompleted: { type: Number, default: 0 },
      finalized: { type: Number, default: 0 },
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

ReviewCycleSchema.index({ organizationId: 1, status: 1 });
ReviewCycleSchema.index({ organizationId: 1, startDate: -1 });
ReviewCycleSchema.index({ isDeleted: 1 });
