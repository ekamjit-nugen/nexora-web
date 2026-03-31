import { Schema, Document, model } from 'mongoose';

export interface IClientFeedback extends Document {
  projectId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  type: 'bug' | 'feature' | 'question' | 'general';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  attachments?: Array<{
    url: string;
    name: string;
    type: string;
    size: number;
  }>;
  taskKey?: string; // linked task created from this feedback
  status: 'new' | 'reviewed' | 'in_progress' | 'completed' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export const ClientFeedbackSchema = new Schema<IClientFeedback>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    clientName: {
      type: String,
      required: true,
    },
    clientEmail: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['bug', 'feature', 'question', 'general'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    attachments: [
      {
        url: String,
        name: String,
        type: String,
        size: Number,
      },
    ],
    taskKey: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'in_progress', 'completed', 'closed'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true },
);

ClientFeedbackSchema.index({ projectId: 1, status: 1 });
ClientFeedbackSchema.index({ projectId: 1, createdAt: -1 });

export const ClientFeedbackModel = model<IClientFeedback>(
  'ClientFeedback',
  ClientFeedbackSchema,
);
