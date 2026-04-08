import { Schema, Document } from 'mongoose';

export interface IMilestoneTemplate {
  name: string;
  description?: string;
  phase?: string;
  offsetDays: number;
  deliverables?: string[];
}

export interface ITaskTemplate {
  title: string;
  description?: string;
  type: string;
  priority: string;
  storyPoints?: number;
  labels?: string[];
  milestoneIndex?: number;
}

export interface IBoardColumn {
  name: string;
  statusMapping: string;
  wipLimit?: number;
  order: number;
}

export interface ITeamRole {
  role: string;
  count: number;
  skills?: string[];
}

export interface IProjectTemplate extends Document {
  name: string;
  description?: string;
  organizationId: string;
  category?: string;
  methodology?: string;
  createdBy: string;
  isPublic: boolean;
  defaultSettings: {
    boardType?: string;
    sprintDuration?: number;
    estimationUnit?: string;
    enableTimeTracking?: boolean;
    enableSubtasks?: boolean;
    enableEpics?: boolean;
    enableSprints?: boolean;
    enableReleases?: boolean;
  };
  milestoneTemplates: IMilestoneTemplate[];
  taskTemplates: ITaskTemplate[];
  boardColumns: IBoardColumn[];
  teamRoles: ITeamRole[];
  usageCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const ProjectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    organizationId: { type: String, required: true, index: true },
    category: { type: String, default: null, index: true },
    methodology: {
      type: String,
      enum: ['scrum', 'kanban', 'scrumban', 'waterfall', 'xp', 'lean', 'safe', 'custom'],
      default: null,
    },
    createdBy: { type: String, required: true },
    isPublic: { type: Boolean, default: false, index: true },
    defaultSettings: {
      boardType: {
        type: String,
        enum: ['scrum', 'kanban', 'custom'],
        default: 'kanban',
      },
      sprintDuration: { type: Number, default: 14 },
      estimationUnit: {
        type: String,
        enum: ['hours', 'story_points'],
        default: 'story_points',
      },
      enableTimeTracking: { type: Boolean, default: true },
      enableSubtasks: { type: Boolean, default: true },
      enableEpics: { type: Boolean, default: false },
      enableSprints: { type: Boolean, default: false },
      enableReleases: { type: Boolean, default: false },
    },
    milestoneTemplates: [
      {
        name: { type: String, required: true },
        description: { type: String },
        phase: { type: String },
        offsetDays: { type: Number, default: 0 },
        deliverables: [{ type: String }],
      },
    ],
    taskTemplates: [
      {
        title: { type: String, required: true },
        description: { type: String },
        type: {
          type: String,
          enum: ['epic', 'story', 'task', 'sub_task', 'bug', 'improvement', 'spike'],
          default: 'task',
        },
        priority: {
          type: String,
          enum: ['critical', 'high', 'medium', 'low', 'trivial'],
          default: 'medium',
        },
        storyPoints: { type: Number, default: null },
        labels: [{ type: String }],
        milestoneIndex: { type: Number, default: null },
      },
    ],
    boardColumns: [
      {
        name: { type: String, required: true },
        statusMapping: { type: String, required: true },
        wipLimit: { type: Number, default: null },
        order: { type: Number, default: 0 },
      },
    ],
    teamRoles: [
      {
        role: { type: String, required: true },
        count: { type: Number, default: 1 },
        skills: [{ type: String }],
      },
    ],
    usageCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ProjectTemplateSchema.index({ name: 'text', description: 'text' });
ProjectTemplateSchema.index({ isDeleted: 1 });
ProjectTemplateSchema.index({ createdBy: 1 });
