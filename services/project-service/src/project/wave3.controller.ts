import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Wave3MethodsService } from './utils/wave3-methods';
import { ProjectPermissionsService } from './utils/permissions';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ProjectAccessGuard } from './guards/project-access.guard';
import {
  AddProjectMemberDto,
  UpdateProjectMemberDto,
  CreateComponentDto,
  UpdateComponentDto,
  CreateReleaseDto,
  UpdateReleaseDto,
  UpdateProjectVisibilityDto,
  CloneTaskDto,
} from './dto/index';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class Wave3Controller {
  private readonly logger = new Logger(Wave3Controller.name);

  constructor(
    private wave3Service: Wave3MethodsService,
    private permissionsService: ProjectPermissionsService,
  ) {}

  // ── 3.1 Per-Project Role Assignment ──

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  async addProjectMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @Req() req,
  ) {
    const member = await this.wave3Service.addProjectMember(
      projectId,
      dto,
      req.user.userId,
    );
    return {
      success: true,
      message: 'Member added to project',
      data: member,
    };
  }

  @Get('members')
  async getProjectMembers(@Param('projectId') projectId: string) {
    const members = await this.wave3Service.getProjectMembers(projectId);
    return {
      success: true,
      message: 'Project members retrieved',
      data: members,
    };
  }

  @Get('members/:userId')
  async getProjectMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    const member = await this.wave3Service.getProjectMember(projectId, userId);
    return {
      success: true,
      message: 'Project member retrieved',
      data: member,
    };
  }

  @Put('members/:userId')
  async updateProjectMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateProjectMemberDto,
  ) {
    const member = await this.wave3Service.updateProjectMember(
      projectId,
      userId,
      dto,
    );
    return {
      success: true,
      message: 'Member role updated',
      data: member,
    };
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProjectMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    await this.wave3Service.removeProjectMember(projectId, userId);
    return {
      success: true,
      message: 'Member removed from project',
    };
  }

  // ── 3.3 Project Visibility ──

  @Put('visibility')
  async updateVisibility(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectVisibilityDto,
  ) {
    const project = await this.wave3Service.updateProjectVisibility(
      projectId,
      dto,
    );
    return {
      success: true,
      message: 'Project visibility updated',
      data: project,
    };
  }

  // ── 3.4 Components ──

  @Post('components')
  @HttpCode(HttpStatus.CREATED)
  async createComponent(
    @Param('projectId') projectId: string,
    @Body() dto: CreateComponentDto,
  ) {
    const project = await this.wave3Service.addComponent(projectId, dto);
    return {
      success: true,
      message: 'Component created',
      data: project.components,
    };
  }

  @Get('components')
  async getComponents(@Param('projectId') projectId: string) {
    const components = await this.wave3Service.getComponents(projectId);
    return {
      success: true,
      message: 'Components retrieved',
      data: components,
    };
  }

  @Put('components/:componentId')
  async updateComponent(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateComponentDto,
  ) {
    const project = await this.wave3Service.updateComponent(
      projectId,
      componentId,
      dto,
    );
    return {
      success: true,
      message: 'Component updated',
      data: project.components,
    };
  }

  @Delete('components/:componentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComponent(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
  ) {
    await this.wave3Service.deleteComponent(projectId, componentId);
    return {
      success: true,
      message: 'Component deleted',
    };
  }

  // ── 3.4 Releases (Fix Versions) ──

  @Post('releases')
  @HttpCode(HttpStatus.CREATED)
  async createRelease(
    @Param('projectId') projectId: string,
    @Body() dto: CreateReleaseDto,
  ) {
    const project = await this.wave3Service.createRelease(projectId, dto);
    return {
      success: true,
      message: 'Release created',
      data: project.releases,
    };
  }

  @Get('releases')
  async getReleases(@Param('projectId') projectId: string) {
    const releases = await this.wave3Service.getReleases(projectId);
    return {
      success: true,
      message: 'Releases retrieved',
      data: releases,
    };
  }

  @Put('releases/:releaseId')
  async updateRelease(
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
    @Body() dto: UpdateReleaseDto,
  ) {
    const project = await this.wave3Service.updateRelease(
      projectId,
      releaseId,
      dto,
    );
    return {
      success: true,
      message: 'Release updated',
      data: project.releases,
    };
  }

  @Delete('releases/:releaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRelease(
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    await this.wave3Service.deleteRelease(projectId, releaseId);
    return {
      success: true,
      message: 'Release deleted',
    };
  }

  // ── 3.2 Task Cloning (Placeholder) ──

  @Post('tasks/:taskId/clone')
  @HttpCode(HttpStatus.CREATED)
  async cloneTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CloneTaskDto,
    @Req() req,
  ) {
    const result = await this.wave3Service.cloneTask(
      projectId,
      taskId,
      dto,
      req.user.userId,
    );
    return {
      success: true,
      message: 'Task clone initiated',
      data: result,
    };
  }
}
