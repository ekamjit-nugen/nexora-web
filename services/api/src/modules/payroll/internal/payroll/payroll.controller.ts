import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Res,
  HttpCode, HttpStatus, Logger, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PayrollService } from './payroll.service';
import { BankPayoutService } from './bank-payout.service';
import { JwtAuthGuard, Roles } from './guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
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
  ParseResumeDto, SmartMatchDto, ParseAndCreateCandidateDto,
  RejectSalaryStructureDto, VerifyInvestmentDto, UploadDocumentDto,
  UpdateOnboardingStatusDto, UpdateOffboardingStatusDto,
  OnboardingQueryDto, OffboardingQueryDto,
  GenerateForm16Dto, GeneratePFECRDto, GenerateESIReturnDto,
  GenerateTDSQuarterlyDto, StatutoryReportQueryDto,
  CreateGoalDto, UpdateGoalDto, GoalCheckInDto, RateGoalDto, GoalQueryDto,
  CreateReviewCycleDto, UpdateReviewCycleDto, StartReviewCycleDto,
  UpdateCycleStatusDto, ReviewCycleQueryDto,
  SubmitSelfReviewDto, SubmitPeerReviewDto, SubmitManagerReviewDto, FinalizeReviewDto, AssignPeerReviewersDto,
  CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementQueryDto,
  AnnouncementReactDto, AnnouncementReadDto,
  CreateKudosDto, KudosQueryDto,
  CreateSurveyDto, UpdateSurveyDto, SubmitSurveyResponseDto, SurveyQueryDto,
  CreateCourseDto, UpdateCourseDto, CourseQueryDto,
  EnrollCourseDto, UpdateLessonProgressDto, SubmitQuizDto, RateCourseDto,
  CreateLearningPathDto, UpdateLearningPathDto, EnrollmentQueryDto,
} from './dto/index';

@Controller()
export class PayrollController {
  private readonly logger = new Logger(PayrollController.name);

  constructor(
    private payrollService: PayrollService,
    private bankPayoutService: BankPayoutService,
  ) {}

  // ── Salary Structures ──

  @Post('salary-structures')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createSalaryStructure(@Body() dto: CreateSalaryStructureDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createSalaryStructure(dto, userId, orgId);
    return { success: true, message: 'Salary structure created successfully', data: result };
  }

  // Admin-level list: returns all structures in the caller's org. Must be
  // declared BEFORE `:employeeId` so Nest doesn't route `salary-structures`
  // (without a path param) into the parametric handler.
  @Get('salary-structures')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async listSalaryStructures(@Query() query: any, @Req() req) {
    const orgId = req.user?.organizationId;
    const result = await this.payrollService.listSalaryStructures(query, orgId);
    return {
      success: true,
      message: 'Salary structures retrieved',
      data: result?.data ?? result ?? [],
      pagination: result?.pagination,
    };
  }

  // Employee self-service: returns the caller's own active salary structure.
  // Declared BEFORE `:employeeId` so Nest matches `me` literally. No @Roles
  // guard — any authenticated user can read their own row. The service
  // resolves HR employee from the auth userId (via HR service).
  @Get('salary-structures/me')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMySalaryStructure(@Query('status') status: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const email = req.user.email;
    const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
    const requested = (status as any) || 'active';
    const allowed = ['active', 'pending_approval', 'draft'];
    const statusParam = allowed.includes(requested) ? requested : 'active';
    const result = await this.payrollService.getMySalaryStructure(userId, orgId, token, statusParam, email);
    return { success: true, message: 'Salary structure retrieved', data: result };
  }

  @Get('salary-structures/:employeeId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getSalaryStructure(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    // P2.3 — pass role + email + token for HRBP scoping. Controller-
    // level @Roles lets managers through broadly; the service then
    // narrows their view to their own report chain (or self).
    const authCtx = {
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      orgRole: req.user?.orgRole || null,
      email: req.user?.email,
      token: (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined,
    };
    const result = await this.payrollService.getSalaryStructure(employeeId, userId, orgId, authCtx);
    return { success: true, message: 'Salary structure retrieved', data: result };
  }

  @Get('salary-structures/:employeeId/history')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getSalaryHistory(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const authCtx = {
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      orgRole: req.user?.orgRole || null,
      email: req.user?.email,
      token: (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined,
    };
    const result = await this.payrollService.getSalaryHistory(employeeId, userId, orgId, authCtx);
    return { success: true, message: 'Salary history retrieved', data: result };
  }

  @Put('salary-structures/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateSalaryStructure(@Param('id') id: string, @Body() dto: UpdateSalaryStructureDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateSalaryStructure(id, dto, userId, orgId);
    return { success: true, message: 'Salary structure updated successfully', data: result };
  }

  @Post('salary-structures/:id/submit')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async submitForApproval(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitForApproval(id, userId, orgId);
    return { success: true, message: 'Salary structure submitted for approval', data: result };
  }

  @Post('salary-structures/:id/approve')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin', 'owner')
  async approveSalaryStructure(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const orgRole = req.user?.orgRole;
    const result = await this.payrollService.approveSalaryStructure(id, userId, orgId, orgRole);
    return { success: true, message: 'Salary structure approved successfully', data: result };
  }

  @Post('salary-structures/:id/reject')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async rejectSalaryStructure(@Param('id') id: string, @Body() dto: RejectSalaryStructureDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rejectSalaryStructure(id, dto, userId, orgId);
    return { success: true, message: 'Salary structure rejected', data: result };
  }

  // Simulate is a deterministic pure calculator — given a CTC it shows the
  // split into earnings/deductions/net. It doesn't read any tenant data or
  // leak salary information about other employees. QA finding Payroll-1:
  // the admin-only gate blocked the employee self-view's "Simulate CTC"
  // button. Relax to any authenticated user in an org.
  @Post('salary-structures/simulate')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async simulateCTC(@Body() dto: SimulateCTCDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.simulateCTC(dto, userId, orgId);
    return { success: true, message: 'CTC simulation completed', data: result };
  }

  // ── Payroll Runs ──

  @Post('payroll-runs')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async initiatePayrollRun(@Body() dto: InitiatePayrollRunDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.initiatePayrollRun(dto, userId, orgId);
    return { success: true, message: 'Payroll run initiated successfully', data: result };
  }

  @Get('payroll-runs')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollRuns(@Query() query: PayrollQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollRuns(query, userId, orgId);
    // Flatten: service returns { data: [...rows], pagination: {...} }; don't
    // nest it under an outer `data` key again — the frontend was reading
    // `response.data` as the row array and always getting an object instead,
    // which rendered as "No payroll runs yet" even when runs existed.
    return {
      success: true,
      message: 'Payroll runs retrieved',
      data: result?.data ?? result ?? [],
      pagination: result?.pagination,
    };
  }

  @Get('payroll-runs/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollRun(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollRun(id, userId, orgId);
    return { success: true, message: 'Payroll run retrieved', data: result };
  }

  @Post('payroll-runs/:id/process')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async processPayrollRun(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.processPayrollRun(id, userId, orgId);
    return { success: true, message: 'Payroll run processing started', data: result };
  }

  @Put('payroll-runs/:id/status')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async updatePayrollRunStatus(@Param('id') id: string, @Body() dto: UpdatePayrollStatusDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const orgRole = req.user?.orgRole;
    const result = await this.payrollService.updatePayrollRunStatus(id, dto, userId, orgId, orgRole);
    return { success: true, message: `Payroll run status updated to ${dto.status}`, data: result };
  }

  // P1.5 — reopen a finalized run back to `review` for correction before
  // disbursement. `paid` runs are rejected with a message pointing to
  // the supplementary-run path. Maker-checker: reopener ≠ finalizer
  // (owner can bypass).
  @Post('payroll-runs/:id/reopen')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async reopenPayrollRun(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const orgRole = req.user?.orgRole;
    const result = await this.payrollService.reopenPayrollRun(id, dto, userId, orgId, orgRole);
    return { success: true, message: 'Payroll run reopened to review', data: result };
  }

  @Get('payroll-runs/:id/entries')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPayrollEntries(@Param('id') id: string, @Query() query: PayrollQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayrollEntries(id, query, userId, orgId);
    return { success: true, message: 'Payroll entries retrieved', data: result };
  }

  // QA finding Payroll-4: employees were blocked by this guard from viewing
  // their OWN payroll entry. The read is still service-level authorized:
  // `getPayrollEntry` resolves the caller's HR row and refuses if
  // `:employeeId` isn't theirs (unless caller has an admin/hr role).
  @Get('payroll-runs/:id/entries/:employeeId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getPayrollEntry(@Param('id') id: string, @Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const email = req.user.email;
    const orgRole = req.user.orgRole;
    const userRoles: string[] = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isPrivileged = ['owner', 'admin', 'hr', 'super_admin', 'manager'].includes(orgRole)
      || userRoles.some(r => ['admin', 'hr', 'super_admin'].includes(r));
    const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
    const result = await this.payrollService.getPayrollEntry(id, employeeId, userId, orgId, {
      callerEmail: email,
      callerToken: token,
      isPrivileged,
    });
    return { success: true, message: 'Payroll entry retrieved', data: result };
  }

  @Put('payroll-runs/:id/entries/:employeeId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async releaseEntry(@Param('id') id: string, @Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.releaseEntry(id, employeeId, userId, orgId);
    return { success: true, message: 'Payroll entry released', data: result };
  }

  @Post('payroll-runs/:id/generate-payslips')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async generatePayslips(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generatePayslips(id, userId, orgId);
    return { success: true, message: 'Payslips generated successfully', data: result };
  }

  // Per-employee payslip (re)generation. Used by the per-row "Generate"
  // button on the payroll-run entries grid, and by the recovery flow
  // when HR releases an entry from `on_hold` after the bulk-generate
  // pass has already run (the bulk endpoint skips on_hold rows). Same
  // RBAC as the bulk endpoint — admin/owner/super_admin only.
  @Post('payroll-runs/:id/entries/:employeeId/generate-payslip')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async generatePayslipForEmployee(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generatePayslips(
      id, userId, orgId, { employeeId },
    );
    // Fetch the freshly upserted payslip so the client can navigate
    // straight to the download link without a follow-up list query.
    const payslip = await this.payrollService.findPayslipForEntry(
      id, employeeId, orgId,
    );
    return {
      success: true,
      message: 'Payslip generated successfully',
      data: {
        count: result.count,
        employeeId,
        payslipId: payslip?._id?.toString() || null,
        downloadUrl: payslip ? `/api/v1/payslips/${payslip._id}/download` : null,
      },
    };
  }

  // ── Bank Payouts ──

  @Post('payroll-runs/:id/payout')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async initiateBulkPayout(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.bankPayoutService.initiateBulkPayout(id, userId, orgId);
    return { success: true, message: 'Bulk payout initiated', data: result };
  }

  @Get('payroll-runs/:id/transactions')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getPayoutTransactions(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const result = await this.bankPayoutService.getTransactions(id, orgId);
    return { success: true, message: 'Bank transactions retrieved', data: result };
  }

  @Get('payroll-runs/:id/bank-file')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async downloadBankFile(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const csv = await this.bankPayoutService.generateBankFile(id, orgId);
    return {
      success: true,
      message: 'Bank file generated',
      data: {
        filename: `bank-file-${id}.csv`,
        contentType: 'text/csv',
        content: csv,
      },
    };
  }

  // Pre-flight validation — admin opens the bank file UI, hits this
  // first to see how many employees would actually appear in the CSV
  // and which ones have missing/malformed bank details. The download
  // endpoint silently skips invalid rows; this gives admins a chance
  // to fix the bank details (or ack the skips) before pulling the
  // file. Same RBAC as the download itself — bank details are PII.
  @Get('payroll-runs/:id/bank-file/validate')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async validateBankFile(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const report = await this.bankPayoutService.validateBankFile(id, orgId);
    return {
      success: true,
      message: 'Bank file validation complete',
      data: report,
    };
  }

  @Post('bank-transactions/:id/retry')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async retryBankTransaction(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.bankPayoutService.retryPayout(id, userId, orgId);
    return { success: true, message: 'Payout retried', data: result };
  }

  @Post('bank-transactions/:id/sync')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async syncBankTransaction(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const result = await this.bankPayoutService.syncPayoutStatus(id, orgId);
    return { success: true, message: 'Payout status synced', data: result };
  }

  // ── Payslips ──

  @Get('payslips/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyPayslips(@Query() query: PayslipQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const email = req.user.email;
    const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
    const result = await this.payrollService.getMyPayslips(query, userId, orgId, token, email);
    return { success: true, message: 'Payslips retrieved', data: result };
  }

  @Get('payslips/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getPayslip(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPayslip(id, userId, orgId);
    return { success: true, message: 'Payslip retrieved', data: result };
  }

  // GET /payslips/:id/download — streams a PDF rendered from the stored
  // Payslip document. Non-privileged users can only download their OWN
  // payslip; admin/hr/owner can download any in their org. Generation is
  // on-demand (no file storage) because payroll is immutable after finalize
  // — regenerating from the Payslip doc always produces the same output.
  @Get('payslips/:id/download')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async downloadPayslipPdf(
    @Param('id') id: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const email = req.user.email;
    const orgRole = req.user.orgRole;
    const userRoles: string[] = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isPrivileged = ['owner', 'admin', 'hr', 'super_admin'].includes(orgRole)
      || userRoles.some((r) => ['admin', 'hr', 'super_admin'].includes(r));
    const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;

    const { buffer, filename } = await this.payrollService.generatePayslipPdf(
      id, userId, orgId, { email, token, isPrivileged },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    // Payroll is immutable once finalized; let the browser cache for a
    // short window to avoid a re-render on refresh. Private because the
    // URL is per-user authorised.
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  }

  // ── Investment Declarations ──

  @Post('investment-declarations')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitDeclaration(@Body() dto: SubmitInvestmentDeclarationDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitDeclaration(dto, userId, orgId);
    return { success: true, message: 'Investment declaration submitted successfully', data: result };
  }

  @Get('investment-declarations/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyDeclarations(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyDeclarations(userId, orgId);
    return { success: true, message: 'Investment declarations retrieved', data: result };
  }

  // Admin-only list view for the verify UI (#15). HR/admin filter by
  // status (`submitted`/`verified`/`rejected`) and financial year to
  // work the queue.
  @Get('investment-declarations')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAllDeclarations(
    @Query('status') status: string,
    @Query('financialYear') financialYear: string,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const result = await this.payrollService.getAllDeclarations(orgId, {
      status,
      financialYear,
    });
    return { success: true, message: 'Investment declarations retrieved', data: result };
  }

  @Get('investment-declarations/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getDeclaration(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getDeclaration(id, userId, orgId);
    return { success: true, message: 'Investment declaration retrieved', data: result };
  }

  @Put('investment-declarations/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateDeclaration(@Param('id') id: string, @Body() dto: SubmitInvestmentDeclarationDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateDeclaration(id, dto, userId, orgId);
    return { success: true, message: 'Investment declaration updated successfully', data: result };
  }

  @Post('investment-declarations/:id/verify')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async verifyDeclaration(@Param('id') id: string, @Body() dto: VerifyInvestmentDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.verifyDeclaration(id, dto, userId, orgId);
    return { success: true, message: 'Investment declaration verification updated', data: result };
  }

  // ── Expense Claims ──

  @Post('expense-claims')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async createExpenseClaim(@Body() dto: CreateExpenseClaimDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createExpenseClaim(dto, userId, orgId);
    return { success: true, message: 'Expense claim created successfully', data: result };
  }

  @Get('expense-claims/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyExpenseClaims(@Query() query: ExpenseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyExpenseClaims(query, userId, orgId);
    return { success: true, message: 'Expense claims retrieved', data: result };
  }

  @Get('expense-claims/stats')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getExpenseStats(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getExpenseStats(userId, orgId);
    return { success: true, message: 'Expense statistics retrieved', data: result };
  }

  @Get('expense-claims/pending')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getPendingApprovals(@Query() query: ExpenseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPendingApprovals(query, userId, orgId);
    return { success: true, message: 'Pending expense approvals retrieved', data: result };
  }

  @Get('expense-claims')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllExpenseClaims(@Query() query: ExpenseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllExpenseClaims(query, userId, orgId);
    return { success: true, message: 'All expense claims retrieved', data: result };
  }

  @Get('expense-claims/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getExpenseClaim(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getExpenseClaim(id, userId, orgId);
    return { success: true, message: 'Expense claim retrieved', data: result };
  }

  @Put('expense-claims/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateExpenseClaim(@Param('id') id: string, @Body() dto: UpdateExpenseClaimDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateExpenseClaim(id, dto, userId, orgId);
    return { success: true, message: 'Expense claim updated successfully', data: result };
  }

  @Post('expense-claims/:id/submit')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async submitExpenseClaim(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitExpenseClaim(id, userId, orgId);
    return { success: true, message: 'Expense claim submitted for approval', data: result };
  }

  @Post('expense-claims/:id/approve')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async approveExpenseClaim(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.approveExpenseClaim(id, dto, userId, orgId);
    return { success: true, message: 'Expense claim approval updated', data: result };
  }

  @Delete('expense-claims/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async cancelExpenseClaim(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.cancelExpenseClaim(id, userId, orgId);
    return { success: true, message: 'Expense claim cancelled', data: result };
  }

  // ── Onboarding ──

  @Post('onboarding')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async initiateOnboarding(@Body() dto: InitiateOnboardingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.initiateOnboarding(dto, userId, orgId);
    return { success: true, message: 'Onboarding initiated successfully', data: result };
  }

  @Get('onboarding')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllOnboardings(@Query() query: OnboardingQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllOnboardings(query, userId, orgId);
    return { success: true, message: 'Onboardings retrieved', data: result };
  }

  @Get('onboarding/:employeeId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getOnboarding(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getOnboarding(employeeId, userId, orgId);
    return { success: true, message: 'Onboarding retrieved', data: result };
  }

  @Post('onboarding/:employeeId/checklist/complete')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async confirmEmployee(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.confirmEmployee(employeeId, userId, orgId);
    return { success: true, message: 'Employee confirmed successfully', data: result };
  }

  @Put('onboarding/:employeeId/status')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async initiateOffboarding(@Body() dto: InitiateOffboardingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.initiateOffboarding(dto, userId, orgId);
    return { success: true, message: 'Offboarding initiated successfully', data: result };
  }

  @Get('offboarding')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllOffboardings(@Query() query: OffboardingQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllOffboardings(query, userId, orgId);
    return { success: true, message: 'Offboardings retrieved', data: result };
  }

  @Get('offboarding/:employeeId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getOffboarding(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getOffboarding(employeeId, userId, orgId);
    return { success: true, message: 'Offboarding retrieved', data: result };
  }

  @Put('offboarding/:employeeId/clearance')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async calculateFnF(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.calculateFnF(employeeId, userId, orgId);
    return { success: true, message: 'F&F settlement calculated', data: result };
  }

  @Post('offboarding/:employeeId/approve-fnf')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async generateLetters(@Param('employeeId') employeeId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateLetters(employeeId, userId, orgId);
    return { success: true, message: 'Letters generated successfully', data: result };
  }

  // GET /offboarding/:employeeId/letters/:kind — streams either the
  // experience letter or the relieving letter. No @Roles decorator:
  // an ex-employee can download their OWN letter (service enforces
  // ownership via HR row resolution); admin/HR bypass the ownership gate.
  @Get('offboarding/:employeeId/letters/:kind')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async downloadOffboardingLetter(
    @Param('employeeId') employeeId: string,
    @Param('kind') kind: string,
    @Req() req,
    @Res() res: Response,
  ) {
    if (kind !== 'experience' && kind !== 'relieving') {
      throw new BadRequestException(`Unknown letter kind '${kind}'. Valid: experience | relieving`);
    }
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const email = req.user.email;
    const orgRole = req.user.orgRole;
    const userRoles: string[] = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isPrivileged = ['owner', 'admin', 'hr', 'super_admin'].includes(orgRole)
      || userRoles.some((r) => ['admin', 'hr', 'super_admin'].includes(r));
    const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;

    const { buffer, filename } = await this.payrollService.generateOffboardingLetterPdf(
      employeeId, kind, userId, orgId, { email, token, isPrivileged },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    // Same rationale as other PDF endpoints — short private cache.
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  }

  @Put('offboarding/:employeeId/status')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getDashboardMetrics(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getDashboardMetrics(query, userId, orgId);
    return { success: true, message: 'Dashboard metrics retrieved', data: result };
  }

  @Get('analytics/headcount')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getHeadcountTrends(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getHeadcountTrends(query, userId, orgId);
    return { success: true, message: 'Headcount trends retrieved', data: result };
  }

  @Get('analytics/attrition')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAttritionTrends(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAttritionTrends(query, userId, orgId);
    return { success: true, message: 'Attrition trends retrieved', data: result };
  }

  @Get('analytics/attrition/predictions')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAttritionPredictions(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAttritionPredictions(userId, orgId);
    return { success: true, message: 'Attrition predictions retrieved', data: result };
  }

  @Get('analytics/attrition/predictions/live')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getLiveAttritionPredictions(@Req() req) {
    const orgId = req.user?.organizationId;
    const predictions = await this.payrollService.getLivePredictions(orgId);
    return { success: true, data: predictions };
  }

  @Get('analytics/cost')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async getCostAnalytics(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCostAnalytics(query, userId, orgId);
    return { success: true, message: 'Cost analytics retrieved', data: result };
  }

  @Get('analytics/attendance-trends')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getAttendanceTrends(@Query() query: AnalyticsQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAttendanceTrends(query, userId, orgId);
    return { success: true, message: 'Attendance trends retrieved', data: result };
  }

  @Get('analytics/headcount-forecast')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getHeadcountForecast(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getHeadcountForecast(userId, orgId);
    return { success: true, message: 'Headcount forecast retrieved', data: result };
  }

  @Post('analytics/snapshots/generate')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async applyLoan(@Body() dto: ApplyLoanDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.applyLoan(dto, userId, orgId);
    return { success: true, message: 'Loan application submitted successfully', data: result };
  }

  @Get('loans/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyLoans(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyLoans(userId, orgId);
    return { success: true, message: 'My loans retrieved', data: result };
  }

  @Get('loans')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getLoans(@Query() query: LoanQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getLoans(query, userId, orgId);
    return { success: true, message: 'Loans retrieved', data: result };
  }

  @Get('loans/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getLoan(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getLoan(id, userId, orgId);
    return { success: true, message: 'Loan retrieved', data: result };
  }

  @Post('loans/:id/approve')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async approveLoan(@Param('id') id: string, @Body() dto: ApproveLoanDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.approveLoan(id, dto, userId, orgId);
    return { success: true, message: `Loan ${dto.status}`, data: result };
  }

  @Post('loans/:id/disburse')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async disburseLoan(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.disburseLoan(id, userId, orgId);
    return { success: true, message: 'Loan disbursed successfully', data: result };
  }

  @Post('loans/:id/close')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  async closeLoan(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.closeLoan(id, userId, orgId);
    return { success: true, message: 'Loan closed successfully', data: result };
  }

  // ── Recruitment - Job Postings ──

  @Post('jobs')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createJobPosting(@Body() dto: CreateJobPostingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createJobPosting(dto, userId, orgId);
    return { success: true, message: 'Job posting created successfully', data: result };
  }

  @Get('jobs')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getJobPostings(@Query() query: JobQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getJobPostings(query, userId, orgId);
    return { success: true, message: 'Job postings retrieved', data: result };
  }

  @Get('jobs/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getJobPosting(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getJobPosting(id, userId, orgId);
    return { success: true, message: 'Job posting retrieved', data: result };
  }

  @Put('jobs/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateJobPosting(@Param('id') id: string, @Body() dto: UpdateJobPostingDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateJobPosting(id, dto, userId, orgId);
    return { success: true, message: 'Job posting updated successfully', data: result };
  }

  @Put('jobs/:id/status')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateJobStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateJobStatus(id, dto, userId, orgId);
    return { success: true, message: `Job status updated to ${dto.status}`, data: result };
  }

  // ── Recruitment - Candidates ──

  @Post('candidates')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async addCandidate(@Body() dto: AddCandidateDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.addCandidate(dto, userId, orgId);
    return { success: true, message: 'Candidate added successfully', data: result };
  }

  @Get('candidates')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getCandidates(@Query() query: CandidateQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCandidates(query, userId, orgId);
    return { success: true, message: 'Candidates retrieved', data: result };
  }

  @Get('candidates/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getCandidate(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCandidate(id, userId, orgId);
    return { success: true, message: 'Candidate retrieved', data: result };
  }

  @Post('candidates/:id/advance')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async advanceCandidate(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.advanceCandidate(id, userId, orgId);
    return { success: true, message: 'Candidate advanced to next stage', data: result };
  }

  @Post('candidates/:id/reject')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async rejectCandidate(@Param('id') id: string, @Body() dto: RejectCandidateDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rejectCandidate(id, dto, userId, orgId);
    return { success: true, message: 'Candidate rejected', data: result };
  }

  // ── AI Recruitment: Resume Parsing & Smart Matching ──

  @Post('candidates/parse-resume')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async parseResume(@Body() dto: ParseResumeDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.parseResume(dto, userId, orgId);
    return { success: true, message: 'Resume parsed', data: result };
  }

  @Post('candidates/parse-and-create')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async parseAndCreateCandidate(@Body() dto: ParseAndCreateCandidateDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const candidate = await this.payrollService.parseAndCreateCandidate(dto, userId, orgId);
    return { success: true, message: 'Candidate created from resume', data: candidate };
  }

  @Post('jobs/smart-match')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async smartMatchCandidates(@Body() dto: SmartMatchDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const candidates = await this.payrollService.smartMatchCandidates(dto, userId, orgId);
    return { success: true, message: 'Candidates scored and ranked', data: candidates };
  }

  @Post('candidates/:id/schedule-interview')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async scheduleInterview(@Param('id') id: string, @Body() dto: ScheduleInterviewDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.scheduleInterview(id, dto, userId, orgId);
    return { success: true, message: 'Interview scheduled successfully', data: result };
  }

  @Post('candidates/:id/interview-feedback')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async interviewFeedback(@Param('id') id: string, @Body() dto: InterviewFeedbackDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.interviewFeedback(id, dto, userId, orgId);
    return { success: true, message: 'Interview feedback submitted', data: result };
  }

  @Post('candidates/:id/offer')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async createOffer(@Param('id') id: string, @Body() dto: CreateOfferDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createOffer(id, dto, userId, orgId);
    return { success: true, message: 'Offer created successfully', data: result };
  }

  @Post('candidates/:id/send-offer')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async sendOffer(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.sendOffer(id, userId, orgId);
    return { success: true, message: 'Offer sent to candidate', data: result };
  }

  @Post('candidates/:id/convert-to-employee')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async convertToEmployee(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.convertToEmployee(id, userId, orgId);
    return { success: true, message: 'Candidate converted to employee', data: result };
  }

  // ── Recruitment Analytics ──

  @Get('recruitment/analytics')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getRecruitmentAnalytics(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getRecruitmentAnalytics(userId, orgId);
    return { success: true, message: 'Recruitment analytics retrieved', data: result };
  }

  // ── Statutory Reports ──

  @Post('statutory-reports/form-16')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateForm16(@Body() dto: GenerateForm16Dto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateForm16(dto, userId, orgId);
    return { success: true, message: 'Form 16 generated successfully', data: result };
  }

  @Post('statutory-reports/pf-ecr')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generatePFECR(@Body() dto: GeneratePFECRDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generatePFECR(dto, userId, orgId);
    return { success: true, message: 'PF ECR generated successfully', data: result };
  }

  @Post('statutory-reports/esi-return')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateESIReturn(@Body() dto: GenerateESIReturnDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateESIReturn(dto, userId, orgId);
    return { success: true, message: 'ESI return generated successfully', data: result };
  }

  @Post('statutory-reports/tds-quarterly')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async generateTDSQuarterly(@Body() dto: GenerateTDSQuarterlyDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.generateTDSQuarterly(dto, userId, orgId);
    return { success: true, message: 'TDS quarterly return generated successfully', data: result };
  }

  @Get('statutory-reports/my/form-16')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyForm16(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyForm16(userId, orgId);
    return { success: true, message: 'Form 16 reports retrieved', data: result };
  }

  @Get('statutory-reports')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async listStatutoryReports(@Query() query: StatutoryReportQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listStatutoryReports(query, userId, orgId);
    return { success: true, message: 'Statutory reports retrieved', data: result };
  }

  @Get('statutory-reports/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getStatutoryReport(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getStatutoryReport(id, userId, orgId);
    return { success: true, message: 'Statutory report retrieved', data: result };
  }

  // GET /statutory-reports/:id/download — streams a PDF for the report.
  // No @Roles decorator at the controller level so an employee can
  // download their OWN Form 16; the service method enforces ownership +
  // rejects non-privileged callers for org-wide report types (PF ECR etc).
  @Get('statutory-reports/:id/download')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async downloadStatutoryReportPdf(
    @Param('id') id: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const email = req.user.email;
    const orgRole = req.user.orgRole;
    const userRoles: string[] = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isPrivileged = ['owner', 'admin', 'hr', 'super_admin'].includes(orgRole)
      || userRoles.some((r) => ['admin', 'hr', 'super_admin'].includes(r));
    const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;

    const { buffer, filename, contentType } = await this.payrollService.generateStatutoryReportPdf(
      id, userId, orgId, { email, token, isPrivileged },
    );

    // Content-Type varies per report — Form 16 is PDF, 24Q/PF ECR/ESI
    // are text uploads for gov portals. Old code hardcoded `application/pdf`
    // so browsers saved `.csv`/`.txt` files with a `.pdf` suffix and
    // admins had to rename before uploading to NSDL/EPFO/ESIC.
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    // Statutory reports are immutable once generated; short browser cache
    // avoids re-rendering on refresh. Private because URL is per-user gated.
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  }

  // ========================================================================
  // Performance Management: Goals
  // ========================================================================

  @Post('goals')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async createGoal(@Body() dto: CreateGoalDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createGoal(dto, userId, orgId);
    return { success: true, message: 'Goal created successfully', data: result };
  }

  @Get('goals')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async getAllGoals(@Query() query: GoalQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAllGoals(query, userId, orgId);
    return { success: true, message: 'Goals retrieved', data: result };
  }

  @Get('goals/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyGoals(@Query() query: GoalQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyGoals(query, userId, orgId);
    return { success: true, message: 'My goals retrieved', data: result };
  }

  @Get('goals/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getGoal(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getGoal(id, userId, orgId);
    return { success: true, message: 'Goal retrieved', data: result };
  }

  @Put('goals/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateGoal(id, dto, userId, orgId);
    return { success: true, message: 'Goal updated successfully', data: result };
  }

  @Post('goals/:id/check-in')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async goalCheckIn(@Param('id') id: string, @Body() dto: GoalCheckInDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.goalCheckIn(id, dto, userId, orgId);
    return { success: true, message: 'Goal check-in recorded', data: result };
  }

  @Post('goals/:id/rate')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async rateGoal(@Param('id') id: string, @Body() dto: RateGoalDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rateGoal(id, dto, userId, orgId);
    return { success: true, message: 'Goal rated successfully', data: result };
  }

  @Delete('goals/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async deleteGoal(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.deleteGoal(id, userId, orgId);
    return { success: true, message: 'Goal deleted successfully', data: result };
  }

  // ── OKR Hierarchy / Alignment ──

  @Get('goals/:id/children')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getGoalChildren(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const data = await this.payrollService.getGoalChildren(id, orgId);
    return { success: true, message: 'Child goals retrieved', data };
  }

  @Get('goals/:id/hierarchy')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getGoalHierarchy(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const data = await this.payrollService.getGoalHierarchy(id, orgId);
    return { success: true, message: 'Goal hierarchy retrieved', data };
  }

  @Get('goals-tree')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getOrgGoalTree(@Req() req) {
    const orgId = req.user?.organizationId;
    const data = await this.payrollService.getOrgGoalTree(orgId);
    return { success: true, message: 'Organization goal tree retrieved', data };
  }

  // ========================================================================
  // Performance Management: Review Cycles
  // ========================================================================

  @Post('review-cycles')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createReviewCycle(@Body() dto: CreateReviewCycleDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createReviewCycle(dto, userId, orgId);
    return { success: true, message: 'Review cycle created successfully', data: result };
  }

  @Get('review-cycles')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async listReviewCycles(@Query() query: ReviewCycleQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listReviewCycles(query, userId, orgId);
    return { success: true, message: 'Review cycles retrieved', data: result };
  }

  @Get('review-cycles/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getReviewCycle(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getReviewCycle(id, userId, orgId);
    return { success: true, message: 'Review cycle retrieved', data: result };
  }

  @Put('review-cycles/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyReviews(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyReviews(userId, orgId);
    return { success: true, message: 'My reviews retrieved', data: result };
  }

  @Get('reviews/pending')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getPendingReviews(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPendingReviews(userId, orgId);
    return { success: true, message: 'Pending reviews retrieved', data: result };
  }

  @Get('reviews/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getReview(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getReview(id, userId, orgId);
    return { success: true, message: 'Review retrieved', data: result };
  }

  @Post('reviews/:id/self-review')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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

  @Patch('reviews/:id/peer-reviewers')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async assignPeerReviewers(
    @Param('id') id: string,
    @Body() dto: AssignPeerReviewersDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.assignPeerReviewers(
      id,
      dto.reviewerIds,
      userId,
      orgId,
    );
    return { success: true, message: 'Peer reviewers assigned', data: result };
  }

  @Post('reviews/:id/manager-review')
  @UseGuards(JwtAuthGuard, FeatureGuard)
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
  @UseGuards(JwtAuthGuard, FeatureGuard)
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

  // ── Employee Engagement: Announcements ──

  @Post('announcements')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createAnnouncement(@Body() dto: CreateAnnouncementDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createAnnouncement(dto, userId, orgId);
    return { success: true, message: 'Announcement created successfully', data: result };
  }

  @Get('announcements')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async listAnnouncements(@Query() query: AnnouncementQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listAnnouncements(query, userId, orgId);
    return { success: true, message: 'Announcements retrieved', data: result };
  }

  @Get('announcements/pinned')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getPinnedAnnouncements(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getPinnedAnnouncements(userId, orgId);
    return { success: true, message: 'Pinned announcements retrieved', data: result };
  }

  @Get('announcements/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getAnnouncement(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getAnnouncement(id, userId, orgId);
    return { success: true, message: 'Announcement retrieved', data: result };
  }

  @Put('announcements/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateAnnouncement(id, dto, userId, orgId);
    return { success: true, message: 'Announcement updated', data: result };
  }

  @Post('announcements/:id/publish')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin', 'manager')
  async publishAnnouncement(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.publishAnnouncement(id, userId, orgId);
    return { success: true, message: 'Announcement published', data: result };
  }

  @Post('announcements/:id/read')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async markAnnouncementRead(
    @Param('id') id: string,
    @Body() _dto: AnnouncementReadDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.markAnnouncementRead(id, userId, orgId);
    return { success: true, message: 'Announcement marked as read', data: result };
  }

  @Post('announcements/:id/react')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async reactToAnnouncement(
    @Param('id') id: string,
    @Body() dto: AnnouncementReactDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.reactToAnnouncement(id, dto, userId, orgId);
    return { success: true, message: 'Reaction updated', data: result };
  }

  @Delete('announcements/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async deleteAnnouncement(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.deleteAnnouncement(id, userId, orgId);
    return { success: true, message: 'Announcement deleted', data: result };
  }

  // ── Employee Engagement: Kudos ──

  @Post('kudos')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @HttpCode(HttpStatus.CREATED)
  async giveKudos(@Body() dto: CreateKudosDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.giveKudos(dto, userId, orgId);
    return { success: true, message: 'Kudos given successfully', data: result };
  }

  @Get('kudos')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async listKudos(@Query() query: KudosQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listKudos(query, userId, orgId);
    return { success: true, message: 'Kudos feed retrieved', data: result };
  }

  @Get('kudos/received')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyReceivedKudos(@Query() query: KudosQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyReceivedKudos(query, userId, orgId);
    return { success: true, message: 'Received kudos retrieved', data: result };
  }

  @Get('kudos/given')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyGivenKudos(@Query() query: KudosQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyGivenKudos(query, userId, orgId);
    return { success: true, message: 'Given kudos retrieved', data: result };
  }

  @Get('kudos/leaderboard')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getKudosLeaderboard(@Query('limit') limit: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getKudosLeaderboard(
      userId,
      orgId,
      limit ? parseInt(limit, 10) : 10,
    );
    return { success: true, message: 'Leaderboard retrieved', data: result };
  }

  @Delete('kudos/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async deleteKudos(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.deleteKudos(id, userId, orgId);
    return { success: true, message: 'Kudos deleted', data: result };
  }

  // ── Employee Engagement: Surveys / Polls / eNPS ──

  @Post('surveys')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createSurvey(@Body() dto: CreateSurveyDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createSurvey(dto, userId, orgId);
    return { success: true, message: 'Survey created successfully', data: result };
  }

  @Get('surveys')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async listSurveys(@Query() query: SurveyQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.listSurveys(query, userId, orgId);
    return { success: true, message: 'Surveys retrieved', data: result };
  }

  @Get('surveys/active')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getActiveSurveysForUser(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getActiveSurveysForUser(userId, orgId);
    return { success: true, message: 'Active surveys retrieved', data: result };
  }

  @Get('surveys/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getSurvey(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getSurvey(id, userId, orgId);
    return { success: true, message: 'Survey retrieved', data: result };
  }

  @Put('surveys/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateSurvey(
    @Param('id') id: string,
    @Body() dto: UpdateSurveyDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateSurvey(id, dto, userId, orgId);
    return { success: true, message: 'Survey updated', data: result };
  }

  @Post('surveys/:id/publish')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async publishSurvey(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.publishSurvey(id, userId, orgId);
    return { success: true, message: 'Survey published', data: result };
  }

  @Post('surveys/:id/close')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async closeSurvey(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.closeSurvey(id, userId, orgId);
    return { success: true, message: 'Survey closed', data: result };
  }

  @Post('surveys/:id/respond')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async submitSurveyResponse(
    @Param('id') id: string,
    @Body() dto: SubmitSurveyResponseDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitSurveyResponse(id, dto, userId, orgId);
    return { success: true, message: 'Survey response submitted', data: result };
  }

  @Get('surveys/:id/results')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async getSurveyResults(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getSurveyResults(id, userId, orgId);
    return { success: true, message: 'Survey results retrieved', data: result };
  }

  @Get('surveys/:id/my-response')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMySurveyResponse(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMySurveyResponse(id, userId, orgId);
    return { success: true, message: 'My survey response retrieved', data: result };
  }

  // ===========================================================================
  // Learning Management System (LMS): Courses
  // ===========================================================================

  @Post('courses')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async createCourse(@Body() dto: CreateCourseDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createCourse(dto, userId, orgId);
    return { success: true, message: 'Course created', data: result };
  }

  @Get('courses')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async listCourses(@Query() query: CourseQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const roles = req.user?.roles || [];
    const result = await this.payrollService.listCourses(query, userId, orgId, roles);
    return { success: true, message: 'Courses retrieved', data: result };
  }

  @Get('courses/mandatory')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMandatoryCourses(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMandatoryCourses(userId, orgId);
    return { success: true, message: 'Mandatory courses retrieved', data: result };
  }

  @Get('courses/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getCourse(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCourse(id, userId, orgId);
    return { success: true, message: 'Course retrieved', data: result };
  }

  @Put('courses/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateCourse(id, dto, userId, orgId);
    return { success: true, message: 'Course updated', data: result };
  }

  @Post('courses/:id/publish')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async publishCourse(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.publishCourse(id, userId, orgId);
    return { success: true, message: 'Course published', data: result };
  }

  @Post('courses/:id/archive')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async archiveCourse(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.archiveCourse(id, userId, orgId);
    return { success: true, message: 'Course archived', data: result };
  }

  @Post('courses/:id/rate')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async rateCourse(
    @Param('id') id: string,
    @Body() dto: RateCourseDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.rateCourse(id, dto, userId, orgId);
    return { success: true, message: 'Course rated', data: result };
  }

  @Delete('courses/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async deleteCourse(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.deleteCourse(id, userId, orgId);
    return { success: true, message: 'Course deleted', data: result };
  }

  // ── LMS: Enrollments ──

  @Post('enrollments')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async enrollInCourse(@Body() dto: EnrollCourseDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.enrollInCourse(dto, userId, orgId);
    return { success: true, message: 'Enrolled in course', data: result };
  }

  @Get('enrollments/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyEnrollments(@Query() query: EnrollmentQueryDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyEnrollments(query, userId, orgId);
    return { success: true, message: 'My enrollments retrieved', data: result };
  }

  @Get('enrollments/my/active')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyActiveCourses(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyActiveCourses(userId, orgId);
    return { success: true, message: 'Active courses retrieved', data: result };
  }

  @Get('enrollments/course/:courseId')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'manager')
  async getCourseEnrollments(@Param('courseId') courseId: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCourseEnrollments(courseId, userId, orgId);
    return { success: true, message: 'Course enrollments retrieved', data: result };
  }

  @Get('enrollments/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getEnrollment(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getEnrollment(id, userId, orgId);
    return { success: true, message: 'Enrollment retrieved', data: result };
  }

  @Post('enrollments/:id/start')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async markCourseStarted(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.markCourseStarted(id, userId, orgId);
    return { success: true, message: 'Course marked as started', data: result };
  }

  @Post('enrollments/:id/lesson-progress')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async updateLessonProgress(
    @Param('id') id: string,
    @Body() dto: UpdateLessonProgressDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateLessonProgress(id, dto, userId, orgId);
    return { success: true, message: 'Lesson progress updated', data: result };
  }

  @Post('enrollments/:id/quiz')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async submitQuiz(
    @Param('id') id: string,
    @Body() dto: SubmitQuizDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.submitQuiz(id, dto, userId, orgId);
    return { success: true, message: 'Quiz submitted', data: result };
  }

  @Post('enrollments/:id/drop')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async dropCourse(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.dropCourse(id, userId, orgId);
    return { success: true, message: 'Course dropped', data: result };
  }

  // ── LMS: Certificates ──

  @Get('certificates/my')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getMyCertificates(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getMyCertificates(userId, orgId);
    return { success: true, message: 'My certificates retrieved', data: result };
  }

  @Get('certificates/verify/:code')
  async verifyCertificate(@Param('code') code: string) {
    const result = await this.payrollService.verifyCertificate(code);
    return { success: true, message: 'Verification result', data: result };
  }

  @Get('certificates/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getCertificate(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getCertificate(id, userId, orgId);
    return { success: true, message: 'Certificate retrieved', data: result };
  }

  @Post('certificates/:id/download')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async incrementCertificateDownload(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.incrementCertificateDownload(id, userId, orgId);
    return { success: true, message: 'Download recorded', data: result };
  }

  @Post('certificates/:id/revoke')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async revokeCertificate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.revokeCertificate(
      id,
      body?.reason || '',
      userId,
      orgId,
    );
    return { success: true, message: 'Certificate revoked', data: result };
  }

  // ── LMS: Learning Paths ──

  @Post('learning-paths')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async createLearningPath(@Body() dto: CreateLearningPathDto, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.createLearningPath(dto, userId, orgId);
    return { success: true, message: 'Learning path created', data: result };
  }

  @Get('learning-paths')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async listLearningPaths(@Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const roles = req.user?.roles || [];
    const result = await this.payrollService.listLearningPaths(userId, orgId, roles);
    return { success: true, message: 'Learning paths retrieved', data: result };
  }

  @Get('learning-paths/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  async getLearningPath(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.getLearningPath(id, userId, orgId);
    return { success: true, message: 'Learning path retrieved', data: result };
  }

  @Put('learning-paths/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async updateLearningPath(
    @Param('id') id: string,
    @Body() dto: UpdateLearningPathDto,
    @Req() req,
  ) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.updateLearningPath(id, dto, userId, orgId);
    return { success: true, message: 'Learning path updated', data: result };
  }

  @Delete('learning-paths/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Roles('admin', 'hr', 'super_admin')
  async deleteLearningPath(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const userId = req.user.userId;
    const result = await this.payrollService.deleteLearningPath(id, userId, orgId);
    return { success: true, message: 'Learning path deleted', data: result };
  }
}
