import { Schema, Document } from 'mongoose';

export interface IPipelineStage {
  stageName: string;
  stageOrder: number;
  stageType: string;
}

export interface IJobPosting extends Document {
  organizationId: string;
  title: string;
  departmentId?: string;
  designationId?: string;
  location: string;
  employmentType: string;
  experienceRange: { min: number; max: number };
  salaryRange?: { min: number; max: number; currency: string };
  description: string;
  requirements: string[];
  niceToHave: string[];
  skills: string[];
  openings: number;
  filledCount: number;
  hiringManagerId: string;
  recruiterId?: string;
  pipeline: IPipelineStage[];
  status: string;
  publishedAt?: Date;
  closedAt?: Date;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const JobPostingSchema = new Schema<IJobPosting>(
  {
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    departmentId: { type: String, default: null },
    designationId: { type: String, default: null },
    location: { type: String, required: true },
    employmentType: {
      type: String,
      required: true,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
    },
    experienceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    salaryRange: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      currency: { type: String, default: 'INR' },
    },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    niceToHave: [{ type: String }],
    skills: [{ type: String }],
    openings: { type: Number, default: 1 },
    filledCount: { type: Number, default: 0 },
    hiringManagerId: { type: String, required: true },
    recruiterId: { type: String, default: null },
    pipeline: [
      {
        stageName: { type: String, required: true },
        stageOrder: { type: Number, required: true },
        stageType: {
          type: String,
          required: true,
          enum: ['screening', 'assessment', 'interview', 'offer', 'hired'],
        },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'open', 'on_hold', 'closed', 'cancelled'],
      default: 'draft',
    },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

JobPostingSchema.index({ organizationId: 1, status: 1 });
JobPostingSchema.index({ isDeleted: 1 });
