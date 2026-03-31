import { Schema, Document } from 'mongoose';

export interface IDataSegmentation {
  level: 'strict' | 'shared' | 'hybrid';
  segregateByTenant: boolean;
  segregateByOrganization: boolean;
  sharedResources?: string[];
}

export interface ITenant extends Document {
  productId: string;
  tenantId: string;
  name: string;
  organizationId: string;
  isolationLevel: 'strict' | 'shared' | 'hybrid';
  dataSegmentation: IDataSegmentation;
  status: 'active' | 'suspended' | 'deleted';
  maxUsers: number;
  currentUsers: number;
  features: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITenantContext {
  tenantId: string;
  productId: string;
  organizationId: string;
  userId: string;
}

export const DataSegmentationSchema = new Schema({
  level: { type: String, enum: ['strict', 'shared', 'hybrid'], default: 'strict' },
  segregateByTenant: { type: Boolean, default: true },
  segregateByOrganization: { type: Boolean, default: true },
  sharedResources: [String],
});

export const TenantSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    isolationLevel: { type: String, enum: ['strict', 'shared', 'hybrid'], default: 'strict' },
    dataSegmentation: DataSegmentationSchema,
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    maxUsers: { type: Number, default: 100 },
    currentUsers: { type: Number, default: 0 },
    features: [String],
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

TenantSchema.index({ productId: 1, tenantId: 1 });
TenantSchema.index({ organizationId: 1, status: 1 });
TenantSchema.index({ productId: 1, status: 1 });
