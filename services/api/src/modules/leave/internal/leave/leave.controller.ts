import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard, Roles } from './guards/jwt-auth.guard';
import {
  ApplyLeaveDto, ApproveLeaveDto, CancelLeaveDto, LeaveQueryDto,
  CreateLeavePolicyDto, UpdateLeavePolicyDto,
} from './dto/index';

@Controller()
export class LeaveController {
  private readonly logger = new Logger(LeaveController.name);

  constructor(private leaveService: LeaveService) {}

  // ── Leave Requests ──

  @Post('leaves')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async applyLeave(@Body() dto: ApplyLeaveDto, @Req() req) {
    const leave = await this.leaveService.applyLeave(
      dto,
      req.user.userId,
      req.user?.organizationId,
      req.user?.roles || [],
      req.user?.orgRole,
    );
    return { success: true, message: 'Leave applied successfully', data: leave };
  }

  @Get('leaves/my')
  @UseGuards(JwtAuthGuard)
  async getMyLeaves(@Query() query: LeaveQueryDto, @Req() req) {
    const result = await this.leaveService.getMyLeaves(req.user.userId, query, req.user?.organizationId);
    return { success: true, message: 'My leaves retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('leaves/balance')
  @UseGuards(JwtAuthGuard)
  async getMyBalance(@Query('year') year: number, @Req() req) {
    const balance = await this.leaveService.getMyBalance(req.user.userId, year, req.user?.organizationId);
    return { success: true, message: 'Leave balance retrieved', data: balance };
  }

  // Admin-only: lookup a specific employee's balance with `encashable`
  // flag attached per leave type. Used by payroll-service during F&F
  // (#13) — the encashment is computed against `available` for the
  // types that policy marks encashable, not a hardcoded day count.
  @Get('leaves/balance/by-user/:userId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async getBalanceForUser(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Req() req,
  ) {
    const balance = await this.leaveService.getBalanceForUser(
      userId,
      year,
      req.user?.organizationId,
    );
    return { success: true, message: 'Leave balance retrieved', data: balance };
  }

  @Get('leaves/team-calendar')
  @UseGuards(JwtAuthGuard)
  async getTeamCalendar(
    @Query('departmentId') departmentId: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Req() req,
  ) {
    const calendar = await this.leaveService.getTeamCalendar(departmentId, month, year, req.user?.organizationId);
    return { success: true, message: 'Team calendar retrieved', data: calendar };
  }

  @Get('leaves/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Req() req) {
    const stats = await this.leaveService.getStats(startDate, endDate, req.user?.organizationId);
    return { success: true, message: 'Leave stats retrieved', data: stats };
  }

  // Org-wide list view for HR. Employees have their own `/leaves/my`.
  @Get('leaves')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin', 'manager')
  async getAllLeaves(@Query() query: LeaveQueryDto, @Req() req) {
    const result = await this.leaveService.getAllLeaves(query, req.user?.organizationId);
    return { success: true, message: 'Leaves retrieved', data: result.data, pagination: result.pagination };
  }

  // SEC-1: approve + cancel were previously ungated — any developer could
  // approve their own or anyone's leave (verified live). Now restricted
  // to manager / hr / admin / owner. The service layer adds a second gate:
  // even a manager can't approve their own leave (self-approval block).
  @Put('leaves/:id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin', 'manager')
  async approveLeave(@Param('id') id: string, @Body() dto: ApproveLeaveDto, @Req() req) {
    const leave = await this.leaveService.approveLeave(
      id,
      dto,
      req.user.userId,
      req.user?.organizationId,
      { orgRole: req.user?.orgRole, roles: req.user?.roles },
    );
    return { success: true, message: `Leave ${dto.status} successfully`, data: leave };
  }

  @Put('leaves/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelLeave(@Param('id') id: string, @Body() dto: CancelLeaveDto, @Req() req) {
    // Cancel is intentionally NOT role-gated: an employee is allowed to
    // cancel their OWN pending leave. The service enforces that a
    // non-privileged caller can only cancel leaves belonging to them.
    const leave = await this.leaveService.cancelLeave(
      id,
      dto,
      req.user.userId,
      req.user?.organizationId,
      { orgRole: req.user?.orgRole, roles: req.user?.roles },
    );
    return { success: true, message: 'Leave cancelled successfully', data: leave };
  }

  // ── Leave Policies ──

  @Post('leave-policies')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createLeavePolicy(@Body() dto: CreateLeavePolicyDto, @Req() req) {
    const policy = await this.leaveService.createLeavePolicy(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Leave policy created successfully', data: policy };
  }

  @Get('leave-policies')
  @UseGuards(JwtAuthGuard)
  async getLeavePolicies(@Req() req) {
    const policies = await this.leaveService.getLeavePolicies(req.user?.organizationId);
    return { success: true, message: 'Leave policies retrieved', data: policies };
  }

  @Get('leave-policies/:id')
  @UseGuards(JwtAuthGuard)
  async getLeavePolicyById(@Param('id') id: string, @Req() req) {
    const policy = await this.leaveService.getLeavePolicyById(id, req.user?.organizationId);
    return { success: true, message: 'Leave policy retrieved', data: policy };
  }

  @Put('leave-policies/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async updateLeavePolicy(@Param('id') id: string, @Body() dto: UpdateLeavePolicyDto, @Req() req) {
    const policy = await this.leaveService.updateLeavePolicy(id, dto, req.user?.organizationId);
    return { success: true, message: 'Leave policy updated successfully', data: policy };
  }

  @Delete('leave-policies/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async deleteLeavePolicy(@Param('id') id: string, @Req() req) {
    const result = await this.leaveService.deleteLeavePolicy(id, req.user?.organizationId);
    return { success: true, ...result };
  }
}
