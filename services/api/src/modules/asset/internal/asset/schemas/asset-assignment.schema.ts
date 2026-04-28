import { Schema, Document } from 'mongoose';

export interface IAssetAssignment extends Document {
  organizationId: string;
  assetId: string;
  assetTag: string;
  action: 'assigned' | 'unassigned' | 'transferred';
  assigneeId: string;
  assigneeType: 'employee' | 'department' | 'shared_pool';
  previousAssigneeId: string;
  assignedBy: string;
  assignedAt: Date;
  returnedAt: Date;
  expectedReturnDate: Date;
  conditionAtAssignment: string;
  conditionAtReturn: string;
  notes: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetAssignmentSchema = new Schema<IAssetAssignment>(
  {
    organizationId: { type: String, required: true, index: true },
    assetId: { type: String, required: true, index: true },
    assetTag: { type: String, default: '' },
    action: {
      type: String,
      enum: ['assigned', 'unassigned', 'transferred'],
      required: true,
    },
    assigneeId: { type: String, required: true, index: true },
    assigneeType: {
      type: String,
      enum: ['employee', 'department', 'shared_pool'],
      default: 'employee',
    },
    previousAssigneeId: { type: String, default: null },
    assignedBy: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
    returnedAt: { type: Date, default: null },
    expectedReturnDate: { type: Date, default: null },
    conditionAtAssignment: { type: String, default: '' },
    conditionAtReturn: { type: String, default: '' },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AssetAssignmentSchema.index({ organizationId: 1, assetId: 1 });
AssetAssignmentSchema.index({ organizationId: 1, assigneeId: 1 });
AssetAssignmentSchema.index({ isDeleted: 1 });
