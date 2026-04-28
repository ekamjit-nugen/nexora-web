import { Schema, Document } from 'mongoose';

export interface IMatchedEmployee {
  userId: string;
  employeeId: string;
  name: string;
  matchScore: number;
  skills: string[];
  status: 'suggested' | 'approved' | 'rejected';
}

export interface IResourceRequest extends Document {
  organizationId: string;
  requestId: string;
  projectId: string;
  projectName: string;
  requestedBy: string;
  title: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperienceYears: number;
  allocationPercentage: number;
  startDate: Date;
  endDate: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'matched' | 'partially_filled' | 'closed' | 'cancelled';
  matchedEmployees: IMatchedEmployee[];
  notes: string;
  isDeleted: boolean;
  deletedAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ResourceRequestSchema = new Schema<IResourceRequest>(
  {
    organizationId: { type: String, required: true, index: true },
    requestId: { type: String, required: true },
    projectId: { type: String, required: true, index: true },
    projectName: { type: String, default: '' },
    requestedBy: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    requiredSkills: [{ type: String }],
    preferredSkills: [{ type: String }],
    minExperienceYears: { type: Number, default: 0 },
    allocationPercentage: { type: Number, default: 100 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'matched', 'partially_filled', 'closed', 'cancelled'],
      default: 'open',
    },
    matchedEmployees: [
      {
        userId: String,
        employeeId: String,
        name: String,
        matchScore: { type: Number, default: 0 },
        skills: [String],
        status: {
          type: String,
          enum: ['suggested', 'approved', 'rejected'],
          default: 'suggested',
        },
      },
    ],
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

ResourceRequestSchema.index({ organizationId: 1, status: 1 });
ResourceRequestSchema.index({ organizationId: 1, requestId: 1 }, { unique: true });
ResourceRequestSchema.index({ requiredSkills: 1 });
ResourceRequestSchema.index({ isDeleted: 1 });
