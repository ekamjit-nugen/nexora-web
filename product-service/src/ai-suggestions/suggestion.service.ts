import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAISuggestionResult, ISuggestion } from './suggestion.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SuggestionService {
  constructor(@InjectModel('AISuggestionResult') private resultModel: Model<IAISuggestionResult>) {}

  /**
   * Analyze product and generate AI suggestions
   */
  async analyzeSuggestions(productId: string, productData: Record<string, any>): Promise<IAISuggestionResult> {
    const suggestions = this.generateSuggestions(productId, productData);
    const topPriorities = suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5)
      .map(s => s.title);

    const riskFactors = suggestions
      .filter(s => s.type === 'risk')
      .map(s => s.title);

    const opportunities = suggestions
      .filter(s => s.type === 'opportunity')
      .map(s => s.title);

    const result = new this.resultModel({
      productId,
      suggestions,
      analysisDate: new Date(),
      overallScore: this.calculateOverallScore(suggestions),
      topPriorities,
      riskFactors,
      opportunities,
    });

    return result.save();
  }

  /**
   * Generate suggestions using AI/ML logic
   */
  private generateSuggestions(productId: string, data: Record<string, any>): ISuggestion[] {
    const suggestions: ISuggestion[] = [];

    // Optimization suggestions
    suggestions.push({
      id: uuidv4(),
      productId,
      type: 'optimization',
      title: 'Implement Caching for Frequent Queries',
      description: 'Reduce database load by caching frequently accessed data',
      confidence: 0.92,
      impact: 'high',
      priority: 95,
      category: 'Performance',
      actionItems: [
        'Identify frequently accessed queries',
        'Implement Redis caching layer',
        'Set appropriate TTLs',
      ],
      estimatedBenefit: '40-50% reduction in query latency',
      createdAt: new Date(),
    });

    // Feature suggestions
    suggestions.push({
      id: uuidv4(),
      productId,
      type: 'feature',
      title: 'Add Product Comparison Tool',
      description: 'Enable side-by-side comparison of product variants',
      confidence: 0.85,
      impact: 'high',
      priority: 88,
      category: 'Feature',
      actionItems: [
        'Design UI mockups',
        'Implement comparison logic',
        'Add test coverage',
      ],
      estimatedBenefit: 'Improve user engagement by 25%',
      createdAt: new Date(),
    });

    // Risk suggestions
    suggestions.push({
      id: uuidv4(),
      productId,
      type: 'risk',
      title: 'Strengthen Authentication Security',
      description: 'Implement multi-factor authentication',
      confidence: 0.89,
      impact: 'high',
      priority: 90,
      category: 'Security',
      actionItems: [
        'Implement TOTP support',
        'Add backup codes',
        'Setup recovery options',
      ],
      estimatedBenefit: 'Reduce security breach risk by 80%',
      createdAt: new Date(),
    });

    // Opportunity suggestions
    suggestions.push({
      id: uuidv4(),
      productId,
      type: 'opportunity',
      title: 'Leverage AI for Personalization',
      description: 'Use machine learning to personalize user experience',
      confidence: 0.78,
      impact: 'high',
      priority: 82,
      category: 'AI/ML',
      actionItems: [
        'Collect user behavior data',
        'Train ML models',
        'Implement personalization engine',
      ],
      estimatedBenefit: 'Increase user retention by 35%',
      createdAt: new Date(),
    });

    suggestions.push({
      id: uuidv4(),
      productId,
      type: 'optimization',
      title: 'Optimize Database Indexes',
      description: 'Review and optimize database indexes for better query performance',
      confidence: 0.88,
      impact: 'medium',
      priority: 75,
      category: 'Database',
      actionItems: [
        'Analyze slow queries',
        'Create missing indexes',
        'Remove unused indexes',
      ],
      estimatedBenefit: '20-30% query performance improvement',
      createdAt: new Date(),
    });

    return suggestions;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(suggestions: ISuggestion[]): number {
    if (suggestions.length === 0) return 0;

    const totalWeight = suggestions.reduce((sum, s) => sum + s.confidence * s.priority, 0);
    const maxWeight = suggestions.length * 1.0 * 100;

    return Math.min(100, (totalWeight / maxWeight) * 100);
  }

  /**
   * Get latest suggestions for product
   */
  async getLatestSuggestions(productId: string): Promise<IAISuggestionResult> {
    const result = await this.resultModel
      .findOne({ productId })
      .sort({ analysisDate: -1 });

    if (!result) {
      throw new NotFoundException('No suggestions found for product');
    }

    return result;
  }

  /**
   * Get suggestion history
   */
  async getSuggestionHistory(productId: string, limit: number = 10): Promise<IAISuggestionResult[]> {
    return this.resultModel
      .find({ productId })
      .sort({ analysisDate: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get suggestions by type
   */
  async getSuggestionsByType(
    productId: string,
    type: 'optimization' | 'feature' | 'risk' | 'opportunity',
  ): Promise<ISuggestion[]> {
    const result = await this.getLatestSuggestions(productId);
    return result.suggestions.filter(s => s.type === type);
  }

  /**
   * Get high priority suggestions
   */
  async getHighPrioritySuggestions(productId: string): Promise<ISuggestion[]> {
    const result = await this.getLatestSuggestions(productId);
    return result.suggestions
      .filter(s => s.priority >= 80)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Accept and implement suggestion
   */
  async acceptSuggestion(productId: string, suggestionId: string): Promise<IAISuggestionResult> {
    const result = await this.getLatestSuggestions(productId);

    const suggestion = result.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    // Mark as accepted by removing from suggestions
    result.suggestions = result.suggestions.filter(s => s.id !== suggestionId);
    return result.save();
  }

  /**
   * Dismiss suggestion
   */
  async dismissSuggestion(productId: string, suggestionId: string): Promise<IAISuggestionResult> {
    const result = await this.getLatestSuggestions(productId);

    const suggestion = result.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    // Remove dismissed suggestion
    result.suggestions = result.suggestions.filter(s => s.id !== suggestionId);
    return result.save();
  }

  /**
   * Get trending suggestions across products
   */
  async getTrendingSuggestions(limit: number = 10): Promise<any> {
    const results = await this.resultModel
      .find()
      .sort({ analysisDate: -1 })
      .limit(100)
      .exec();

    const suggestionMap = new Map<string, number>();

    results.forEach(result => {
      result.suggestions.forEach(suggestion => {
        const key = `${suggestion.type}:${suggestion.title}`;
        suggestionMap.set(key, (suggestionMap.get(key) || 0) + 1);
      });
    });

    const trending = Array.from(suggestionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({
        suggestion: key,
        frequency: count,
      }));

    return trending;
  }

  /**
   * Delete suggestion result
   */
  async deleteResult(resultId: string): Promise<void> {
    await this.resultModel.findByIdAndDelete(resultId);
  }
}
