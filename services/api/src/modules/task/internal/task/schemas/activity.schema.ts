import { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  organizationId?: string;
  projectId: string;
  boardId?: string;
  taskId?: string;
  sprintId?: string;
  action: string;
  actorId: string;
  actorName?: string;
  entityType: string; // 'task' | 'sprint' | 'board' | 'project'
  entityTitle?: string;
  details?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const ActivitySchema = new Schema<IActivity>(
  {
    organizationId: { type: String, default: null, index: true },
    projectId: { type: String, required: true, index: true },
    boardId: { type: String, default: null },
    taskId: { type: String, default: null },
    sprintId: { type: String, default: null },
    action: { type: String, required: true },
    actorId: { type: String, required: true },
    actorName: { type: String, default: '' },
    entityType: { type: String, required: true },
    entityTitle: { type: String, default: '' },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ActivitySchema.index({ projectId: 1, createdAt: -1 });
ActivitySchema.index({ organizationId: 1, createdAt: -1 });
