import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IRoadmap, IRoadmapPhase, IMilestone } from './roadmap.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RoadmapService {
  constructor(@InjectModel('Roadmap') private roadmapModel: Model<IRoadmap>) {}

  /**
   * Create roadmap
   */
  async createRoadmap(
    productId: string,
    roadmapData: {
      name: string;
      description?: string;
      phases: IRoadmapPhase[];
      startDate: Date;
      endDate: Date;
      visibility?: string;
    },
  ): Promise<IRoadmap> {
    if (roadmapData.startDate >= roadmapData.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const roadmap = new this.roadmapModel({
      productId,
      ...roadmapData,
      visibility: roadmapData.visibility || 'internal',
    });

    return roadmap.save();
  }

  /**
   * Get roadmap
   */
  async getRoadmap(roadmapId: string): Promise<IRoadmap> {
    const roadmap = await this.roadmapModel.findById(roadmapId);
    if (!roadmap) {
      throw new NotFoundException('Roadmap not found');
    }
    return roadmap;
  }

  /**
   * Get product roadmap
   */
  async getProductRoadmap(productId: string): Promise<IRoadmap> {
    const roadmap = await this.roadmapModel.findOne({ productId });
    if (!roadmap) {
      throw new NotFoundException('Roadmap not found for product');
    }
    return roadmap;
  }

  /**
   * Update roadmap
   */
  async updateRoadmap(
    roadmapId: string,
    updates: Partial<{
      name: string;
      description: string;
      phases: IRoadmapPhase[];
      visibility: string;
    }>,
  ): Promise<IRoadmap> {
    const roadmap = await this.getRoadmap(roadmapId);
    Object.assign(roadmap, updates);
    return roadmap.save();
  }

  /**
   * Add phase to roadmap
   */
  async addPhase(roadmapId: string, phase: IRoadmapPhase): Promise<IRoadmap> {
    const roadmap = await this.getRoadmap(roadmapId);

    if (phase.startDate >= phase.endDate) {
      throw new BadRequestException('Phase start date must be before end date');
    }

    phase.id = phase.id || uuidv4();
    roadmap.phases.push(phase);
    return roadmap.save();
  }

  /**
   * Update phase
   */
  async updatePhase(roadmapId: string, phaseId: string, updates: Partial<IRoadmapPhase>): Promise<IRoadmap> {
    const roadmap = await this.getRoadmap(roadmapId);
    const phase = roadmap.phases.find(p => p.id === phaseId);

    if (!phase) {
      throw new NotFoundException('Phase not found');
    }

    Object.assign(phase, updates);
    return roadmap.save();
  }

  /**
   * Add milestone to phase
   */
  async addMilestone(roadmapId: string, phaseId: string, milestone: IMilestone): Promise<IRoadmap> {
    const roadmap = await this.getRoadmap(roadmapId);
    const phase = roadmap.phases.find(p => p.id === phaseId);

    if (!phase) {
      throw new NotFoundException('Phase not found');
    }

    milestone.id = milestone.id || uuidv4();
    phase.milestones.push(milestone);
    return roadmap.save();
  }

  /**
   * Get timeline view
   */
  async getTimeline(roadmapId: string): Promise<any> {
    const roadmap = await this.getRoadmap(roadmapId);

    const timeline = {
      productId: roadmap.productId,
      name: roadmap.name,
      startDate: roadmap.startDate,
      endDate: roadmap.endDate,
      phases: roadmap.phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        status: phase.status,
        featureCount: phase.features.length,
        milestoneCount: phase.milestones.length,
        milestones: phase.milestones,
      })),
    };

    return timeline;
  }

  /**
   * Get roadmap statistics
   */
  async getRoadmapStats(roadmapId: string): Promise<any> {
    const roadmap = await this.getRoadmap(roadmapId);

    const stats = {
      totalPhases: roadmap.phases.length,
      totalFeatures: roadmap.phases.reduce((sum, p) => sum + p.features.length, 0),
      totalMilestones: roadmap.phases.reduce((sum, p) => sum + p.milestones.length, 0),
      phaseStats: roadmap.phases.map(p => ({
        phaseId: p.id,
        name: p.name,
        features: p.features.length,
        milestones: p.milestones.length,
        completedMilestones: p.milestones.filter(m => m.status === 'completed').length,
      })),
      completedMilestones: roadmap.phases.reduce(
        (sum, p) => sum + p.milestones.filter(m => m.status === 'completed').length,
        0,
      ),
    };

    return stats;
  }

  /**
   * Export roadmap
   */
  async exportRoadmap(roadmapId: string, format: 'json' | 'csv'): Promise<any> {
    const roadmap = await this.getRoadmap(roadmapId);

    if (format === 'json') {
      return roadmap.toObject();
    }

    // CSV export
    const csv = this.convertToCSV(roadmap);
    return csv;
  }

  /**
   * Share roadmap
   */
  async shareRoadmap(roadmapId: string, visibility: string): Promise<IRoadmap> {
    const roadmap = await this.getRoadmap(roadmapId);
    roadmap.visibility = visibility as any;
    return roadmap.save();
  }

  /**
   * Delete roadmap
   */
  async deleteRoadmap(roadmapId: string): Promise<void> {
    await this.roadmapModel.findByIdAndDelete(roadmapId);
  }

  /**
   * Convert roadmap to CSV
   */
  private convertToCSV(roadmap: IRoadmap): string {
    let csv = `Product Roadmap: ${roadmap.name}\n`;
    csv += `Start Date,End Date\n`;
    csv += `${roadmap.startDate.toISOString()},${roadmap.endDate.toISOString()}\n\n`;

    csv += `Phase,Start Date,End Date,Status,Features,Milestones\n`;
    roadmap.phases.forEach(phase => {
      csv += `${phase.name},${phase.startDate.toISOString()},${phase.endDate.toISOString()},${phase.status},${phase.features.length},${phase.milestones.length}\n`;

      phase.milestones.forEach(milestone => {
        csv += `,,Milestone: ${milestone.name},${milestone.status},Target: ${milestone.targetDate.toISOString()}\n`;
      });
    });

    return csv;
  }
}
