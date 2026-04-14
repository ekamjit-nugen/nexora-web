import { Schema, Document } from 'mongoose';

export interface IAssetCounter extends Document {
  organizationId: string;
  prefix: string;
  seq: number;
}

export const AssetCounterSchema = new Schema<IAssetCounter>({
  organizationId: { type: String, required: true },
  prefix: { type: String, default: 'AST' },
  seq: { type: Number, default: 0 },
});

AssetCounterSchema.index({ organizationId: 1 }, { unique: true });
