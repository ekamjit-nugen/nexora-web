import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { RoadmapService } from './roadmap.service';
import { IRoadmapPhase, IMilestone } from './roadmap.model';

@Controller('api/v1/roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  /**
   * Create roadmap
   */
  @Post()
  async createRoadmap(@Body() body: any) {
    return this.roadmapService.createRoadmap(body.productId, {
      name: body.name,
      description: body.description,
      phases: body.phases,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      visibility: body.visibility,
    });
  }

  /**
   * Get roadmap
   */
  @Get(':id')
  async getRoadmap(@Param('id') id: string) {
    return this.roadmapService.getRoadmap(id);
  }

  /**
   * Get product roadmap
   */
  @Get('product/:productId')
  async getProductRoadmap(@Param('productId') productId: string) {
    return this.roadmapService.getProductRoadmap(productId);
  }

  /**
   * Update roadmap
   */
  @Put(':id')
  async updateRoadmap(@Param('id') id: string, @Body() body: any) {
    return this.roadmapService.updateRoadmap(id, body);
  }

  /**
   * Add phase
   */
  @Post(':id/phases')
  async addPhase(@Param('id') id: string, @Body() phase: IRoadmapPhase) {
    return this.roadmapService.addPhase(id, phase);
  }

  /**
   * Update phase
   */
  @Put(':id/phases/:phaseId')
  async updatePhase(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() body: any,
  ) {
    return this.roadmapService.updatePhase(id, phaseId, body);
  }

  /**
   * Add milestone
   */
  @Post(':id/phases/:phaseId/milestones')
  async addMilestone(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() milestone: IMilestone,
  ) {
    return this.roadmapService.addMilestone(id, phaseId, milestone);
  }

  /**
   * Get timeline
   */
  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    return this.roadmapService.getTimeline(id);
  }

  /**
   * Get statistics
   */
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.roadmapService.getRoadmapStats(id);
  }

  /**
   * Export roadmap
   */
  @Get(':id/export')
  async exportRoadmap(@Param('id') id: string, @Query('format') format: string) {
    return this.roadmapService.exportRoadmap(id, (format as any) || 'json');
  }

  /**
   * Share roadmap
   */
  @Post(':id/share')
  async shareRoadmap(@Param('id') id: string, @Body() body: any) {
    return this.roadmapService.shareRoadmap(id, body.visibility);
  }

  /**
   * Delete roadmap
   */
  @Delete(':id')
  async deleteRoadmap(@Param('id') id: string) {
    await this.roadmapService.deleteRoadmap(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'roadmap' };
  }
}
