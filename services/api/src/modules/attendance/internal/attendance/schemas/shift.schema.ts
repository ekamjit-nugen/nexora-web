import { Schema, Document } from 'mongoose';

export interface IShift extends Document {
  organizationId?: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutesLateArrival: number;
  graceMinutesEarlyDeparture: number;
  minimumWorkingHours: number;
  breakDurationMinutes: number;
  isNightShift: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ShiftSchema = new Schema<IShift>(
  {
    organizationId: { type: String, default: null, index: true },
    shiftName: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    graceMinutesLateArrival: { type: Number, default: 15 },
    graceMinutesEarlyDeparture: { type: Number, default: 15 },
    minimumWorkingHours: { type: Number, default: 8 },
    breakDurationMinutes: { type: Number, default: 60 },
    isNightShift: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

ShiftSchema.index({ isDeleted: 1, isActive: 1 });
