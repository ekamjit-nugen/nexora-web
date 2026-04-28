import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProjectPublicApi, ProjectSummary } from './project-public-api';
import { PROJECT_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class ProjectPublicApiImpl implements ProjectPublicApi {
  constructor(
    @InjectModel('Project', PROJECT_DB) private readonly projectModel: Model<any>,
  ) {}

  async getProjectById(organizationId: string, projectId: string): Promise<ProjectSummary | null> {
    const p: any = await this.projectModel.findOne({
      _id: projectId,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();
    return p ? this.toSummary(p) : null;
  }

  async listActiveProjects(organizationId: string): Promise<ProjectSummary[]> {
    const rows: any[] = await this.projectModel.find({
      organizationId,
      status: { $nin: ['archived', 'cancelled'] },
      isDeleted: { $ne: true },
    }).lean();
    return rows.map((p) => this.toSummary(p));
  }

  private toSummary(p: any): ProjectSummary {
    return {
      _id: String(p._id),
      organizationId: String(p.organizationId),
      name: p.name,
      status: p.status || 'unknown',
      clientId: p.clientId ? String(p.clientId) : null,
      startDate: p.startDate || null,
      endDate: p.endDate || null,
    };
  }
}
