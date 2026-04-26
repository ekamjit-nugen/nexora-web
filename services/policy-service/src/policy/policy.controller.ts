import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { PolicyService } from './policy.service';
import { JwtAuthGuard, Roles } from './guards/jwt-auth.guard';
import {
  CreatePolicyDto, UpdatePolicyDto, PolicyQueryDto,
  CreateFromTemplateDto, AcknowledgePolicyDto,
} from './dto/index';

@Controller()
export class PolicyController {
  private readonly logger = new Logger(PolicyController.name);

  constructor(private policyService: PolicyService) {}

  // ── Policies ──

  // SEC-3: policy writes were completely ungated — any developer could
  // create/edit/delete org-wide policies. Restricted to admin / hr / owner
  // (HR writes the policies, admin approves, owner overrides).
  @Post('policies')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createPolicy(@Body() dto: CreatePolicyDto, @Req() req) {
    const policy = await this.policyService.createPolicy(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Policy created successfully', data: policy };
  }

  @Get('policies/templates')
  @UseGuards(JwtAuthGuard)
  async getTemplates(@Query('category') category?: string) {
    const templates = await this.policyService.getTemplates(category);
    return { success: true, message: 'Templates retrieved', data: templates };
  }

  @Get('policies/templates/:category')
  @UseGuards(JwtAuthGuard)
  async getTemplatesByCategory(@Param('category') category: string) {
    const templates = await this.policyService.getTemplates(category);
    return { success: true, message: 'Templates retrieved', data: templates };
  }

  @Post('policies/from-template/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createFromTemplate(
    @Param('id') id: string,
    @Body() dto: CreateFromTemplateDto,
    @Req() req,
  ) {
    const policy = await this.policyService.createFromTemplate(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Policy created from template', data: policy };
  }

  @Get('policies/applicable')
  @UseGuards(JwtAuthGuard)
  async getApplicablePolicies(
    @Query('departmentId') departmentId?: string,
    @Query('designationId') designationId?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?,
  ) {
    const policies = await this.policyService.getApplicablePolicies(
      req.user?.organizationId,
      departmentId,
      designationId,
      employeeId,
    );
    return { success: true, message: 'Applicable policies retrieved', data: policies };
  }

  @Get('policies')
  @UseGuards(JwtAuthGuard)
  async getPolicies(@Query() query: PolicyQueryDto, @Req() req) {
    const result = await this.policyService.getPolicies(query, req.user?.organizationId);
    return { success: true, message: 'Policies retrieved', data: result.data, pagination: result.pagination };
  }

  // NOTE: Sub-routes with /:id/xxx MUST come BEFORE /:id to avoid route conflict
  @Get('policies/:id/versions')
  @UseGuards(JwtAuthGuard)
  async getVersionHistory(@Param('id') id: string) {
    const versions = await this.policyService.getVersionHistory(id);
    return { success: true, message: 'Version history retrieved', data: versions };
  }

  @Post('policies/:id/acknowledge')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acknowledgePolicy(@Param('id') id: string, @Body() dto: AcknowledgePolicyDto, @Req() req) {
    const ack = await this.policyService.acknowledgePolicy(id, req.user.userId, dto);
    return { success: true, message: 'Policy acknowledged', data: ack };
  }

  @Get('policies/:id')
  @UseGuards(JwtAuthGuard)
  async getPolicyById(@Param('id') id: string, @Req() req) {
    const policy = await this.policyService.getPolicyById(id, req.user?.organizationId);
    return { success: true, message: 'Policy retrieved', data: policy };
  }

  @Put('policies/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async updatePolicy(@Param('id') id: string, @Body() dto: UpdatePolicyDto, @Req() req) {
    const policy = await this.policyService.updatePolicy(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Policy updated successfully', data: policy };
  }

  @Delete('policies/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async deletePolicy(@Param('id') id: string, @Req() req) {
    const result = await this.policyService.deletePolicy(id, req.user?.organizationId);
    return { success: true, ...result };
  }
}
