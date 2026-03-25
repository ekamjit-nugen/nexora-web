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
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

SprintSchema.index({ boardId: 1, status: 1 });
SprintSchema.index({ projectId: 1, status: 1 });
