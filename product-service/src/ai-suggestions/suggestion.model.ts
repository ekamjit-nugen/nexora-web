import { Schema, Document } from 'mongoose';

export interface ISuggestion {
  id: string;
  productId: string;
  type: 'optimization' | 'feature' | 'risk' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  priority: number;
  category: string;
  actionItems: string[];
  estimatedBenefit: string;
  createdAt: Date;
}

export interface IAISuggestionResult extends Document {
  productId: string;
  suggestions: ISuggestion[];
  analysisDate: Date;
  overallScore: number;
  topPriorities: string[];
  riskFactors: string[];
  opportunities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const SuggestionSchema = new Schema({
  id: String,
  productId: String,
  type: { type: String, enum: ['optimization', 'feature', 'risk', 'opportunity'] },
  title: String,
  description: String,
  confidence: Number,
  impact: { type: String, enum: ['high', 'medium', 'low'] },
  priority: Number,
  category: String,
  actionItems: [String],
  estimatedBenefit: String,
  createdAt: Date,
});

export const AISuggestionResultSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    suggestions: [SuggestionSchema],
    analysisDate: Date,
    overallScore: Number,
    topPriorities: [String],
    riskFactors: [String],
    opportunities: [String],
  },
  { timestamps: true },
);

AISuggestionResultSchema.index({ productId: 1 });
AISuggestionResultSchema.index({ analysisDate: -1 });
AISuggestionResultSchema.index({ 'suggestions.type': 1 });
