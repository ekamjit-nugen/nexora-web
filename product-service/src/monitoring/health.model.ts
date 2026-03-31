import { Schema, Document } from 'mongoose';

export interface IHealthMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

export interface IAlert {
  id: string;
  productId: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggered: Date;
  resolved?: Date;
  isResolved: boolean;
}

export interface IProductHealth extends Document {
  productId: string;
  overallHealth: number;
  status: 'healthy' | 'warning' | 'critical';
  metrics: IHealthMetric[];
  alerts: IAlert[];
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const HealthMetricSchema = new Schema({
  name: String,
  value: Number,
  threshold: Number,
  status: { type: String, enum: ['healthy', 'warning', 'critical'] },
  timestamp: Date,
});

export const AlertSchema = new Schema({
  id: String,
  productId: String,
  metric: String,
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  message: String,
  triggered: Date,
  resolved: Date,
  isResolved: Boolean,
});

export const ProductHealthSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    overallHealth: Number,
    status: { type: String, enum: ['healthy', 'warning', 'critical'], default: 'healthy' },
    metrics: [HealthMetricSchema],
    alerts: [AlertSchema],
    lastUpdated: Date,
  },
  { timestamps: true },
);

ProductHealthSchema.index({ productId: 1 });
ProductHealthSchema.index({ status: 1 });
ProductHealthSchema.index({ 'alerts.severity': 1 });
