import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { SuggestionService } from './suggestion.service';

@Controller('api/v1/suggestions')
export class SuggestionController {
  constructor(private readonly suggestionService: SuggestionService) {}

  /**
   * Analyze and generate suggestions
   */
  @Post('analyze')
  async analyzeSuggestions(@Body() body: any) {
    return this.suggestionService.analyzeSuggestions(body.productId, body.productData);
  }

  /**
   * Get latest suggestions
   */
  @Get('product/:productId/latest')
  async getLatestSuggestions(@Param('productId') productId: string) {
    return this.suggestionService.getLatestSuggestions(productId);
  }

  /**
   * Get suggestion history
   */
  @Get('product/:productId/history')
  async getSuggestionHistory(
    @Param('productId') productId: string,
    @Query('limit') limit: string,
  ) {
    return this.suggestionService.getSuggestionHistory(productId, parseInt(limit) || 10);
  }

  /**
   * Get suggestions by type
   */
  @Get('product/:productId/type/:type')
  async getSuggestionsByType(
    @Param('productId') productId: string,
    @Param('type') type: string,
  ) {
    return this.suggestionService.getSuggestionsByType(productId, type as any);
  }

  /**
   * Get high priority suggestions
   */
  @Get('product/:productId/high-priority')
  async getHighPrioritySuggestions(@Param('productId') productId: string) {
    return this.suggestionService.getHighPrioritySuggestions(productId);
  }

  /**
   * Accept suggestion
   */
  @Post('product/:productId/suggestions/:suggestionId/accept')
  async acceptSuggestion(
    @Param('productId') productId: string,
    @Param('suggestionId') suggestionId: string,
  ) {
    return this.suggestionService.acceptSuggestion(productId, suggestionId);
  }

  /**
   * Dismiss suggestion
   */
  @Post('product/:productId/suggestions/:suggestionId/dismiss')
  async dismissSuggestion(
    @Param('productId') productId: string,
    @Param('suggestionId') suggestionId: string,
  ) {
    return this.suggestionService.dismissSuggestion(productId, suggestionId);
  }

  /**
   * Get trending suggestions
   */
  @Get('trending')
  async getTrendingSuggestions(@Query('limit') limit: string) {
    return this.suggestionService.getTrendingSuggestions(parseInt(limit) || 10);
  }

  /**
   * Delete result
   */
  @Delete(':resultId')
  async deleteResult(@Param('resultId') resultId: string) {
    await this.suggestionService.deleteResult(resultId);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'suggestions' };
  }
}
