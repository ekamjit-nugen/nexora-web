import { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ISavedFilter {
  id: string;
  name: string;
  query: any;
  isShared: boolean;
  createdBy: string;
}

export interface ISwimlaneConfig {
  enabled: boolean;
  groupBy: string;
  showEmpty: boolean;
  sortOrder: string;
  defaultLane: string;
}

export interface ICardLayout {
  showTaskKey: boolean;
  showAvatar: boolean;
  showPriority: boolean;
  showLabels: boolean;
  showEstimate: boolean;
  showDueDate: boolean;
  showSubtasks: boolean;
  showProgress: boolean;
  showCommentCount: boolean;
  showTypeIndicator: boolean;
  compactMode: boolean;
}

export interface IBoardColumn {
  id: string;
  name: string;
  key: string;
  order: number;
  wipLimit: number;
  statusMapping: string[];
  color: string;
  isCollapsed: boolean;
  isDoneColumn: boolean;
  isStartColumn: boolean;
}

export interface IBoard extends Document {
  name: string;
  description: string;
  projectId: string;
  organizationId: string;
  type: string;
  color: string;
  icon: string;
  columns: IBoardColumn[];
  swimlaneBy: string;
  swimlaneConfig: ISwimlaneConfig;
  cardLayout: ICardLayout;
  quickFilters: string[];
  savedFilters: ISavedFilter[];
  isDefault: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  templateRef: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const BoardColumnSchema = new Schema(
  {
    id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true },
    key: { type: String },
    order: { type: Number, required: true },
    wipLimit: { type: Number, default: 0 },
    statusMapping: [{ type: String }],
    color: { type: String, default: '#6B7280' },
    isCollapsed: { type: Boolean, default: false },
    isDoneColumn: { type: Boolean, default: false },
    isStartColumn: { type: Boolean, default: false },
  },
  { _id: false },
);

const SwimlaneConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    groupBy: {
      type: String,
      enum: ['assignee', 'priority', 'type', 'label', 'epic', 'sprint', 'none'],
      default: 'none',
    },
    showEmpty: { type: Boolean, default: false },
    sortOrder: { type: String, default: 'default' },
    defaultLane: { type: String, default: 'Unassigned' },
  },
  { _id: false },
);

const CardLayoutSchema = new Schema(
  {
    showTaskKey: { type: Boolean, default: true },
    showAvatar: { type: Boolean, default: true },
    showPriority: { type: Boolean, default: true },
    showLabels: { type: Boolean, default: true },
    showEstimate: { type: Boolean, default: true },
    showDueDate: { type: Boolean, default: true },
    showSubtasks: { type: Boolean, default: true },
    showProgress: { type: Boolean, default: false },
    showCommentCount: { type: Boolean, default: true },
    showTypeIndicator: { type: Boolean, default: true },
    compactMode: { type: Boolean, default: false },
  },
  { _id: false },
);

const SavedFilterSchema = new Schema(
  {
    id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true },
    query: { type: Schema.Types.Mixed },
    isShared: { type: Boolean, default: false },
    createdBy: { type: String },
  },
  { _id: false },
);

export const BoardSchema = new Schema<IBoard>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500 },
    projectId: { type: String, required: true, index: true },
    organizationId: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ['scrum', 'kanban', 'bug_tracker', 'custom'],
      default: 'kanban',
    },
    color: { type: String },
    icon: { type: String, default: 'layout-kanban' },
    columns: [BoardColumnSchema],
    swimlaneBy: {
      type: String,
      enum: ['none', 'assignee', 'priority', 'type'],
      default: 'none',
    },
    swimlaneConfig: { type: SwimlaneConfigSchema, default: () => ({}) },
    cardLayout: { type: CardLayoutSchema, default: () => ({}) },
    quickFilters: [{ type: String }],
    savedFilters: [SavedFilterSchema],
    isDefault: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    templateRef: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

BoardSchema.index({ projectId: 1, isDefault: 1 });
BoardSchema.index({ projectId: 1, isDeleted: 1 });
BoardSchema.index({ organizationId: 1, isDeleted: 1 });
