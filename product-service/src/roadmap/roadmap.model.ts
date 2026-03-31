import { Schema, Document } from 'mongoose';

export interface IMilestone {
  id: string;
  name: string;
  targetDate: Date;
  status: 'planned' | 'inProgress' | 'completed' | 'delayed';
  description: string;
}

export interface IRoadmapPhase {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed';
  features: string[];
  milestones: IMilestone[];
}

export interface IRoadmap extends Document {
  productId: string;
  name: string;
  description: string;
  phases: IRoadmapPhase[];
  startDate: Date;
  endDate: Date;
  visibility: 'private' | 'internal' | 'public';
  createdAt: Date;
  updatedAt: Date;
}

export const RoadmapSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    phases: [
      {
        id: String,
        name: String,
        startDate: Date,
        endDate: Date,
        status: String,
        features: [String],
        milestones: [
          {
            id: String,
            name: String,
            targetDate: Date,
            status: String,
            description: String,
          },
        ],
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    visibility: { type: String, enum: ['private', 'internal', 'public'], default: 'internal' },
  },
  { timestamps: true },
);

RoadmapSchema.index({ productId: 1 });
RoadmapSchema.index({ visibility: 1 });
RoadmapSchema.index({ createdAt: -1 });
