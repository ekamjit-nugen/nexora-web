import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { HelpdeskService } from './helpdesk.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateTicketDto, UpdateTicketDto, TicketQueryDto,
  CreateCommentDto, AssignTicketDto, RateTicketDto,
  CreateTeamDto, UpdateTeamDto,
} from './dto';

@Controller('helpdesk')
export class HelpdeskController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  // ── Tickets ──

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTicket(@Body() dto: CreateTicketDto, @Req() req) {
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    const data = await this.helpdeskService.createTicket(req.user?.organizationId, dto, req.user.userId, userName, req.user.email);
    return { success: true, message: 'Ticket created', data };
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  async getTickets(@Query() query: TicketQueryDto, @Req() req) {
    const isAgent = await this.helpdeskService.isUserAgent(req.user?.organizationId, req.user.userId);
    const isManager = ['manager', 'admin', 'owner', 'hr'].includes(req.user.orgRole || '');
    const result = await this.helpdeskService.getTickets(req.user?.organizationId, query, req.user.userId, isAgent || isManager);
    return { success: true, message: 'Tickets retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  async getTicket(@Param('id') id: string, @Req() req) {
    const data = await this.helpdeskService.getTicket(req.user?.organizationId, id);
    return { success: true, message: 'Ticket retrieved', data };
  }

  @Put('tickets/:id')
  @UseGuards(JwtAuthGuard)
  async updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto, @Req() req) {
    const data = await this.helpdeskService.updateTicket(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Ticket updated', data };
  }

  @Post('tickets/:id/assign')
  @UseGuards(JwtAuthGuard)
  async assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto, @Req() req) {
    const data = await this.helpdeskService.assignTicket(req.user?.organizationId, id, dto.assigneeId, dto.assigneeName || '', req.user.userId);
    return { success: true, message: 'Ticket assigned', data };
  }

  @Post('tickets/:id/close')
  @UseGuards(JwtAuthGuard)
  async closeTicket(@Param('id') id: string, @Req() req) {
    const data = await this.helpdeskService.closeTicket(req.user?.organizationId, id, req.user.userId);
    return { success: true, message: 'Ticket closed', data };
  }

  @Post('tickets/:id/rate')
  @UseGuards(JwtAuthGuard)
  async rateTicket(@Param('id') id: string, @Body() dto: RateTicketDto, @Req() req) {
    const data = await this.helpdeskService.rateTicket(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Ticket rated', data };
  }

  // ── Comments ──

  @Post('tickets/:id/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @Req() req) {
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    const data = await this.helpdeskService.addComment(req.user?.organizationId, id, dto, req.user.userId, userName);
    return { success: true, message: 'Comment added', data };
  }

  @Get('tickets/:id/comments')
  @UseGuards(JwtAuthGuard)
  async getComments(@Param('id') id: string, @Req() req) {
    const isAgent = await this.helpdeskService.isUserAgent(req.user?.organizationId, req.user.userId);
    const isManager = ['manager', 'admin', 'owner', 'hr'].includes(req.user.orgRole || '');
    const data = await this.helpdeskService.getComments(req.user?.organizationId, id, isAgent || isManager);
    return { success: true, message: 'Comments retrieved', data };
  }

  // ── Teams ──

  @Post('teams')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTeam(@Body() dto: CreateTeamDto, @Req() req) {
    const data = await this.helpdeskService.createTeam(req.user?.organizationId, dto, req.user.userId);
    return { success: true, message: 'Team created', data };
  }

  @Get('teams')
  @UseGuards(JwtAuthGuard)
  async getTeams(@Req() req) {
    const data = await this.helpdeskService.getTeams(req.user?.organizationId);
    return { success: true, message: 'Teams retrieved', data };
  }

  @Get('teams/:id')
  @UseGuards(JwtAuthGuard)
  async getTeam(@Param('id') id: string, @Req() req) {
    const data = await this.helpdeskService.getTeam(req.user?.organizationId, id);
    return { success: true, message: 'Team retrieved', data };
  }

  @Put('teams/:id')
  @UseGuards(JwtAuthGuard)
  async updateTeam(@Param('id') id: string, @Body() dto: UpdateTeamDto, @Req() req) {
    const data = await this.helpdeskService.updateTeam(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Team updated', data };
  }

  @Delete('teams/:id')
  @UseGuards(JwtAuthGuard)
  async deleteTeam(@Param('id') id: string, @Req() req) {
    const data = await this.helpdeskService.deleteTeam(req.user?.organizationId, id);
    return { success: true, ...data };
  }

  // ── Dashboard & Stats ──

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Req() req) {
    const data = await this.helpdeskService.getAgentDashboard(req.user?.organizationId, req.user.userId);
    return { success: true, message: 'Dashboard retrieved', data };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req) {
    const data = await this.helpdeskService.getStats(req.user?.organizationId);
    return { success: true, message: 'Stats retrieved', data };
  }
}
