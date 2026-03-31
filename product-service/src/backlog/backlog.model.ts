import { Schema, Document } from 'mongoose';

export interface IBacklogItem {
  id: string;
  productId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'todo' | 'inProgress' | 'review' | 'done';
  storyPoints: number;
  assignee?: string;
  sprint?: string;
  dueDate?: Date;
  tags: string[];
  order: number;
}

export interface ISprint {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed';
  capacity: number;
  goal: string;
  items: string[];
}

export interface IBacklog extends Document {
  productId: string;
  items: IBacklogItem[];
  sprints: ISprint[];
  createdAt: Date;
  updatedAt: Date;
}

export const BacklogItemSchema = new Schema({
  id: String,
  productId: String,
  title: String,
  description: String,
  priority: String,
  status: String,
  storyPoints: Number,
  assignee: String,
  sprint: String,
  dueDate: Date,
  tags: [String],
  order: Number,
});

export const SprintSchema = new Schema({
  id: String,
  name: String,
  startDate: Date,
  endDate: Date,
  status: String,
  capacity: Number,
  goal: String,
  items: [String],
});

export const BacklogSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    items: [BacklogItemSchema],
    sprints: [SprintSchema],
  },
  { timestamps: true },
);

BacklogSchema.index({ productId: 1 });
BacklogSchema.index({ 'items.priority': 1 });
BacklogSchema.index({ 'sprints.status': 1 });
