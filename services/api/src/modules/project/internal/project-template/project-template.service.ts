import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProjectTemplate } from './schemas/project-template.schema';
import { IProject } from '../project/schemas/project.schema';
import {
  CreateProjectTemplateDto,
  UpdateProjectTemplateDto,
  SaveAsTemplateDto,
  ApplyTemplateDto,
} from './dto/project-template.dto';

@Injectable()
export class ProjectTemplateService {
  private readonly logger = new Logger(ProjectTemplateService.name);

  constructor(
    @InjectModel('ProjectTemplate', 'nexora_projects') private templateModel: Model<IProjectTemplate>,
    @InjectModel('Project', 'nexora_projects') private projectModel: Model<IProject>,
  ) {}

  // ── Create Template from Scratch ──

  async createTemplate(dto: CreateProjectTemplateDto, userId: string, orgId: string) {
    const template = new this.templateModel({
      ...dto,
      organizationId: orgId,
      createdBy: userId,
    });
    await template.save();
    this.logger.log(`Template created: ${template._id} - ${dto.name}`);
    return template;
  }

  // ── Save Project as Template ──

  async createFromProject(projectId: string, dto: SaveAsTemplateDto, userId: string, orgId: string) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      isDeleted: false,
      ...(orgId && { organizationId: orgId }),
    });
    if (!project) throw new NotFoundException('Project not found');

    // Compute milestone offsets from project start date
    const projectStart = project.startDate
      ? new Date(project.startDate).getTime()
      : new Date(project.createdAt).getTime();

    const milestoneTemplates = (project.milestones || []).map((m) => ({
      name: m.name,
      description: m.description || undefined,
      phase: m.phase || undefined,
      offsetDays: Math.max(
        0,
        Math.round((new Date(m.targetDate).getTime() - projectStart) / (1000 * 60 * 60 * 24)),
      ),
      deliverables: m.deliverables || [],
    }));

    const defaultSettings = project.settings
      ? {
          boardType: project.settings.boardType,
          sprintDuration: project.settings.sprintDuration,
          estimationUnit: project.settings.estimationUnit,
          enableTimeTracking: project.settings.enableTimeTracking,
          enableSubtasks: project.settings.enableSubtasks,
          enableEpics: project.settings.enableEpics,
          enableSprints: project.settings.enableSprints,
          enableReleases: project.settings.enableReleases,
        }
      : {};

    // Extract team role patterns from the existing team
    const roleCountMap = new Map<string, { count: number; skills: Set<string> }>();
    for (const member of project.team || []) {
      const role = member.projectRole || member.role || 'member';
      if (!roleCountMap.has(role)) {
        roleCountMap.set(role, { count: 0, skills: new Set() });
      }
      const entry = roleCountMap.get(role)!;
      entry.count += 1;
      if (member.skills) {
        for (const skill of member.skills) {
          entry.skills.add(skill);
        }
      }
    }

    const teamRoles = Array.from(roleCountMap.entries()).map(([role, data]) => ({
      role,
      count: data.count,
      skills: Array.from(data.skills),
    }));

    const template = new this.templateModel({
      name: dto.name,
      description: dto.description || project.description,
      organizationId: orgId,
      category: project.category,
      methodology: project.methodology,
      createdBy: userId,
      isPublic: dto.isPublic ?? false,
      defaultSettings,
      milestoneTemplates,
      taskTemplates: [],
      boardColumns: [],
      teamRoles,
    });

    await template.save();
    this.logger.log(`Template created from project ${projectId}: ${template._id}`);
    return template;
  }

  // ── List Templates ──

  async list(orgId: string, search?: string, category?: string) {
    const filter: any = {
      isDeleted: false,
      $or: [
        { organizationId: orgId },
        { isPublic: true },
      ],
    };

    if (search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        },
      ];
      // Move the existing $or into $and to avoid conflict
      const orgFilter = filter.$or;
      delete filter.$or;
      filter.$and.push({ $or: orgFilter });
    }

    if (category) {
      filter.category = category;
    }

    const templates = await this.templateModel
      .find(filter)
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    return templates;
  }

  // ── Get Single Template ──

  async getById(id: string, orgId: string) {
    const template = await this.templateModel.findOne({
      _id: id,
      isDeleted: false,
      $or: [
        { organizationId: orgId },
        { isPublic: true },
      ],
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  // ── Update Template ──

  async update(id: string, dto: UpdateProjectTemplateDto, userId: string, orgId: string) {
    const template = await this.templateModel.findOne({
      _id: id,
      isDeleted: false,
      organizationId: orgId,
    });
    if (!template) throw new NotFoundException('Template not found');

    Object.assign(template, dto);
    await template.save();
    this.logger.log(`Template updated: ${id}`);
    return template;
  }

  // ── Delete Template (soft) ──

  async delete(id: string, userId: string, orgId: string) {
    const template = await this.templateModel.findOneAndUpdate(
      { _id: id, isDeleted: false, organizationId: orgId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
    if (!template) throw new NotFoundException('Template not found');
    this.logger.log(`Template soft-deleted: ${id}`);
    return { message: 'Template deleted successfully' };
  }

  // ── Create Project from Template ──

  async createProjectFromTemplate(
    templateId: string,
    dto: ApplyTemplateDto,
    userId: string,
    orgId: string,
  ) {
    const template = await this.templateModel.findOne({
      _id: templateId,
      isDeleted: false,
      $or: [
        { organizationId: orgId },
        { isPublic: true },
      ],
    });
    if (!template) throw new NotFoundException('Template not found');

    if (!dto.projectName || !dto.projectName.trim()) {
      throw new BadRequestException('Project name is required');
    }

    // Generate project key
    const projectKey = await this.generateProjectKey(dto.projectName, orgId);

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    // Compute milestone dates from offsets
    const milestones = (template.milestoneTemplates || []).map((mt) => ({
      name: mt.name,
      description: mt.description || undefined,
      phase: mt.phase || undefined,
      targetDate: new Date(startDate.getTime() + mt.offsetDays * 24 * 60 * 60 * 1000),
      status: 'pending',
      deliverables: mt.deliverables || [],
    }));

    // Build settings from template defaults
    const settings = template.defaultSettings
      ? {
          boardType: template.defaultSettings.boardType || 'kanban',
          clientPortalEnabled: false,
          sprintDuration: template.defaultSettings.sprintDuration || 14,
          estimationUnit: template.defaultSettings.estimationUnit || 'story_points',
          enableTimeTracking: template.defaultSettings.enableTimeTracking ?? true,
          enableSubtasks: template.defaultSettings.enableSubtasks ?? true,
          enableEpics: template.defaultSettings.enableEpics ?? false,
          enableSprints: template.defaultSettings.enableSprints ?? false,
          enableReleases: template.defaultSettings.enableReleases ?? false,
        }
      : undefined;

    const project = new this.projectModel({
      projectName: dto.projectName,
      projectKey,
      description: dto.description || template.description,
      category: dto.category || template.category,
      status: 'planning',
      priority: dto.priority || 'medium',
      methodology: template.methodology,
      organizationId: orgId,
      startDate,
      milestones,
      settings,
      templateRef: templateId,
      templateVersion: 1,
      team: [
        {
          userId,
          role: 'owner',
          projectRole: 'Project Owner',
          skills: [],
          allocationPercentage: 100,
          assignedAt: new Date(),
        },
      ],
      risks: [],
      activities: [
        {
          action: 'created',
          description: `Project created from template "${template.name}"`,
          userId,
          createdAt: new Date(),
        },
      ],
      tags: [],
      healthScore: 100,
      progressPercentage: 0,
      createdBy: userId,
    });

    await project.save();

    // Increment template usage count
    await this.templateModel.updateOne(
      { _id: templateId },
      { $inc: { usageCount: 1 } },
    );

    this.logger.log(
      `Project ${project._id} created from template ${templateId} (${template.name})`,
    );

    return project;
  }

  // ── Private: Generate Project Key ──

  private async generateProjectKey(projectName: string, orgId?: string): Promise<string> {
    const words = projectName.trim().split(/\s+/);
    let baseKey: string;

    if (words.length >= 2) {
      baseKey = words.map((w) => w[0]).join('').substring(0, 4).toUpperCase();
    } else {
      baseKey = words[0].substring(0, 4).toUpperCase();
    }

    const filter: any = { projectKey: baseKey };
    if (orgId) filter.organizationId = orgId;

    const existing = await this.projectModel.findOne(filter);
    if (!existing) return baseKey;

    let suffix = 1;
    while (true) {
      const candidateKey = `${baseKey}${suffix}`;
      const collisionFilter: any = { projectKey: candidateKey };
      if (orgId) collisionFilter.organizationId = orgId;
      const collision = await this.projectModel.findOne(collisionFilter);
      if (!collision) return candidateKey;
      suffix++;
    }
  }
}
