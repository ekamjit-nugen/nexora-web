import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard, Roles } from './guards/roles.guard';
import {
  CreateProjectDto, UpdateProjectDto, ProjectQueryDto,
  AddTeamMemberDto, UpdateTeamMemberDto, AddMilestoneDto, UpdateMilestoneDto,
  AddRiskDto, UpdateRiskDto, UpdateBudgetDto, DuplicateProjectDto,
} from './dto/index';

@Controller()
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(private projectService: ProjectService) {}

  // ── Projects ──

  @Post('projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createProject(@Body() dto: CreateProjectDto, @Req() req) {
    const project = await this.projectService.createProject(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Project created successfully', data: project };
  }

  @Get('projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getProjects(@Query() query: ProjectQueryDto, @Req() req) {
    const result = await this.projectService.getProjects(query, req.user?.organizationId);
    return { success: true, message: 'Projects retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('projects/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMyProjects(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.projectService.getMyProjects(
      req.user.userId,
      req.user?.organizationId,
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
    return { success: true, message: 'My projects retrieved', ...result };
  }

  @Get('projects/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async getStats(@Req() req) {
    const stats = await this.projectService.getStats(req.user?.organizationId);
    return { success: true, message: 'Project stats retrieved', data: stats };
  }

  @Get('projects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getProject(@Param('id') id: string, @Req() req) {
    const project = await this.projectService.getProjectById(id, req.user?.organizationId);
    return { success: true, message: 'Project retrieved', data: project };
  }

  @Put('projects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async updateProject(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Req() req) {
    const project = await this.projectService.updateProject(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Project updated successfully', data: project };
  }

  @Delete('projects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async deleteProject(@Param('id') id: string, @Req() req) {
    const result = await this.projectService.deleteProject(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Team Members ──

  @Post('projects/:id/team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async addTeamMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto, @Req() req) {
    const project = await this.projectService.addTeamMember(id, dto, req.user?.organizationId);
    return { success: true, message: 'Team member added successfully', data: project };
  }

  @Put('projects/:id/team/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async updateTeamMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateTeamMemberDto,
    @Req() req,
  ) {
    const project = await this.projectService.updateTeamMember(id, userId, dto, req.user?.organizationId);
    return { success: true, message: 'Team member updated successfully', data: project };
  }

  @Delete('projects/:id/team/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async removeTeamMember(@Param('id') id: string, @Param('userId') userId: string, @Req() req) {
    const project = await this.projectService.removeTeamMember(id, userId, req.user?.organizationId);
    return { success: true, message: 'Team member removed successfully', data: project };
  }

  // ── Milestones ──

  @Post('projects/:id/milestones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async addMilestone(@Param('id') id: string, @Body() dto: AddMilestoneDto, @Req() req) {
    const project = await this.projectService.addMilestone(id, dto, req.user?.organizationId);
    return { success: true, message: 'Milestone added successfully', data: project };
  }

  @Put('projects/:id/milestones/:milestoneId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @Req() req,
  ) {
    const project = await this.projectService.updateMilestone(id, milestoneId, dto, req.user?.organizationId);
    return { success: true, message: 'Milestone updated successfully', data: project };
  }

  @Delete('projects/:id/milestones/:milestoneId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async deleteMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Req() req,
  ) {
    const project = await this.projectService.deleteMilestone(id, milestoneId, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Milestone removed successfully', data: project };
  }

  // ── Risks ──

  @Post('projects/:id/risks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async addRisk(@Param('id') id: string, @Body() dto: AddRiskDto, @Req() req) {
    const project = await this.projectService.addRisk(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Risk added successfully', data: project };
  }

  @Put('projects/:id/risks/:riskId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async updateRisk(
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Body() dto: UpdateRiskDto,
    @Req() req,
  ) {
    const project = await this.projectService.updateRisk(id, riskId, dto, req.user?.organizationId);
    return { success: true, message: 'Risk updated successfully', data: project };
  }

  @Delete('projects/:id/risks/:riskId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async removeRisk(@Param('id') id: string, @Param('riskId') riskId: string, @Req() req) {
    const project = await this.projectService.removeRisk(id, riskId, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Risk removed successfully', data: project };
  }

  // ── Activities ──

  @Get('projects/:id/activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getActivities(@Param('id') id: string, @Req() req) {
    const activities = await this.projectService.getProjectActivities(id, req.user?.organizationId);
    return { success: true, message: 'Activities retrieved', data: activities };
  }

  // ── Dashboard ──

  @Get('projects/:id/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getDashboard(@Param('id') id: string, @Req() req) {
    const dashboard = await this.projectService.getProjectDashboard(id, req.user?.organizationId);
    return { success: true, message: 'Dashboard retrieved', data: dashboard };
  }

  // ── Duplicate ──

  @Post('projects/:id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async duplicateProject(@Param('id') id: string, @Body() dto: DuplicateProjectDto, @Req() req) {
    const project = await this.projectService.duplicateProject(id, dto.projectName, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Project duplicated successfully', data: project };
  }

  // ── Archive ──

  @Post('projects/:id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async archiveProject(@Param('id') id: string, @Req() req) {
    const project = await this.projectService.archiveProject(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Project archived successfully', data: project };
  }

  // ── Budget ──

  @Put('projects/:id/budget')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async updateBudget(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @Req() req) {
    const project = await this.projectService.updateBudgetSpent(id, dto.spent, req.user?.organizationId);
    return { success: true, message: 'Budget updated successfully', data: project };
  }
}
