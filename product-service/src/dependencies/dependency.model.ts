import { Schema, Document } from 'mongoose';

export interface IDependency {
  id: string;
  sourceProductId: string;
  targetProductId: string;
  type: 'blocks' | 'depends-on' | 'impacts';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  createdAt: Date;
}

export interface IImpactAnalysis {
  sourceProductId: string;
  affectedProducts: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: number;
  mitigation: string;
}

export interface IDependencyGraph extends Document {
  productId: string;
  dependencies: IDependency[];
  impactAnalyses: IImpactAnalysis[];
  lastAnalyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DependencySchema = new Schema({
  id: String,
  sourceProductId: String,
  targetProductId: String,
  type: { type: String, enum: ['blocks', 'depends-on', 'impacts'] },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
  description: String,
  createdAt: Date,
});

export const ImpactAnalysisSchema = new Schema({
  sourceProductId: String,
  affectedProducts: [String],
  riskLevel: String,
  estimatedImpact: Number,
  mitigation: String,
});

export const DependencyGraphSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    dependencies: [DependencySchema],
    impactAnalyses: [ImpactAnalysisSchema],
    lastAnalyzedAt: Date,
  },
  { timestamps: true },
);

DependencyGraphSchema.index({ productId: 1 });
DependencyGraphSchema.index({ 'dependencies.severity': 1 });
