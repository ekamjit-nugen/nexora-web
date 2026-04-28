import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { RetentionService } from './retention.service';
import { DlpService } from './dlp.service';
import { EDiscoveryService } from './ediscovery.service';
import { LegalHoldService } from './legal-hold.service';
import { GuestAccessService } from './guest-access.service';
import { CreateDlpRuleDto, CreateRetentionPolicyDto, CreateLegalHoldDto } from './dto/compliance.dto';

@Controller('chat/compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(
    private retentionService: RetentionService,
    private dlpService: DlpService,
    private ediscoveryService: EDiscoveryService,
    private legalHoldService: LegalHoldService,
    private guestAccessService: GuestAccessService,
  ) {}

  // ── Retention Policies ──

  @Get('retention')
  @Roles('admin', 'owner')
  async getRetentionPolicies(@Req() req) {
    const policies = await this.retentionService.getPolicies(req.user.organizationId || 'default');
    return { success: true, data: policies };
  }

  @Post('retention')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createRetentionPolicy(@Body() body: CreateRetentionPolicyDto, @Req() req) {
    const policy = await this.retentionService.createPolicy(req.user.organizationId || 'default', body, req.user.userId);
    return { success: true, message: 'Retention policy created', data: policy };
  }

  @Put('retention/:id')
  @Roles('admin', 'owner')
  async updateRetentionPolicy(@Param('id') id: string, @Body() body: any) {
    const policy = await this.retentionService.updatePolicy(id, body);
    return { success: true, message: 'Policy updated', data: policy };
  }

  @Delete('retention/:id')
  @Roles('admin', 'owner')
  async deleteRetentionPolicy(@Param('id') id: string) {
    await this.retentionService.deletePolicy(id);
    return { success: true, message: 'Policy deleted' };
  }

  @Post('retention/execute')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async executeRetention(@Req() req) {
    const result = await this.retentionService.executeRetention(req.user.organizationId || 'default');
    return { success: true, message: 'Retention executed', data: result };
  }

  // ── DLP Rules ──

  @Get('dlp')
  @Roles('admin', 'owner')
  async getDlpRules(@Req() req) {
    const rules = await this.dlpService.getRules(req.user.organizationId || 'default');
    return { success: true, data: rules };
  }

  @Post('dlp')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createDlpRule(@Body() body: CreateDlpRuleDto, @Req() req) {
    const rule = await this.dlpService.createRule(req.user.organizationId || 'default', body, req.user.userId);
    return { success: true, message: 'DLP rule created', data: rule };
  }

  @Put('dlp/:id')
  @Roles('admin', 'owner')
  async updateDlpRule(@Param('id') id: string, @Body() body: any) {
    const rule = await this.dlpService.updateRule(id, body);
    return { success: true, message: 'Rule updated', data: rule };
  }

  @Delete('dlp/:id')
  @Roles('admin', 'owner')
  async deleteDlpRule(@Param('id') id: string) {
    await this.dlpService.deleteRule(id);
    return { success: true, message: 'Rule deleted' };
  }

  @Get('dlp/patterns')
  @Roles('admin', 'owner')
  async getBuiltinPatterns() {
    const patterns = await this.dlpService.getBuiltinPatterns();
    return { success: true, data: patterns };
  }

  // ── eDiscovery ──

  @Get('ediscovery/search')
  @Roles('admin', 'owner')
  async ediscoverySearch(
    @Query('q') q: string, @Query('from') from: string, @Query('conversationId') conversationId: string,
    @Query('before') before: string, @Query('after') after: string, @Query('page') page: string,
    @Req() req,
  ) {
    const result = await this.ediscoveryService.search(
      { organizationId: req.user.organizationId || 'default', q, from, conversationId, before, after },
      parseInt(page || '1'),
    );
    return { success: true, data: result.results, pagination: { total: result.total } };
  }

  @Post('ediscovery/export')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async ediscoveryExport(@Body() body: any, @Req() req) {
    const result = await this.ediscoveryService.exportResults({
      organizationId: req.user.organizationId || 'default', ...body,
    });
    return { success: true, data: result };
  }

  // ── Legal Holds ──

  @Get('legal-holds')
  @Roles('owner')
  async getLegalHolds(@Req() req) {
    const holds = await this.legalHoldService.getHolds(req.user.organizationId || 'default');
    return { success: true, data: holds };
  }

  @Post('legal-holds')
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async createLegalHold(@Body() body: CreateLegalHoldDto, @Req() req) {
    const hold = await this.legalHoldService.createHold(req.user.organizationId || 'default', body, req.user.userId);
    return { success: true, message: 'Legal hold created', data: hold };
  }

  @Post('legal-holds/:id/release')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async releaseLegalHold(@Param('id') id: string, @Req() req) {
    const hold = await this.legalHoldService.releaseHold(id, req.user.userId);
    return { success: true, message: 'Legal hold released', data: hold };
  }

  // ── Guest Access ──

  @Post('guest-access/:conversationId/enable')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async enableGuestAccess(@Param('conversationId') id: string, @Req() req) {
    const conv = await this.guestAccessService.enableGuestAccess(id, req.user.userId);
    return { success: true, message: 'Guest access enabled', data: conv };
  }

  @Post('guest-access/:conversationId/disable')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async disableGuestAccess(@Param('conversationId') id: string, @Req() req) {
    const conv = await this.guestAccessService.disableGuestAccess(id, req.user.userId);
    return { success: true, message: 'Guest access disabled', data: conv };
  }

  @Delete('guest-access/:conversationId/guests/:guestId')
  @Roles('admin', 'owner')
  async removeGuest(@Param('conversationId') convId: string, @Param('guestId') guestId: string, @Req() req) {
    const conv = await this.guestAccessService.removeGuest(convId, guestId, req.user.userId);
    return { success: true, message: 'Guest removed', data: conv };
  }
}
