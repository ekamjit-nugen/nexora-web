import { Schema, Document } from 'mongoose';

export interface ICompetencyRating {
  name: string;
  rating: number;
  comment?: string;
}

export interface ISelfReview {
  overallRating: number;
  strengths: string;
  improvements: string;
  achievements: string;
  challenges: string;
  competencyRatings: ICompetencyRating[];
  submittedAt: Date;
}

export interface IPeerReview {
  reviewerId: string;
  relationship: string;
  overallRating: number;
  strengths: string;
  improvements: string;
  competencyRatings: ICompetencyRating[];
  isAnonymous: boolean;
  submittedAt: Date;
}

export interface IManagerReview {
  overallRating: number;
  strengths: string;
  improvements: string;
  goalAchievement: string;
  developmentPlan: string;
  promotionRecommendation: string;
  salaryIncreaseRecommendation: string;
  competencyRatings: ICompetencyRating[];
  submittedAt: Date;
}

export interface IPerformanceReview extends Document {
  organizationId: string;
  cycleId: string;
  employeeId: string;
  managerId?: string;
  status: string;
  goalIds: string[];
  selfReview?: ISelfReview;
  peerReviews: IPeerReview[];
  managerReview?: IManagerReview;
  finalRating?: number;
  finalLabel?: string;
  finalizedBy?: string;
  finalizedAt?: Date;
  calibrationNotes?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompetencyRatingSchema = {
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, default: null },
};

export const PerformanceReviewSchema = new Schema<IPerformanceReview>(
  {
    organizationId: { type: String, required: true, index: true },
    cycleId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    managerId: { type: String, default: null },
    status: {
      type: String,
      enum: [
        'pending',
        'goal_setting',
        'self_review_pending',
        'self_review_completed',
        'peer_review_pending',
        'peer_review_completed',
        'manager_review_pending',
        'manager_review_completed',
        'calibration',
        'finalized',
        'cancelled',
      ],
      default: 'pending',
    },
    goalIds: [{ type: String }],
    selfReview: {
      type: {
        overallRating: { type: Number, required: true },
        strengths: { type: String, default: '' },
        improvements: { type: String, default: '' },
        achievements: { type: String, default: '' },
        challenges: { type: String, default: '' },
        competencyRatings: [CompetencyRatingSchema],
        submittedAt: { type: Date, required: true },
      },
      default: null,
    },
    peerReviews: [
      {
        reviewerId: { type: String, required: true },
        relationship: {
          type: String,
          enum: ['peer', 'cross_functional', 'skip_level', 'subordinate'],
          required: true,
        },
        overallRating: { type: Number, required: true },
        strengths: { type: String, default: '' },
        improvements: { type: String, default: '' },
        competencyRatings: [CompetencyRatingSchema],
        isAnonymous: { type: Boolean, default: true },
        submittedAt: { type: Date, required: true },
      },
    ],
    managerReview: {
      type: {
        overallRating: { type: Number, required: true },
        strengths: { type: String, default: '' },
        improvements: { type: String, default: '' },
        goalAchievement: { type: String, default: '' },
        developmentPlan: { type: String, default: '' },
        promotionRecommendation: {
          type: String,
          enum: ['yes', 'no', 'consider_next_cycle'],
          default: 'no',
        },
        salaryIncreaseRecommendation: {
          type: String,
          enum: ['no_change', 'small', 'medium', 'large'],
          default: 'no_change',
        },
        competencyRatings: [CompetencyRatingSchema],
        submittedAt: { type: Date, required: true },
      },
      default: null,
    },
    finalRating: { type: Number, default: null },
    finalLabel: { type: String, default: null },
    finalizedBy: { type: String, default: null },
    finalizedAt: { type: Date, default: null },
    calibrationNotes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

PerformanceReviewSchema.index(
  { organizationId: 1, cycleId: 1, employeeId: 1 },
  { unique: true },
);
PerformanceReviewSchema.index({ organizationId: 1, managerId: 1, status: 1 });
PerformanceReviewSchema.index({ isDeleted: 1 });
