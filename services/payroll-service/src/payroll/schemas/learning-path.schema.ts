import { Schema, Document } from 'mongoose';

export interface ILearningPathCourse {
  courseId: string;
  order: number;
  isRequired: boolean;
}

export interface ILearningPath extends Document {
  organizationId: string;
  name: string;
  description: string;
  category: string;
  courses: ILearningPathCourse[];
  targetAudience: string;
  departments: string[];
  designations: string[];
  estimatedDurationDays: number;
  isMandatory: boolean;
  status: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const LearningPathSchema = new Schema<ILearningPath>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    courses: [
      {
        courseId: { type: String, required: true },
        order: { type: Number, default: 0 },
        isRequired: { type: Boolean, default: true },
      },
    ],
    targetAudience: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    departments: { type: [String], default: [] },
    designations: { type: [String], default: [] },
    estimatedDurationDays: { type: Number, default: 0 },
    isMandatory: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

LearningPathSchema.index({ organizationId: 1, status: 1 });
LearningPathSchema.index({ isDeleted: 1 });
