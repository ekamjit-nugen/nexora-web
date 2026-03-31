import { Schema, Document } from 'mongoose';

export interface IKanbanCard {
  id: string;
  productId: string;
  title: string;
  description: string;
  state: string;
  order: number;
}

export interface IKanbanBoard extends Document {
  productId: string;
  workflowId: string;
  title: string;
  description: string;
  columns: Array<{
    stateId: string;
    title: string;
    cards: IKanbanCard[];
  }>;
  settings: {
    showLabel: boolean;
    showDueDate: boolean;
    allowDragDrop: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const KanbanBoardSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    workflowId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    columns: [
      {
        stateId: String,
        title: String,
        cards: [
          {
            id: String,
            productId: String,
            title: String,
            description: String,
            state: String,
            order: Number,
          },
        ],
      },
    ],
    settings: {
      showLabel: { type: Boolean, default: true },
      showDueDate: { type: Boolean, default: true },
      allowDragDrop: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

// Indexes
KanbanBoardSchema.index({ productId: 1, workflowId: 1 });
KanbanBoardSchema.index({ createdAt: -1 });
