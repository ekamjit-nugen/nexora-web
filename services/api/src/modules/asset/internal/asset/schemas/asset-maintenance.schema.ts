import { Schema, Document } from 'mongoose';

export interface IAssetMaintenance extends Document {
  organizationId: string;
  assetId: string;
  assetTag: string;
  type: 'repair' | 'upgrade' | 'inspection' | 'cleaning' | 'software_update' | 'replacement_part';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  description: string;
  vendor: string;
  cost: number;
  scheduledDate: Date;
  startDate: Date;
  completionDate: Date;
  performedBy: string;
  notes: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetMaintenanceSchema = new Schema<IAssetMaintenance>(
  {
    organizationId: { type: String, required: true, index: true },
    assetId: { type: String, required: true, index: true },
    assetTag: { type: String, default: '' },
    type: {
      type: String,
      enum: ['repair', 'upgrade', 'inspection', 'cleaning', 'software_update', 'replacement_part'],
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    description: { type: String, required: true },
    vendor: { type: String, default: '' },
    cost: { type: Number, default: 0 },
    scheduledDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },
    performedBy: { type: String, default: '' },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

AssetMaintenanceSchema.index({ organizationId: 1, assetId: 1 });
AssetMaintenanceSchema.index({ organizationId: 1, status: 1 });
AssetMaintenanceSchema.index({ isDeleted: 1 });
