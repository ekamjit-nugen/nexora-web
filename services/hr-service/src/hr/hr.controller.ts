import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto,
  CreateDepartmentDto, UpdateDepartmentDto,
  CreateDesignationDto, UpdateDesignationDto,
  CreateTeamDto, UpdateTeamDto,
  CreateClientDto, UpdateClientDto, ClientQueryDto,
  ClientContactPersonDto, LinkProjectDto,
  CreateCallLogDto, UpdateCallLogDto, CallLogQueryDto,
  CreateInvoiceDto, UpdateInvoiceDto, InvoiceQueryDto, SendInvoiceDto, MarkPaidDto,
  CreateInvoiceTemplateDto,
} from './dto/index';

@Controller()
export class HrController {
  private readonly logger = new Logger(HrController.name);

  constructor(private hrService: HrService) {}

  // ── Employees ──

  @Post('employees')
  @UseGuards(JwtAuthGuard)
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

  @Get('employees/:id')
  @UseGuards(JwtAuthGuard)
  async getEmployee(@Param('id') id: string, @Req() req) {
    const employee = await this.hrService.getEmployeeById(id, req.user?.organizationId);
    return { success: true, message: 'Employee retrieved', data: employee };
  }

  @Put('employees/:id')
  @UseGuards(JwtAuthGuard)
  async updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @Req() req) {
    const employee = await this.hrService.updateEmployee(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Employee updated successfully', data: employee };
  }

  @Delete('employees/:id')
  @UseGuards(JwtAuthGuard)
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
  @HttpCode(HttpStatus.OK)
  async attachPolicy(@Param('id') id: string, @Body() body: { policyId: string }, @Req() req) {
    const employee = await this.hrService.attachPolicy(id, body.policyId, req.user?.organizationId);
    return { success: true, message: 'Policy attached successfully', data: employee };
  }

  @Delete('employees/:id/policies/:policyId')
  @UseGuards(JwtAuthGuard)
  async detachPolicy(@Param('id') id: string, @Param('policyId') policyId: string, @Req() req) {
    const employee = await this.hrService.detachPolicy(id, policyId, req.user?.organizationId);
    return { success: true, message: 'Policy detached successfully', data: employee };
  }

  // ── Departments ──

  @Post('departments')
  @UseGuards(JwtAuthGuard)
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
  async updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @Req() req) {
    const dept = await this.hrService.updateDepartment(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Department updated successfully', data: dept };
  }

  @Delete('departments/:id')
  @UseGuards(JwtAuthGuard)
  async deleteDepartment(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteDepartment(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Designations ──

  @Post('designations')
  @UseGuards(JwtAuthGuard)
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
  async updateDesignation(@Param('id') id: string, @Body() dto: UpdateDesignationDto, @Req() req) {
    const designation = await this.hrService.updateDesignation(id, dto, req.user?.organizationId);
    return { success: true, message: 'Designation updated successfully', data: designation };
  }

  @Delete('designations/:id')
  @UseGuards(JwtAuthGuard)
  async deleteDesignation(@Param('id') id: string, @Req() req) {
    const result = await this.hrService.deleteDesignation(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  // ── Teams ──

  @Post('teams')
  @UseGuards(JwtAuthGuard)
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
  async updateTeam(@Param('id') id: string, @Body() dto: UpdateTeamDto, @Req() req) {
    const team = await this.hrService.updateTeam(id, dto, req.user?.organizationId);
    return { success: true, message: 'Team updated successfully', data: team };
  }

  @Delete('teams/:id')
  @UseGuards(JwtAuthGuard)
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

  // ── Call Logs ──

  @Post('calls')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCallLog(@Body() dto: CreateCallLogDto, @Req() req) {
    const callLog = await this.hrService.createCallLog(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Call log created successfully', data: callLog };
  }

  @Get('calls')
  @UseGuards(JwtAuthGuard)
  async getCallLogs(@Query() query: CallLogQueryDto, @Req() req) {
    const result = await this.hrService.getCallLogs(query, req.user?.organizationId);
    return { success: true, message: 'Call logs retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('calls/stats')
  @UseGuards(JwtAuthGuard)
  async getCallStats(@Query('userId') userId: string, @Req() req) {
    const stats = await this.hrService.getCallStats(userId || req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Call stats retrieved', data: stats };
  }

  @Get('calls/recent')
  @UseGuards(JwtAuthGuard)
  async getRecentCalls(@Req() req) {
    const calls = await this.hrService.getRecentCalls(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Recent calls retrieved', data: calls };
  }

  @Get('calls/:id')
  @UseGuards(JwtAuthGuard)
  async getCallLogById(@Param('id') id: string, @Req() req) {
    const callLog = await this.hrService.getCallLogById(id, req.user?.organizationId);
    return { success: true, message: 'Call log retrieved', data: callLog };
  }

  @Put('calls/:id')
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
}
