import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { DependencyService } from './dependency.service';
import { IDependency } from './dependency.model';

@Controller('api/v1/dependencies')
export class DependencyController {
  constructor(private readonly dependencyService: DependencyService) {}

  /**
   * Get dependency graph
   */
  @Get('graph/:productId')
  async getGraph(@Param('productId') productId: string) {
    return this.dependencyService.getGraph(productId);
  }

  /**
   * Add dependency
   */
  @Post('graph/:productId/dependencies')
  async addDependency(@Param('productId') productId: string, @Body() dependency: any) {
    return this.dependencyService.addDependency(productId, dependency);
  }

  /**
   * Remove dependency
   */
  @Delete('graph/:productId/dependencies/:dependencyId')
  async removeDependency(
    @Param('productId') productId: string,
    @Param('dependencyId') dependencyId: string,
  ) {
    return this.dependencyService.removeDependency(productId, dependencyId);
  }

  /**
   * Analyze impact
   */
  @Post('graph/:productId/analyze-impact')
  async analyzeImpact(@Param('productId') productId: string, @Body() body: any) {
    return this.dependencyService.analyzeImpact(productId, body.sourceProductId);
  }

  /**
   * Get graph visualization
   */
  @Get('graph/:productId/visualization')
  async getVisualization(@Param('productId') productId: string) {
    return this.dependencyService.getGraphVisualization(productId);
  }

  /**
   * Get critical paths
   */
  @Get('graph/:productId/critical-paths')
  async getCriticalPaths(@Param('productId') productId: string) {
    return this.dependencyService.getCriticalPaths(productId);
  }

  /**
   * Update dependency
   */
  @Put('graph/:productId/dependencies/:dependencyId')
  async updateDependency(
    @Param('productId') productId: string,
    @Param('dependencyId') dependencyId: string,
    @Body() updates: any,
  ) {
    return this.dependencyService.updateDependency(productId, dependencyId, updates);
  }

  /**
   * Get product dependencies
   */
  @Get('product/:productId')
  async getProductDependencies(@Param('productId') productId: string) {
    return this.dependencyService.getProductDependencies(productId);
  }

  /**
   * Get impact analyses
   */
  @Get('product/:productId/impact-analyses')
  async getImpactAnalyses(@Param('productId') productId: string) {
    return this.dependencyService.getImpactAnalyses(productId);
  }

  /**
   * Delete graph
   */
  @Delete('graph/:productId')
  async deleteGraph(@Param('productId') productId: string) {
    await this.dependencyService.deleteGraph(productId);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'dependencies' };
  }
}
