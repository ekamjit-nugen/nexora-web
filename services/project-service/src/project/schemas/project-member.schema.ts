import { Schema, Document, model } from 'mongoose';

export interface IProjectMember extends Document {
  projectId: string;
  userId: string;
  role: 'admin' | 'lead' | 'developer' | 'viewer';
  permissions?: string[]; // Override specific permissions
  addedAt: Date;
  addedBy: string;
  updatedAt: Date;
}

export const ProjectMemberSchema = new Schema<IProjectMember>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'lead', 'developer', 'viewer'],
      required: true,
      default: 'developer',
    },
    permissions: [
      {
        type: String,
      },
    ],
    addedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// Unique constraint: one user can only have one role per project
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectMemberSchema.index({ projectId: 1 });
ProjectMemberSchema.index({ userId: 1 });

export const ProjectMemberModel = model<IProjectMember>(
  'ProjectMember',
  ProjectMemberSchema,
);
