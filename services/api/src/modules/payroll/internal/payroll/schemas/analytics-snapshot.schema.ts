import { Schema, Document } from 'mongoose';

export interface IAnalyticsSnapshot extends Document {
  organizationId: string;
  snapshotDate: Date;
  period: { month: number; year: number };
  headcount: {
    total: number;
    active: number;
    onNotice: number;
    newJoiners: number;
    exits: number;
    contractors: number;
  };
  departmentBreakdown: Array<{ department: string; count: number; avgSalary: number }>;
  attritionData: {
    monthlyRate: number;
    annualizedRate: number;
    voluntaryExits: number;
    involuntaryExits: number;
  };
  costMetrics: {
    totalPayroll: number;
    avgCostPerEmployee: number;
    payrollToRevenue?: number;
  };
  attendanceSummary: {
    avgAttendanceRate: number;
    avgLatePercentage: number;
    avgOvertimeHours: number;
  };
  leaveSummary: {
    avgLeaveUtilization: number;
    topLeaveTypes: Array<{ type: string; count: number }>;
  };
  attritionPredictions: Array<{
    employeeId: string;
    riskScore: number;
    factors: string[];
    predictedAt: Date;
  }>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const AnalyticsSnapshotSchema = new Schema<IAnalyticsSnapshot>(
  {
    organizationId: { type: String, required: true, index: true },
    snapshotDate: { type: Date, required: true },
    period: {
      month: { type: Number, required: true },
      year: { type: Number, required: true },
    },
    headcount: {
      total: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
      onNotice: { type: Number, default: 0 },
      newJoiners: { type: Number, default: 0 },
      exits: { type: Number, default: 0 },
      contractors: { type: Number, default: 0 },
    },
    departmentBreakdown: [
      {
        department: { type: String, required: true },
        count: { type: Number, default: 0 },
        avgSalary: { type: Number, default: 0 },
      },
    ],
    attritionData: {
      monthlyRate: { type: Number, default: 0 },
      annualizedRate: { type: Number, default: 0 },
      voluntaryExits: { type: Number, default: 0 },
      involuntaryExits: { type: Number, default: 0 },
    },
    costMetrics: {
      totalPayroll: { type: Number, default: 0 },
      avgCostPerEmployee: { type: Number, default: 0 },
      payrollToRevenue: { type: Number, default: null },
    },
    attendanceSummary: {
      avgAttendanceRate: { type: Number, default: 0 },
      avgLatePercentage: { type: Number, default: 0 },
      avgOvertimeHours: { type: Number, default: 0 },
    },
    leaveSummary: {
      avgLeaveUtilization: { type: Number, default: 0 },
      topLeaveTypes: [
        {
          type: { type: String, required: true },
          count: { type: Number, default: 0 },
        },
      ],
    },
    attritionPredictions: [
      {
        employeeId: { type: String, required: true },
        riskScore: { type: Number, required: true },
        factors: [{ type: String }],
        predictedAt: { type: Date, required: true },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AnalyticsSnapshotSchema.index(
  { organizationId: 1, 'period.year': 1, 'period.month': 1 },
  { unique: true },
);
AnalyticsSnapshotSchema.index({ organizationId: 1, snapshotDate: -1 });
