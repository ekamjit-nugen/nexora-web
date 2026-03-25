import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CheckInDto, CheckOutDto, ManualEntryDto, AttendanceQueryDto,
  CreateShiftDto, UpdateShiftDto,
  CreatePolicyDto, UpdatePolicyDto, PolicyQueryDto,
} from './dto/index';

@Controller()
export class AttendanceController {
  private readonly logger = new Logger(AttendanceController.name);

  constructor(private attendanceService: AttendanceService) {}

  // ── Attendance ──

  @Post('attendance/check-in')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async checkIn(@Body() dto: CheckInDto, @Req() req) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const attendance = await this.attendanceService.checkIn(
      req.user.userId, req.user.roles || [], ip, dto.method || 'web', req.user?.organizationId,
    );
    return { success: true, message: 'Check-in recorded successfully', data: attendance };
  }

  @Post('attendance/check-out')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkOut(@Body() dto: CheckOutDto, @Req() req) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const attendance = await this.attendanceService.checkOut(
      req.user.userId, req.user.roles || [], ip, dto.method || 'web', req.user?.organizationId,
    );
    return { success: true, message: 'Check-out recorded successfully', data: attendance };
  }

  @Get('attendance/today')
  @UseGuards(JwtAuthGuard)
  async getTodayStatus(@Req() req) {
    const status = await this.attendanceService.getTodayStatus(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Today status retrieved', data: status };
  }

  @Get('attendance/my')
  @UseGuards(JwtAuthGuard)
  async getMyAttendance(
    @Req() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const records = await this.attendanceService.getMyAttendance(req.user.userId, startDate, endDate, req.user?.organizationId);
    return { success: true, message: 'Attendance records retrieved', data: records };
  }

  @Get('attendance/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(
    @Req() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.attendanceService.getStats(startDate, endDate, req.user?.organizationId);
    return { success: true, message: 'Attendance stats retrieved', data: stats };
  }

  @Get('attendance')
  @UseGuards(JwtAuthGuard)
  async getAllAttendance(@Query() query: AttendanceQueryDto, @Req() req) {
    const result = await this.attendanceService.getAllAttendance(query, req.user?.organizationId);
    return { success: true, message: 'Attendance records retrieved', data: result.data, pagination: result.pagination };
  }

  // ── Manual Entries ──

  @Post('attendance/manual-entry')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createManualEntry(@Body() dto: ManualEntryDto, @Req() req) {
    const attendance = await this.attendanceService.createManualEntry(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Manual entry submitted for approval', data: attendance };
  }

  @Get('attendance/pending-approvals')
  @UseGuards(JwtAuthGuard)
  async getPendingApprovals(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.attendanceService.getPendingManualEntries(page || 1, limit || 20, req.user?.organizationId);
    return { success: true, message: 'Pending approvals retrieved', data: result.data, pagination: result.pagination };
  }

  @Put('attendance/:id/approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async approveManualEntry(
    @Param('id') id: string,
    @Body() body: { approved: boolean; rejectionReason?: string },
    @Req() req,
  ) {
    const attendance = await this.attendanceService.approveManualEntry(
      id, body.approved, req.user.userId, body.rejectionReason, req.user?.organizationId,
    );
    return {
      success: true,
      message: `Manual entry ${body.approved ? 'approved' : 'rejected'} successfully`,
      data: attendance,
    };
  }

  // ── Shifts ──

  @Post('shifts')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createShift(@Body() dto: CreateShiftDto, @Req() req) {
    const shift = await this.attendanceService.createShift(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Shift created successfully', data: shift };
  }

  @Get('shifts')
  @UseGuards(JwtAuthGuard)
  async getShifts(@Req() req) {
    const shifts = await this.attendanceService.getShifts(req.user?.organizationId);
    return { success: true, message: 'Shifts retrieved', data: shifts };
  }

  @Get('shifts/:id')
  @UseGuards(JwtAuthGuard)
  async getShift(@Param('id') id: string, @Req() req) {
    const shift = await this.attendanceService.getShiftById(id, req.user?.organizationId);
    return { success: true, message: 'Shift retrieved', data: shift };
  }

  @Put('shifts/:id')
  @UseGuards(JwtAuthGuard)
  async updateShift(@Param('id') id: string, @Body() dto: UpdateShiftDto, @Req() req) {
    const shift = await this.attendanceService.updateShift(id, dto, req.user?.organizationId);
    return { success: true, message: 'Shift updated successfully', data: shift };
  }

  @Delete('shifts/:id')
  @UseGuards(JwtAuthGuard)
  async deleteShift(@Param('id') id: string, @Req() req) {
    const result = await this.attendanceService.deleteShift(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Policies ──

  @Post('policies')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPolicy(@Body() dto: CreatePolicyDto, @Req() req) {
    const policy = await this.attendanceService.createPolicy(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Policy created successfully', data: policy };
  }

  @Get('policies/templates')
  @UseGuards(JwtAuthGuard)
  async getTemplates(@Req() req) {
    const templates = await this.attendanceService.getTemplates(req.user?.organizationId);
    return { success: true, message: 'Templates retrieved', data: templates };
  }

  @Post('policies/from-template/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFromTemplate(
    @Param('id') id: string,
    @Body() body: Partial<CreatePolicyDto>,
    @Req() req,
  ) {
    const policy = await this.attendanceService.createFromTemplate(id, body, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Policy created from template', data: policy };
  }

  @Get('policies')
  @UseGuards(JwtAuthGuard)
  async getPolicies(@Query() query: PolicyQueryDto, @Req() req) {
    const result = await this.attendanceService.getPolicies(query, req.user?.organizationId);
    return { success: true, message: 'Policies retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('policies/:id')
  @UseGuards(JwtAuthGuard)
  async getPolicy(@Param('id') id: string, @Req() req) {
    const policy = await this.attendanceService.getPolicyById(id, req.user?.organizationId);
    return { success: true, message: 'Policy retrieved', data: policy };
  }

  @Put('policies/:id')
  @UseGuards(JwtAuthGuard)
  async updatePolicy(@Param('id') id: string, @Body() dto: UpdatePolicyDto, @Req() req) {
    const policy = await this.attendanceService.updatePolicy(id, dto, req.user?.organizationId);
    return { success: true, message: 'Policy updated successfully', data: policy };
  }

  @Delete('policies/:id')
  @UseGuards(JwtAuthGuard)
  async deletePolicy(@Param('id') id: string, @Req() req) {
    const result = await this.attendanceService.deletePolicy(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Alerts ──

  @Get('alerts')
  @UseGuards(JwtAuthGuard)
  async getAlerts(
    @Req() req,
    @Query('employeeId') employeeId?: string,
    @Query('alertType') alertType?: string,
    @Query('acknowledged') acknowledged?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.attendanceService.getAlerts({
      employeeId,
      alertType,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      page: page || 1,
      limit: limit || 20,
    }, req.user?.organizationId);
    return { success: true, message: 'Alerts retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('alerts/my')
  @UseGuards(JwtAuthGuard)
  async getMyAlerts(@Req() req) {
    const alerts = await this.attendanceService.getMyAlerts(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'My alerts retrieved', data: alerts };
  }

  @Put('alerts/:id/acknowledge')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acknowledgeAlert(@Param('id') id: string, @Req() req) {
    const alert = await this.attendanceService.acknowledgeAlert(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Alert acknowledged', data: alert };
  }
}
