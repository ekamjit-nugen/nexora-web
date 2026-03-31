import { Schema, Document } from 'mongoose';

export interface IComment {
  _id?: any;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  isEdited?: boolean;
  reactions?: Array<{ emoji: string; userIds: string[] }>;
}

export interface ITimeEntry {
  userId: string;
  hours: number;
  description: string;
  date: Date;
  category: string;
  createdAt: Date;
}

export interface IAttachment {
  name: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface ITask extends Document {
  organizationId?: string;
  taskKey?: string;
  title: string;
  description?: string;
  projectId: string;
  parentTaskId?: string;
  type: string;
  status: string;
  priority: string;
  assigneeId?: string;
  reporterId: string;
  storyPoints?: number;
  dueDate?: Date;
  labels: string[];
  estimatedHours?: number;
  loggedHours: number;
  comments: IComment[];
  timeEntries: ITimeEntry[];
  attachments: IAttachment[];
  boardId?: string;
  sprintId?: string;
  columnId?: string;
  statusHistory?: Array<{ status: string; changedAt: Date; changedBy?: string }>;
  dependencies?: Array<{itemId: string; type: string}>;
  order?: number;
  completedAt?: Date;
  resolution?: string;
  isFlagged?: boolean;
  watchers?: string[];
  votes?: string[];
  components?: string[];
  fixVersion?: string;
  environment?: string;
  originalEstimate?: number;
  remainingEstimate?: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TaskSchema = new Schema<ITask>(
  {
    organizationId: { type: String, default: null, index: true },
    taskKey: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    projectId: { type: String, required: true, index: true },
    parentTaskId: { type: String, default: null },
    type: {
      type: String,
      enum: ['epic', 'story', 'task', 'sub_task', 'bug', 'improvement', 'spike'],
      default: 'task',
    },
    status: {
      type: String,
      enum: ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'],
      default: 'backlog',
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'trivial'],
      default: 'medium',
    },
    assigneeId: { type: String, default: null, index: true },
    reporterId: { type: String, required: true },
    storyPoints: { type: Number, default: null },
    dueDate: { type: Date, default: null },
    labels: [{ type: String }],
    estimatedHours: { type: Number, default: null },
    loggedHours: { type: Number, default: 0 },
    comments: [
      {
        userId: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: null },
        isEdited: { type: Boolean, default: false },
        reactions: [{ emoji: { type: String }, userIds: [{ type: String }] }],
      },
    ],
    timeEntries: [
      {
        userId: { type: String, required: true },
        hours: { type: Number, required: true },
        description: { type: String, default: '' },
        date: { type: Date, required: true },
        category: { type: String, default: 'development' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedBy: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    boardId: { type: String, default: null, index: true },
    sprintId: { type: String, default: null },
    columnId: { type: String, default: null },
    dependencies: [{
      itemId: { type: String, required: true },
      type: {
        type: String,
        enum: ['blocked_by', 'relates_to', 'duplicates', 'child_of'],
        required: true,
      },
    }],
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    resolution: { type: String, default: null },
    isFlagged: { type: Boolean, default: false },
    watchers: [{ type: String }],
    votes: [{ type: String }],
    components: [{ type: String }],
    fixVersion: { type: String, default: null },
    environment: { type: String, default: null },
    originalEstimate: { type: Number, default: null },
    remainingEstimate: { type: Number, default: null },
    statusHistory: [{
      status: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String },
    }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

TaskSchema.index({ title: 'text', description: 'text', labels: 'text' });
TaskSchema.index({ projectId: 1, status: 1 });
TaskSchema.index({ assigneeId: 1, status: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ isDeleted: 1 });
TaskSchema.index({ boardId: 1, columnId: 1 });
TaskSchema.index({ projectId: 1, taskKey: 1 }, { unique: true, sparse: true });
