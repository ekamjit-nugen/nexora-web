import { Schema, Document } from 'mongoose';

export interface IBenchConfig extends Document {
  organizationId: string;
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  benchThresholdPercentage: number;
  costCalculationMethod: 'ctc' | 'gross' | 'net';
  autoSnapshotEnabled: boolean;
  alertThresholds: {
    benchPercentageWarning: number;
    benchPercentageCritical: number;
    maxBenchDays: number;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const BenchConfigSchema = new Schema<IBenchConfig>(
  {
    organizationId: { type: String, required: true, unique: true, index: true },
    workingDaysPerMonth: { type: Number, default: 22 },
    workingHoursPerDay: { type: Number, default: 8 },
    benchThresholdPercentage: { type: Number, default: 0 },
    costCalculationMethod: {
      type: String,
      enum: ['ctc', 'gross', 'net'],
      default: 'ctc',
    },
    autoSnapshotEnabled: { type: Boolean, default: true },
    alertThresholds: {
      benchPercentageWarning: { type: Number, default: 20 },
      benchPercentageCritical: { type: Number, default: 40 },
      maxBenchDays: { type: Number, default: 30 },
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
