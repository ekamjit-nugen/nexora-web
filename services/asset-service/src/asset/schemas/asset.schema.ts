import { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  organizationId: string;
  assetTag: string;
  name: string;
  categoryId: string;
  serialNumber: string;
  modelName: string;
  manufacturer: string;
  description: string;
  status: 'available' | 'assigned' | 'maintenance' | 'retired' | 'lost' | 'disposed';
  condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged';
  purchaseDate: Date;
  purchasePrice: number;
  vendor: string;
  invoiceNumber: string;
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  warrantyProvider: string;
  warrantyNotes: string;
  currentAssigneeId: string;
  currentAssigneeType: 'employee' | 'department' | 'shared_pool';
  assignedAt: Date;
  location: string;
  building: string;
  floor: string;
  depreciationMethod: 'straight_line' | 'declining_balance' | 'none';
  usefulLifeYears: number;
  salvageValue: number;
  currentBookValue: number;
  customFieldValues: Record<string, any>;
  documents: Array<{ type: string; url: string; uploadedAt: Date }>;
  notes: string;
  tags: string[];
  isDeleted: boolean;
  deletedAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetSchema = new Schema<IAsset>(
  {
    organizationId: { type: String, required: true, index: true },
    assetTag: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, index: true },
    serialNumber: { type: String, default: '' },
    modelName: { type: String, default: '' },
    manufacturer: { type: String, default: '' },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['available', 'assigned', 'maintenance', 'retired', 'lost', 'disposed'],
      default: 'available',
    },
    condition: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor', 'damaged'],
      default: 'new',
    },
    purchaseDate: { type: Date, default: null },
    purchasePrice: { type: Number, default: 0 },
    vendor: { type: String, default: '' },
    invoiceNumber: { type: String, default: '' },
    warrantyStartDate: { type: Date, default: null },
    warrantyEndDate: { type: Date, default: null },
    warrantyProvider: { type: String, default: '' },
    warrantyNotes: { type: String, default: '' },
    currentAssigneeId: { type: String, default: null, index: true },
    currentAssigneeType: {
      type: String,
      enum: ['employee', 'department', 'shared_pool'],
      default: 'employee',
    },
    assignedAt: { type: Date, default: null },
    location: { type: String, default: '' },
    building: { type: String, default: '' },
    floor: { type: String, default: '' },
    depreciationMethod: { type: String, enum: ['straight_line', 'declining_balance', 'none'], default: 'straight_line' },
    usefulLifeYears: { type: Number, default: 3 },
    salvageValue: { type: Number, default: 0 },
    currentBookValue: { type: Number, default: 0 },
    customFieldValues: { type: Schema.Types.Mixed, default: {} },
    documents: [
      {
        type: { type: String },
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, default: '' },
    tags: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

AssetSchema.index({ organizationId: 1, assetTag: 1 }, { unique: true });
AssetSchema.index({ organizationId: 1, status: 1 });
AssetSchema.index({ organizationId: 1, categoryId: 1, status: 1 });
AssetSchema.index({ organizationId: 1, warrantyEndDate: 1 });
AssetSchema.index({ isDeleted: 1 });
AssetSchema.index({ name: 'text', assetTag: 'text', serialNumber: 'text', tags: 'text' });
