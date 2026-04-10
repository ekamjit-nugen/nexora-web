import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProject } from './schemas/project.schema';
import {
  CreateProjectDto, UpdateProjectDto, ProjectQueryDto,
  AddTeamMemberDto, AddMilestoneDto,
  AddRiskDto, UpdateRiskDto, UpdateBudgetDto, DuplicateProjectDto,
  UpdateTeamMemberDto, UpdateMilestoneDto,
} from './dto/index';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectModel('Project') private projectModel: Model<IProject>,
  ) {}

  // ── Project Key Generation ──

  private async generateProjectKey(projectName: string, orgId?: string): Promise<string> {
    const words = projectName.trim().split(/\s+/);
    let baseKey: string;

    if (words.length >= 2) {
      // Take first letter of each word, up to 4 chars
      baseKey = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
    } else {
      // Single word: take first 4 chars
      baseKey = words[0].substring(0, 4).toUpperCase();
    }

    // Check uniqueness within organization
    const filter: any = { projectKey: baseKey };
    if (orgId) filter.organizationId = orgId;

    const existing = await this.projectModel.findOne(filter);
    if (!existing) return baseKey;

    // Collision: append numeric suffix until unique
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

  // ── Projects ──

  async createProject(dto: CreateProjectDto, createdBy: string, orgId?: string) {
    const projectKey = await this.generateProjectKey(dto.projectName, orgId);

    const methodologyDefaults: Record<string, { enableSprints: boolean; enableEpics: boolean; estimationUnit: string }> = {
      scrum:     { enableSprints: true,  enableEpics: true,  estimationUnit: 'story_points' },
      kanban:    { enableSprints: false, enableEpics: true,  estimationUnit: 'story_points' },
      scrumban:  { enableSprints: true,  enableEpics: true,  estimationUnit: 'story_points' },
      waterfall: { enableSprints: false, enableEpics: true,  estimationUnit: 'hours' },
      xp:        { enableSprints: true,  enableEpics: false, estimationUnit: 'story_points' },
      lean:      { enableSprints: false, enableEpics: false, estimationUnit: 'story_points' },
      safe:      { enableSprints: true,  enableEpics: true,  estimationUnit: 'story_points' },
      custom:    { enableSprints: false, enableEpics: false, estimationUnit: 'story_points' },
    };
    const mDefaults = methodologyDefaults[dto.methodology as string] || methodologyDefaults.custom;

    const projectData: any = { ...dto };
    if (projectData.settings) {
      projectData.settings.enableSprints  = projectData.settings.enableSprints  ?? mDefaults.enableSprints;
      projectData.settings.enableEpics    = projectData.settings.enableEpics    ?? mDefaults.enableEpics;
      projectData.settings.estimationUnit = projectData.settings.estimationUnit ?? mDefaults.estimationUnit;
    } else {
      projectData.settings = { ...mDefaults };
    }

    const project = new this.projectModel({
      ...projectData,
      projectKey,
      createdBy,
      ...(orgId && { organizationId: orgId }),
    });
    project.team.push({
      userId: createdBy,
      role: 'owner',
      projectRole: 'Project Owner',
      skills: [],
      allocationPercentage: 100,
      assignedAt: new Date(),
    });
    await project.save();
    this.logger.log(`Project created: ${project._id} - ${dto.projectName} [${projectKey}]`);

    // Log activity
    await this.addActivity(project._id.toString(), 'created', `Project "${dto.projectName}" created`, createdBy);

    return project;
  }

  async getProjects(query: ProjectQueryDto, orgId?: string) {
    const { search, status, category, clientId, page = 1, limit = 20, sort = '-createdAt' } = query;

    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (clientId) filter.clientId = clientId;
    if (search) {
      filter.$or = [
        { projectName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortObj = sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

    const [data, total] = await Promise.all([
      this.projectModel.find(filter).sort(sortObj as any).skip(skip).limit(limit),
      this.projectModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getProjectById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async updateProject(id: string, dto: UpdateProjectDto, updatedBy: string, orgId?: string) {
    const existingFilter: any = { _id: id, isDeleted: false };
    if (orgId) existingFilter.organizationId = orgId;

    const existingProject = await this.projectModel.findOne(existingFilter);
    if (!existingProject) throw new NotFoundException('Project not found');

    const oldStatus = existingProject.status;

    // Status transition validation
    if (dto.status && dto.status !== oldStatus) {
      this.validateStatusTransition(oldStatus, dto.status, existingProject);

      // Set actualStartDate when transitioning to 'active'
      if (dto.status === 'active' && !existingProject.actualStartDate) {
        dto.actualStartDate = new Date().toISOString();
      }

      // Set actualEndDate when transitioning to 'completed'
      if (dto.status === 'completed') {
        dto.actualEndDate = new Date().toISOString();
      }
    }

    const project = await this.projectModel.findOneAndUpdate(
      existingFilter,
      { ...dto, updatedBy },
      { new: true },
    );

    this.logger.log(`Project updated: ${project._id}`);

    // Log activity for status changes
    if (dto.status && dto.status !== oldStatus) {
      await this.addActivity(id, 'status_changed', `Status changed from "${oldStatus}" to "${dto.status}"`, updatedBy);
    }

    // Recalculate health score
    await this.calculateHealthScore(id);

    return this.projectModel.findById(id);
  }

  private validateStatusTransition(from: string, to: string, project: IProject) {
    const allowedTransitions: Record<string, string[]> = {
      planning: ['active', 'cancelled'],
      active: ['on_hold', 'completed'],
      on_hold: ['active', 'cancelled'],
      cancelled: ['planning'],
    };

    const allowed = allowedTransitions[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(`Invalid status transition from "${from}" to "${to}"`);
    }

    // planning -> active: must have at least 1 team member
    if (from === 'planning' && to === 'active') {
      if (!project.team || project.team.length < 1) {
        throw new BadRequestException('Cannot activate project: at least 1 team member is required');
      }
    }

    // active -> completed: all milestones must be completed or missed
    if (from === 'active' && to === 'completed') {
      if (project.milestones && project.milestones.length > 0) {
        const pendingOrInProgress = project.milestones.filter(
          m => m.status === 'pending' || m.status === 'in_progress',
        );
        if (pendingOrInProgress.length > 0) {
          throw new BadRequestException(
            `Cannot complete project: ${pendingOrInProgress.length} milestone(s) are still pending or in progress`,
          );
        }
      }
    }
  }

  async deleteProject(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOneAndUpdate(
      filter,
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
    if (!project) throw new NotFoundException('Project not found');
    this.logger.log(`Project soft-deleted: ${project._id}`);
    return { message: 'Project deleted successfully' };
  }

  // ── Team Members ──

  async addTeamMember(projectId: string, dto: AddTeamMemberDto, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const existingMember = project.team.find(m => m.userId === dto.userId);
    if (existingMember) throw new ConflictException('User is already a team member');

    project.team.push({
      userId: dto.userId,
      role: dto.role || 'member',
      allocationPercentage: dto.allocationPercentage ?? 100,
      assignedAt: new Date(),
    });
    await project.save();
    this.logger.log(`Team member added to project ${projectId}: ${dto.userId}`);

    // Log activity
    await this.addActivity(projectId, 'member_added', `Team member "${dto.userId}" added with role "${dto.role || 'member'}"`, dto.userId);

    return project;
  }

  async updateTeamMember(projectId: string, userId: string, dto: UpdateTeamMemberDto, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const member = project.team.find(m => m.userId === userId);
    if (!member) throw new NotFoundException('Team member not found');

    if (dto.role !== undefined) member.role = dto.role;
    if (dto.projectRole !== undefined) member.projectRole = dto.projectRole;
    if (dto.allocationPercentage !== undefined) member.allocationPercentage = dto.allocationPercentage;
    if (dto.skills !== undefined) member.skills = dto.skills;

    await project.save();
    this.logger.log(`Team member updated in project ${projectId}: ${userId}`);

    // Log activity
    await this.addActivity(projectId, 'member_updated', `Team member "${userId}" updated`, userId);

    return project;
  }

  async removeTeamMember(projectId: string, userId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const memberIndex = project.team.findIndex(m => m.userId === userId);
    if (memberIndex === -1) throw new NotFoundException('Team member not found');

    project.team.splice(memberIndex, 1);
    await project.save();
    this.logger.log(`Team member removed from project ${projectId}: ${userId}`);

    // Log activity
    await this.addActivity(projectId, 'member_removed', `Team member "${userId}" removed`, userId);

    return project;
  }

  // ── Milestones ──

  async addMilestone(projectId: string, dto: AddMilestoneDto, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    project.milestones.push({
      name: dto.name,
      targetDate: new Date(dto.targetDate),
      status: 'pending',
    });
    await project.save();
    this.logger.log(`Milestone added to project ${projectId}: ${dto.name}`);
    return project;
  }

  async updateMilestone(projectId: string, milestoneId: string, dto: UpdateMilestoneDto, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const milestone = project.milestones.find(m => m._id.toString() === milestoneId);
    if (!milestone) throw new NotFoundException('Milestone not found');

    // Update all provided fields
    if (dto.name !== undefined) milestone.name = dto.name;
    if (dto.description !== undefined) milestone.description = dto.description;
    if (dto.phase !== undefined) milestone.phase = dto.phase;
    if (dto.targetDate !== undefined) milestone.targetDate = new Date(dto.targetDate);
    if (dto.deliverables !== undefined) milestone.deliverables = dto.deliverables;
    if (dto.dependencies !== undefined) milestone.dependencies = dto.dependencies;
    if (dto.ownerId !== undefined) milestone.ownerId = dto.ownerId;
    if (dto.order !== undefined) milestone.order = dto.order;

    if (dto.status !== undefined) {
      milestone.status = dto.status;
      if (dto.status === 'completed') {
        milestone.completedDate = new Date();
      }
    }

    await project.save();
    this.logger.log(`Milestone updated in project ${projectId}: ${milestoneId}`);

    // Log activity
    await this.addActivity(projectId, 'milestone_updated', `Milestone "${milestone.name}" updated`, null);

    // Recalculate health score
    await this.calculateHealthScore(projectId);

    return this.projectModel.findById(projectId);
  }

  async deleteMilestone(projectId: string, milestoneId: string, currentUserId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const milestoneIndex = project.milestones.findIndex(m => m._id.toString() === milestoneId);
    if (milestoneIndex === -1) throw new NotFoundException('Milestone not found');

    const removedMilestone = project.milestones[milestoneIndex];
    project.milestones.splice(milestoneIndex, 1);
    await project.save();
    this.logger.log(`Milestone removed from project ${projectId}: ${milestoneId}`);

    // Log activity
    await this.addActivity(projectId, 'milestone_removed', `Milestone "${removedMilestone.name}" removed`, currentUserId);

    return project;
  }

  // ── My Projects ──

  async getMyProjects(userId: string, orgId?: string, page = 1, limit = 20) {
    const filter: any = {
      isDeleted: false,
      'team.userId': userId,
    };
    if (orgId) filter.organizationId = orgId;

    const skip = (page - 1) * limit;
    const [projects, total] = await Promise.all([
      this.projectModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      this.projectModel.countDocuments(filter),
    ]);

    return {
      data: projects,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ── Stats ──

  async getStats(orgId?: string) {
    const baseFilter: any = { isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;

    const [total, active, completed, onHold, planning, cancelled] = await Promise.all([
      this.projectModel.countDocuments(baseFilter),
      this.projectModel.countDocuments({ ...baseFilter, status: 'active' }),
      this.projectModel.countDocuments({ ...baseFilter, status: 'completed' }),
      this.projectModel.countDocuments({ ...baseFilter, status: 'on_hold' }),
      this.projectModel.countDocuments({ ...baseFilter, status: 'planning' }),
      this.projectModel.countDocuments({ ...baseFilter, status: 'cancelled' }),
    ]);

    return { total, active, completed, onHold, planning, cancelled };
  }

  // ── Risks ──

  async addRisk(projectId: string, dto: AddRiskDto, userId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    project.risks.push({
      description: dto.description,
      probability: dto.probability || 'medium',
      impact: dto.impact || 'medium',
      mitigation: dto.mitigation || '',
      ownerId: dto.ownerId || null,
      status: 'open',
      createdAt: new Date(),
    });
    await project.save();
    this.logger.log(`Risk added to project ${projectId}`);

    // Log activity
    await this.addActivity(projectId, 'risk_added', `Risk added: "${dto.description}"`, userId);

    return project;
  }

  async updateRisk(projectId: string, riskId: string, dto: UpdateRiskDto, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const risk = project.risks.find(r => r._id.toString() === riskId);
    if (!risk) throw new NotFoundException('Risk not found');

    if (dto.description !== undefined) risk.description = dto.description;
    if (dto.probability !== undefined) risk.probability = dto.probability;
    if (dto.impact !== undefined) risk.impact = dto.impact;
    if (dto.mitigation !== undefined) risk.mitigation = dto.mitigation;
    if (dto.ownerId !== undefined) risk.ownerId = dto.ownerId;
    if (dto.status !== undefined) risk.status = dto.status;

    await project.save();
    this.logger.log(`Risk updated in project ${projectId}: ${riskId}`);
    return project;
  }

  async removeRisk(projectId: string, riskId: string, userId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const riskIndex = project.risks.findIndex(r => r._id.toString() === riskId);
    if (riskIndex === -1) throw new NotFoundException('Risk not found');

    const removedRisk = project.risks[riskIndex];
    project.risks.splice(riskIndex, 1);
    await project.save();
    this.logger.log(`Risk removed from project ${projectId}: ${riskId}`);

    // Log activity
    await this.addActivity(projectId, 'risk_removed', `Risk removed: "${removedRisk.description}"`, userId);

    return project;
  }

  // ── Activities ──

  async addActivity(projectId: string, action: string, description: string, userId: string) {
    const project = await this.projectModel.findById(projectId);
    if (!project) return;

    project.activities.push({
      action,
      description,
      userId: userId || null,
      createdAt: new Date(),
    });

    // Keep max 50 activities, trim oldest
    if (project.activities.length > 50) {
      const sorted = project.activities.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      project.activities = sorted.slice(0, 50) as any;
    }

    await project.save();
  }

  async getProjectActivities(projectId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    const activities = [...project.activities].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return activities;
  }

  // ── Budget ──

  async updateBudgetSpent(projectId: string, amount: number, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    if (!project.budget) {
      project.budget = { amount: 0, currency: 'USD', billingType: 'fixed', spent: 0 };
    }
    project.budget.spent = amount;
    await project.save();
    this.logger.log(`Budget spent updated for project ${projectId}: ${amount}`);

    // Recalculate health score after budget update
    await this.calculateHealthScore(projectId);

    return this.projectModel.findById(projectId);
  }

  // ── Health Score ──

  async calculateHealthScore(projectId: string) {
    const project = await this.projectModel.findById(projectId);
    if (!project) return;

    let score = 100;

    // 1. Milestone health (max deduction: -35 points)
    if (project.milestones.length > 0) {
      let milestoneDeduction = 0;
      const now = new Date();
      const overdueMilestones = project.milestones.filter(
        m => m.status !== 'completed' && new Date(m.targetDate) < now,
      );
      const overduePercentage = overdueMilestones.length / project.milestones.length;
      milestoneDeduction += Math.round(overduePercentage * 25);

      // Missed milestones penalty
      const missedCount = project.milestones.filter(m => m.status === 'missed').length;
      milestoneDeduction += missedCount * 5;

      score -= Math.min(milestoneDeduction, 35);
    }

    // 2. Schedule health (max deduction: -30 points)
    if (project.endDate) {
      let scheduleDeduction = 0;
      const now = new Date();
      const endDate = new Date(project.endDate);
      if (now > endDate && project.status !== 'completed') {
        scheduleDeduction += 20; // Project is overdue
      } else {
        const totalDuration = endDate.getTime() - (project.startDate ? new Date(project.startDate).getTime() : project.createdAt.getTime());
        const elapsed = now.getTime() - (project.startDate ? new Date(project.startDate).getTime() : project.createdAt.getTime());
        const timeProgress = totalDuration > 0 ? elapsed / totalDuration : 0;
        const taskProgress = project.progressPercentage / 100;
        if (timeProgress > 0.5 && taskProgress < timeProgress * 0.5) {
          scheduleDeduction += 10; // Significantly behind schedule
        }
      }
      score -= Math.min(scheduleDeduction, 30);
    }

    // 3. Budget burn rate check (up to -25 points)
    if (project.budget && project.budget.amount > 0) {
      const burnRate = project.budget.spent / project.budget.amount;
      if (burnRate > 1) {
        score -= 25; // Over budget
      } else if (burnRate > 0.9) {
        score -= 15; // Near budget limit
      } else if (burnRate > 0.75) {
        score -= 5;
      }
    }

    // 4. Open high-impact risks (max deduction: -15 points)
    if (project.risks.length > 0) {
      const openHighRisks = project.risks.filter(
        r => r.status === 'open' && (r.impact === 'high' || r.probability === 'high'),
      );
      score -= Math.min(openHighRisks.length * 5, 15);
    }

    // TODO: Add blocked-tasks factor once inter-service communication with task-service is implemented.
    // Blocked tasks should contribute up to -10 points based on percentage of blocked tasks.

    // Clamp between 0 and 100
    score = Math.max(0, Math.min(100, score));

    project.healthScore = score;
    await project.save();

    return score;
  }

  // ── Duplicate Project ──

  async duplicateProject(projectId: string, newName: string, userId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const source = await this.projectModel.findOne(filter);
    if (!source) throw new NotFoundException('Project not found');

    const projectKey = await this.generateProjectKey(newName, orgId);

    const duplicated = new this.projectModel({
      projectName: newName,
      projectKey,
      description: source.description,
      category: source.category,
      clientId: source.clientId,
      status: 'planning',
      priority: source.priority,
      departmentId: source.departmentId,
      ...(orgId && { organizationId: orgId }),
      budget: source.budget ? {
        amount: source.budget.amount,
        currency: source.budget.currency,
        billingType: source.budget.billingType,
        hourlyRate: source.budget.hourlyRate,
        spent: 0,
        retainerAmount: source.budget.retainerAmount,
      } : undefined,
      team: source.team.map(m => ({
        userId: m.userId,
        role: m.role,
        allocationPercentage: m.allocationPercentage,
        assignedAt: new Date(),
      })),
      milestones: source.milestones.map(m => ({
        name: m.name,
        targetDate: m.targetDate,
        completedDate: null,
        status: 'pending',
      })),
      risks: [],
      activities: [],
      settings: source.settings ? {
        boardType: source.settings.boardType,
        clientPortalEnabled: source.settings.clientPortalEnabled,
        sprintDuration: source.settings.sprintDuration,
        estimationUnit: source.settings.estimationUnit,
      } : undefined,
      tags: source.tags,
      healthScore: 100,
      progressPercentage: 0,
      createdBy: userId,
    });

    await duplicated.save();
    this.logger.log(`Project duplicated: ${source._id} -> ${duplicated._id}`);

    // Log activity on the new project
    await this.addActivity(duplicated._id.toString(), 'created', `Project duplicated from "${source.projectName}"`, userId);

    return duplicated;
  }

  // ── Dashboard ──

  async getProjectDashboard(projectId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    // Milestone progress
    const totalMilestones = project.milestones.length;
    const completedMilestones = project.milestones.filter(m => m.status === 'completed').length;
    const overdueMilestones = project.milestones.filter(
      m => m.status !== 'completed' && new Date(m.targetDate) < new Date(),
    ).length;

    // Next milestone: earliest pending or in_progress
    const now = new Date();
    const upcomingMilestones = project.milestones
      .filter(m => m.status === 'pending' || m.status === 'in_progress')
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
    const nextMilestone = upcomingMilestones.length > 0 ? {
      _id: upcomingMilestones[0]._id,
      name: upcomingMilestones[0].name,
      targetDate: upcomingMilestones[0].targetDate,
      status: upcomingMilestones[0].status,
      daysRemaining: Math.ceil((new Date(upcomingMilestones[0].targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    } : null;

    const milestoneProgress = {
      total: totalMilestones,
      completed: completedMilestones,
      overdue: overdueMilestones,
      completionRate: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
      nextMilestone,
    };

    // Budget utilization
    const budgetTotal = project.budget?.amount || 0;
    const budgetSpent = project.budget?.spent || 0;
    const budgetRemaining = budgetTotal - budgetSpent;
    const utilizationRate = budgetTotal > 0
      ? Math.round((budgetSpent / budgetTotal) * 100)
      : 0;

    // Burn rate: spent / weeksElapsed
    const startDate = project.startDate ? new Date(project.startDate) : project.createdAt;
    const weeksElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
    const burnRate = weeksElapsed > 0 ? budgetSpent / weeksElapsed : 0;

    // Projected total: burnRate * totalWeeks
    const endDate = project.endDate ? new Date(project.endDate) : null;
    const totalWeeks = endDate
      ? Math.max((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7), 0.01)
      : 0;
    const projectedTotal = weeksElapsed > 0 && totalWeeks > 0
      ? Math.round(burnRate * totalWeeks)
      : budgetSpent;

    // Health color based on utilization
    let healthColor: string;
    if (utilizationRate > 90) {
      healthColor = 'red';
    } else if (utilizationRate >= 70) {
      healthColor = 'amber';
    } else {
      healthColor = 'green';
    }

    const budgetUtilization = {
      total: budgetTotal,
      spent: budgetSpent,
      remaining: budgetRemaining,
      utilizationRate,
      burnRate: Math.round(burnRate * 100) / 100,
      projectedTotal,
      healthColor,
    };

    // Risk summary
    const riskSummary = {
      total: project.risks.length,
      open: project.risks.filter(r => r.status === 'open').length,
      mitigated: project.risks.filter(r => r.status === 'mitigated').length,
      occurred: project.risks.filter(r => r.status === 'occurred').length,
      closed: project.risks.filter(r => r.status === 'closed').length,
    };

    // Recent activities (last 10)
    const recentActivities = [...project.activities]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    // Unassigned slots: placeholder until role capacity planning is built
    const unassignedSlots = 0;

    return {
      project,
      milestoneProgress,
      budgetUtilization,
      riskSummary,
      recentActivities,
      teamSize: project.team.length,
      unassignedSlots,
      healthScore: project.healthScore,
      progressPercentage: project.progressPercentage,
    };
  }

  // ── Client Portal ──

  async getClientPortalData(projectId: string) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      isDeleted: false,
    });
    if (!project) throw new NotFoundException('Project not found');

    if (!project.settings?.clientPortalEnabled) {
      throw new BadRequestException('Client portal is not enabled for this project');
    }

    // Budget: client-safe view (no hourly rates or internal breakdowns)
    const budgetTotal = project.budget?.amount || 0;
    const budgetSpent = project.budget?.spent || 0;
    const budgetRemaining = budgetTotal - budgetSpent;
    const utilizationPercent = budgetTotal > 0
      ? Math.round((budgetSpent / budgetTotal) * 100)
      : 0;

    // Burn rate
    const now = new Date();
    const startDate = project.startDate ? new Date(project.startDate) : project.createdAt;
    const weeksElapsed = Math.max((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7), 0.01);
    const burnRate = Math.round((budgetSpent / weeksElapsed) * 100) / 100;

    // Recent updates: curated from activities (exclude internal details)
    const publicActions = ['created', 'status_changed', 'milestone_updated', 'milestone_added', 'archived'];
    const recentUpdates = [...project.activities]
      .filter(a => publicActions.includes(a.action))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(a => ({
        date: a.createdAt,
        title: a.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: a.description,
      }));

    // Team: name and role only (no internal details)
    const team = project.team.map(t => ({
      role: t.projectRole || t.role,
      userId: t.userId,
    }));

    return {
      projectName: project.projectName,
      projectKey: project.projectKey,
      description: project.description || '',
      status: project.status,
      progressPercentage: project.progressPercentage,
      healthScore: project.healthScore,
      startDate: project.startDate,
      endDate: project.endDate,
      milestones: (project.milestones || []).map(m => ({
        _id: m._id,
        name: m.name,
        status: m.status,
        targetDate: m.targetDate,
        completedDate: m.completedDate,
        phase: m.phase || null,
        deliverables: m.deliverables || [],
        description: m.description || '',
      })),
      releases: (project.releases || []).map(r => ({
        _id: r._id,
        name: r.name,
        status: r.status,
        releaseDate: r.releaseDate,
        description: r.description || '',
      })),
      budget: {
        total: budgetTotal,
        spent: budgetSpent,
        remaining: budgetRemaining,
        currency: project.budget?.currency || 'USD',
        utilizationPercent,
        burnRate,
      },
      recentUpdates,
      team,
    };
  }

  async toggleClientPortal(projectId: string, enabled: boolean, userId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    if (!project.settings) {
      (project as any).settings = {};
    }
    project.settings.clientPortalEnabled = enabled;
    await project.save();

    await this.addActivity(
      projectId,
      'settings_changed',
      `Client portal ${enabled ? 'enabled' : 'disabled'}`,
      userId,
    );

    return project;
  }

  // ── Archive Project ──

  async archiveProject(projectId: string, userId: string, orgId?: string) {
    const filter: any = { _id: projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const project = await this.projectModel.findOne(filter);
    if (!project) throw new NotFoundException('Project not found');

    // Validate milestone completion before archiving
    const pendingMilestones = (project.milestones || []).filter(
      m => m.status !== 'completed' && m.status !== 'missed',
    );
    if (pendingMilestones.length > 0) {
      throw new BadRequestException(
        `Cannot archive: ${pendingMilestones.length} milestone(s) are still pending or in progress. ` +
        `Complete or mark them as missed first.`,
      );
    }

    project.status = 'completed';
    project.actualEndDate = new Date();
    await project.save();
    this.logger.log(`Project archived: ${projectId}`);

    // Log activity
    await this.addActivity(projectId, 'archived', 'Project archived and marked as completed', userId);

    return project;
  }

  async getManagerOverview(orgId?: string): Promise<any> {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const [total, active, completed, onHold] = await Promise.all([
      this.projectModel.countDocuments(filter),
      this.projectModel.countDocuments({ ...filter, status: 'active' }),
      this.projectModel.countDocuments({ ...filter, status: 'completed' }),
      this.projectModel.countDocuments({ ...filter, status: 'on_hold' }),
    ]);

    const recentProjects = await this.projectModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    return {
      stats: { total, active, completed, onHold },
      recentProjects,
      teamWorkload: [],
      upcomingDeadlines: [],
      pendingApprovals: { leaveRequests: 0, timesheets: 0, expenses: 0 },
    };
  }
}
