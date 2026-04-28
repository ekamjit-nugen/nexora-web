import { Schema, Document } from 'mongoose';

export interface ICustomFieldDef {
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  options?: string[];
}

export interface IAssetCategory extends Document {
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  customFields: ICustomFieldDef[];
  depreciationMethod: 'straight_line' | 'declining_balance' | 'none';
  defaultUsefulLifeYears: number;
  isDeleted: boolean;
  deletedAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetCategorySchema = new Schema<IAssetCategory>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    customFields: [
      {
        fieldName: { type: String, required: true },
        fieldType: { type: String, enum: ['text', 'number', 'date', 'select', 'boolean'], default: 'text' },
        required: { type: Boolean, default: false },
        options: [String],
      },
    ],
    depreciationMethod: { type: String, enum: ['straight_line', 'declining_balance', 'none'], default: 'straight_line' },
    defaultUsefulLifeYears: { type: Number, default: 3 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

AssetCategorySchema.index({ organizationId: 1, slug: 1 }, { unique: true });
AssetCategorySchema.index({ isDeleted: 1 });
