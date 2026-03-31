import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProject } from '../schemas/project.schema';
import { IProjectMember } from '../schemas/project-member.schema';
import {
  AddProjectMemberDto,
  UpdateProjectMemberDto,
  CreateComponentDto,
  UpdateComponentDto,
  CreateReleaseDto,
  UpdateReleaseDto,
  UpdateProjectVisibilityDto,
  CloneTaskDto,
} from '../dto/index';
import { ProjectPermissionsService } from './permissions';

@Injectable()
export class Wave3MethodsService {
  constructor(
    @InjectModel('Project') private projectModel: Model<IProject>,
    @InjectModel('ProjectMember') private projectMemberModel: Model<IProjectMember>,
    private permissionsService: ProjectPermissionsService,
  ) {}

  // ── 3.1 Per-Project Role Assignment ──

  async addProjectMember(
    projectId: string,
    dto: AddProjectMemberDto,
    addedBy: string,
  ): Promise<IProjectMember> {
    // Check if user already is a member
    const existing = await this.projectMemberModel.findOne({
      projectId,
      userId: dto.userId,
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this project');
    }

    const member = new this.projectMemberModel({
      projectId,
      userId: dto.userId,
      role: dto.role || 'developer',
      permissions: dto.permissions,
      addedAt: new Date(),
      addedBy,
    });

    await member.save();
    return member;
  }

  async updateProjectMember(
    projectId: string,
    userId: string,
    dto: UpdateProjectMemberDto,
  ): Promise<IProjectMember> {
    const member = await this.projectMemberModel.findOne({
      projectId,
      userId,
    });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    if (dto.role) member.role = dto.role;
    if (dto.permissions) member.permissions = dto.permissions;

    await member.save();
    return member;
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const result = await this.projectMemberModel.deleteOne({
      projectId,
      userId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Project member not found');
    }
  }

  async getProjectMembers(projectId: string): Promise<IProjectMember[]> {
    return this.projectMemberModel.find({ projectId }).exec();
  }

  async getProjectMember(projectId: string, userId: string): Promise<IProjectMember> {
    const member = await this.projectMemberModel.findOne({
      projectId,
      userId,
    });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    return member;
  }

  // ── 3.3 Project Visibility Controls ──

  async updateProjectVisibility(
    projectId: string,
    dto: UpdateProjectVisibilityDto,
  ): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    project.visibility = dto.visibility as 'public' | 'private' | 'restricted';
    await project.save();

    return project;
  }

  async getAccessibleProjects(
    userId: string,
    orgId?: string,
    orgRole?: string,
  ): Promise<IProject[]> {
    // Platform admin sees all projects
    if (orgRole === 'platform_admin') {
      return this.projectModel
        .find({ organizationId: orgId, isDeleted: false })
        .exec();
    }

    // Get project IDs where user is a member
    const membershipIds = await this.projectMemberModel.distinct('projectId', {
      userId,
    });

    // Get projects where user is member OR project is public
    return this.projectModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        $or: [{ _id: { $in: membershipIds } }, { visibility: 'public' }],
      })
      .exec();
  }

  // ── 3.4 Components ──

  async addComponent(projectId: string, dto: CreateComponentDto): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.components) {
      project.components = [];
    }

    project.components.push({
      name: dto.name,
      description: dto.description,
      lead: dto.lead,
      defaultAssignee: dto.defaultAssignee,
      color: dto.color,
    });

    await project.save();
    return project;
  }

  async updateComponent(
    projectId: string,
    componentId: string,
    dto: UpdateComponentDto,
  ): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const component = project.components?.find(
      (c) => c._id?.toString() === componentId,
    );

    if (!component) {
      throw new NotFoundException('Component not found');
    }

    if (dto.name) component.name = dto.name;
    if (dto.description) component.description = dto.description;
    if (dto.lead) component.lead = dto.lead;
    if (dto.defaultAssignee) component.defaultAssignee = dto.defaultAssignee;
    if (dto.color) component.color = dto.color;

    await project.save();
    return project;
  }

  async deleteComponent(projectId: string, componentId: string): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    project.components = project.components?.filter(
      (c) => c._id?.toString() !== componentId,
    );

    await project.save();
    return project;
  }

  async getComponents(projectId: string) {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project.components || [];
  }

  // ── 3.4 Releases (Fix Versions) ──

  async createRelease(projectId: string, dto: CreateReleaseDto): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.releases) {
      project.releases = [];
    }

    project.releases.push({
      name: dto.name,
      description: dto.description,
      releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
      status: (dto.status as any) || 'planned',
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      releaseNotes: dto.releaseNotes,
      issues: dto.issues || [],
    });

    await project.save();
    return project;
  }

  async updateRelease(
    projectId: string,
    releaseId: string,
    dto: UpdateReleaseDto,
  ): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const release = project.releases?.find(
      (r) => r._id?.toString() === releaseId,
    );

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    if (dto.name) release.name = dto.name;
    if (dto.description) release.description = dto.description;
    if (dto.releaseDate) release.releaseDate = new Date(dto.releaseDate);
    if (dto.status) release.status = dto.status as any;
    if (dto.startDate) release.startDate = new Date(dto.startDate);
    if (dto.releasedDate) release.releasedDate = new Date(dto.releasedDate);
    if (dto.releaseNotes) release.releaseNotes = dto.releaseNotes;
    if (dto.issues) release.issues = dto.issues;

    await project.save();
    return project;
  }

  async deleteRelease(projectId: string, releaseId: string): Promise<IProject> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    project.releases = project.releases?.filter(
      (r) => r._id?.toString() !== releaseId,
    );

    await project.save();
    return project;
  }

  async getReleases(projectId: string) {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project.releases || [];
  }

  // ── 3.2 Task Cloning (Placeholder) ──

  async cloneTask(
    projectId: string,
    taskId: string,
    dto: CloneTaskDto,
    userId: string,
  ): Promise<any> {
    // This method requires task-service integration
    // For now, return placeholder response
    return {
      message: `Task ${taskId} cloning initiated`,
      targetProjectId: dto.targetProjectId,
      userId,
    };
  }
}
