import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { BenchService } from './bench.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import {
  CreateResourceRequestDto, UpdateResourceRequestDto, UpdateMatchStatusDto,
  ResourceRequestQueryDto, BenchEmployeeQueryDto, BenchTrendQueryDto,
  UpdateBenchConfigDto,
} from './dto';

@Controller('bench')
export class BenchController {
  private readonly logger = new Logger(BenchController.name);

  constructor(private readonly benchService: BenchService) {}

  // ── Overview ──

  @Get('overview')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getOverview(@Req() req) {
    const data = await this.benchService.getBenchOverview(req.user?.organizationId, req.headers.authorization);
    return { success: true, message: 'Bench overview retrieved', data };
  }

  // ── Bench Employees ──

  @Get('employees')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getBenchEmployees(@Query() query: BenchEmployeeQueryDto, @Req() req) {
    const result = await this.benchService.getBenchEmployees(
      req.user?.organizationId, query, req.headers.authorization,
    );
    return { success: true, message: 'Bench employees retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('employees/:userId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getEmployeeStatus(@Param('userId') userId: string, @Req() req) {
    const data = await this.benchService.getEmployeeAllocationStatus(
      req.user?.organizationId, userId, req.headers.authorization,
    );
    return { success: true, message: 'Employee allocation status retrieved', data };
  }

  // ── Skills ──

  @Get('skills')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getSkillAvailability(@Query('skills') skills: string, @Req() req) {
    const skillList = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    const data = await this.benchService.getSkillAvailability(
      req.user?.organizationId, skillList, req.headers.authorization,
    );
    return { success: true, message: 'Skill availability retrieved', data };
  }

  // ── Analytics ──

  @Get('analytics')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getAnalytics(@Req() req) {
    const data = await this.benchService.getBenchAnalytics(
      req.user?.organizationId, req.headers.authorization,
    );
    return { success: true, message: 'Bench analytics retrieved', data };
  }

  // ── Trends ──

  @Get('trends')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getTrends(@Query() query: BenchTrendQueryDto, @Req() req) {
    const data = await this.benchService.getBenchTrends(req.user?.organizationId, query);
    return { success: true, message: 'Bench trends retrieved', data };
  }

  // ── Snapshots ──

  @Post('snapshot')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async takeSnapshot(@Req() req) {
    const data = await this.benchService.takeSnapshot(
      req.user?.organizationId, req.headers.authorization,
    );
    return { success: true, message: 'Bench snapshot created', data };
  }

  // ── Config ──

  @Get('config')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getConfig(@Req() req) {
    const data = await this.benchService.getBenchConfig(req.user?.organizationId);
    return { success: true, message: 'Bench config retrieved', data };
  }

  @Put('config')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateConfig(@Body() dto: UpdateBenchConfigDto, @Req() req) {
    const data = await this.benchService.updateBenchConfig(req.user?.organizationId, dto);
    return { success: true, message: 'Bench config updated', data };
  }

  // ── Resource Requests ──

  @Post('resource-requests')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async createResourceRequest(@Body() dto: CreateResourceRequestDto, @Req() req) {
    const data = await this.benchService.createResourceRequest(
      req.user?.organizationId, dto, req.user.userId, req.headers.authorization,
    );
    return { success: true, message: 'Resource request created', data };
  }

  @Get('resource-requests')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getResourceRequests(@Query() query: ResourceRequestQueryDto, @Req() req) {
    const result = await this.benchService.getResourceRequests(req.user?.organizationId, query);
    return { success: true, message: 'Resource requests retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('resource-requests/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getResourceRequest(@Param('id') id: string, @Req() req) {
    const data = await this.benchService.getResourceRequest(req.user?.organizationId, id);
    return { success: true, message: 'Resource request retrieved', data };
  }

  @Put('resource-requests/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateResourceRequest(@Param('id') id: string, @Body() dto: UpdateResourceRequestDto, @Req() req) {
    const data = await this.benchService.updateResourceRequest(
      req.user?.organizationId, id, dto, req.user.userId,
    );
    return { success: true, message: 'Resource request updated', data };
  }

  @Post('resource-requests/:id/match')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async rematchResourceRequest(@Param('id') id: string, @Req() req) {
    const data = await this.benchService.runMatching(
      req.user?.organizationId, id, req.headers.authorization,
    );
    return { success: true, message: 'Matching re-run successfully', data };
  }

  @Put('resource-requests/:id/matches/:userId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateMatchStatus(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMatchStatusDto,
    @Req() req,
  ) {
    const data = await this.benchService.updateMatchStatus(
      req.user?.organizationId, id, userId, dto, req.user.userId,
    );
    return { success: true, message: 'Match status updated', data };
  }

  @Delete('resource-requests/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async deleteResourceRequest(@Param('id') id: string, @Req() req) {
    const data = await this.benchService.deleteResourceRequest(
      req.user?.organizationId, id, req.user.userId,
    );
    return { success: true, ...data };
  }
}
