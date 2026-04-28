import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { ProjectTemplateService } from './project-template.service';
import { JwtAuthGuard } from '../project/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../project/guards/roles.guard';
import {
  CreateProjectTemplateDto,
  UpdateProjectTemplateDto,
  SaveAsTemplateDto,
  ApplyTemplateDto,
} from './dto/project-template.dto';

@Controller()
export class ProjectTemplateController {
  private readonly logger = new Logger(ProjectTemplateController.name);

  constructor(private templateService: ProjectTemplateService) {}

  // ── List Templates ──

  @Get('projects/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listTemplates(
    @Req() req,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const templates = await this.templateService.list(
      req.user?.organizationId,
      search,
      category,
    );
    return { success: true, message: 'Templates retrieved', data: templates };
  }

  // ── Get Single Template ──

  @Get('projects/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getTemplate(@Param('id') id: string, @Req() req) {
    const template = await this.templateService.getById(id, req.user?.organizationId);
    return { success: true, message: 'Template retrieved', data: template };
  }

  // ── Create Template from Scratch ──

  @Post('projects/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(@Body() dto: CreateProjectTemplateDto, @Req() req) {
    const template = await this.templateService.createTemplate(
      dto,
      req.user.userId,
      req.user?.organizationId,
    );
    return { success: true, message: 'Template created successfully', data: template };
  }

  // ── Save Project as Template ──

  @Post('projects/templates/from-project/:projectId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async saveAsTemplate(
    @Param('projectId') projectId: string,
    @Body() dto: SaveAsTemplateDto,
    @Req() req,
  ) {
    const template = await this.templateService.createFromProject(
      projectId,
      dto,
      req.user.userId,
      req.user?.organizationId,
    );
    return { success: true, message: 'Project saved as template', data: template };
  }

  // ── Update Template ──

  @Put('projects/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateProjectTemplateDto,
    @Req() req,
  ) {
    const template = await this.templateService.update(
      id,
      dto,
      req.user.userId,
      req.user?.organizationId,
    );
    return { success: true, message: 'Template updated successfully', data: template };
  }

  // ── Delete Template ──

  @Delete('projects/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async deleteTemplate(@Param('id') id: string, @Req() req) {
    const result = await this.templateService.delete(
      id,
      req.user.userId,
      req.user?.organizationId,
    );
    return { success: true, ...result };
  }

  // ── Apply Template (Create Project from Template) ──

  @Post('projects/templates/:id/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyTemplateDto,
    @Req() req,
  ) {
    const project = await this.templateService.createProjectFromTemplate(
      id,
      dto,
      req.user.userId,
      req.user?.organizationId,
    );
    return { success: true, message: 'Project created from template', data: project };
  }
}
