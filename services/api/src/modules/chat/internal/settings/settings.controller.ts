import { Controller, Get, Put, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard, FeatureGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('settings')
  async getSettings(@Req() req) {
    const settings = await this.settingsService.getSettings(req.user.userId);
    return { success: true, message: 'Settings retrieved', data: settings };
  }

  @Put('settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() dto: any, @Req() req) {
    const settings = await this.settingsService.updateSettings(req.user.userId, dto);
    return { success: true, message: 'Settings updated', data: settings };
  }

  @Put('settings/:userId/override')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async adminOverrideSettings(@Param('userId') targetUserId: string, @Body() dto: any, @Req() req) {
    const settings = await this.settingsService.adminOverrideSettings(targetUserId, dto, req.user.userId);
    return { success: true, message: 'Settings overridden', data: settings };
  }
}
