import * as mongoose from 'mongoose';
import { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  organizationId?: string;
  projectName: string;
  projectKey?: string;
  description?: string;
  category?: string;
  clientId?: string;
  startDate?: Date;
  endDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: string;
  priority: string;
  departmentId?: string;
  budget?: {
    amount: number;
    currency: string;
    billingType: string;
    hourlyRate?: number;
    spent: number;
    retainerAmount?: number;
  };
  team: Array<{
    userId: string;
    role: string;
    projectRole?: string;
    skills?: string[];
    allocationPercentage: number;
    assignedAt: Date;
  }>;
  milestones: Array<{
    _id?: any;
    name: string;
    targetDate: Date;
    completedDate?: Date;
    status: string;
    description?: string;
    phase?: string;
    deliverables?: string[];
    dependencies?: any[];
    ownerId?: string;
    linkedTaskIds?: string[];
    order?: number;
  }>;
  risks: Array<{
    _id?: any;
    description: string;
    probability: string;
    impact: string;
    mitigation: string;
    ownerId: string;
    status: string;
    category?: string;
    createdAt: Date;
  }>;
  activities: Array<{
    _id?: any;
    action: string;
    description: string;
    userId: string;
    metadata?: any;
    createdAt: Date;
  }>;
  settings: {
    boardType: string;
    clientPortalEnabled: boolean;
    sprintDuration: number;
    estimationUnit: string;
    defaultView?: string;
    enableTimeTracking?: boolean;
    enableSubtasks?: boolean;
    enableEpics?: boolean;
    enableSprints?: boolean;
    enableReleases?: boolean;
  };
  labels?: Array<{
    name: string;
    key: string;
    color: string;
  }>;
  templateRef?: string;
  templateVersion?: number;
  healthScore: number;
  progressPercentage: number;
  tags: string[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ProjectSchema = new Schema<IProject>(
  {
    organizationId: { type: String, default: null, index: true },
    projectName: { type: String, required: true, trim: true },
    projectKey: { type: String, uppercase: true, maxlength: 6 },
    description: { type: String, default: null },
    category: { type: String, default: null, index: true },
    clientId: { type: String, default: null, index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    actualStartDate: { type: Date, default: null },
    actualEndDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
      index: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    departmentId: { type: String, default: null, index: true },
    budget: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' },
      billingType: {
        type: String,
        enum: ['fixed', 'time_and_material', 'retainer', 'internal'],
        default: 'fixed',
      },
      hourlyRate: { type: Number, default: null },
      spent: { type: Number, default: 0 },
      retainerAmount: { type: Number, default: null },
    },
    team: [
      {
        userId: { type: String, required: true },
        role: {
          type: String,
          enum: ['admin', 'manager', 'member', 'viewer'],
          default: 'member',
        },
        projectRole: { type: String },
        skills: [{ type: String }],
        allocationPercentage: { type: Number, default: 100, min: 0, max: 100 },
        assignedAt: { type: Date, default: Date.now },
      },
    ],
    milestones: [
      {
        name: { type: String, required: true },
        targetDate: { type: Date, required: true },
        completedDate: { type: Date, default: null },
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'missed'],
          default: 'pending',
        },
        description: { type: String },
        phase: { type: String },
        deliverables: [{ type: String }],
        dependencies: [{ type: mongoose.Schema.Types.ObjectId }],
        ownerId: { type: String },
        linkedTaskIds: [{ type: String }],
        order: { type: Number, default: 0 },
      },
    ],
    risks: [
      {
        description: { type: String, required: true },
        probability: {
          type: String,
          enum: ['low', 'medium', 'high'],
          default: 'medium',
        },
        impact: {
          type: String,
          enum: ['low', 'medium', 'high'],
          default: 'medium',
        },
        mitigation: { type: String, default: '' },
        ownerId: { type: String, default: null },
        status: {
          type: String,
          enum: ['open', 'mitigated', 'occurred', 'closed'],
          default: 'open',
        },
        category: {
          type: String,
          enum: ['technical', 'resource', 'schedule', 'budget', 'scope', 'external'],
          default: 'technical',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    activities: [
      {
        action: { type: String, required: true },
        description: { type: String, default: '' },
        userId: { type: String, default: null },
        metadata: { type: Schema.Types.Mixed },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    settings: {
      boardType: {
        type: String,
        enum: ['scrum', 'kanban', 'custom'],
        default: 'kanban',
      },
      clientPortalEnabled: { type: Boolean, default: false },
      sprintDuration: { type: Number, default: 14 },
      estimationUnit: {
        type: String,
        enum: ['hours', 'story_points'],
        default: 'hours',
      },
      defaultView: {
        type: String,
        enum: ['board', 'list', 'timeline', 'calendar'],
        default: 'board',
      },
      enableTimeTracking: { type: Boolean, default: true },
      enableSubtasks: { type: Boolean, default: true },
      enableEpics: { type: Boolean, default: false },
      enableSprints: { type: Boolean, default: false },
      enableReleases: { type: Boolean, default: false },
    },
    healthScore: { type: Number, default: 100, min: 0, max: 100 },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    labels: [
      {
        name: { type: String },
        key: { type: String },
        color: { type: String },
      },
    ],
    templateRef: { type: String },
    templateVersion: { type: Number },
    tags: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

ProjectSchema.index({ projectKey: 1, organizationId: 1 }, { unique: true, sparse: true });
ProjectSchema.index({ projectName: 'text', description: 'text', tags: 'text' });
ProjectSchema.index({ isDeleted: 1, status: 1 });
ProjectSchema.index({ 'team.userId': 1 });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ departmentId: 1 });
ProjectSchema.index({ priority: 1 });
