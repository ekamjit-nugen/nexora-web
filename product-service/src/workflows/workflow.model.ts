import { Schema, Document } from 'mongoose';

export interface IWorkflowState {
  id: string;
  name: string;
  color: string;
  order: number;
  isFinal: boolean;
}

export interface IWorkflowTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  conditions: Record<string, any>;
  actions: string[];
  allowedRoles: string[];
}

export interface IWorkflow extends Document {
  productId: string;
  name: string;
  description: string;
  states: IWorkflowState[];
  transitions: IWorkflowTransition[];
  initialStateId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const WorkflowSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    states: [
      {
        id: String,
        name: String,
        color: String,
        order: Number,
        isFinal: Boolean,
      },
    ],
    transitions: [
      {
        id: String,
        fromStateId: String,
        toStateId: String,
        conditions: Schema.Types.Mixed,
        actions: [String],
        allowedRoles: [String],
      },
    ],
    initialStateId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Indexes for common queries
WorkflowSchema.index({ productId: 1, isActive: 1 });
WorkflowSchema.index({ createdAt: -1 });
