import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard, Roles } from './guards/jwt-auth.guard';
import {
  CreateSalaryStructureDto, UpdateSalaryStructureDto, SimulateCTCDto,
  InitiatePayrollRunDto, UpdatePayrollStatusDto, OverrideEntryDto,
  HoldEntryDto, SubmitInvestmentDeclarationDto,
  PayrollQueryDto, PayslipQueryDto,
  CreateExpenseClaimDto, UpdateExpenseClaimDto, ApproveExpenseDto, ExpenseQueryDto,
  InitiateOnboardingDto, CompleteChecklistItemDto, VerifyDocumentDto,
  InitiateOffboardingDto, UpdateClearanceDto, ExitInterviewDto, ApproveFnFDto,
  AnalyticsQueryDto,
  ApplyLoanDto, ApproveLoanDto, LoanQueryDto,
  CreateJobPostingDto, UpdateJobPostingDto, UpdateJobStatusDto, JobQueryDto,
  AddCandidateDto, CandidateQueryDto, ScheduleInterviewDto, InterviewFeedbackDto,
  CreateOfferDto, RejectCandidateDto,
  RejectSalaryStructureDto, VerifyInvestmentDto, UploadDocumentDto,
  UpdateOnboardingStatusDto, UpdateOffboardingStatusDto,
  OnboardingQueryDto, OffboardingQueryDto,
  GenerateForm16Dto, GeneratePFECRDto, GenerateESIReturnDto,
  GenerateTDSQuarterlyDto, StatutoryReportQueryDto,
  CreateGoalDto, UpdateGoalDto, GoalCheckInDto, RateGoalDto, GoalQueryDto,
  CreateReviewCycleDto, UpdateReviewCycleDto, StartReviewCycleDto,
  UpdateCycleStatusDto, ReviewCycleQueryDto,
  SubmitSelfReviewDto, SubmitPeerReviewDto, SubmitManagerReviewDto, FinalizeReviewDto,
} from './dto/index';

@Controller()
export class PayrollController {
  private readonly logger = new Logger(PayrollController.name);

  constructor(private payrollService: PayrollService) {}

  // ── Salary Structures ──

  @Post('salary-structures')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createSalaryStructure(@Body() dto: CreateSalaryStructureDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createSalaryStructure(dto, userId, orgId);
    return { success: true, message: 'Salary structure created successfully', data: result };
  }

  @Get('salary-structures/:employeeId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getSalaryStructure(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getSalaryStructure(employeeId, userId, orgId);
    return { success: true, message: 'Salary structure retrieved', data: result };
  }

  @Get('salary-structures/:employeeId/history')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getSalaryHistory(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getSalaryHistory(employeeId, userId, orgId);
    return { success: true, message: 'Salary history retrieved', data: result };
  }

  @Put('salary-structures/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateSalaryStructure(@Param('id') id: string, @Body() dto: UpdateSalaryStructureDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateSalaryStructure(id, dto, userId, orgId);
    return { success: true, message: 'Salary structure updated successfully', data: result };
  }

  @Post('salary-structures/:id/submit')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async submitForApproval(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitForApproval(id, userId, orgId);
    return { success: true, message: 'Salary structure submitted for approval', data: result };
  }

  @Post('salary-structures/:id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async approveSalaryStructure(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.approveSalaryStructure(id, userId, orgId);
    return { success: true, message: 'Salary structure approved successfully', data: result };
  }

  @Post('salary-structures/:id/reject')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async rejectSalaryStructure(@Param('id') id: string, @Body() dto: RejectSalaryStructureDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rejectSalaryStructure(id, dto, userId, orgId);
    return { success: true, message: 'Salary structure rejected', data: result };
  }

  @Post('salary-structures/simulate')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async simulateCTC(@Body() dto: SimulateCTCDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.simulateCTC(dto, userId, orgId);
    return { success: true, message: 'CTC simulation completed', data: result };
  }

  // ── Payroll Runs ──

  @Post('payroll-runs')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async initiatePayrollRun(@Body() dto: InitiatePayrollRunDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.initiatePayrollRun(dto, userId, orgId);
    return { success: true, message: 'Payroll run initiated successfully', data: result };
  }

  @Get('payroll-runs')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollRuns(@Query() query: PayrollQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollRuns(query, userId, orgId);
    return { success: true, message: 'Payroll runs retrieved', data: result };
  }

  @Get('payroll-runs/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollRun(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollRun(id, userId, orgId);
    return { success: true, message: 'Payroll run retrieved', data: result };
  }

  @Post('payroll-runs/:id/process')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async processPayrollRun(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.processPayrollRun(id, userId, orgId);
    return { success: true, message: 'Payroll run processing started', data: result };
  }

  @Put('payroll-runs/:id/status')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async updatePayrollRunStatus(@Param('id') id: string, @Body() dto: UpdatePayrollStatusDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updatePayrollRunStatus(id, dto, userId, orgId);
    return { success: true, message: `Payroll run status updated to ${dto.status}`, data: result };
  }

  @Get('payroll-runs/:id/entries')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollEntries(@Param('id') id: string, @Query() query: PayrollQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollEntries(id, query, userId, orgId);
    return { success: true, message: 'Payroll entries retrieved', data: result };
  }

  @Get('payroll-runs/:id/entries/:employeeId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollEntry(@Param('id') id: string, @Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollEntry(id, employeeId, userId, orgId);
    return { success: true, message: 'Payroll entry retrieved', data: result };
  }

  @Put('payroll-runs/:id/entries/:employeeId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async overridePayrollEntry(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: OverrideEntryDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.overridePayrollEntry(id, employeeId, dto, userId, orgId);
    return { success: true, message: 'Payroll entry overridden successfully', data: result };
  }

  @Post('payroll-runs/:id/entries/:employeeId/hold')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async holdEntry(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: HoldEntryDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.holdEntry(id, employeeId, dto, userId, orgId);
    return { success: true, message: 'Payroll entry held', data: result };
  }

  @Post('payroll-runs/:id/entries/:employeeId/release')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async releaseEntry(@Param('id') id: string, @Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.releaseEntry(id, employeeId, userId, orgId);
    return { success: true, message: 'Payroll entry released', data: result };
  }

  @Post('payroll-runs/:id/generate-payslips')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async generatePayslips(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generatePayslips(id, userId, orgId);
    return { success: true, message: 'Payslips generated successfully', data: result };
  }

  // ── Payslips ──

  @Get('payslips/my')
  @UseGuards(JwtAuthGuard)
  async getMyPayslips(@Query() query: PayslipQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyPayslips(query, userId, orgId);
    return { success: true, message: 'Payslips retrieved', data: result };
  }

  @Get('payslips/:id')
  @UseGuards(JwtAuthGuard)
  async getPayslip(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayslip(id, userId, orgId);
    return { success: true, message: 'Payslip retrieved', data: result };
  }

  // ── Investment Declarations ──

  @Post('investment-declarations')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitDeclaration(@Body() dto: SubmitInvestmentDeclarationDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitDeclaration(dto, userId, orgId);
    return { success: true, message: 'Investment declaration submitted successfully', data: result };
  }

  @Get('investment-declarations/my')
  @UseGuards(JwtAuthGuard)
  async getMyDeclarations(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyDeclarations(userId, orgId);
    return { success: true, message: 'Investment declarations retrieved', data: result };
  }

  @Get('investment-declarations/:id')
  @UseGuards(JwtAuthGuard)
  async getDeclaration(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getDeclaration(id, userId, orgId);
    return { success: true, message: 'Investment declaration retrieved', data: result };
  }

  @Put('investment-declarations/:id')
  @UseGuards(JwtAuthGuard)
  async updateDeclaration(@Param('id') id: string, @Body() dto: SubmitInvestmentDeclarationDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateDeclaration(id, dto, userId, orgId);
    return { success: true, message: 'Investment declaration updated successfully', data: result };
  }

  @Post('investment-declarations/:id/verify')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async verifyDeclaration(@Param('id') id: string, @Body() dto: VerifyInvestmentDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.verifyDeclaration(id, dto, userId, orgId);
    return { success: true, message: 'Investment declaration verification updated', data: result };
  }

  // ── Expense Claims ──

  @Post('expense-claims')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createExpenseClaim(@Body() dto: CreateExpenseClaimDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createExpenseClaim(dto, userId, orgId);
    return { success: true, message: 'Expense claim created successfully', data: result };
  }

  @Get('expense-claims/my')
  @UseGuards(JwtAuthGuard)
  async getMyExpenseClaims(@Query() query: ExpenseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyExpenseClaims(query, userId, orgId);
    return { success: true, message: 'Expense claims retrieved', data: result };
  }

  @Get('expense-claims/stats')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getExpenseStats(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getExpenseStats(userId, orgId);
    return { success: true, message: 'Expense statistics retrieved', data: result };
  }

  @Get('expense-claims/pending')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPendingApprovals(@Query() query: ExpenseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPendingApprovals(query, userId, orgId);
    return { success: true, message: 'Pending expense approvals retrieved', data: result };
  }

  @Get('expense-claims')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllExpenseClaims(@Query() query: ExpenseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllExpenseClaims(query, userId, orgId);
    return { success: true, message: 'All expense claims retrieved', data: result };
  }

  @Get('expense-claims/:id')
  @UseGuards(JwtAuthGuard)
  async getExpenseClaim(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getExpenseClaim(id, userId, orgId);
    return { success: true, message: 'Expense claim retrieved', data: result };
  }

  @Put('expense-claims/:id')
  @UseGuards(JwtAuthGuard)
  async updateExpenseClaim(@Param('id') id: string, @Body() dto: UpdateExpenseClaimDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateExpenseClaim(id, dto, userId, orgId);
    return { success: true, message: 'Expense claim updated successfully', data: result };
  }

  @Post('expense-claims/:id/submit')
  @UseGuards(JwtAuthGuard)
  async submitExpenseClaim(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitExpenseClaim(id, userId, orgId);
    return { success: true, message: 'Expense claim submitted for approval', data: result };
  }

  @Post('expense-claims/:id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async approveExpenseClaim(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.approveExpenseClaim(id, dto, userId, orgId);
    return { success: true, message: 'Expense claim approval updated', data: result };
  }

  @Delete('expense-claims/:id')
  @UseGuards(JwtAuthGuard)
  async cancelExpenseClaim(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.cancelExpenseClaim(id, userId, orgId);
    return { success: true, message: 'Expense claim cancelled', data: result };
  }

  // ── Onboarding ──

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async initiateOnboarding(@Body() dto: InitiateOnboardingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.initiateOnboarding(dto, userId, orgId);
    return { success: true, message: 'Onboarding initiated successfully', data: result };
  }

  @Get('onboarding')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllOnboardings(@Query() query: OnboardingQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllOnboardings(query, userId, orgId);
    return { success: true, message: 'Onboardings retrieved', data: result };
  }

  @Get('onboarding/:employeeId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getOnboarding(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getOnboarding(employeeId, userId, orgId);
    return { success: true, message: 'Onboarding retrieved', data: result };
  }

  @Post('onboarding/:employeeId/checklist/complete')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async completeChecklistItem(
    @Param('employeeId') employeeId: string,
    @Body() dto: CompleteChecklistItemDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.completeChecklistItem(employeeId, dto, userId, orgId);
    return { success: true, message: 'Checklist item completed', data: result };
  }

  @Post('onboarding/:employeeId/documents/:docIndex/upload')
  @UseGuards(JwtAuthGuard)
  async uploadDocument(
    @Param('employeeId') employeeId: string,
    @Param('docIndex') docIndex: number,
    @Body() dto: UploadDocumentDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.uploadOnboardingDocument(employeeId, +docIndex, dto.url, userId, orgId);
    return { success: true, message: 'Document uploaded', data: result };
  }

  @Post('onboarding/:employeeId/documents/:docIndex/verify')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async verifyDocument(
    @Param('employeeId') employeeId: string,
    @Param('docIndex') docIndex: number,
    @Body() dto: VerifyDocumentDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.verifyOnboardingDocument(employeeId, +docIndex, dto, userId, orgId);
    return { success: true, message: 'Document verification updated', data: result };
  }

  @Post('onboarding/:employeeId/confirm')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async confirmEmployee(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.confirmEmployee(employeeId, userId, orgId);
    return { success: true, message: 'Employee confirmed successfully', data: result };
  }

  @Put('onboarding/:employeeId/status')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateOnboardingStatus(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateOnboardingStatusDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateOnboardingStatus(employeeId, dto.status, userId, orgId);
    return { success: true, message: `Onboarding status updated to ${dto.status}`, data: result };
  }

  // ── Offboarding ──

  @Post('offboarding')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async initiateOffboarding(@Body() dto: InitiateOffboardingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.initiateOffboarding(dto, userId, orgId);
    return { success: true, message: 'Offboarding initiated successfully', data: result };
  }

  @Get('offboarding')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllOffboardings(@Query() query: OffboardingQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllOffboardings(query, userId, orgId);
    return { success: true, message: 'Offboardings retrieved', data: result };
  }

  @Get('offboarding/:employeeId')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getOffboarding(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getOffboarding(employeeId, userId, orgId);
    return { success: true, message: 'Offboarding retrieved', data: result };
  }

  @Put('offboarding/:employeeId/clearance')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async updateClearance(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateClearanceDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateClearance(employeeId, dto, userId, orgId);
    return { success: true, message: 'Clearance updated', data: result };
  }

  @Post('offboarding/:employeeId/exit-interview')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async submitExitInterview(
    @Param('employeeId') employeeId: string,
    @Body() dto: ExitInterviewDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitExitInterview(employeeId, dto, userId, orgId);
    return { success: true, message: 'Exit interview submitted', data: result };
  }

  @Post('offboarding/:employeeId/calculate-fnf')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async calculateFnF(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.calculateFnF(employeeId, userId, orgId);
    return { success: true, message: 'F&F settlement calculated', data: result };
  }

  @Post('offboarding/:employeeId/approve-fnf')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async approveFnF(
    @Param('employeeId') employeeId: string,
    @Body() dto: ApproveFnFDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.approveFnF(employeeId, dto, userId, orgId);
    return { success: true, message: 'F&F settlement approved', data: result };
  }

  @Post('offboarding/:employeeId/generate-letters')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async generateLetters(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateLetters(employeeId, userId, orgId);
    return { success: true, message: 'Letters generated successfully', data: result };
  }

  @Put('offboarding/:employeeId/status')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateOffboardingStatus(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateOffboardingStatusDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateOffboardingStatus(employeeId, dto.status, userId, orgId);
    return { success: true, message: `Offboarding status updated to ${dto.status}`, data: result };
  }

  // ── Analytics ──

  @Get('analytics/dashboard')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getDashboardMetrics(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getDashboardMetrics(query, userId, orgId);
    return { success: true, message: 'Dashboard metrics retrieved', data: result };
  }

  @Get('analytics/headcount')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getHeadcountTrends(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getHeadcountTrends(query, userId, orgId);
    return { success: true, message: 'Headcount trends retrieved', data: result };
  }

  @Get('analytics/attrition')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAttritionTrends(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAttritionTrends(query, userId, orgId);
    return { success: true, message: 'Attrition trends retrieved', data: result };
  }

  @Get('analytics/attrition/predictions')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAttritionPredictions(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAttritionPredictions(userId, orgId);
    return { success: true, message: 'Attrition predictions retrieved', data: result };
  }

  @Get('analytics/cost')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async getCostAnalytics(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCostAnalytics(query, userId, orgId);
    return { success: true, message: 'Cost analytics retrieved', data: result };
  }

  @Get('analytics/attendance-trends')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAttendanceTrends(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAttendanceTrends(query, userId, orgId);
    return { success: true, message: 'Attendance trends retrieved', data: result };
  }

  @Get('analytics/headcount-forecast')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getHeadcountForecast(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getHeadcountForecast(userId, orgId);
    return { success: true, message: 'Headcount forecast retrieved', data: result };
  }

  @Post('analytics/snapshots/generate')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateSnapshot(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateSnapshot(userId, orgId);
    return { success: true, message: 'Analytics snapshot generated', data: result };
  }

  // ── Employee Loans ──

  @Post('loans')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async applyLoan(@Body() dto: ApplyLoanDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.applyLoan(dto, userId, orgId);
    return { success: true, message: 'Loan application submitted successfully', data: result };
  }

  @Get('loans/my')
  @UseGuards(JwtAuthGuard)
  async getMyLoans(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyLoans(userId, orgId);
    return { success: true, message: 'My loans retrieved', data: result };
  }

  @Get('loans')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getLoans(@Query() query: LoanQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getLoans(query, userId, orgId);
    return { success: true, message: 'Loans retrieved', data: result };
  }

  @Get('loans/:id')
  @UseGuards(JwtAuthGuard)
  async getLoan(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getLoan(id, userId, orgId);
    return { success: true, message: 'Loan retrieved', data: result };
  }

  @Post('loans/:id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async approveLoan(@Param('id') id: string, @Body() dto: ApproveLoanDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.approveLoan(id, dto, userId, orgId);
    return { success: true, message: `Loan ${dto.status}`, data: result };
  }

  @Post('loans/:id/disburse')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async disburseLoan(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.disburseLoan(id, userId, orgId);
    return { success: true, message: 'Loan disbursed successfully', data: result };
  }

  @Post('loans/:id/close')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  async closeLoan(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.closeLoan(id, userId, orgId);
    return { success: true, message: 'Loan closed successfully', data: result };
  }

  // ── Recruitment - Job Postings ──

  @Post('jobs')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createJobPosting(@Body() dto: CreateJobPostingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createJobPosting(dto, userId, orgId);
    return { success: true, message: 'Job posting created successfully', data: result };
  }

  @Get('jobs')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getJobPostings(@Query() query: JobQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getJobPostings(query, userId, orgId);
    return { success: true, message: 'Job postings retrieved', data: result };
  }

  @Get('jobs/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getJobPosting(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getJobPosting(id, userId, orgId);
    return { success: true, message: 'Job posting retrieved', data: result };
  }

  @Put('jobs/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateJobPosting(@Param('id') id: string, @Body() dto: UpdateJobPostingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateJobPosting(id, dto, userId, orgId);
    return { success: true, message: 'Job posting updated successfully', data: result };
  }

  @Put('jobs/:id/status')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateJobStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateJobStatus(id, dto, userId, orgId);
    return { success: true, message: `Job status updated to ${dto.status}`, data: result };
  }

  // ── Recruitment - Candidates ──

  @Post('candidates')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async addCandidate(@Body() dto: AddCandidateDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.addCandidate(dto, userId, orgId);
    return { success: true, message: 'Candidate added successfully', data: result };
  }

  @Get('candidates')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getCandidates(@Query() query: CandidateQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCandidates(query, userId, orgId);
    return { success: true, message: 'Candidates retrieved', data: result };
  }

  @Get('candidates/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getCandidate(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCandidate(id, userId, orgId);
    return { success: true, message: 'Candidate retrieved', data: result };
  }

  @Post('candidates/:id/advance')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async advanceCandidate(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.advanceCandidate(id, userId, orgId);
    return { success: true, message: 'Candidate advanced to next stage', data: result };
  }

  @Post('candidates/:id/reject')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async rejectCandidate(@Param('id') id: string, @Body() dto: RejectCandidateDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rejectCandidate(id, dto, userId, orgId);
    return { success: true, message: 'Candidate rejected', data: result };
  }

  @Post('candidates/:id/schedule-interview')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async scheduleInterview(@Param('id') id: string, @Body() dto: ScheduleInterviewDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.scheduleInterview(id, dto, userId, orgId);
    return { success: true, message: 'Interview scheduled successfully', data: result };
  }

  @Post('candidates/:id/interview-feedback')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async interviewFeedback(@Param('id') id: string, @Body() dto: InterviewFeedbackDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.interviewFeedback(id, dto, userId, orgId);
    return { success: true, message: 'Interview feedback submitted', data: result };
  }

  @Post('candidates/:id/offer')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async createOffer(@Param('id') id: string, @Body() dto: CreateOfferDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createOffer(id, dto, userId, orgId);
    return { success: true, message: 'Offer created successfully', data: result };
  }

  @Post('candidates/:id/send-offer')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async sendOffer(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.sendOffer(id, userId, orgId);
    return { success: true, message: 'Offer sent to candidate', data: result };
  }

  @Post('candidates/:id/convert-to-employee')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async convertToEmployee(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.convertToEmployee(id, userId, orgId);
    return { success: true, message: 'Candidate converted to employee', data: result };
  }

  // ── Recruitment Analytics ──

  @Get('recruitment/analytics')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getRecruitmentAnalytics(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getRecruitmentAnalytics(userId, orgId);
    return { success: true, message: 'Recruitment analytics retrieved', data: result };
  }

  // ── Statutory Reports ──

  @Post('statutory-reports/form-16')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateForm16(@Body() dto: GenerateForm16Dto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateForm16(dto, userId, orgId);
    return { success: true, message: 'Form 16 generated successfully', data: result };
  }

  @Post('statutory-reports/pf-ecr')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generatePFECR(@Body() dto: GeneratePFECRDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generatePFECR(dto, userId, orgId);
    return { success: true, message: 'PF ECR generated successfully', data: result };
  }

  @Post('statutory-reports/esi-return')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateESIReturn(@Body() dto: GenerateESIReturnDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateESIReturn(dto, userId, orgId);
    return { success: true, message: 'ESI return generated successfully', data: result };
  }

  @Post('statutory-reports/tds-quarterly')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateTDSQuarterly(@Body() dto: GenerateTDSQuarterlyDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateTDSQuarterly(dto, userId, orgId);
    return { success: true, message: 'TDS quarterly return generated successfully', data: result };
  }

  @Get('statutory-reports/my/form-16')
  @UseGuards(JwtAuthGuard)
  async getMyForm16(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyForm16(userId, orgId);
    return { success: true, message: 'Form 16 reports retrieved', data: result };
  }

  @Get('statutory-reports')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async listStatutoryReports(@Query() query: StatutoryReportQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listStatutoryReports(query, userId, orgId);
    return { success: true, message: 'Statutory reports retrieved', data: result };
  }

  @Get('statutory-reports/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getStatutoryReport(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getStatutoryReport(id, userId, orgId);
    return { success: true, message: 'Statutory report retrieved', data: result };
  }

  // ========================================================================
  // Performance Management: Goals
  // ========================================================================

  @Post('goals')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createGoal(@Body() dto: CreateGoalDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createGoal(dto, userId, orgId);
    return { success: true, message: 'Goal created successfully', data: result };
  }

  @Get('goals')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllGoals(@Query() query: GoalQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllGoals(query, userId, orgId);
    return { success: true, message: 'Goals retrieved', data: result };
  }

  @Get('goals/my')
  @UseGuards(JwtAuthGuard)
  async getMyGoals(@Query() query: GoalQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyGoals(query, userId, orgId);
    return { success: true, message: 'My goals retrieved', data: result };
  }

  @Get('goals/:id')
  @UseGuards(JwtAuthGuard)
  async getGoal(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getGoal(id, userId, orgId);
    return { success: true, message: 'Goal retrieved', data: result };
  }

  @Put('goals/:id')
  @UseGuards(JwtAuthGuard)
  async updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateGoal(id, dto, userId, orgId);
    return { success: true, message: 'Goal updated successfully', data: result };
  }

  @Post('goals/:id/check-in')
  @UseGuards(JwtAuthGuard)
  async goalCheckIn(@Param('id') id: string, @Body() dto: GoalCheckInDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.goalCheckIn(id, dto, userId, orgId);
    return { success: true, message: 'Goal check-in recorded', data: result };
  }

  @Post('goals/:id/rate')
  @UseGuards(JwtAuthGuard)
  async rateGoal(@Param('id') id: string, @Body() dto: RateGoalDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rateGoal(id, dto, userId, orgId);
    return { success: true, message: 'Goal rated successfully', data: result };
  }

  @Delete('goals/:id')
  @UseGuards(JwtAuthGuard)
  async deleteGoal(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.deleteGoal(id, userId, orgId);
    return { success: true, message: 'Goal deleted successfully', data: result };
  }

  // ========================================================================
  // Performance Management: Review Cycles
  // ========================================================================

  @Post('review-cycles')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createReviewCycle(@Body() dto: CreateReviewCycleDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createReviewCycle(dto, userId, orgId);
    return { success: true, message: 'Review cycle created successfully', data: result };
  }

  @Get('review-cycles')
  @UseGuards(JwtAuthGuard)
  async listReviewCycles(@Query() query: ReviewCycleQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listReviewCycles(query, userId, orgId);
    return { success: true, message: 'Review cycles retrieved', data: result };
  }

  @Get('review-cycles/:id')
  @UseGuards(JwtAuthGuard)
  async getReviewCycle(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getReviewCycle(id, userId, orgId);
    return { success: true, message: 'Review cycle retrieved', data: result };
  }

  @Put('review-cycles/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateReviewCycle(
    @Param('id') id: string,
    @Body() dto: UpdateReviewCycleDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateReviewCycle(id, dto, userId, orgId);
    return { success: true, message: 'Review cycle updated successfully', data: result };
  }

  @Post('review-cycles/:id/start')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async startReviewCycle(
    @Param('id') id: string,
    @Body() dto: StartReviewCycleDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.startReviewCycle(id, dto, userId, orgId);
    return { success: true, message: 'Review cycle started', data: result };
  }

  @Put('review-cycles/:id/status')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateCycleStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCycleStatusDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateCycleStatus(id, dto, userId, orgId);
    return { success: true, message: 'Cycle status updated', data: result };
  }

  // ========================================================================
  // Performance Management: Reviews
  // ========================================================================

  @Get('reviews/my')
  @UseGuards(JwtAuthGuard)
  async getMyReviews(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyReviews(userId, orgId);
    return { success: true, message: 'My reviews retrieved', data: result };
  }

  @Get('reviews/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingReviews(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPendingReviews(userId, orgId);
    return { success: true, message: 'Pending reviews retrieved', data: result };
  }

  @Get('reviews/:id')
  @UseGuards(JwtAuthGuard)
  async getReview(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getReview(id, userId, orgId);
    return { success: true, message: 'Review retrieved', data: result };
  }

  @Post('reviews/:id/self-review')
  @UseGuards(JwtAuthGuard)
  async submitSelfReview(
    @Param('id') id: string,
    @Body() dto: SubmitSelfReviewDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitSelfReview(id, dto, userId, orgId);
    return { success: true, message: 'Self-review submitted', data: result };
  }

  @Post('reviews/:id/peer-review')
  @UseGuards(JwtAuthGuard)
  async submitPeerReview(
    @Param('id') id: string,
    @Body() dto: SubmitPeerReviewDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitPeerReview(id, dto, userId, orgId);
    return { success: true, message: 'Peer review submitted', data: result };
  }

  @Post('reviews/:id/manager-review')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitManagerReviewDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitManagerReview(id, dto, userId, orgId);
    return { success: true, message: 'Manager review submitted', data: result };
  }

  @Post('reviews/:id/finalize')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'hr', 'super_admin')
  async finalizeReview(
    @Param('id') id: string,
    @Body() dto: FinalizeReviewDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.finalizeReview(id, dto, userId, orgId);
    return { success: true, message: 'Review finalized', data: result };
  }
}
