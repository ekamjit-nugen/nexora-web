import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { HrService } from './hr.service';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { JwtAuthGuard, Roles } from './guards/jwt-auth.guard';
import {
  CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto,
  UpdateSelfProfileDto, SubmitBankChangeDto, RejectBankChangeDto,
  CreateDepartmentDto, UpdateDepartmentDto,
  CreateDesignationDto, UpdateDesignationDto,
  CreateTeamDto, UpdateTeamDto,
  CreateClientDto, UpdateClientDto, ClientQueryDto,
  ClientContactPersonDto, LinkProjectDto,
  CreateCallLogDto, UpdateCallLogDto, CallLogQueryDto,
  CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto, InvoiceQueryDto, SendInvoiceDto, MarkPaidDto,
  CreateInvoiceTemplateDto,
  CreateBillingRateDto, UpdateBillingRateDto, BillingRateQueryDto,
  PreviewInvoiceDto, GenerateInvoiceDto,
  CreateEmployeeStatusDto, UpdateEmployeeStatusDto,
} from './dto/index';

@Controller()
export class HrController {
  private readonly logger = new Logger(HrController.name);

  constructor(
    private hrService: HrService,
    private invoiceLifecycleService: InvoiceLifecycleService,
  ) {}

  // ── Employees ──

  @Post('employees')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createEmployee(@Body() dto: CreateEmployeeDto, @Req() req) {
    const authToken = req.headers.authorization;
    const orgId = req.user?.organizationId;
    const employee = await this.hrService.createEmployee(dto, req.user.userId, authToken, orgId);
    return { success: true, message: 'Employee created successfully', data: employee };
  }

  @Get('employees')
  @UseGuards(JwtAuthGuard)
  async getEmployees(@Query() query: EmployeeQueryDto, @Req() req) {
    const result = await this.hrService.getEmployees(query, req.user?.organizationId);
    return { success: true, message: 'Employees retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('employees/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req) {
    const stats = await this.hrService.getStats(req.user?.organizationId);
    return { success: true, message: 'HR stats retrieved', data: stats };
  }

  @Get('employees/org-chart')
  @UseGuards(JwtAuthGuard)
  async getOrgChart(@Query('departmentId') departmentId: string, @Req() req) {
    const chart = await this.hrService.getOrgChart(departmentId, req.user?.organizationId);
    return { success: true, message: 'Org chart retrieved', data: chart };
  }

  // ── Self-service (the literal 'me' routes MUST sit above /:id so the
  // param match doesn't swallow them) ──

  @Get('employees/me')
  @UseGuards(JwtAuthGuard)
  async getMyEmployee(@Req() req) {
    const employee = await this.hrService.getSelfEmployee(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Employee retrieved', data: employee };
  }

  @Patch('employees/me')
  @UseGuards(JwtAuthGuard)
  // No @Roles() — every authenticated user can self-update their own
  // record. Field-level safety is enforced by UpdateSelfProfileDto
  // combined with the global ValidationPipe's `forbidNonWhitelisted`,
  // which 400s any attempt to sneak department/designation/bankDetails.
  async updateMyProfile(@Body() dto: UpdateSelfProfileDto, @Req() req) {
    const employee = await this.hrService.updateSelfProfile(req.user.userId, dto, req.user?.organizationId);
    return { success: true, message: 'Profile updated', data: employee };
  }

  @Post('employees/me/bank-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitMyBankChange(@Body() dto: SubmitBankChangeDto, @Req() req) {
    const employee = await this.hrService.submitBankChange(req.user.userId, dto, req.user?.organizationId);
    return { success: true, message: 'Bank change submitted for approval', data: employee };
  }

  @Delete('employees/me/bank-change')
  @UseGuards(JwtAuthGuard)
  async withdrawMyBankChange(@Req() req) {
    const result = await this.hrService.withdrawBankChange(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Pending bank change withdrawn', data: result };
  }

  // ── Bank-change approval queue (admin/HR) ──
  // Listed under /employees/bank-changes/pending (plural + namespaced)
  // to avoid clashing with the individual :id routes further down.
  @Get('employees/bank-changes/pending')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async listPendingBankChanges(@Req() req) {
    const rows = await this.hrService.listPendingBankChanges(req.user?.organizationId);
    return { success: true, message: 'Pending bank changes retrieved', data: rows };
  }

  @Post('employees/:id/bank-change/approve')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async approveBankChange(@Param('id') id: string, @Req() req) {
    const employee = await this.hrService.approveBankChange(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Bank change approved', data: employee };
  }

  @Post('employees/:id/bank-change/reject')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async rejectBankChange(@Param('id') id: string, @Body() dto: RejectBankChangeDto, @Req() req) {
    const result = await this.hrService.rejectBankChange(id, req.user.userId, dto.reason, req.user?.organizationId);
    return { success: true, message: 'Bank change rejected', data: result };
  }

  // ── Audit (admin/HR) ──
  // Timeline of all profile edits for one employee. Admins only — the
  // audit contains reasons/deltas that the employee themselves
  // shouldn't necessarily see for every field (e.g. why HR changed
  // their designation).
  @Get('employees/:id/audit')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async getEmployeeAudit(@Param('id') id: string, @Query('limit') limit: string, @Req() req) {
    const rows = await this.hrService.getEmployeeAudit(id, req.user?.organizationId, parseInt(limit, 10) || 50);
    return { success: true, message: 'Audit trail retrieved', data: rows };
  }

  @Get('employees/:id')
  @UseGuards(JwtAuthGuard)
  async getEmployee(@Param('id') id: string, @Req() req) {
    const employee = await this.hrService.getEmployeeById(id, req.user?.organizationId);
    return { success: true, message: 'Employee retrieved', data: employee };
  }

  // Admin/HR/owner path for editing ANY employee record — can touch
  // sensitive fields (department, designation, reporting line, status,
  // statutory identifiers, bank details). Employees editing their own
  // record use PATCH /employees/me instead, which is scoped to a
  // narrow DTO (see UpdateSelfProfileDto) and blocks these sensitive
  // fields server-side.
  @Put('employees/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin', 'manager')
  async updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @Req() req) {
    const employee = await this.hrService.updateEmployee(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Employee updated successfully', data: employee };
  }

  @Delete('employees/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async deleteEmployee(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteEmployee(id, req.user.userId, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Employee Policies ──

  @Get('employees/:id/policies')
  @UseGuards(JwtAuthGuard)
  async getEmployeePolicies(@Param('id') id: string, @Req() req) {
    const policyIds = await this.hrService.getEmployeePolicies(id, req.user?.organizationId);
    return { success: true, message: 'Employee policies retrieved', data: policyIds };
  }

  @Post('employees/:id/policies')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async attachPolicy(@Param('id') id: string, @Body() body: { policyId: string }, @Req() req) {
    const employee = await this.hrService.attachPolicy(id, body.policyId, req.user?.organizationId);
    return { success: true, message: 'Policy attached successfully', data: employee };
  }

  @Delete('employees/:id/policies/:policyId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async detachPolicy(@Param('id') id: string, @Param('policyId') policyId: string, @Req() req) {
    const employee = await this.hrService.detachPolicy(id, policyId, req.user?.organizationId);
    return { success: true, message: 'Policy detached successfully', data: employee };
  }

  // ── Departments ──

  @Post('departments')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createDepartment(@Body() dto: CreateDepartmentDto, @Req() req) {
    const dept = await this.hrService.createDepartment(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Department created successfully', data: dept };
  }

  @Get('departments')
  @UseGuards(JwtAuthGuard)
  async getDepartments(@Req() req) {
    const depts = await this.hrService.getDepartments(req.user?.organizationId);
    return { success: true, message: 'Departments retrieved', data: depts };
  }

  @Get('departments/:id')
  @UseGuards(JwtAuthGuard)
  async getDepartment(@Param('id') id: string, @Req() req) {
    const dept = await this.hrService.getDepartmentById(id, req.user?.organizationId);
    return { success: true, message: 'Department retrieved', data: dept };
  }

  @Put('departments/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @Req() req) {
    const dept = await this.hrService.updateDepartment(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Department updated successfully', data: dept };
  }

  @Delete('departments/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async deleteDepartment(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteDepartment(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Designations ──

  @Post('designations')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createDesignation(@Body() dto: CreateDesignationDto, @Req() req) {
    const designation = await this.hrService.createDesignation(dto, req.user?.organizationId);
    return { success: true, message: 'Designation created successfully', data: designation };
  }

  @Get('designations')
  @UseGuards(JwtAuthGuard)
  async getDesignations(@Req() req) {
    const designations = await this.hrService.getDesignations(req.user?.organizationId);
    return { success: true, message: 'Designations retrieved', data: designations };
  }

  @Put('designations/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async updateDesignation(@Param('id') id: string, @Body() dto: UpdateDesignationDto, @Req() req) {
    const designation = await this.hrService.updateDesignation(id, dto, req.user?.organizationId);
    return { success: true, message: 'Designation updated successfully', data: designation };
  }

  @Delete('designations/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async deleteDesignation(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteDesignation(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Employee Statuses ──

  @Get('employee-statuses')
  @UseGuards(JwtAuthGuard)
  async getEmployeeStatuses(@Req() req) {
    const statuses = await this.hrService.getEmployeeStatuses(req.user?.organizationId);
    return { success: true, message: 'Statuses retrieved', data: statuses };
  }

  @Post('employee-statuses')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createEmployeeStatus(@Body() dto: CreateEmployeeStatusDto, @Req() req) {
    const status = await this.hrService.createEmployeeStatus(dto, req.user?.organizationId, req.user?.userId);
    return { success: true, message: 'Status created successfully', data: status };
  }

  @Put('employee-statuses/:id')
  @UseGuards(JwtAuthGuard)
  async updateEmployeeStatus(@Param('id') id: string, @Body() dto: UpdateEmployeeStatusDto, @Req() req) {
    const status = await this.hrService.updateEmployeeStatus(id, dto, req.user?.organizationId);
    return { success: true, message: 'Status updated successfully', data: status };
  }

  @Delete('employee-statuses/:id')
  @UseGuards(JwtAuthGuard)
  async deleteEmployeeStatus(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteEmployeeStatus(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Teams ──

  @Post('teams')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createTeam(@Body() dto: CreateTeamDto, @Req() req) {
    const team = await this.hrService.createTeam(dto, req.user?.organizationId);
    return { success: true, message: 'Team created successfully', data: team };
  }

  @Get('teams')
  @UseGuards(JwtAuthGuard)
  async getTeams(@Query('departmentId') departmentId: string, @Req() req) {
    const teams = await this.hrService.getTeams(departmentId, req.user?.organizationId);
    return { success: true, message: 'Teams retrieved', data: teams };
  }

  @Put('teams/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin', 'manager')
  async updateTeam(@Param('id') id: string, @Body() dto: UpdateTeamDto, @Req() req) {
    const team = await this.hrService.updateTeam(id, dto, req.user?.organizationId);
    return { success: true, message: 'Team updated successfully', data: team };
  }

  @Delete('teams/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  async deleteTeam(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteTeam(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Clients ──

  @Post('clients')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createClient(@Body() dto: CreateClientDto, @Req() req) {
    const client = await this.hrService.createClient(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Client created successfully', data: client };
  }

  @Get('clients')
  @UseGuards(JwtAuthGuard)
  async getClients(@Query() query: ClientQueryDto, @Req() req) {
    const result = await this.hrService.getClients(query, req.user?.organizationId);
    return { success: true, message: 'Clients retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('clients/stats')
  @UseGuards(JwtAuthGuard)
  async getClientStats(@Req() req) {
    const stats = await this.hrService.getClientStats(req.user?.organizationId);
    return { success: true, message: 'Client stats retrieved', data: stats };
  }

  @Get('clients/:id')
  @UseGuards(JwtAuthGuard)
  async getClient(@Param('id') id: string, @Req() req) {
    const client = await this.hrService.getClientById(id, req.user?.organizationId);
    return { success: true, message: 'Client retrieved', data: client };
  }

  @Get('clients/:id/dashboard')
  @UseGuards(JwtAuthGuard)
  async getClientDashboard(@Param('id') id: string, @Req() req) {
    const authToken = req.headers.authorization;
    const dashboard = await this.hrService.getClientDashboard(id, req.user?.organizationId, authToken);
    return { success: true, message: 'Client dashboard retrieved', data: dashboard };
  }

  @Get('clients/:id/projects')
  @UseGuards(JwtAuthGuard)
  async getClientProjects(@Param('id') id: string, @Req() req) {
    const authToken = req.headers.authorization;
    const projects = await this.hrService.getClientProjects(id, req.user?.organizationId, authToken);
    return { success: true, message: 'Client projects retrieved', data: projects };
  }

  @Post('clients/:id/projects')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async linkProjectToClient(@Param('id') id: string, @Body() dto: LinkProjectDto, @Req() req) {
    const client = await this.hrService.linkProjectToClient(id, dto.projectId, req.user?.organizationId);
    return { success: true, message: 'Project linked to client', data: client };
  }

  @Delete('clients/:id/projects/:projId')
  @UseGuards(JwtAuthGuard)
  async unlinkProjectFromClient(@Param('id') id: string, @Param('projId') projId: string, @Req() req) {
    const client = await this.hrService.unlinkProjectFromClient(id, projId, req.user?.organizationId);
    return { success: true, message: 'Project unlinked from client', data: client };
  }

  @Post('clients/:id/contacts')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async addContactPerson(@Param('id') id: string, @Body() dto: ClientContactPersonDto, @Req() req) {
    const client = await this.hrService.addContactPerson(id, dto, req.user?.organizationId);
    return { success: true, message: 'Contact person added', data: client };
  }

  @Delete('clients/:id/contacts/:idx')
  @UseGuards(JwtAuthGuard)
  async removeContactPerson(@Param('id') id: string, @Param('idx') idx: string, @Req() req) {
    const client = await this.hrService.removeContactPerson(id, parseInt(idx), req.user?.organizationId);
    return { success: true, message: 'Contact person removed', data: client };
  }

  @Put('clients/:id')
  @UseGuards(JwtAuthGuard)
  async updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto, @Req() req) {
    const client = await this.hrService.updateClient(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Client updated successfully', data: client };
  }

  @Delete('clients/:id')
  @UseGuards(JwtAuthGuard)
  async deleteClient(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteClient(id, req.user.userId, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Call Logs (CRM) — routes use /call-logs to avoid collision with calling-service /calls ──

  @Post('call-logs')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCallLog(@Body() dto: CreateCallLogDto, @Req() req) {
    const callLog = await this.hrService.createCallLog(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Call log created successfully', data: callLog };
  }

  @Get('call-logs')
  @UseGuards(JwtAuthGuard)
  async getCallLogs(@Query() query: CallLogQueryDto, @Req() req) {
    const result = await this.hrService.getCallLogs(query, req.user?.organizationId);
    return { success: true, message: 'Call logs retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('call-logs/stats')
  @UseGuards(JwtAuthGuard)
  async getCallStats(@Query('userId') userId: string, @Req() req) {
    const stats = await this.hrService.getCallStats(userId || req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Call stats retrieved', data: stats };
  }

  @Get('call-logs/recent')
  @UseGuards(JwtAuthGuard)
  async getRecentCalls(@Req() req) {
    const calls = await this.hrService.getRecentCalls(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Recent calls retrieved', data: calls };
  }

  @Get('call-logs/:id')
  @UseGuards(JwtAuthGuard)
  async getCallLogById(@Param('id') id: string, @Req() req) {
    const callLog = await this.hrService.getCallLogById(id, req.user?.organizationId);
    return { success: true, message: 'Call log retrieved', data: callLog };
  }

  @Put('call-logs/:id')
  @UseGuards(JwtAuthGuard)
  async updateCallLog(@Param('id') id: string, @Body() dto: UpdateCallLogDto, @Req() req) {
    const callLog = await this.hrService.updateCallLog(id, dto, req.user?.organizationId);
    return { success: true, message: 'Call log updated successfully', data: callLog };
  }

  // ── Invoices ──

  @Post('invoices')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createInvoice(@Body() dto: CreateInvoiceDto, @Req() req) {
    const invoice = await this.hrService.createInvoice(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Invoice created successfully', data: invoice };
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async getInvoices(@Query() query: InvoiceQueryDto, @Req() req) {
    const result = await this.hrService.getInvoices(query, req.user?.organizationId);
    return { success: true, message: 'Invoices retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('invoices/stats')
  @UseGuards(JwtAuthGuard)
  async getInvoiceStats(@Req() req) {
    const stats = await this.hrService.getInvoiceStats(req.user?.organizationId);
    return { success: true, message: 'Invoice stats retrieved', data: stats };
  }

  // ── Invoice lifecycle (cron + notifications) ──
  // Routes here MUST stay above `/invoices/:id` so the literal-path
  // segments (`/invoices/lifecycle/...`, `/invoices/notifications/...`)
  // don't get captured by the :id param matcher.

  @Get('invoices/lifecycle/stats')
  @UseGuards(JwtAuthGuard)
  async getLifecycleStats(@Req() req) {
    const orgId = req.user?.organizationId;
    if (!orgId) return { success: true, data: {} };
    const stats = await this.invoiceLifecycleService.getLifecycleStats(orgId);
    return { success: true, message: 'Lifecycle stats retrieved', data: stats };
  }

  // Manual lifecycle scan trigger — admin-only. Useful for end-to-end
  // testing without waiting for the daily cron, and for "I just imported
  // 5000 invoices, populate the lifecycle fields now" workflows.
  @Post('invoices/lifecycle/run')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async runLifecycleScan() {
    const result = await this.invoiceLifecycleService.runScan();
    return { success: true, message: 'Lifecycle scan complete', data: result };
  }

  @Get('invoices/notifications')
  @UseGuards(JwtAuthGuard)
  async listInvoiceNotifications(
    @Req() req,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = req.user?.organizationId;
    if (!orgId) return { success: true, data: [], unreadCount: 0 };
    const [list, unreadCount] = await Promise.all([
      this.invoiceLifecycleService.listNotifications(req.user.userId, orgId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit, 10) : undefined,
      }),
      this.invoiceLifecycleService.getUnreadCount(req.user.userId, orgId),
    ]);
    return { success: true, message: 'Notifications retrieved', data: list, unreadCount };
  }

  @Post('invoices/notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markNotificationRead(@Param('id') id: string, @Req() req) {
    const result = await this.invoiceLifecycleService.markRead(
      id, req.user.userId, req.user?.organizationId,
    );
    return { success: true, ...result };
  }

  @Post('invoices/notifications/mark-all-read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markAllNotificationsRead(@Req() req) {
    const result = await this.invoiceLifecycleService.markAllRead(
      req.user.userId, req.user?.organizationId,
    );
    return { success: true, ...result };
  }

  @Get('invoices/templates')
  @UseGuards(JwtAuthGuard)
  async getInvoiceTemplates(@Req() req) {
    const templates = await this.hrService.getInvoiceTemplates(req.user?.organizationId);
    return { success: true, message: 'Invoice templates retrieved', data: templates };
  }

  @Post('invoices/templates')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createInvoiceTemplate(@Body() dto: CreateInvoiceTemplateDto, @Req() req) {
    const template = await this.hrService.createInvoiceTemplate(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Invoice template created successfully', data: template };
  }

  @Delete('invoices/templates/:id')
  @UseGuards(JwtAuthGuard)
  async deleteInvoiceTemplate(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteInvoiceTemplate(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  @Get('invoices/:id')
  @UseGuards(JwtAuthGuard)
  async getInvoice(@Param('id') id: string, @Req() req) {
    const invoice = await this.hrService.getInvoiceById(id, req.user?.organizationId);
    return { success: true, message: 'Invoice retrieved', data: invoice };
  }

  @Put('invoices/:id')
  @UseGuards(JwtAuthGuard)
  async updateInvoice(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @Req() req) {
    const invoice = await this.hrService.updateInvoice(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Invoice updated successfully', data: invoice };
  }

  @Delete('invoices/:id')
  @UseGuards(JwtAuthGuard)
  async deleteInvoice(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteInvoice(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  @Post('invoices/:id/send')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendInvoice(@Param('id') id: string, @Body() dto: SendInvoiceDto, @Req() req) {
    const invoice = await this.hrService.sendInvoice(id, dto, req.user?.organizationId);
    return { success: true, message: 'Invoice sent successfully', data: invoice };
  }

  @Post('invoices/:id/mark-paid')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markInvoicePaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @Req() req) {
    const invoice = await this.hrService.markAsPaid(id, dto, req.user?.organizationId);
    return { success: true, message: 'Payment recorded successfully', data: invoice };
  }

  @Put('invoices/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateInvoiceStatus(@Param('id') id: string, @Body() dto: UpdateInvoiceStatusDto, @Req() req) {
    const invoice = await this.hrService.updateInvoiceStatus(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Invoice status updated', data: invoice };
  }
}

// ── Billing Controller ──

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private hrService: HrService) {}

  // ── Billing Rates ──

  @Get('rates')
  @UseGuards(JwtAuthGuard)
  async getBillingRates(@Query() query: BillingRateQueryDto, @Req() req) {
    const rates = await this.hrService.getBillingRates(query, req.user?.organizationId);
    return { success: true, message: 'Billing rates retrieved', data: rates };
  }

  @Post('rates')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBillingRate(@Body() dto: CreateBillingRateDto, @Req() req) {
    const rate = await this.hrService.createBillingRate(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Billing rate created', data: rate };
  }

  @Put('rates/:id')
  @UseGuards(JwtAuthGuard)
  async updateBillingRate(@Param('id') id: string, @Body() dto: UpdateBillingRateDto, @Req() req) {
    const rate = await this.hrService.updateBillingRate(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Billing rate updated', data: rate };
  }

  @Delete('rates/:id')
  @UseGuards(JwtAuthGuard)
  async deleteBillingRate(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteBillingRate(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Timesheet-to-Invoice Bridge ──

  @Post('preview')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async previewInvoice(@Body() dto: PreviewInvoiceDto, @Req() req) {
    const authToken = req.headers.authorization;
    const preview = await this.hrService.previewInvoiceFromTimesheets(dto, authToken, req.user?.organizationId);
    return { success: true, message: 'Invoice preview generated', data: preview };
  }

  @Post('generate-invoice')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateInvoice(@Body() dto: GenerateInvoiceDto, @Req() req) {
    const authToken = req.headers.authorization;
    const result = await this.hrService.generateInvoiceFromTimesheets(dto, req.user.userId, authToken, req.user?.organizationId);
    return { success: true, message: 'Invoice generated from timesheets', data: result };
  }
}
