import { Schema, Document } from 'mongoose';

export interface ISprint extends Document {
  name: string;
  boardId: string;
  projectId: string;
  organizationId: string;
  goal: string;
  startDate: Date;
  endDate: Date;
  status: string;
  taskIds: string[];
  velocity: number;
  plannedPoints?: number;
  completedPoints?: number;
  retroNotes?: string;
  burndownData?: Array<{day: Date; remaining: number; ideal: number}>;
  spilloverPoints?: number;
  spilloverTaskIds?: string[];
  carryOverPoints?: number;
  carryOverTaskIds?: string[];
  carriedFromSprintId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SprintSchema = new Schema<ISprint>(
  {
    name: { type: String, required: true, trim: true },
    boardId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    organizationId: { type: String, default: null },
    goal: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['planning', 'active', 'completed'],
      default: 'planning',
    },
    taskIds: [{ type: String }],
    velocity: { type: Number, default: 0 },
    plannedPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
    retroNotes: { type: String, default: '' },
    burndownData: [{
      day: { type: Date },
      remaining: { type: Number },
      ideal: { type: Number },
    }],
    spilloverPoints: { type: Number, default: 0 },
    spilloverTaskIds: [{ type: String }],
    carryOverPoints: { type: Number, default: 0 },
    carryOverTaskIds: [{ type: String }],
    carriedFromSprintId: { type: String, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

SprintSchema.index({ boardId: 1, status: 1 });
SprintSchema.index({ projectId: 1, status: 1 });
