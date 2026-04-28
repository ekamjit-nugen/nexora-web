import { Schema, Document } from 'mongoose';
import { IGitLink, GitLinkSubSchema } from './git-integration.schema';

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

export interface IRecurrence {
  enabled: boolean;
  rule?: string;
  frequency?: string;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: Date;
  maxOccurrences?: number;
  occurrenceCount?: number;
  lastGeneratedAt?: Date;
  templateTaskId?: string;
}

export interface ITask extends Document {
  organizationId?: string;
  taskKey?: string;
  title: string;
  description?: string;
  // Optional — empty for personal tasks (see `isPersonal`).
  projectId?: string | null;
  // Personal tasks: lightweight todos with no project context. Created via
  // the personal-tasks UI, listed in /tasks/personal endpoint, and can have
  // optional collaborators (other users invited to view/edit).
  isPersonal?: boolean;
  collaborators?: string[];
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
  recurrence?: IRecurrence;
  isRecurringInstance?: boolean;
  recurringParentId?: string;
  gitLinks?: IGitLink[];
  customFields?: Record<string, unknown>;
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
    // Project is now optional. Personal tasks (todo-list use-case) have
    // projectId = null and isPersonal = true — they bypass the board/sprint
    // machinery and only appear in /tasks/personal for the creator and any
    // collaborators they explicitly added.
    projectId: { type: String, default: null, index: true },
    isPersonal: { type: Boolean, default: false, index: true },
    collaborators: { type: [String], default: [] },
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
    recurrence: {
      enabled: { type: Boolean, default: false },
      rule: { type: String, default: null },
      frequency: {
        type: String,
        // `null` allowed as the unset state — the default for non-recurring
        // tasks. Without this, every new task save fails enum validation
        // because mongoose materialises the subdoc with `frequency: null`.
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'custom', null],
        default: null,
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number }],
      dayOfMonth: { type: Number, default: null },
      endDate: { type: Date, default: null },
      maxOccurrences: { type: Number, default: null },
      occurrenceCount: { type: Number, default: 0 },
      lastGeneratedAt: { type: Date, default: null },
      templateTaskId: { type: String, default: null },
    },
    isRecurringInstance: { type: Boolean, default: false },
    recurringParentId: { type: String, default: null, index: true },
    gitLinks: [GitLinkSubSchema],
    customFields: { type: Schema.Types.Mixed, default: {} },
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
// Partial unique index — only applies when BOTH projectId and taskKey are
// non-null. Sparse indexes treat `null` as present, so two personal tasks
// (both having projectId=null AND taskKey=null) would collide on a sparse
// unique index. Partial filters fix that: personal tasks are excluded from
// the uniqueness constraint entirely, while project tasks still enforce the
// "one taskKey per project" rule.
TaskSchema.index(
  { projectId: 1, taskKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      projectId: { $type: 'string' },
      taskKey: { $type: 'string' },
    },
  },
);
TaskSchema.index({ 'recurrence.enabled': 1, isDeleted: 1 });
