import { Schema, Document } from 'mongoose';

export interface IKeyResult {
  title: string;
  metric?: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  progress: number;
  status: string;
  notes?: string;
}

export interface IGoalCheckIn {
  date: Date;
  progress: number;
  notes: string;
  updatedBy: string;
}

export interface IGoal extends Document {
  organizationId: string;
  employeeId: string;
  cycleId?: string;
  title: string;
  description: string;
  type: string;
  category: string;
  status: string;
  priority: string;
  weightage: number;
  startDate: Date;
  targetDate: Date;
  completedAt?: Date;
  progress: number;
  keyResults: IKeyResult[];
  checkIns: IGoalCheckIn[];
  parentGoalId?: string;
  alignedGoals: string[];
  managerRating?: number;
  selfRating?: number;
  finalScore?: number;
  managerComment?: string;
  selfAssessment?: string;
  tags: string[];
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const GoalSchema = new Schema<IGoal>(
  {
    organizationId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    cycleId: { type: String, default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['individual', 'team', 'company', 'okr'],
      default: 'individual',
    },
    category: {
      type: String,
      enum: ['performance', 'learning', 'behavior', 'project', 'revenue', 'quality'],
      default: 'performance',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'achieved', 'missed', 'cancelled', 'deferred'],
      default: 'draft',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    weightage: { type: Number, default: 0, min: 0, max: 100 },
    startDate: { type: Date, required: true },
    targetDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    keyResults: [
      {
        title: { type: String, required: true },
        metric: { type: String, default: null },
        targetValue: { type: Number, required: true },
        currentValue: { type: Number, default: 0 },
        unit: { type: String, default: null },
        progress: { type: Number, default: 0, min: 0, max: 100 },
        status: {
          type: String,
          enum: ['not_started', 'in_progress', 'achieved', 'missed'],
          default: 'not_started',
        },
        notes: { type: String, default: null },
      },
    ],
    checkIns: [
      {
        date: { type: Date, required: true },
        progress: { type: Number, required: true },
        notes: { type: String, default: '' },
        updatedBy: { type: String, required: true },
      },
    ],
    parentGoalId: { type: String, default: null },
    alignedGoals: [{ type: String }],
    managerRating: { type: Number, default: null, min: 1, max: 5 },
    selfRating: { type: Number, default: null, min: 1, max: 5 },
    finalScore: { type: Number, default: null },
    managerComment: { type: String, default: null },
    selfAssessment: { type: String, default: null },
    tags: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

GoalSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
GoalSchema.index({ organizationId: 1, cycleId: 1 });
GoalSchema.index({ parentGoalId: 1 });
GoalSchema.index({ isDeleted: 1 });
