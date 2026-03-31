import { Schema, Document } from 'mongoose';

export interface IAnalyticsMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface IPrediction {
  metric: string;
  predictedValue: number;
  confidence: number;
  horizon: string;
  timestamp: Date;
}

export interface IAnalyticsReport extends Document {
  productId: string;
  reportType: 'velocity' | 'burndown' | 'trend' | 'forecast';
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  metrics: IAnalyticsMetric[];
  predictions: IPrediction[];
  insights: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const AnalyticsMetricSchema = new Schema({
  name: String,
  value: Number,
  timestamp: Date,
  tags: Schema.Types.Mixed,
});

export const PredictionSchema = new Schema({
  metric: String,
  predictedValue: Number,
  confidence: Number,
  horizon: String,
  timestamp: Date,
});

export const AnalyticsReportSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    reportType: {
      type: String,
      enum: ['velocity', 'burndown', 'trend', 'forecast'],
      required: true,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    metrics: [AnalyticsMetricSchema],
    predictions: [PredictionSchema],
    insights: [String],
  },
  { timestamps: true },
);

AnalyticsReportSchema.index({ productId: 1, reportType: 1 });
AnalyticsReportSchema.index({ startDate: -1 });
