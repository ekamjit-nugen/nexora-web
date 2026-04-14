import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { AssetService } from './asset.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateAssetCategoryDto, UpdateAssetCategoryDto,
  CreateAssetDto, UpdateAssetDto, AssetQueryDto,
  AssignAssetDto, UnassignAssetDto, TransferAssetDto,
  BulkAssignDto, BulkUnassignDto,
  CreateMaintenanceDto, UpdateMaintenanceDto,
} from './dto';

@Controller('assets')
export class AssetController {
  private readonly logger = new Logger(AssetController.name);

  constructor(private readonly assetService: AssetService) {}

  // ── Categories ──

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateAssetCategoryDto, @Req() req) {
    const data = await this.assetService.createCategory(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Category created', data };
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async getCategories(@Req() req) {
    const data = await this.assetService.getCategories(req.user?.organizationId);
    return { success: true, message: 'Categories retrieved', data };
  }

  @Get('categories/:id')
  @UseGuards(JwtAuthGuard)
  async getCategory(@Param('id') id: string, @Req() req) {
    const data = await this.assetService.getCategory(req.user?.organizationId, id);
    return { success: true, message: 'Category retrieved', data };
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard)
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateAssetCategoryDto, @Req() req) {
    const data = await this.assetService.updateCategory(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Category updated', data };
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  async deleteCategory(@Param('id') id: string, @Req() req) {
    const data = await this.assetService.deleteCategory(req.user?.organizationId, id, req.user.userId);
    return { success: true, ...data };
  }

  // ── Assets ──

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAsset(@Body() dto: CreateAssetDto, @Req() req) {
    const data = await this.assetService.createAsset(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Asset created', data };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAssets(@Query() query: AssetQueryDto, @Req() req) {
    const result = await this.assetService.getAssets(req.user?.organizationId, query);
    return { success: true, message: 'Assets retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req) {
    const data = await this.assetService.getStats(req.user?.organizationId);
    return { success: true, message: 'Asset stats retrieved', data };
  }

  @Get('warranty-expiring')
  @UseGuards(JwtAuthGuard)
  async getWarrantyExpiring(@Query('days') days: number, @Req() req) {
    const data = await this.assetService.getWarrantyExpiring(req.user?.organizationId, days || 30);
    return { success: true, message: 'Warranty expiring assets retrieved', data };
  }

  @Get('employee/:employeeId')
  @UseGuards(JwtAuthGuard)
  async getEmployeeAssets(@Param('employeeId') employeeId: string, @Req() req) {
    const data = await this.assetService.getEmployeeAssets(req.user?.organizationId, employeeId);
    return { success: true, message: 'Employee assets retrieved', data };
  }

  @Get('employee/:employeeId/unreturned')
  @UseGuards(JwtAuthGuard)
  async getUnreturnedAssets(@Param('employeeId') employeeId: string, @Req() req) {
    const data = await this.assetService.getUnreturnedAssets(req.user?.organizationId, employeeId);
    return { success: true, message: 'Unreturned assets retrieved', data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getAsset(@Param('id') id: string, @Req() req) {
    const data = await this.assetService.getAsset(req.user?.organizationId, id);
    return { success: true, message: 'Asset retrieved', data };
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  async getAssetHistory(@Param('id') id: string, @Req() req) {
    const data = await this.assetService.getAssetHistory(req.user?.organizationId, id);
    return { success: true, message: 'Asset history retrieved', data };
  }

  @Get(':id/maintenance')
  @UseGuards(JwtAuthGuard)
  async getAssetMaintenance(@Param('id') id: string, @Req() req) {
    const data = await this.assetService.getAssetMaintenance(req.user?.organizationId, id);
    return { success: true, message: 'Maintenance logs retrieved', data };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto, @Req() req) {
    const data = await this.assetService.updateAsset(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Asset updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteAsset(@Param('id') id: string, @Req() req) {
    const data = await this.assetService.deleteAsset(req.user?.organizationId, id, req.user.userId);
    return { success: true, ...data };
  }

  // ── Assignment Operations ──

  @Post('assign')
  @UseGuards(JwtAuthGuard)
  async assignAsset(@Body() dto: AssignAssetDto, @Req() req) {
    const data = await this.assetService.assignAsset(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Asset assigned', data };
  }

  @Post('unassign')
  @UseGuards(JwtAuthGuard)
  async unassignAsset(@Body() dto: UnassignAssetDto, @Req() req) {
    const data = await this.assetService.unassignAsset(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Asset unassigned', data };
  }

  @Post('transfer')
  @UseGuards(JwtAuthGuard)
  async transferAsset(@Body() dto: TransferAssetDto, @Req() req) {
    const data = await this.assetService.transferAsset(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Asset transferred', data };
  }

  @Post('bulk-assign')
  @UseGuards(JwtAuthGuard)
  async bulkAssign(@Body() dto: BulkAssignDto, @Req() req) {
    const data = await this.assetService.bulkAssign(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Bulk assignment completed', data };
  }

  @Post('bulk-unassign')
  @UseGuards(JwtAuthGuard)
  async bulkUnassign(@Body() dto: BulkUnassignDto, @Req() req) {
    const data = await this.assetService.bulkUnassign(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Bulk unassignment completed', data };
  }

  // ── Maintenance ──

  @Post('maintenance')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createMaintenance(@Body() dto: CreateMaintenanceDto, @Req() req) {
    const data = await this.assetService.createMaintenance(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Maintenance log created', data };
  }

  @Put('maintenance/:id')
  @UseGuards(JwtAuthGuard)
  async updateMaintenance(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto, @Req() req) {
    const data = await this.assetService.updateMaintenance(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Maintenance log updated', data };
  }
}
