import { Schema, Document } from 'mongoose';

export interface IChannelCategory extends Document {
  organizationId: string;
  name: string;
  order: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ChannelCategorySchema = new Schema<IChannelCategory>(
  {
    organizationId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

ChannelCategorySchema.index({ organizationId: 1, order: 1 });
