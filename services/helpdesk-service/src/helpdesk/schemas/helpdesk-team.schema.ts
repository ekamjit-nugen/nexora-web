import { Schema, Document } from 'mongoose';

export interface ISlaTier {
  responseMinutes: number;
  resolutionMinutes: number;
}

export interface IHelpdeskTeam extends Document {
  organizationId: string;
  name: string;
  description: string;
  category: string;
  members: Array<{ userId: string; name: string; role: 'lead' | 'agent' }>;
  workingHours: { start: string; end: string; timezone: string; daysOfWeek: number[] };
  slaPolicy: { critical: ISlaTier; high: ISlaTier; medium: ISlaTier; low: ISlaTier };
  autoAssign: boolean;
  lastAssignedIndex: number;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const HelpdeskTeamSchema = new Schema<IHelpdeskTeam>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    members: [{
      userId: { type: String, required: true },
      name: { type: String, default: '' },
      role: { type: String, enum: ['lead', 'agent'], default: 'agent' },
    }],
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },
    },
    slaPolicy: {
      critical: { responseMinutes: { type: Number, default: 15 }, resolutionMinutes: { type: Number, default: 120 } },
      high: { responseMinutes: { type: Number, default: 60 }, resolutionMinutes: { type: Number, default: 480 } },
      medium: { responseMinutes: { type: Number, default: 240 }, resolutionMinutes: { type: Number, default: 1440 } },
      low: { responseMinutes: { type: Number, default: 480 }, resolutionMinutes: { type: Number, default: 2880 } },
    },
    autoAssign: { type: Boolean, default: true },
    lastAssignedIndex: { type: Number, default: -1 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

HelpdeskTeamSchema.index({ organizationId: 1, category: 1 });
HelpdeskTeamSchema.index({ organizationId: 1, isActive: 1 });
