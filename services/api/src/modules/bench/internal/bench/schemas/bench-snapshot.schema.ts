import { Schema, Document } from 'mongoose';

export interface IDepartmentBenchBreakdown {
  departmentId: string;
  departmentName: string;
  benchCount: number;
  allocatedCount: number;
  benchCost: number;
}

export interface ISkillBenchBreakdown {
  skill: string;
  benchCount: number;
  allocatedCount: number;
}

export interface IBenchEmployee {
  userId: string;
  employeeId: string;
  name: string;
  departmentId: string;
  departmentName: string;
  skills: string[];
  benchSinceDays: number;
  dailyCost: number;
  allocationPercentage: number;
}

export interface IBenchSnapshot extends Document {
  organizationId: string;
  snapshotDate: Date;
  totalEmployees: number;
  benchCount: number;
  allocatedCount: number;
  partiallyAllocatedCount: number;
  benchCostDaily: number;
  benchCostMonthly: number;
  benchPercentage: number;
  departmentBreakdown: IDepartmentBenchBreakdown[];
  skillBreakdown: ISkillBenchBreakdown[];
  benchEmployees: IBenchEmployee[];
  isDeleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const BenchSnapshotSchema = new Schema<IBenchSnapshot>(
  {
    organizationId: { type: String, required: true, index: true },
    snapshotDate: { type: Date, required: true },
    totalEmployees: { type: Number, default: 0 },
    benchCount: { type: Number, default: 0 },
    allocatedCount: { type: Number, default: 0 },
    partiallyAllocatedCount: { type: Number, default: 0 },
    benchCostDaily: { type: Number, default: 0 },
    benchCostMonthly: { type: Number, default: 0 },
    benchPercentage: { type: Number, default: 0 },
    departmentBreakdown: [
      {
        departmentId: String,
        departmentName: String,
        benchCount: { type: Number, default: 0 },
        allocatedCount: { type: Number, default: 0 },
        benchCost: { type: Number, default: 0 },
      },
    ],
    skillBreakdown: [
      {
        skill: String,
        benchCount: { type: Number, default: 0 },
        allocatedCount: { type: Number, default: 0 },
      },
    ],
    benchEmployees: [
      {
        userId: String,
        employeeId: String,
        name: String,
        departmentId: String,
        departmentName: String,
        skills: [String],
        benchSinceDays: { type: Number, default: 0 },
        dailyCost: { type: Number, default: 0 },
        allocationPercentage: { type: Number, default: 0 },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

BenchSnapshotSchema.index({ organizationId: 1, snapshotDate: -1 }, { unique: true });
BenchSnapshotSchema.index({ isDeleted: 1 });
