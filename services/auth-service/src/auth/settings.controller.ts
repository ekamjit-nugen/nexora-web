import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';
import { AuditService, AuditAction } from './audit.service';

// Dangerous fields that must never be set via settings endpoints
const FORBIDDEN_FIELDS = ['_id', 'createdBy', 'createdAt', 'updatedAt', 'isDeleted', 'isActive', 'ownerId', 'slug', 'plan', '__v'];

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  for (const field of FORBIDDEN_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private organizationService: OrganizationService,
    private auditService: AuditService,
  ) {}

  // ─── General ───────────────────────────────────────────────

  @Get('general')
  async getGeneral(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    const data = {
      name: org.name,
      slug: (org as any).slug,
      industry: org.industry,
      size: org.size,
      type: (org as any).type,
      country: (org as any).country,
      state: (org as any).state,
      city: (org as any).city,
      description: (org as any).description,
      foundedYear: (org as any).foundedYear,
      website: (org as any).website,
      settings: org.settings,
    };
    return { success: true, data };
  }

  @Put('general')
  async updateGeneral(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.updateOrganization(orgId, sanitizeBody(body));
    await this.auditService.log({
      action: AuditAction.SETTINGS_GENERAL_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
    });
    return { success: true, message: 'General settings updated', data: org };
  }

  @Get('general/check-slug')
  async checkSlug(@Query('slug') slug: string, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    if (!slug) throw new HttpException('Slug query parameter is required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    const isOwn = (org as any).slug === slug;
    // Check if slug is taken by another org
    const available = isOwn || !(await (this.organizationService as any).organizationModel?.findOne({ slug, _id: { $ne: orgId } }));
    return { success: true, data: { slug, available: !!available } };
  }

  // ─── Business ──────────────────────────────────────────────

  @Get('business')
  async getBusiness(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    return { success: true, data: (org as any).business || {} };
  }

  @Put('business')
  async updateBusiness(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    (org as any).business = { ...((org as any).business || {}), ...sanitizeBody(body) };
    org.markModified('business');
    await org.save();
    await this.auditService.log({
      action: AuditAction.SETTINGS_BUSINESS_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
    });
    return { success: true, message: 'Business details updated', data: (org as any).business };
  }

  // ─── Payroll ───────────────────────────────────────────────

  @Get('payroll')
  async getPayroll(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    return { success: true, data: (org as any).payroll || {} };
  }

  @Put('payroll')
  async updatePayroll(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    (org as any).payroll = { ...((org as any).payroll || {}), ...sanitizeBody(body) };
    org.markModified('payroll');
    await org.save();
    await this.auditService.log({
      action: AuditAction.SETTINGS_PAYROLL_SCHEDULE_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
    });
    return { success: true, message: 'Payroll configuration updated', data: (org as any).payroll };
  }

  // ─── Work Preferences ─────────────────────────────────────

  @Get('work-preferences')
  async getWorkPreferences(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    return { success: true, data: (org as any).workPreferences || {} };
  }

  @Put('work-preferences')
  async updateWorkPreferences(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    (org as any).workPreferences = { ...((org as any).workPreferences || {}), ...sanitizeBody(body) };
    org.markModified('workPreferences');
    await org.save();
    await this.auditService.log({
      action: AuditAction.SETTINGS_WORK_HOURS_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
    });
    return { success: true, message: 'Work preferences updated', data: (org as any).workPreferences };
  }

  // ─── Holidays ──────────────────────────────────────────────

  @Post('work-preferences/holidays')
  async addHoliday(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.addHoliday(orgId, body);
    await this.auditService.log({
      action: AuditAction.SETTINGS_HOLIDAY_ADDED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { holiday: body },
    });
    return { success: true, message: 'Holiday added', data: (org as any).workPreferences?.holidays };
  }

  @Put('work-preferences/holidays/:id')
  async updateHoliday(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.updateHoliday(orgId, id, body);
    await this.auditService.log({
      action: AuditAction.SETTINGS_WORK_HOURS_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { holidayId: id },
    });
    return { success: true, message: 'Holiday updated', data: (org as any).workPreferences?.holidays };
  }

  @Delete('work-preferences/holidays/:id')
  async removeHoliday(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.removeHoliday(orgId, id);
    await this.auditService.log({
      action: AuditAction.SETTINGS_HOLIDAY_REMOVED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { holidayId: id },
    });
    return { success: true, message: 'Holiday removed', data: (org as any).workPreferences?.holidays };
  }

  // ─── Leave Types ───────────────────────────────────────────

  @Post('work-preferences/leave-types')
  async addLeaveType(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.addLeaveType(orgId, body);
    await this.auditService.log({
      action: AuditAction.SETTINGS_LEAVE_TYPE_ADDED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { leaveType: body },
    });
    return { success: true, message: 'Leave type added', data: (org as any).workPreferences?.leaveTypes };
  }

  @Put('work-preferences/leave-types/:id')
  async updateLeaveType(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.updateLeaveType(orgId, id, body);
    await this.auditService.log({
      action: AuditAction.SETTINGS_LEAVE_TYPE_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { leaveTypeId: id },
    });
    return { success: true, message: 'Leave type updated', data: (org as any).workPreferences?.leaveTypes };
  }

  @Delete('work-preferences/leave-types/:id')
  async removeLeaveType(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.removeLeaveType(orgId, id);
    await this.auditService.log({
      action: AuditAction.SETTINGS_LEAVE_TYPE_REMOVED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { leaveTypeId: id },
    });
    return { success: true, message: 'Leave type removed', data: (org as any).workPreferences?.leaveTypes };
  }

  // ─── Branding ──────────────────────────────────────────────

  @Get('branding')
  async getBranding(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    return { success: true, data: (org as any).branding || {} };
  }

  @Put('branding')
  async updateBranding(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    (org as any).branding = { ...((org as any).branding || {}), ...sanitizeBody(body) };
    org.markModified('branding');
    await org.save();
    await this.auditService.log({
      action: AuditAction.SETTINGS_BRANDING_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
    });
    return { success: true, message: 'Branding updated', data: (org as any).branding };
  }

  // ─── Features ──────────────────────────────────────────────

  @Get('features')
  async getFeatures(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    return { success: true, data: (org as any).features || {} };
  }

  @Put('features')
  async updateFeatures(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    (org as any).features = { ...((org as any).features || {}), ...sanitizeBody(body) };
    org.markModified('features');
    await org.save();
    await this.auditService.log({
      action: AuditAction.SETTINGS_FEATURE_TOGGLED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      details: { toggledFeatures: Object.keys(body) },
    });
    return { success: true, message: 'Feature flags updated', data: (org as any).features };
  }

  // ─── Notifications ─────────────────────────────────────────

  @Get('notifications')
  async getNotifications(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    return { success: true, data: (org as any).notifications || {} };
  }

  @Put('notifications')
  async updateNotifications(@Body() body: any, @Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const org = await this.organizationService.getOrganization(orgId);
    (org as any).notifications = { ...((org as any).notifications || {}), ...sanitizeBody(body) };
    org.markModified('notifications');
    await org.save();
    await this.auditService.log({
      action: AuditAction.SETTINGS_NOTIFICATION_UPDATED,
      userId: req.user.userId,
      resource: 'organization',
      resourceId: orgId,
      organizationId: orgId,
    });
    return { success: true, message: 'Notification settings updated', data: (org as any).notifications };
  }

  // ─── Setup Completeness ────────────────────────────────────

  @Get('completeness')
  async getCompleteness(@Req() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new HttpException('Organization context required', HttpStatus.BAD_REQUEST);
    const result = await this.organizationService.calculateSetupCompleteness(orgId);
    return { success: true, data: result };
  }
}
