import { Schema, Document } from 'mongoose';

export interface IPortfolioMetrics {
  totalValue: number;
  activeProducts: number;
  riskScore: number;
  healthScore: number;
  roi: number;
  timeToMarket: number;
}

export interface IPortfolioProduct {
  productId: string;
  status: 'active' | 'planned' | 'deprecated';
  priority: number;
  investment: number;
  expectedRevenue: number;
  healthScore: number;
}

export interface IPortfolio extends Document {
  organizationId: string;
  name: string;
  description: string;
  products: IPortfolioProduct[];
  metrics: IPortfolioMetrics;
  managers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const PortfolioMetricsSchema = new Schema({
  totalValue: Number,
  activeProducts: Number,
  riskScore: Number,
  healthScore: Number,
  roi: Number,
  timeToMarket: Number,
});

export const PortfolioProductSchema = new Schema({
  productId: String,
  status: String,
  priority: Number,
  investment: Number,
  expectedRevenue: Number,
  healthScore: Number,
});

export const PortfolioSchema = new Schema(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    products: [PortfolioProductSchema],
    metrics: PortfolioMetricsSchema,
    managers: [String],
  },
  { timestamps: true },
);

PortfolioSchema.index({ organizationId: 1 });
PortfolioSchema.index({ createdAt: -1 });
