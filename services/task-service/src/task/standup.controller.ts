import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { StandupService } from './standup.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('standups')
export class StandupController {
  constructor(private readonly standupService: StandupService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: any, @Req() req) {
    const data = await this.standupService.createStandup(req.user?.organizationId, dto, req.user.userId);
    return { success: true, message: 'Standup created', data };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req) {
    const data = await this.standupService.getStandups(req.user?.organizationId, req.user.userId);
    return { success: true, message: 'Standups retrieved', data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async get(@Param('id') id: string, @Req() req) {
    const data = await this.standupService.getStandup(req.user?.organizationId, id);
    return { success: true, message: 'Standup retrieved', data };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: any, @Req() req) {
    const data = await this.standupService.updateStandup(req.user?.organizationId, id, dto);
    return { success: true, message: 'Standup updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deactivate(@Param('id') id: string, @Req() req) {
    const data = await this.standupService.deleteStandup(req.user?.organizationId, id);
    return { success: true, ...data };
  }

  @Post(':id/responses')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitResponse(@Param('id') id: string, @Body() dto: any, @Req() req) {
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    const data = await this.standupService.submitResponse(
      req.user?.organizationId, id, req.user.userId, userName, dto,
    );
    return { success: true, message: 'Standup response submitted', data };
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard)
  async getResponses(@Param('id') id: string, @Query() query: any, @Req() req) {
    const data = await this.standupService.getResponses(req.user?.organizationId, id, query);
    return { success: true, message: 'Responses retrieved', data };
  }

  @Get(':id/responses/today')
  @UseGuards(JwtAuthGuard)
  async getTodayResponses(@Param('id') id: string, @Req() req) {
    const data = await this.standupService.getTodayResponses(req.user?.organizationId, id);
    return { success: true, message: 'Today\'s responses retrieved', data };
  }

  @Get(':id/responses/my-status')
  @UseGuards(JwtAuthGuard)
  async getMyStatus(@Param('id') id: string, @Req() req) {
    const data = await this.standupService.getMyTodayStatus(req.user?.organizationId, id, req.user.userId);
    return { success: true, message: 'Status retrieved', data };
  }

  @Get(':id/summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(@Param('id') id: string, @Req() req) {
    const data = await this.standupService.getSummary(req.user?.organizationId, id);
    return { success: true, message: 'Summary generated', data };
  }
}
