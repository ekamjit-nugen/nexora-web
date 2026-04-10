import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { ISalaryStructure } from './schemas/salary-structure.schema';
import { IPayrollRun } from './schemas/payroll-run.schema';
import { IPayrollEntry } from './schemas/payroll-entry.schema';
import { IPayslip } from './schemas/payslip.schema';
import { IInvestmentDeclaration } from './schemas/investment-declaration.schema';
import { IExpenseClaim } from './schemas/expense-claim.schema';
import { IEmployeeLoan } from './schemas/employee-loan.schema';
import { IOnboarding } from './schemas/onboarding.schema';
import { IOffboarding } from './schemas/offboarding.schema';
import { IAnalyticsSnapshot } from './schemas/analytics-snapshot.schema';
import { IJobPosting } from './schemas/job-posting.schema';
import { ICandidate } from './schemas/candidate.schema';
import { IStatutoryReport } from './schemas/statutory-report.schema';
import { IGoal } from './schemas/goal.schema';
import { IReviewCycle } from './schemas/review-cycle.schema';
import { IPerformanceReview } from './schemas/performance-review.schema';
import { IAnnouncement } from './schemas/announcement.schema';
import { IKudos } from './schemas/kudos.schema';
import { ISurvey } from './schemas/survey.schema';
import { ISurveyResponse } from './schemas/survey-response.schema';
import { ICourse } from './schemas/course.schema';
import { IEnrollment } from './schemas/enrollment.schema';
import { ICertificate } from './schemas/certificate.schema';
import { ILearningPath } from './schemas/learning-path.schema';
import { ICounter } from './schemas/counter.schema';
import { PayrollCalculationService } from './payroll-calculation.service';
import { ExternalServicesService } from './external-services.service';
import { AttritionPredictorService } from './attrition-predictor.service';
import {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  SimulateCTCDto,
  InitiatePayrollRunDto,
  UpdatePayrollStatusDto,
  OverrideEntryDto,
  HoldEntryDto,
  SubmitInvestmentDeclarationDto,
  PayrollQueryDto,
  PayslipQueryDto,
  CreateExpenseClaimDto,
  UpdateExpenseClaimDto,
  ApproveExpenseDto,
  ExpenseQueryDto,
  InitiateOnboardingDto,
  CompleteChecklistItemDto,
  VerifyDocumentDto,
  InitiateOffboardingDto,
  UpdateClearanceDto,
  ExitInterviewDto,
  ApproveFnFDto,
  AnalyticsQueryDto,
  ApplyLoanDto,
  ApproveLoanDto,
  LoanQueryDto,
  CreateJobPostingDto,
  UpdateJobPostingDto,
  UpdateJobStatusDto,
  JobQueryDto,
  AddCandidateDto,
  CandidateQueryDto,
  ScheduleInterviewDto,
  InterviewFeedbackDto,
  CreateOfferDto,
  RejectCandidateDto,
  ParseResumeDto,
  SmartMatchDto,
  ParseAndCreateCandidateDto,
  GenerateForm16Dto,
  GeneratePFECRDto,
  GenerateESIReturnDto,
  GenerateTDSQuarterlyDto,
  StatutoryReportQueryDto,
  CreateGoalDto,
  UpdateGoalDto,
  GoalCheckInDto,
  RateGoalDto,
  GoalQueryDto,
  CreateReviewCycleDto,
  UpdateReviewCycleDto,
  StartReviewCycleDto,
  UpdateCycleStatusDto,
  ReviewCycleQueryDto,
  SubmitSelfReviewDto,
  SubmitPeerReviewDto,
  SubmitManagerReviewDto,
  FinalizeReviewDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementQueryDto,
  AnnouncementReactDto,
  CreateKudosDto,
  KudosQueryDto,
  CreateSurveyDto,
  UpdateSurveyDto,
  SubmitSurveyResponseDto,
  SurveyQueryDto,
  CreateCourseDto,
  UpdateCourseDto,
  CourseQueryDto,
  EnrollCourseDto,
  UpdateLessonProgressDto,
  SubmitQuizDto,
  RateCourseDto,
  CreateLearningPathDto,
  UpdateLearningPathDto,
  EnrollmentQueryDto,
} from './dto/index';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @InjectModel('SalaryStructure') private salaryStructureModel: Model<ISalaryStructure>,
    @InjectModel('PayrollRun') private payrollRunModel: Model<IPayrollRun>,
    @InjectModel('PayrollEntry') private payrollEntryModel: Model<IPayrollEntry>,
    @InjectModel('Payslip') private payslipModel: Model<IPayslip>,
    @InjectModel('InvestmentDeclaration') private investmentDeclarationModel: Model<IInvestmentDeclaration>,
    @InjectModel('ExpenseClaim') private expenseClaimModel: Model<IExpenseClaim>,
    @InjectModel('EmployeeLoan') private employeeLoanModel: Model<IEmployeeLoan>,
    @InjectModel('Onboarding') private onboardingModel: Model<IOnboarding>,
    @InjectModel('Offboarding') private offboardingModel: Model<IOffboarding>,
    @InjectModel('AnalyticsSnapshot') private analyticsSnapshotModel: Model<IAnalyticsSnapshot>,
    @InjectModel('JobPosting') private jobPostingModel: Model<IJobPosting>,
    @InjectModel('Candidate') private candidateModel: Model<ICandidate>,
    @InjectModel('StatutoryReport') private statutoryReportModel: Model<IStatutoryReport>,
    @InjectModel('Goal') private goalModel: Model<IGoal>,
    @InjectModel('ReviewCycle') private reviewCycleModel: Model<IReviewCycle>,
    @InjectModel('PerformanceReview') private performanceReviewModel: Model<IPerformanceReview>,
    @InjectModel('Announcement') private announcementModel: Model<IAnnouncement>,
    @InjectModel('Kudos') private kudosModel: Model<IKudos>,
    @InjectModel('Survey') private surveyModel: Model<ISurvey>,
    @InjectModel('SurveyResponse') private surveyResponseModel: Model<ISurveyResponse>,
    @InjectModel('Course') private courseModel: Model<ICourse>,
    @InjectModel('Enrollment') private enrollmentModel: Model<IEnrollment>,
    @InjectModel('Certificate') private certificateModel: Model<ICertificate>,
    @InjectModel('LearningPath') private learningPathModel: Model<ILearningPath>,
    @InjectModel('Counter') private counterModel: Model<ICounter>,
    private calculationService: PayrollCalculationService,
    private externalServices: ExternalServicesService,
    private attritionPredictorService: AttritionPredictorService,
  ) {}

  // ===========================================================================
  // 1. createSalaryStructure
  // ===========================================================================
  async createSalaryStructure(
    dto: CreateSalaryStructureDto,
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Creating salary structure for employee ${dto.employeeId} by user ${userId}`);

    const components = (dto.components || []).map((comp) => ({
      ...comp,
      monthlyAmount: Math.round(comp.annualAmount / 12),
      showInPayslip: comp.showInPayslip ?? true,
      order: comp.order ?? 0,
    }));

    const grossSalary = components
      .filter((c) => c.type === 'earning')
      .reduce((sum, c) => sum + c.monthlyAmount, 0);

    // Calculate statutory deductions using calculationService helpers
    const basicComp = components.find(
      (c) => c.code === 'BASIC' || c.code === 'basic',
    );
    const basicMonthly = basicComp ? basicComp.monthlyAmount : 0;

    const defaultPFConfig = {
      applicable: true,
      employeeRate: 0.12,
      employerRate: 0.12,
      adminChargesRate: 0.005,
      edliRate: 0.005,
      wageCeiling: 15000,
    };
    const defaultESIConfig = {
      applicable: true,
      employeeRate: 0.0075,
      employerRate: 0.0325,
      wageCeiling: 21000,
    };
    const defaultPTConfig = { applicable: true, state: 'maharashtra' };

    const pf = this.calculationService.calculatePF(basicMonthly, defaultPFConfig);
    const esi = this.calculationService.calculateESI(grossSalary, defaultESIConfig);
    const professionalTax = this.calculationService.calculateProfessionalTax(
      grossSalary,
      defaultPTConfig,
    );

    const statutoryDeductions = {
      pfEmployee: pf.pfEmployee,
      pfEmployer: pf.pfEmployer,
      pfAdminCharges: pf.adminCharges,
      edli: pf.edli,
      esiEmployee: esi.esiEmployee,
      esiEmployer: esi.esiEmployer,
      professionalTax,
      lwf: 0,
    };

    const totalStatutoryEmployee =
      statutoryDeductions.pfEmployee +
      statutoryDeductions.esiEmployee +
      statutoryDeductions.professionalTax +
      statutoryDeductions.lwf;

    const netSalary = grossSalary - totalStatutoryEmployee;

    const data: Partial<ISalaryStructure> = {
      employeeId: dto.employeeId,
      structureName: dto.structureName,
      effectiveFrom: new Date(dto.effectiveFrom),
      ctc: dto.ctc,
      grossSalary,
      netSalary,
      components,
      statutoryDeductions,
      metadata: { revision: 1 },
      status: 'draft',
      isActive: true,
      isDeleted: false,
      createdBy: userId,
    };

    data.organizationId = orgId;

    const structure = new this.salaryStructureModel(data);
    return structure.save();
  }

  // ===========================================================================
  // 2. getSalaryStructure
  // ===========================================================================
  async getSalaryStructure(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { employeeId, status: 'active', isDeleted: false };
    filter.organizationId = orgId;

    const structure = await this.salaryStructureModel
      .findOne(filter)
      .sort({ effectiveFrom: -1 });

    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }
    return structure;
  }

  // ===========================================================================
  // 3. getSalaryHistory
  // ===========================================================================
  async getSalaryHistory(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { employeeId, isDeleted: false };
    filter.organizationId = orgId;

    return this.salaryStructureModel
      .find(filter)
      .sort({ effectiveFrom: -1 });
  }

  // ===========================================================================
  // 4. updateSalaryStructure
  // ===========================================================================
  async updateSalaryStructure(
    id: string,
    dto: UpdateSalaryStructureDto,
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const existing = await this.salaryStructureModel.findOne(filter);
    if (!existing) {
      throw new NotFoundException('Salary structure not found');
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        `Cannot update salary structure in '${existing.status}' status. Only 'draft' structures can be updated.`,
      );
    }

    const updateData: any = { ...dto, updatedBy: userId };

    // Recalculate if components changed
    if (dto.components) {
      updateData.components = dto.components.map((comp) => ({
        ...comp,
        monthlyAmount: Math.round(comp.annualAmount / 12),
        showInPayslip: comp.showInPayslip ?? true,
        order: comp.order ?? 0,
      }));

      const grossSalary = updateData.components
        .filter((c: any) => c.type === 'earning')
        .reduce((sum: number, c: any) => sum + c.monthlyAmount, 0);

      updateData.grossSalary = grossSalary;

      const basicComp = updateData.components.find(
        (c: any) => c.code === 'BASIC' || c.code === 'basic',
      );
      const basicMonthly = basicComp ? basicComp.monthlyAmount : 0;

      const pf = this.calculationService.calculatePF(basicMonthly, {
        applicable: true,
        employeeRate: 0.12,
        employerRate: 0.12,
        adminChargesRate: 0.005,
        edliRate: 0.005,
        wageCeiling: 15000,
      });
      const esi = this.calculationService.calculateESI(grossSalary, {
        applicable: true,
        employeeRate: 0.0075,
        employerRate: 0.0325,
        wageCeiling: 21000,
      });
      const professionalTax = this.calculationService.calculateProfessionalTax(
        grossSalary,
        { applicable: true, state: 'maharashtra' },
      );

      updateData.statutoryDeductions = {
        pfEmployee: pf.pfEmployee,
        pfEmployer: pf.pfEmployer,
        pfAdminCharges: pf.adminCharges,
        edli: pf.edli,
        esiEmployee: esi.esiEmployee,
        esiEmployer: esi.esiEmployer,
        professionalTax,
        lwf: 0,
      };

      const totalStatutoryEmployee =
        updateData.statutoryDeductions.pfEmployee +
        updateData.statutoryDeductions.esiEmployee +
        updateData.statutoryDeductions.professionalTax +
        updateData.statutoryDeductions.lwf;

      updateData.netSalary = grossSalary - totalStatutoryEmployee;
    }

    if (dto.effectiveFrom) {
      updateData.effectiveFrom = new Date(dto.effectiveFrom);
    }

    const updated = await this.salaryStructureModel.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Salary structure not found');
    }

    this.logger.log(`Salary structure ${id} updated by user ${userId}`);
    return updated;
  }

  // ===========================================================================
  // 5. submitForApproval
  // ===========================================================================
  async submitForApproval(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const structure = await this.salaryStructureModel.findOne(filter);
    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    if (structure.status !== 'draft') {
      throw new BadRequestException(
        `Cannot submit for approval from '${structure.status}' status. Only 'draft' structures can be submitted.`,
      );
    }

    structure.status = 'pending_approval';
    structure.updatedBy = userId;

    this.logger.log(
      `Salary structure ${id} submitted for approval by user ${userId}`,
    );

    return structure.save();
  }

  // ===========================================================================
  // 6. approveSalaryStructure
  // ===========================================================================
  async approveSalaryStructure(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const structure = await this.salaryStructureModel.findOne(filter);
    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    if (structure.createdBy === userId) {
      throw new ForbiddenException('Cannot approve your own salary structure. A different administrator must approve.');
    }

    if (structure.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot approve from '${structure.status}' status. Only 'pending_approval' structures can be approved.`,
      );
    }

    // Supersede any existing active structure for the same employee
    const existingActiveFilter: any = {
      employeeId: structure.employeeId,
      status: 'active',
      isDeleted: false,
      _id: { $ne: id },
    };
    existingActiveFilter.organizationId = orgId;

    await this.salaryStructureModel.updateMany(existingActiveFilter, {
      $set: {
        status: 'superseded',
        effectiveTo: structure.effectiveFrom,
        isActive: false,
        updatedBy: userId,
      },
    });

    structure.status = 'active';
    structure.isActive = true;
    structure.metadata.approvedBy = userId;
    structure.metadata.approvedAt = new Date();
    structure.updatedBy = userId;

    this.logger.log(
      `Salary structure ${id} approved by user ${userId}`,
    );

    return structure.save();
  }

  // ===========================================================================
  // 7. rejectSalaryStructure
  // ===========================================================================
  async rejectSalaryStructure(
    id: string,
    body: { reason?: string },
    userId: string,
    orgId: string,
  ): Promise<ISalaryStructure> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const structure = await this.salaryStructureModel.findOne(filter);
    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    if (structure.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot reject from '${structure.status}' status. Only 'pending_approval' structures can be rejected.`,
      );
    }

    structure.status = 'draft';
    structure.metadata.revisionReason = body.reason || 'Rejected';
    structure.updatedBy = userId;

    this.logger.log(
      `Salary structure ${id} rejected by user ${userId}: ${body.reason || 'No reason provided'}`,
    );

    return structure.save();
  }

  // ===========================================================================
  // 8. simulateCTC
  // ===========================================================================
  async simulateCTC(
    dto: SimulateCTCDto,
    userId: string,
    orgId: string,
  ): Promise<any> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`CTC simulation requested for ${dto.ctc} paise by user ${userId}`);

    // Default org components for simulation
    const defaultComponents = [
      {
        code: 'BASIC',
        name: 'Basic Salary',
        type: 'earning' as const,
        calculationMethod: 'percentage_ctc' as const,
        annualAmount: 0,
        monthlyAmount: 0,
        percentage: 40,
        isTaxable: true,
        isPFApplicable: true,
        isESIApplicable: true,
        showInPayslip: true,
        order: 1,
      },
      {
        code: 'HRA',
        name: 'House Rent Allowance',
        type: 'earning' as const,
        calculationMethod: 'percentage_basic' as const,
        annualAmount: 0,
        monthlyAmount: 0,
        percentage: 50,
        isTaxable: true,
        taxExemptionLimit: 0,
        isPFApplicable: false,
        isESIApplicable: true,
        showInPayslip: true,
        order: 2,
      },
      {
        code: 'SPECIAL',
        name: 'Special Allowance',
        type: 'earning' as const,
        calculationMethod: 'fixed' as const,
        annualAmount: 0,
        monthlyAmount: 0,
        isTaxable: true,
        isPFApplicable: false,
        isESIApplicable: true,
        showInPayslip: true,
        order: 3,
      },
    ];

    const pfConfig = {
      applicable: true,
      employeeRate: 0.12,
      employerRate: 0.12,
      adminChargesRate: 0.005,
      edliRate: 0.005,
      wageCeiling: 15000,
    };

    const esiConfig = {
      applicable: true,
      employeeRate: 0.0075,
      employerRate: 0.0325,
      wageCeiling: 21000,
    };

    const breakdown = this.calculationService.simulateCTCBreakdown(
      dto.ctc,
      defaultComponents,
      pfConfig,
      esiConfig,
    );

    return breakdown;
  }

  // ===========================================================================
  // 9. initiatePayrollRun
  // ===========================================================================
  async initiatePayrollRun(
    dto: InitiatePayrollRunDto,
    userId: string,
    orgId: string,
  ): Promise<IPayrollRun> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(
      `Initiating payroll run for ${dto.month}/${dto.year} by user ${userId}`,
    );

    // Generate runNumber: PR-YYYY-MM-001 (increment if duplicates)
    const monthStr = String(dto.month).padStart(2, '0');
    const baseRunNumber = `PR-${dto.year}-${monthStr}`;
    const existingRuns = await this.payrollRunModel
      .find({ runNumber: { $regex: `^${baseRunNumber}` } })
      .sort({ runNumber: -1 })
      .limit(1);

    let sequence = 1;
    if (existingRuns.length > 0) {
      const lastRunNumber = existingRuns[0].runNumber;
      const lastSeqStr = lastRunNumber.split('-').pop();
      const lastSeq = parseInt(lastSeqStr || '0', 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }
    const runNumber = `${baseRunNumber}-${String(sequence).padStart(3, '0')}`;

    // Calculate pay period dates
    const startDate = new Date(dto.year, dto.month - 1, 1);
    const endDate = new Date(dto.year, dto.month, 0); // last day of month

    const data: Partial<IPayrollRun> = {
      organizationId: orgId,
      payPeriod: {
        month: dto.month,
        year: dto.year,
        startDate,
        endDate,
      },
      runNumber,
      status: 'draft',
      summary: {
        totalEmployees: 0,
        processedEmployees: 0,
        skippedEmployees: 0,
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        totalEmployerContributions: 0,
        totalTDS: 0,
        totalPFEmployee: 0,
        totalPFEmployer: 0,
        totalESIEmployee: 0,
        totalESIEmployer: 0,
        totalPT: 0,
        totalLWF: 0,
        totalReimbursements: 0,
        totalArrears: 0,
        totalOvertime: 0,
        totalLOPDeductions: 0,
        totalBonuses: 0,
      },
      employeePayrolls: [],
      auditTrail: [
        {
          action: 'initiated',
          performedBy: userId,
          performedAt: new Date(),
          newStatus: 'draft',
        },
      ],
      isDeleted: false,
      createdBy: userId,
    };

    // Use atomic save — unique partial index on payroll-run schema prevents duplicates
    try {
      const run = new this.payrollRunModel(data);
      return await run.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('A payroll run already exists for this period');
      }
      throw err;
    }
  }

  // ===========================================================================
  // 10. getPayrollRuns
  // ===========================================================================
  async getPayrollRuns(
    query: PayrollQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ data: IPayrollRun[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { isDeleted: false };
    filter.organizationId = orgId;
    if (query.status) filter.status = query.status;
    if (query.year) filter['payPeriod.year'] = query.year;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.payrollRunModel
        .find(filter)
        .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 })
        .skip(skip)
        .limit(limit),
      this.payrollRunModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // 11. getPayrollRun
  // ===========================================================================
  async getPayrollRun(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IPayrollRun> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const run = await this.payrollRunModel.findOne(filter);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    return run;
  }

  // ===========================================================================
  // 12. processPayrollRun (THE CORE METHOD)
  // ===========================================================================
  async processPayrollRun(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IPayrollRun> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const run = await this.payrollRunModel.findOne(filter);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'draft') {
      throw new BadRequestException(
        `Cannot process payroll run in '${run.status}' status. Only 'draft' runs can be processed.`,
      );
    }

    // Set status to processing
    run.status = 'processing';
    run.auditTrail.push({
      action: 'processing_started',
      performedBy: userId,
      performedAt: new Date(),
      previousStatus: 'draft',
      newStatus: 'processing',
    });
    await run.save();

    this.logger.log(`Processing payroll run ${run.runNumber} for period ${run.payPeriod.month}/${run.payPeriod.year}`);

    // Get all active salary structures for this org
    const structureFilter: any = {
      status: 'active',
      isDeleted: false,
    };
    structureFilter.organizationId = orgId;

    const salaryStructures = await this.salaryStructureModel.find(structureFilter);

    // Try to load org-specific payroll config
    let payrollConfig = {
      pfConfig: {
        applicable: true,
        employeeRate: 0.12,
        employerRate: 0.12,
        adminChargesRate: 0.005,
        edliRate: 0.005,
        wageCeiling: 15000,
      },
      esiConfig: {
        applicable: true,
        employeeRate: 0.0075,
        employerRate: 0.0325,
        wageCeiling: 21000,
      },
      tdsConfig: {
        applicable: true,
        regime: 'new' as 'old' | 'new',
      },
      ptConfig: {
        applicable: true,
        state: 'maharashtra',
      },
      lwfConfig: {
        applicable: false,
        state: 'maharashtra',
      },
      overtime: {
        applicable: false,
        rate: 2,
      },
    };

    const orgConfig = await this.externalServices.getPayrollConfig(orgId);
    if (orgConfig?.payroll) {
      const pc = orgConfig.payroll;
      payrollConfig = {
        pfConfig: {
          applicable: pc.pfConfig?.applicable ?? true,
          employeeRate: pc.pfConfig?.employeeRate ?? 0.12,
          employerRate: pc.pfConfig?.employerRate ?? 0.12,
          adminChargesRate: pc.pfConfig?.adminChargesRate ?? 0.005,
          edliRate: pc.pfConfig?.edliRate ?? 0.005,
          wageCeiling: pc.pfConfig?.wageCeiling ?? 15000,
        },
        esiConfig: {
          applicable: pc.esiConfig?.applicable ?? true,
          employeeRate: pc.esiConfig?.employeeRate ?? 0.0075,
          employerRate: pc.esiConfig?.employerRate ?? 0.0325,
          wageCeiling: pc.esiConfig?.wageCeiling ?? 21000,
        },
        tdsConfig: {
          applicable: pc.tdsConfig?.applicable ?? true,
          regime: (pc.tdsConfig?.regime || 'new') as 'old' | 'new',
        },
        ptConfig: {
          applicable: pc.ptConfig?.applicable ?? true,
          state: pc.ptConfig?.state || 'maharashtra',
        },
        lwfConfig: {
          applicable: pc.lwfConfig?.applicable ?? false,
          state: pc.lwfConfig?.state || 'maharashtra',
        },
        overtime: {
          applicable: false,
          rate: 2,
        },
      };
      this.logger.log(`Loaded org payroll config for ${orgId}`);
    } else {
      this.logger.warn(`Could not load org payroll config for ${orgId}, using defaults`);
    }

    const payPeriod = {
      month: run.payPeriod.month,
      year: run.payPeriod.year,
      startDate: run.payPeriod.startDate,
      endDate: run.payPeriod.endDate,
    };

    const entryIds: string[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    // Summary accumulators
    const summary = {
      totalEmployees: salaryStructures.length,
      processedEmployees: 0,
      skippedEmployees: 0,
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      totalEmployerContributions: 0,
      totalTDS: 0,
      totalPFEmployee: 0,
      totalPFEmployer: 0,
      totalESIEmployee: 0,
      totalESIEmployer: 0,
      totalPT: 0,
      totalLWF: 0,
      totalReimbursements: 0,
      totalArrears: 0,
      totalOvertime: 0,
      totalLOPDeductions: 0,
      totalBonuses: 0,
    };

    for (const structure of salaryStructures) {
      try {
        // Try to fetch real attendance from attendance-service
        let attendance = {
          totalWorkingDays: 22,
          presentDays: 22,
          absentDays: 0,
          halfDays: 0,
          lopDays: 0,
          paidLeaveDays: 0,
          holidays: 0,
          weekoffs: 0,
          overtimeHours: 0,
        };

        const attendanceData = await this.externalServices.getMonthlyAttendance(
          structure.employeeId,
          payPeriod.month,
          payPeriod.year,
        );

        if (attendanceData && Array.isArray(attendanceData)) {
          const records = attendanceData;
          const present = records.filter((r: any) => ['present', 'late', 'wfh'].includes(r.status)).length;
          const absent = records.filter((r: any) => r.status === 'absent').length;
          const halfDays = records.filter((r: any) => r.status === 'half_day').length;
          const holidays = records.filter((r: any) => r.status === 'holiday').length;
          const weekoffs = records.filter((r: any) => r.status === 'weekoff').length;
          const leaves = records.filter((r: any) => r.status === 'leave').length;
          const totalOT = records.reduce((sum: number, r: any) => sum + (r.overtimeHours || 0), 0);

          attendance = {
            totalWorkingDays: present + absent + halfDays + leaves,
            presentDays: present,
            absentDays: absent,
            halfDays,
            lopDays: absent,
            paidLeaveDays: leaves,
            holidays,
            weekoffs,
            overtimeHours: totalOT,
          };
        } else {
          this.logger.warn(`No attendance data for employee ${structure.employeeId}, using defaults`);
        }

        // Compute employee payroll
        const result = this.calculationService.computeEmployeePayroll({
          salaryStructure: structure,
          attendance,
          payrollConfig,
          payPeriod,
        });

        // Create PayrollEntry document
        const entryData: Partial<IPayrollEntry> = {
          payrollRunId: run._id.toString(),
          employeeId: structure.employeeId,
          salaryStructureId: structure._id.toString(),
          payPeriod: { month: payPeriod.month, year: payPeriod.year },
          attendance: result.attendance,
          earnings: result.earnings,
          deductions: result.deductions,
          statutory: result.statutory,
          reimbursements: [],
          bonuses: result.bonuses,
          loanDeductions: result.loanDeductions,
          totals: result.totals,
          paymentDetails: {},
          status: 'computed',
          isDeleted: false,
          createdBy: userId,
        };

        entryData.organizationId = orgId;

        const entry = new this.payrollEntryModel(entryData);
        const savedEntry = await entry.save();
        entryIds.push(savedEntry._id.toString());

        // Accumulate summary
        summary.totalGross += result.totals.grossEarnings;
        summary.totalDeductions += result.totals.totalDeductions;
        summary.totalNet += result.totals.netPayable;
        summary.totalEmployerContributions +=
          result.statutory.pfEmployer +
          result.statutory.pfAdminCharges +
          result.statutory.edli +
          result.statutory.esiEmployer;
        summary.totalTDS += result.statutory.tds;
        summary.totalPFEmployee += result.statutory.pfEmployee;
        summary.totalPFEmployer += result.statutory.pfEmployer;
        summary.totalESIEmployee += result.statutory.esiEmployee;
        summary.totalESIEmployer += result.statutory.esiEmployer;
        summary.totalPT += result.statutory.professionalTax;
        summary.totalLWF += result.statutory.lwf;
        summary.totalReimbursements += result.totals.totalReimbursements;
        summary.totalArrears += result.totals.totalArrears;
        summary.totalOvertime += result.totals.overtimePay;
        summary.totalLOPDeductions += result.totals.lopDeduction;
        summary.totalBonuses += result.totals.totalBonuses;

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process payroll for employee ${structure.employeeId}: ${error.message}`,
        );
        skippedCount++;
      }
    }

    summary.processedEmployees = processedCount;
    summary.skippedEmployees = skippedCount;

    // Update run with results
    run.status = 'review';
    run.summary = summary;
    run.employeePayrolls = entryIds;
    run.auditTrail.push({
      action: 'processing_completed',
      performedBy: userId,
      performedAt: new Date(),
      previousStatus: 'processing',
      newStatus: 'review',
      notes: `Processed ${processedCount} employees, skipped ${skippedCount}`,
    });

    this.logger.log(
      `Payroll run ${run.runNumber} processing completed: ${processedCount} processed, ${skippedCount} skipped`,
    );

    return run.save();
  }

  // ===========================================================================
  // 13. updatePayrollRunStatus
  // ===========================================================================
  async updatePayrollRunStatus(
    id: string,
    dto: UpdatePayrollStatusDto,
    userId: string,
    orgId: string,
  ): Promise<IPayrollRun> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const run = await this.payrollRunModel.findOne(filter);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    // State machine transitions
    const validTransitions: Record<string, string[]> = {
      draft: ['cancelled'],
      review: ['draft', 'approved'],
      approved: ['draft', 'finalized'],
      finalized: ['paid'],
    };

    const allowedTargets = validTransitions[run.status];
    if (!allowedTargets || !allowedTargets.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from '${run.status}' to '${dto.status}'. Allowed transitions: ${(allowedTargets || []).join(', ') || 'none'}`,
      );
    }

    const previousStatus = run.status;
    run.status = dto.status;

    // Status-specific actions
    if (dto.status === 'approved') {
      run.approvedBy = userId;
      run.approvedAt = new Date();
    } else if (dto.status === 'finalized') {
      run.finalizedBy = userId;
      run.finalizedAt = new Date();
    } else if (dto.status === 'paid') {
      run.paidAt = new Date();
      if (dto.paymentReference) {
        run.paymentReference = dto.paymentReference;
      }
    }

    run.auditTrail.push({
      action: `status_changed_to_${dto.status}`,
      performedBy: userId,
      performedAt: new Date(),
      previousStatus,
      newStatus: dto.status,
      notes: dto.notes || undefined,
    });

    this.logger.log(
      `Payroll run ${run.runNumber} status changed from '${previousStatus}' to '${dto.status}' by user ${userId}`,
    );

    return run.save();
  }

  // ===========================================================================
  // 14. getPayrollEntries
  // ===========================================================================
  async getPayrollEntries(
    runId: string,
    query: PayrollQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ data: IPayrollEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { payrollRunId: runId, isDeleted: false };
    filter.organizationId = orgId;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.payrollEntryModel
        .find(filter)
        .sort({ employeeId: 1 })
        .skip(skip)
        .limit(limit),
      this.payrollEntryModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // 15. getPayrollEntry
  // ===========================================================================
  async getPayrollEntry(
    runId: string,
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IPayrollEntry> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { payrollRunId: runId, employeeId, isDeleted: false };
    filter.organizationId = orgId;

    const entry = await this.payrollEntryModel.findOne(filter);
    if (!entry) {
      throw new NotFoundException('Payroll entry not found');
    }
    return entry;
  }

  // ===========================================================================
  // 16. overridePayrollEntry
  // ===========================================================================
  async overridePayrollEntry(
    runId: string,
    employeeId: string,
    dto: OverrideEntryDto,
    userId: string,
    orgId: string,
  ): Promise<IPayrollEntry> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    // Validate the run is in 'review' status
    const runFilter: any = { _id: runId, isDeleted: false };
    runFilter.organizationId = orgId;

    const run = await this.payrollRunModel.findOne(runFilter);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    if (run.status !== 'review') {
      throw new BadRequestException(
        `Cannot override entries for a payroll run in '${run.status}' status. Run must be in 'review' status.`,
      );
    }

    const entryFilter: any = { payrollRunId: runId, employeeId, isDeleted: false };
    entryFilter.organizationId = orgId;

    const entry = await this.payrollEntryModel.findOne(entryFilter);
    if (!entry) {
      throw new NotFoundException('Payroll entry not found');
    }

    // Add additional earnings
    if (dto.additionalEarnings && dto.additionalEarnings.length > 0) {
      for (const earning of dto.additionalEarnings) {
        entry.earnings.push({
          code: earning.code,
          name: earning.name,
          fullAmount: earning.amount,
          actualAmount: earning.amount,
          arrearAmount: 0,
          isTaxable: earning.isTaxable ?? true,
        });
      }
    }

    // Add additional deductions
    if (dto.additionalDeductions && dto.additionalDeductions.length > 0) {
      for (const deduction of dto.additionalDeductions) {
        entry.deductions.push({
          code: deduction.code,
          name: deduction.name,
          amount: deduction.amount,
          category: 'voluntary',
        });
      }
    }

    // Recalculate totals
    const grossEarnings = entry.earnings.reduce(
      (sum, e) => sum + e.actualAmount,
      0,
    );
    const totalDeductionAmount = entry.deductions.reduce(
      (sum, d) => sum + d.amount,
      0,
    );
    const netPayable = grossEarnings + entry.totals.overtimePay + entry.totals.totalBonuses - totalDeductionAmount;

    entry.totals.grossEarnings = grossEarnings;
    entry.totals.totalDeductions = totalDeductionAmount;
    entry.totals.netPayable = netPayable;

    if (dto.notes) {
      entry.notes = dto.notes;
    }

    entry.status = 'reviewed';

    this.logger.log(
      `Payroll entry for employee ${employeeId} in run ${runId} overridden by user ${userId}`,
    );

    return entry.save();
  }

  // ===========================================================================
  // 17. holdEntry
  // ===========================================================================
  async holdEntry(
    runId: string,
    employeeId: string,
    dto: HoldEntryDto,
    userId: string,
    orgId: string,
  ): Promise<IPayrollEntry> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const run = await this.payrollRunModel.findOne({ _id: runId, isDeleted: false, organizationId: orgId });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'review') throw new BadRequestException('Can only hold entries during review');

    const entryFilter: any = { payrollRunId: runId, employeeId, isDeleted: false };
    entryFilter.organizationId = orgId;

    const entry = await this.payrollEntryModel.findOne(entryFilter);
    if (!entry) {
      throw new NotFoundException('Payroll entry not found');
    }

    entry.status = 'on_hold';
    entry.holdReason = dto.reason;

    this.logger.log(
      `Payroll entry for employee ${employeeId} in run ${runId} put on hold by user ${userId}: ${dto.reason}`,
    );

    return entry.save();
  }

  // ===========================================================================
  // 18. releaseEntry
  // ===========================================================================
  async releaseEntry(
    runId: string,
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IPayrollEntry> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const run = await this.payrollRunModel.findOne({ _id: runId, isDeleted: false, organizationId: orgId });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'review') throw new BadRequestException('Can only release entries during review');

    const entryFilter: any = { payrollRunId: runId, employeeId, isDeleted: false };
    entryFilter.organizationId = orgId;

    const entry = await this.payrollEntryModel.findOne(entryFilter);
    if (!entry) {
      throw new NotFoundException('Payroll entry not found');
    }

    entry.status = 'computed';
    entry.holdReason = undefined;

    this.logger.log(
      `Payroll entry for employee ${employeeId} in run ${runId} released by user ${userId}`,
    );

    return entry.save();
  }

  // ===========================================================================
  // 19. generatePayslips
  // ===========================================================================
  async generatePayslips(
    runId: string,
    userId: string,
    orgId: string,
  ): Promise<{ count: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const runFilter: any = { _id: runId, isDeleted: false };
    runFilter.organizationId = orgId;

    const run = await this.payrollRunModel.findOne(runFilter);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'finalized') {
      throw new BadRequestException(
        `Cannot generate payslips for a payroll run in '${run.status}' status. Run must be 'finalized'.`,
      );
    }

    // Get all entries for this run (skip on_hold entries)
    const entryFilter: any = { payrollRunId: runId, isDeleted: false, status: { $ne: 'on_hold' } };
    entryFilter.organizationId = orgId;

    const entries = await this.payrollEntryModel.find(entryFilter);

    const monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const periodLabel = `${monthNames[run.payPeriod.month]} ${run.payPeriod.year}`;

    let count = 0;

    // Fetch org details once before the loop (PAY-013)
    let orgName = 'Organization';
    let orgAddress = 'N/A';
    let orgPan = 'N/A';
    let orgTan = 'N/A';
    let orgLogo = '';

    const orgDetails = await this.externalServices.getOrgDetails(orgId);
    if (orgDetails) {
      orgName = orgDetails.companyName || orgDetails.name || 'Organization';
      orgAddress = orgDetails.registeredAddress || orgDetails.address || 'N/A';
      orgPan = orgDetails.pan || 'N/A';
      orgTan = orgDetails.tan || 'N/A';
      orgLogo = orgDetails.logo || '';
    }

    for (const entry of entries) {
      // Build earnings line items for payslip
      const payslipEarnings = entry.earnings.map((e) => ({
        code: e.code,
        name: e.name,
        amount: e.actualAmount,
      }));

      // Build deductions line items for payslip
      const payslipDeductions = entry.deductions.map((d) => ({
        code: d.code,
        name: d.name,
        amount: d.amount,
      }));

      // Build employer contributions
      const employerContributions = [];
      if (entry.statutory.pfEmployer > 0) {
        employerContributions.push({
          code: 'PF_EMPLOYER',
          name: 'Provident Fund (Employer)',
          amount: entry.statutory.pfEmployer,
        });
      }
      if (entry.statutory.pfAdminCharges > 0) {
        employerContributions.push({
          code: 'PF_ADMIN',
          name: 'PF Admin Charges',
          amount: entry.statutory.pfAdminCharges,
        });
      }
      if (entry.statutory.edli > 0) {
        employerContributions.push({
          code: 'EDLI',
          name: 'EDLI',
          amount: entry.statutory.edli,
        });
      }
      if (entry.statutory.esiEmployer > 0) {
        employerContributions.push({
          code: 'ESI_EMPLOYER',
          name: 'ESI (Employer)',
          amount: entry.statutory.esiEmployer,
        });
      }

      const netPayableWords = this.calculationService.numberToWords(
        entry.totals.netPayable,
      );

      // Try to fetch real employee data (PAY-013)
      let employeeName = 'Employee';
      let employeeDesignation = 'N/A';
      let employeeDepartment = 'N/A';
      let employeeBankAccount = 'XXXX';
      let employeePan = 'XXXXX';
      let employeeUan = '';
      let employeeEsiNumber = '';

      const empData = await this.externalServices.getEmployee(entry.employeeId);
      if (empData) {
        employeeName = `${empData.firstName || ''} ${empData.lastName || ''}`.trim() || 'Employee';
        employeeDesignation = empData.designation || empData.designationName || 'N/A';
        employeeDepartment = empData.department || empData.departmentName || 'N/A';
        if (empData.bankDetails?.accountNumber) {
          const acct = empData.bankDetails.accountNumber;
          employeeBankAccount = 'XXXX' + acct.slice(-4);
        }
        if (empData.pan) {
          employeePan = empData.pan.slice(0, 5) + '****' + empData.pan.slice(-1);
        }
        employeeUan = empData.uan || '';
        employeeEsiNumber = empData.esiNumber || '';
      }

      // Calculate YTD totals from previous payslips in the same financial year (PAY-014)
      const fyStartYear = run.payPeriod.month >= 4 ? run.payPeriod.year : run.payPeriod.year - 1;

      const previousPayslips = await this.payslipModel.find({
        organizationId: orgId,
        employeeId: entry.employeeId,
        isDeleted: false,
        $or: [
          { 'payPeriod.year': fyStartYear, 'payPeriod.month': { $gte: 4 } },
          { 'payPeriod.year': fyStartYear + 1, 'payPeriod.month': { $lt: 4 } },
        ],
      }).lean();

      const ytdGross = previousPayslips.reduce((sum, p: any) => sum + (p.totals?.grossEarnings || 0), 0) + entry.totals.grossEarnings;
      const ytdDeductions = previousPayslips.reduce((sum, p: any) => sum + (p.totals?.totalDeductions || 0), 0) + entry.totals.totalDeductions;
      const ytdPF = previousPayslips.reduce((sum, p: any) => sum + (p.deductions?.find((d: any) => d.code === 'PF_EMPLOYEE')?.amount || 0), 0) + (entry.statutory?.pfEmployee || 0);
      const ytdESI = previousPayslips.reduce((sum, p: any) => sum + (p.deductions?.find((d: any) => d.code === 'ESI_EMPLOYEE')?.amount || 0), 0) + (entry.statutory?.esiEmployee || 0);
      const ytdTDS = previousPayslips.reduce((sum, p: any) => sum + (p.deductions?.find((d: any) => d.code === 'TDS')?.amount || 0), 0) + (entry.statutory?.tds || 0);
      const ytdNet = previousPayslips.reduce((sum, p: any) => sum + (p.totals?.netPayable || 0), 0) + entry.totals.netPayable;

      const payslipData: Partial<IPayslip> = {
        employeeId: entry.employeeId,
        payrollRunId: runId,
        payrollEntryId: entry._id.toString(),
        payPeriod: {
          month: run.payPeriod.month,
          year: run.payPeriod.year,
          label: periodLabel,
        },
        employeeSnapshot: {
          employeeId: entry.employeeId,
          name: employeeName,
          designation: employeeDesignation,
          department: employeeDepartment,
          bankAccount: employeeBankAccount,
          pan: employeePan,
          uan: employeeUan,
          esiNumber: employeeEsiNumber,
        },
        organizationSnapshot: {
          name: orgName,
          logo: orgLogo,
          address: orgAddress,
          pan: orgPan,
          tan: orgTan,
        },
        earnings: payslipEarnings,
        deductions: payslipDeductions,
        employerContributions,
        totals: {
          grossEarnings: entry.totals.grossEarnings,
          totalDeductions: entry.totals.totalDeductions,
          netPayable: entry.totals.netPayable,
          netPayableWords,
        },
        ytdTotals: {
          grossEarnings: ytdGross,
          totalDeductions: ytdDeductions,
          pfTotal: ytdPF,
          esiTotal: ytdESI,
          tdsTotal: ytdTDS,
          netPayable: ytdNet,
        },
        isDeleted: false,
      };

      payslipData.organizationId = orgId;

      const payslip = new this.payslipModel(payslipData);
      await payslip.save();
      count++;
    }

    this.logger.log(
      `Generated ${count} payslips for payroll run ${run.runNumber} by user ${userId}`,
    );

    return { count };
  }

  // ===========================================================================
  // 20. getMyPayslips
  // ===========================================================================
  async getMyPayslips(
    query: PayslipQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ data: IPayslip[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { employeeId: userId, isDeleted: false };
    filter.organizationId = orgId;
    if (query.year) filter['payPeriod.year'] = query.year;
    if (query.month) filter['payPeriod.month'] = query.month;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.payslipModel
        .find(filter)
        .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 })
        .skip(skip)
        .limit(limit),
      this.payslipModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // 21. getPayslip
  // ===========================================================================
  async getPayslip(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IPayslip> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const payslip = await this.payslipModel.findOne(filter);
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    return payslip;
  }

  // ===========================================================================
  // 22. submitDeclaration
  // ===========================================================================
  async submitDeclaration(
    dto: SubmitInvestmentDeclarationDto,
    userId: string,
    orgId: string,
  ): Promise<IInvestmentDeclaration> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(
      `Investment declaration submitted by employee ${userId} for FY ${dto.financialYear}`,
    );

    // Calculate totalDeclared from sections
    const totalDeclared = dto.sections.reduce((sectionSum, section) => {
      return sectionSum + section.items.reduce(
        (itemSum, item) => itemSum + item.declaredAmount,
        0,
      );
    }, 0);

    // Check if declaration already exists for this employee+financialYear
    const existingFilter: any = {
      employeeId: userId,
      financialYear: dto.financialYear,
      isDeleted: false,
    };
    existingFilter.organizationId = orgId;

    const existing = await this.investmentDeclarationModel.findOne(existingFilter);

    if (existing) {
      // Update existing declaration
      existing.regime = dto.regime;
      existing.sections = dto.sections.map((s) => ({
        section: s.section,
        items: s.items.map((i) => ({
          description: i.description,
          declaredAmount: i.declaredAmount,
          proofSubmitted: false,
          verifiedAmount: 0,
          proofUrl: i.proofUrl || '',
        })),
      }));
      existing.totalDeclared = totalDeclared;
      existing.status = 'submitted';
      existing.submittedAt = new Date();
      return existing.save();
    }

    // Create new declaration
    const data: Partial<IInvestmentDeclaration> = {
      employeeId: userId,
      financialYear: dto.financialYear,
      regime: dto.regime,
      sections: dto.sections.map((s) => ({
        section: s.section,
        items: s.items.map((i) => ({
          description: i.description,
          declaredAmount: i.declaredAmount,
          proofSubmitted: false,
          verifiedAmount: 0,
          proofUrl: i.proofUrl || '',
        })),
      })),
      totalDeclared,
      totalVerified: 0,
      status: 'submitted',
      submittedAt: new Date(),
      isDeleted: false,
      createdBy: userId,
    };

    data.organizationId = orgId;

    const declaration = new this.investmentDeclarationModel(data);
    return declaration.save();
  }

  // ===========================================================================
  // 23. getMyDeclarations
  // ===========================================================================
  async getMyDeclarations(
    userId: string,
    orgId: string,
  ): Promise<IInvestmentDeclaration[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { employeeId: userId, isDeleted: false };
    filter.organizationId = orgId;

    return this.investmentDeclarationModel
      .find(filter)
      .sort({ financialYear: -1 });
  }

  // ===========================================================================
  // 24. getDeclaration
  // ===========================================================================
  async getDeclaration(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IInvestmentDeclaration> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const declaration = await this.investmentDeclarationModel.findOne(filter);
    if (!declaration) {
      throw new NotFoundException('Investment declaration not found');
    }
    return declaration;
  }

  // ===========================================================================
  // 25. updateDeclaration
  // ===========================================================================
  async updateDeclaration(
    id: string,
    dto: SubmitInvestmentDeclarationDto,
    userId: string,
    orgId: string,
  ): Promise<IInvestmentDeclaration> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const declaration = await this.investmentDeclarationModel.findOne(filter);
    if (!declaration) {
      throw new NotFoundException('Investment declaration not found');
    }

    if (declaration.status !== 'draft' && declaration.status !== 'rejected') {
      throw new BadRequestException(
        `Cannot update declaration in '${declaration.status}' status. Only 'draft' or 'rejected' declarations can be updated.`,
      );
    }

    declaration.regime = dto.regime;
    declaration.sections = dto.sections.map((s) => ({
      section: s.section,
      items: s.items.map((i) => ({
        description: i.description,
        declaredAmount: i.declaredAmount,
        proofSubmitted: false,
        verifiedAmount: 0,
        proofUrl: i.proofUrl || '',
      })),
    }));

    // Recalculate totalDeclared
    declaration.totalDeclared = dto.sections.reduce((sectionSum, section) => {
      return sectionSum + section.items.reduce(
        (itemSum, item) => itemSum + item.declaredAmount,
        0,
      );
    }, 0);

    // Reset status to submitted after update
    declaration.status = 'submitted';
    declaration.submittedAt = new Date();

    this.logger.log(
      `Investment declaration ${id} updated by employee ${userId}`,
    );

    return declaration.save();
  }

  // ===========================================================================
  // 26. verifyDeclaration
  // ===========================================================================
  async verifyDeclaration(
    id: string,
    body: { verified: boolean; remarks?: string },
    userId: string,
    orgId: string,
  ): Promise<IInvestmentDeclaration> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const declaration = await this.investmentDeclarationModel.findOne(filter);
    if (!declaration) {
      throw new NotFoundException('Investment declaration not found');
    }

    if (body.verified) {
      declaration.status = 'verified';
      declaration.verifiedAt = new Date();
      declaration.verifiedBy = userId;

      // Calculate totalVerified from all items
      let totalVerified = 0;
      for (const section of declaration.sections) {
        for (const item of section.items) {
          totalVerified += item.verifiedAmount || item.declaredAmount;
        }
      }
      declaration.totalVerified = totalVerified;

      this.logger.log(
        `Investment declaration ${id} verified by user ${userId}. Total verified: ${totalVerified}`,
      );
    } else {
      declaration.status = 'rejected';
      declaration.rejectionReason = body.remarks || 'Rejected by admin';

      this.logger.log(
        `Investment declaration ${id} rejected by user ${userId}: ${body.remarks || 'No reason provided'}`,
      );
    }

    return declaration.save();
  }

  // ===========================================================================
  // EXPENSE CLAIMS
  // ===========================================================================

  private async generateClaimNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `EXP-${year}-${month}-`;

    const lastClaim = await this.expenseClaimModel
      .findOne({ claimNumber: { $regex: `^${prefix}` } })
      .sort({ claimNumber: -1 })
      .lean();

    let seq = 1;
    if (lastClaim) {
      const lastSeq = parseInt(lastClaim.claimNumber.split('-').pop() || '0', 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async createExpenseClaim(
    dto: CreateExpenseClaimDto,
    userId: string,
    orgId: string,
  ): Promise<IExpenseClaim> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Creating expense claim for user ${userId}`);

    const claimNumber = await this.generateClaimNumber();
    const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    const claim = new this.expenseClaimModel({
      organizationId: orgId,
      employeeId: userId,
      claimNumber,
      title: dto.title,
      category: dto.category,
      items: dto.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        date: new Date(item.date),
        receiptUrl: item.receiptUrl || null,
        merchant: item.merchant || null,
        ocrExtracted: false,
      })),
      totalAmount,
      currency: 'INR',
      status: 'draft',
      approvalChain: [],
      auditTrail: [
        {
          action: 'created',
          performedBy: userId,
          performedAt: new Date(),
          notes: 'Expense claim created',
        },
      ],
      isDeleted: false,
      createdBy: userId,
    });

    return claim.save();
  }

  async getMyExpenseClaims(
    query: ExpenseQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Fetching expense claims for user ${userId}`);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      employeeId: userId,
      isDeleted: false,
    };
    filter.organizationId = orgId;
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;

    const [claims, total] = await Promise.all([
      this.expenseClaimModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.expenseClaimModel.countDocuments(filter),
    ]);

    return { claims, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAllExpenseClaims(
    query: ExpenseQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Fetching all expense claims for org ${orgId} by user ${userId}`);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isDeleted: false };
    filter.organizationId = orgId;
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.employeeId) filter.employeeId = query.employeeId;

    const [claims, total] = await Promise.all([
      this.expenseClaimModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.expenseClaimModel.countDocuments(filter),
    ]);

    return { claims, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPendingApprovals(
    query: ExpenseQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Fetching pending expense approvals for user ${userId}`);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      status: { $in: ['submitted', 'manager_approved', 'hr_approved'] },
      isDeleted: false,
    };
    filter.organizationId = orgId;
    if (query.category) filter.category = query.category;

    const [claims, total] = await Promise.all([
      this.expenseClaimModel.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
      this.expenseClaimModel.countDocuments(filter),
    ]);

    return { claims, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getExpenseClaim(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IExpenseClaim> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Fetching expense claim ${id} for user ${userId}`);

    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const claim = await this.expenseClaimModel.findOne(filter);
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found`);
    }

    return claim;
  }

  async updateExpenseClaim(
    id: string,
    dto: UpdateExpenseClaimDto,
    userId: string,
    orgId: string,
  ): Promise<IExpenseClaim> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Updating expense claim ${id} by user ${userId}`);

    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const claim = await this.expenseClaimModel.findOne(filter);
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found`);
    }

    if (claim.status !== 'draft') {
      throw new BadRequestException('Only draft expense claims can be updated');
    }

    if (dto.title) claim.title = dto.title;
    if (dto.category) claim.category = dto.category;
    if (dto.items) {
      claim.items = dto.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        date: new Date(item.date),
        receiptUrl: item.receiptUrl || undefined,
        merchant: item.merchant || undefined,
        ocrExtracted: false,
      })) as typeof claim.items;
      claim.totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);
    }

    claim.auditTrail.push({
      action: 'updated',
      performedBy: userId,
      performedAt: new Date(),
      notes: 'Expense claim updated',
    });

    return claim.save();
  }

  async submitExpenseClaim(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IExpenseClaim> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Submitting expense claim ${id} by user ${userId}`);

    const filter: Record<string, unknown> = { _id: id, employeeId: userId, isDeleted: false };
    filter.organizationId = orgId;

    const claim = await this.expenseClaimModel.findOne(filter);
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found`);
    }

    if (claim.status !== 'draft') {
      throw new BadRequestException('Only draft expense claims can be submitted');
    }

    if (!claim.items || claim.items.length === 0) {
      throw new BadRequestException('Cannot submit expense claim with no items');
    }

    claim.status = 'submitted';
    claim.submittedAt = new Date();
    claim.approvalChain = [
      { level: 'manager', status: 'pending', approvedBy: undefined, approvedAt: undefined, remarks: undefined },
      { level: 'hr', status: 'pending', approvedBy: undefined, approvedAt: undefined, remarks: undefined },
      { level: 'finance', status: 'pending', approvedBy: undefined, approvedAt: undefined, remarks: undefined },
    ] as typeof claim.approvalChain;

    claim.auditTrail.push({
      action: 'submitted',
      performedBy: userId,
      performedAt: new Date(),
      notes: 'Expense claim submitted for approval',
    });

    return claim.save();
  }

  async approveExpenseClaim(
    id: string,
    dto: ApproveExpenseDto,
    userId: string,
    orgId: string,
  ): Promise<IExpenseClaim> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Processing approval for expense claim ${id} by user ${userId}`);

    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const claim = await this.expenseClaimModel.findOne(filter);
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found`);
    }

    if (['draft', 'paid', 'rejected', 'cancelled', 'finance_approved'].includes(claim.status)) {
      throw new BadRequestException(`Expense claim cannot be approved in status '${claim.status}'`);
    }

    // Find the first pending entry in the approval chain
    const pendingIndex = claim.approvalChain.findIndex(
      (entry) => entry.status === 'pending',
    );

    if (pendingIndex === -1) {
      throw new BadRequestException('No pending approval found in the approval chain');
    }

    const pendingEntry = claim.approvalChain[pendingIndex];

    if (dto.status === 'rejected') {
      pendingEntry.status = 'rejected';
      pendingEntry.approvedBy = userId;
      pendingEntry.approvedAt = new Date();
      pendingEntry.remarks = dto.remarks || undefined;

      claim.status = 'rejected';
      claim.rejectionReason = dto.remarks || `Rejected at ${pendingEntry.level} level`;

      claim.auditTrail.push({
        action: 'rejected',
        performedBy: userId,
        performedAt: new Date(),
        notes: `Rejected at ${pendingEntry.level} level: ${dto.remarks || 'No reason provided'}`,
      });
    } else {
      pendingEntry.status = 'approved';
      pendingEntry.approvedBy = userId;
      pendingEntry.approvedAt = new Date();
      pendingEntry.remarks = dto.remarks || undefined;

      // Determine the new status based on which level just got approved
      const levelStatusMap: Record<string, string> = {
        manager: 'manager_approved',
        hr: 'hr_approved',
        finance: 'finance_approved',
      };

      claim.status = levelStatusMap[pendingEntry.level] || `${pendingEntry.level}_approved`;

      claim.auditTrail.push({
        action: 'approved',
        performedBy: userId,
        performedAt: new Date(),
        notes: `Approved at ${pendingEntry.level} level${dto.remarks ? ': ' + dto.remarks : ''}`,
      });
    }

    return claim.save();
  }

  async cancelExpenseClaim(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IExpenseClaim> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Cancelling expense claim ${id} by user ${userId}`);

    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    filter.organizationId = orgId;

    const claim = await this.expenseClaimModel.findOne(filter);
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found`);
    }

    if (claim.status === 'paid') {
      throw new BadRequestException('Cannot cancel a paid expense claim');
    }

    claim.status = 'cancelled';
    claim.isDeleted = true;

    claim.auditTrail.push({
      action: 'cancelled',
      performedBy: userId,
      performedAt: new Date(),
      notes: 'Expense claim cancelled',
    });

    return claim.save();
  }

  async getExpenseStats(userId: string, orgId: string) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Fetching expense statistics for org ${orgId}`);

    const matchFilter: Record<string, unknown> = { isDeleted: false };
    matchFilter.organizationId = orgId;

    const [byCategory, byStatus, monthlySpend] = await Promise.all([
      this.expenseClaimModel.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$category', totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
      ]),
      this.expenseClaimModel.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$status', totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      this.expenseClaimModel.aggregate([
        { $match: { ...matchFilter, status: { $nin: ['cancelled', 'rejected'] } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
    ]);

    return { byCategory, byStatus, monthlySpend };
  }

  // ===========================================================================
  // ONBOARDING
  // ===========================================================================

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private getDefaultOnboardingChecklist() {
    return [
      { taskId: this.generateUuid(), title: 'Submit identity documents', category: 'documents', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Submit bank account proof', category: 'documents', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Submit educational certificates', category: 'documents', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Sign offer letter', category: 'compliance', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Sign NDA', category: 'compliance', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'IT equipment setup', category: 'it_setup', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Email and system access', category: 'it_setup', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Orientation session', category: 'training', isRequired: true, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Team introduction', category: 'welcome', isRequired: false, isCompleted: false },
      { taskId: this.generateUuid(), title: 'Welcome kit distribution', category: 'welcome', isRequired: false, isCompleted: false },
    ];
  }

  private getDefaultOnboardingDocuments() {
    return [
      { type: 'aadhaar', title: 'Aadhaar Card', status: 'pending' },
      { type: 'pan', title: 'PAN Card', status: 'pending' },
      { type: 'bank_proof', title: 'Bank Account Proof', status: 'pending' },
      { type: 'education', title: 'Educational Certificates', status: 'pending' },
      { type: 'experience', title: 'Experience Letters', status: 'pending' },
      { type: 'photo', title: 'Passport Photo', status: 'pending' },
    ];
  }

  async initiateOnboarding(
    dto: InitiateOnboardingDto,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Initiating onboarding for employee ${dto.employeeId} by user ${userId}`);

    const startDate = new Date(dto.startDate);
    const targetCompletionDate = dto.targetCompletionDate
      ? new Date(dto.targetCompletionDate)
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const checklist = dto.checklist && dto.checklist.length > 0
      ? dto.checklist.map((item) => ({
          taskId: this.generateUuid(),
          title: item.title,
          category: item.category,
          description: item.description || null,
          assignedTo: item.assignedTo || null,
          isCompleted: false,
          completedAt: null,
          completedBy: null,
          isRequired: item.isRequired ?? true,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          notes: null,
        }))
      : this.getDefaultOnboardingChecklist();

    const data: Partial<IOnboarding> = {
      organizationId: orgId,
      employeeId: dto.employeeId,
      status: 'pending',
      startDate,
      targetCompletionDate,
      checklist: checklist,
      documents: this.getDefaultOnboardingDocuments(),
      buddyId: dto.buddyId || null,
      welcomeKitSent: false,
      probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
      confirmationStatus: 'pending',
      auditTrail: [
        {
          action: 'onboarding_initiated',
          performedBy: userId,
          performedAt: new Date(),
          notes: `Onboarding initiated for employee ${dto.employeeId}`,
        },
      ],
      isDeleted: false,
      createdBy: userId,
    };

    const onboarding = new this.onboardingModel(data);
    return onboarding.save();
  }

  async getAllOnboardings(
    query: { status?: string; page?: number; limit?: number },
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { isDeleted: false };
    filter.organizationId = orgId;
    if (query.status) filter.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.onboardingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.onboardingModel.countDocuments(filter),
    ]);

    return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOnboarding(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { employeeId, isDeleted: false };
    filter.organizationId = orgId;

    const onboarding = await this.onboardingModel.findOne(filter);
    if (!onboarding) {
      throw new NotFoundException(`Onboarding not found for employee ${employeeId}`);
    }
    return onboarding;
  }

  async completeChecklistItem(
    employeeId: string,
    dto: CompleteChecklistItemDto,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const onboarding = await this.getOnboarding(employeeId, userId, orgId);

    const task = onboarding.checklist.find((item) => item.taskId === dto.taskId);
    if (!task) {
      throw new NotFoundException(`Checklist task ${dto.taskId} not found`);
    }
    if (task.isCompleted) {
      throw new BadRequestException(`Task ${dto.taskId} is already completed`);
    }

    task.isCompleted = true;
    task.completedAt = new Date();
    task.completedBy = userId;
    if (dto.notes) task.notes = dto.notes;

    // Update status to in_progress if still pending
    if (onboarding.status === 'pending') {
      onboarding.status = 'in_progress';
    }

    // Check if all required items are completed — auto-complete onboarding
    const allRequiredDone = onboarding.checklist
      .filter((item) => item.isRequired)
      .every((item) => item.isCompleted);

    if (allRequiredDone) {
      onboarding.status = 'completed';
      onboarding.actualCompletionDate = new Date();
    }

    onboarding.auditTrail.push({
      action: 'checklist_item_completed',
      performedBy: userId,
      performedAt: new Date(),
      notes: `Task "${task.title}" completed`,
    });

    return onboarding.save();
  }

  async uploadOnboardingDocument(
    employeeId: string,
    docIndex: number,
    url: string,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const onboarding = await this.getOnboarding(employeeId, userId, orgId);

    if (docIndex < 0 || docIndex >= onboarding.documents.length) {
      throw new BadRequestException(`Invalid document index ${docIndex}`);
    }

    onboarding.documents[docIndex].url = url;
    onboarding.documents[docIndex].status = 'uploaded';

    onboarding.auditTrail.push({
      action: 'document_uploaded',
      performedBy: userId,
      performedAt: new Date(),
      notes: `Document "${onboarding.documents[docIndex].title}" uploaded`,
    });

    return onboarding.save();
  }

  async verifyOnboardingDocument(
    employeeId: string,
    docIndex: number,
    dto: VerifyDocumentDto,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const onboarding = await this.getOnboarding(employeeId, userId, orgId);

    if (docIndex < 0 || docIndex >= onboarding.documents.length) {
      throw new BadRequestException(`Invalid document index ${docIndex}`);
    }

    const doc = onboarding.documents[docIndex];
    if (doc.status !== 'uploaded') {
      throw new BadRequestException(`Document must be uploaded before verification`);
    }

    doc.status = dto.status;
    doc.verifiedBy = userId;
    doc.verifiedAt = new Date();
    if (dto.status === 'rejected' && dto.rejectionReason) {
      doc.rejectionReason = dto.rejectionReason;
    }

    onboarding.auditTrail.push({
      action: `document_${dto.status}`,
      performedBy: userId,
      performedAt: new Date(),
      notes: `Document "${doc.title}" ${dto.status}${dto.rejectionReason ? ': ' + dto.rejectionReason : ''}`,
    });

    return onboarding.save();
  }

  async confirmEmployee(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const onboarding = await this.getOnboarding(employeeId, userId, orgId);

    if (onboarding.confirmationStatus === 'confirmed') {
      throw new BadRequestException('Employee is already confirmed');
    }

    onboarding.confirmationStatus = 'confirmed';
    onboarding.confirmationDate = new Date();

    onboarding.auditTrail.push({
      action: 'employee_confirmed',
      performedBy: userId,
      performedAt: new Date(),
      notes: 'Employee probation completed and confirmed',
    });

    return onboarding.save();
  }

  async updateOnboardingStatus(
    employeeId: string,
    status: string,
    userId: string,
    orgId: string,
  ): Promise<IOnboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid onboarding status: ${status}`);
    }

    const onboarding = await this.getOnboarding(employeeId, userId, orgId);
    onboarding.status = status;

    if (status === 'completed') {
      onboarding.actualCompletionDate = new Date();
    }

    onboarding.auditTrail.push({
      action: 'status_updated',
      performedBy: userId,
      performedAt: new Date(),
      notes: `Status changed to ${status}`,
    });

    return onboarding.save();
  }

  // ===========================================================================
  // OFFBOARDING
  // ===========================================================================

  private getDefaultClearanceDepartments() {
    return ['IT', 'HR', 'Finance', 'Admin', 'Reporting Manager'].map((dept) => ({
      department: dept,
      approver: null,
      status: 'pending',
      clearedAt: null,
      remarks: null,
      assets: [],
    }));
  }

  async initiateOffboarding(
    dto: InitiateOffboardingDto,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Initiating offboarding for employee ${dto.employeeId} by user ${userId}`);

    const resignationDate = new Date(dto.resignationDate);
    const lastWorkingDate = new Date(dto.lastWorkingDate);
    const noticePeriodDays = dto.noticePeriodDays ?? 30;

    // Calculate notice period shortfall
    const actualNoticeDays = Math.ceil(
      (lastWorkingDate.getTime() - resignationDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const shortfall = dto.noticePeriodWaived ? 0 : Math.max(0, noticePeriodDays - actualNoticeDays);

    const data: Partial<IOffboarding> = {
      organizationId: orgId,
      employeeId: dto.employeeId,
      type: dto.type,
      status: 'initiated',
      resignationDate,
      lastWorkingDate,
      noticePeriodDays,
      noticePeriodWaived: dto.noticePeriodWaived ?? false,
      noticePeriodShortfall: shortfall,
      noticeRecoveryAmount: null,
      clearance: this.getDefaultClearanceDepartments(),
      exitInterview: {
        conducted: false,
      },
      fnfSettlement: {
        basicDue: 0,
        leaveEncashment: 0,
        bonusDue: 0,
        gratuity: 0,
        pendingReimbursements: 0,
        noticeRecovery: 0,
        otherDeductions: 0,
        totalPayable: 0,
        status: 'pending',
      },
      experienceLetterGenerated: false,
      auditTrail: [
        {
          action: 'offboarding_initiated',
          performedBy: userId,
          performedAt: new Date(),
          notes: `Offboarding initiated: ${dto.type} for employee ${dto.employeeId}`,
        },
      ],
      isDeleted: false,
      createdBy: userId,
    };

    const offboarding = new this.offboardingModel(data);
    return offboarding.save();
  }

  async getAllOffboardings(
    query: { status?: string; page?: number; limit?: number },
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { isDeleted: false };
    filter.organizationId = orgId;
    if (query.status) filter.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.offboardingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.offboardingModel.countDocuments(filter),
    ]);

    return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOffboarding(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { employeeId, isDeleted: false };
    filter.organizationId = orgId;

    const offboarding = await this.offboardingModel.findOne(filter).sort({ createdAt: -1 });
    if (!offboarding) {
      throw new NotFoundException(`Offboarding not found for employee ${employeeId}`);
    }
    return offboarding;
  }

  async updateClearance(
    employeeId: string,
    dto: UpdateClearanceDto,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const offboarding = await this.getOffboarding(employeeId, userId, orgId);

    const dept = offboarding.clearance.find((c) => c.department === dto.department);
    if (!dept) {
      throw new NotFoundException(`Department ${dto.department} not found in clearance`);
    }

    dept.status = dto.status;
    dept.approver = userId;
    if (dto.status === 'cleared') {
      dept.clearedAt = new Date();
    }
    if (dto.remarks) dept.remarks = dto.remarks;

    // Check if all departments cleared — auto-transition to clearance status
    const allCleared = offboarding.clearance.every((c) => c.status === 'cleared');
    if (allCleared && offboarding.status === 'clearance') {
      offboarding.status = 'fnf_processing';
    }

    // Move to clearance status if still in notice_period or initiated
    if (['initiated', 'notice_period'].includes(offboarding.status)) {
      offboarding.status = 'clearance';
    }

    offboarding.auditTrail.push({
      action: 'clearance_updated',
      performedBy: userId,
      performedAt: new Date(),
      notes: `${dto.department} clearance: ${dto.status}${dto.remarks ? ' - ' + dto.remarks : ''}`,
    });

    return offboarding.save();
  }

  async submitExitInterview(
    employeeId: string,
    dto: ExitInterviewDto,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const offboarding = await this.getOffboarding(employeeId, userId, orgId);

    offboarding.exitInterview = {
      conducted: true,
      conductedBy: userId,
      conductedAt: new Date(),
      rating: dto.rating ?? null,
      feedback: dto.feedback ?? null,
      reasonForLeaving: dto.reasonForLeaving ?? null,
      wouldRecommend: dto.wouldRecommend ?? null,
    };

    offboarding.auditTrail.push({
      action: 'exit_interview_submitted',
      performedBy: userId,
      performedAt: new Date(),
      notes: 'Exit interview recorded',
    });

    return offboarding.save();
  }

  async calculateFnF(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const offboarding = await this.getOffboarding(employeeId, userId, orgId);

    // Fetch salary structure to get monthly salary
    const salaryFilter: any = { employeeId, isActive: true, isDeleted: false };
    salaryFilter.organizationId = orgId;
    const salaryStructure = await this.salaryStructureModel.findOne(salaryFilter).sort({ effectiveFrom: -1 });

    const monthlySalary = salaryStructure ? salaryStructure.grossSalary : 0;
    const dailySalary = Math.round(monthlySalary / 30);

    // Calculate prorated basic due (days worked in last month)
    const lastWorkingDate = new Date(offboarding.lastWorkingDate);
    const daysInMonth = new Date(lastWorkingDate.getFullYear(), lastWorkingDate.getMonth() + 1, 0).getDate();
    const daysWorked = lastWorkingDate.getDate();
    const basicDue = Math.round((monthlySalary * daysWorked) / daysInMonth);

    // Leave encashment (mock: assume 15 days leave balance)
    const leaveBalance = 15;
    const leaveEncashment = dailySalary * leaveBalance;

    // Gratuity: if >5 years service (mock: assume eligible, 5 years)
    // Gratuity = (last drawn salary x 15 x years of service) / 26
    const yearsOfService = 5; // Mock value
    const gratuity = yearsOfService >= 5 ? Math.round((monthlySalary * 15 * yearsOfService) / 26) : 0;

    // Notice recovery
    const noticeRecovery = offboarding.noticePeriodShortfall > 0
      ? dailySalary * offboarding.noticePeriodShortfall
      : 0;

    const bonusDue = 0;
    const pendingReimbursements = 0;
    const otherDeductions = 0;

    const totalPayable = basicDue + leaveEncashment + bonusDue + gratuity + pendingReimbursements - noticeRecovery - otherDeductions;

    offboarding.fnfSettlement = {
      basicDue,
      leaveEncashment,
      bonusDue,
      gratuity,
      pendingReimbursements,
      noticeRecovery,
      otherDeductions,
      totalPayable: Math.max(0, totalPayable),
      status: 'calculated',
      approvedBy: null,
      approvedAt: null,
      paidAt: null,
    };

    offboarding.noticeRecoveryAmount = noticeRecovery;

    if (offboarding.status === 'clearance' || offboarding.status === 'fnf_processing') {
      offboarding.status = 'fnf_processing';
    }

    offboarding.auditTrail.push({
      action: 'fnf_calculated',
      performedBy: userId,
      performedAt: new Date(),
      notes: `F&F calculated: total payable = ${Math.max(0, totalPayable)}`,
    });

    return offboarding.save();
  }

  async approveFnF(
    employeeId: string,
    dto: ApproveFnFDto,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const offboarding = await this.getOffboarding(employeeId, userId, orgId);

    if (offboarding.fnfSettlement.status !== 'calculated') {
      throw new BadRequestException('F&F must be calculated before approval');
    }

    offboarding.fnfSettlement.status = 'approved';
    offboarding.fnfSettlement.approvedBy = userId;
    offboarding.fnfSettlement.approvedAt = new Date();
    offboarding.status = 'fnf_approved';

    offboarding.auditTrail.push({
      action: 'fnf_approved',
      performedBy: userId,
      performedAt: new Date(),
      notes: dto.notes || 'F&F settlement approved',
    });

    return offboarding.save();
  }

  async generateLetters(
    employeeId: string,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const offboarding = await this.getOffboarding(employeeId, userId, orgId);

    // Placeholder URLs — in production these would be generated PDFs
    offboarding.experienceLetterGenerated = true;
    offboarding.experienceLetterUrl = `/documents/experience-letter/${employeeId}-${Date.now()}.pdf`;
    offboarding.relievingLetterUrl = `/documents/relieving-letter/${employeeId}-${Date.now()}.pdf`;

    offboarding.auditTrail.push({
      action: 'letters_generated',
      performedBy: userId,
      performedAt: new Date(),
      notes: 'Experience letter and relieving letter generated',
    });

    return offboarding.save();
  }

  async updateOffboardingStatus(
    employeeId: string,
    status: string,
    userId: string,
    orgId: string,
  ): Promise<IOffboarding> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const validStatuses = ['initiated', 'notice_period', 'clearance', 'fnf_processing', 'fnf_approved', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid offboarding status: ${status}`);
    }

    const offboarding = await this.getOffboarding(employeeId, userId, orgId);
    offboarding.status = status;

    offboarding.auditTrail.push({
      action: 'status_updated',
      performedBy: userId,
      performedAt: new Date(),
      notes: `Status changed to ${status}`,
    });

    return offboarding.save();
  }

  // ===========================================================================
  // EMPLOYEE LOANS
  // ===========================================================================

  async applyLoan(
    dto: ApplyLoanDto,
    userId: string,
    orgId: string,
  ): Promise<IEmployeeLoan> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    // Check for existing active/pending loans of the same type
    const existingLoan = await this.employeeLoanModel.findOne({
      organizationId: orgId,
      employeeId: userId,
      type: dto.type,
      status: { $in: ['applied', 'approved', 'disbursed', 'active'] },
      isDeleted: false,
    });
    if (existingLoan) {
      throw new ConflictException(
        `You already have an active ${dto.type.replace(/_/g, ' ')} (${existingLoan.loanNumber}). Please close it before applying for a new one.`,
      );
    }

    // Generate loan number: LOAN-YYYY-NNN (with atomic retry on duplicate)
    const year = new Date().getFullYear();
    let loanNumber: string;
    let retries = 0;
    const maxRetries = 5;
    while (retries < maxRetries) {
      const count = await this.employeeLoanModel.countDocuments({
        organizationId: orgId,
        loanNumber: { $regex: `^LOAN-${year}-` },
      });
      loanNumber = `LOAN-${year}-${String(count + 1 + retries).padStart(3, '0')}`;
      const existing = await this.employeeLoanModel.findOne({ loanNumber });
      if (!existing) break;
      retries++;
    }
    if (retries >= maxRetries) {
      throw new ConflictException('Unable to generate unique loan number. Please try again.');
    }

    const amount = dto.amount;
    const tenure = dto.tenure;
    const interestRate = dto.interestRate ?? 0;

    // Calculate EMI
    let emiAmount: number;
    if (interestRate === 0) {
      emiAmount = Math.round(amount / tenure);
    } else {
      const monthlyRate = interestRate / 12 / 100;
      emiAmount = Math.round(
        (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
          (Math.pow(1 + monthlyRate, tenure) - 1),
      );
    }

    const totalInterest = emiAmount * tenure - amount;

    // Generate schedule
    const now = new Date();
    let currentMonth = now.getMonth() + 2; // start next month
    let currentYear = now.getFullYear();
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    const schedule: Array<{
      installmentNumber: number;
      dueMonth: number;
      dueYear: number;
      principal: number;
      interest: number;
      emiAmount: number;
      status: string;
    }> = [];

    let remainingPrincipal = amount;
    for (let i = 1; i <= tenure; i++) {
      let interest: number;
      let principal: number;

      if (interestRate === 0) {
        interest = 0;
        principal = i === tenure ? remainingPrincipal : emiAmount;
      } else {
        const monthlyRate = interestRate / 12 / 100;
        interest = Math.round(remainingPrincipal * monthlyRate);
        principal = emiAmount - interest;
        if (i === tenure) {
          principal = remainingPrincipal;
          interest = emiAmount - principal;
        }
      }

      schedule.push({
        installmentNumber: i,
        dueMonth: currentMonth,
        dueYear: currentYear,
        principal,
        interest,
        emiAmount,
        status: 'pending',
      });

      remainingPrincipal -= principal;
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    const loan = new this.employeeLoanModel({
      organizationId: orgId,
      employeeId: userId,
      loanNumber,
      type: dto.type,
      amount,
      interestRate,
      tenure,
      emiAmount,
      disbursedAmount: 0,
      outstandingBalance: amount,
      totalInterest,
      schedule,
      reason: dto.reason,
      approvalChain: [{ level: 1, status: 'pending' }],
      status: 'applied',
      isDeleted: false,
      createdBy: userId,
    });

    this.logger.log(`Loan ${loanNumber} applied by employee ${userId} in org ${orgId}`);
    return loan.save();
  }

  async getLoans(
    query: LoanQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ loans: IEmployeeLoan[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: Record<string, unknown> = { organizationId: orgId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.employeeId) filter.employeeId = query.employeeId;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      this.employeeLoanModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.employeeLoanModel.countDocuments(filter).exec(),
    ]);

    return { loans, total, page, limit };
  }

  async getMyLoans(
    userId: string,
    orgId: string,
  ): Promise<IEmployeeLoan[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.employeeLoanModel
      .find({ organizationId: orgId, employeeId: userId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getLoan(
    id: string,
    userId: string,
    orgId: string,
    checkOwnership = true,
  ): Promise<IEmployeeLoan> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const loan = await this.employeeLoanModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    }).exec();

    if (!loan) throw new NotFoundException('Loan not found');

    // Ownership check: employees can only view their own loans
    // Admin/HR/Manager endpoints use their own @Roles-guarded methods
    if (checkOwnership !== false && loan.employeeId !== userId) {
      throw new ForbiddenException('You can only view your own loan details');
    }

    return loan;
  }

  async approveLoan(
    id: string,
    dto: ApproveLoanDto,
    userId: string,
    orgId: string,
  ): Promise<IEmployeeLoan> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const loan = await this.getLoan(id, userId, orgId, false);

    // Prevent self-approval (segregation of duties)
    if (loan.employeeId === userId) {
      throw new ForbiddenException('Cannot approve your own loan application');
    }

    if (loan.status === 'rejected' || loan.status === 'cancelled') {
      throw new BadRequestException(`Cannot approve/reject a loan with status '${loan.status}'`);
    }

    // Find first pending entry in approval chain
    const pendingEntry = loan.approvalChain.find((e) => e.status === 'pending');
    if (!pendingEntry) {
      throw new BadRequestException('No pending approval found in the approval chain');
    }

    pendingEntry.approverId = userId;
    pendingEntry.status = dto.status;
    pendingEntry.comments = dto.comments || null;
    pendingEntry.actedAt = new Date();

    if (dto.status === 'approved') {
      loan.status = 'approved';
      this.logger.log(`Loan ${loan.loanNumber} approved by ${userId}`);
    } else {
      loan.status = 'rejected';
      this.logger.log(`Loan ${loan.loanNumber} rejected by ${userId}`);
    }

    return loan.save();
  }

  async disburseLoan(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IEmployeeLoan> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const loan = await this.getLoan(id, userId, orgId, false);

    if (loan.status !== 'approved') {
      throw new BadRequestException(`Cannot disburse loan with status '${loan.status}'. Must be 'approved'.`);
    }

    loan.disbursedAmount = loan.amount;
    loan.disbursedAt = new Date();
    loan.status = 'active';

    this.logger.log(`Loan ${loan.loanNumber} disbursed by ${userId}`);
    return loan.save();
  }

  async closeLoan(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IEmployeeLoan> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const loan = await this.getLoan(id, userId, orgId, false);

    if (loan.status !== 'active' && loan.status !== 'disbursed') {
      throw new BadRequestException(`Cannot close loan with status '${loan.status}'`);
    }

    loan.status = 'closed';
    loan.closedAt = new Date();
    loan.outstandingBalance = 0;

    // Mark remaining pending installments as skipped
    for (const installment of loan.schedule) {
      if (installment.status === 'pending') {
        installment.status = 'skipped';
      }
    }

    this.logger.log(`Loan ${loan.loanNumber} closed by ${userId}`);
    return loan.save();
  }

  // ===========================================================================
  // Analytics: getDashboardMetrics
  // ===========================================================================
  async getDashboardMetrics(
    query: AnalyticsQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const totalEmployees = await this.salaryStructureModel.countDocuments({
      organizationId: orgId,
      status: 'active',
      isDeleted: false,
    });

    const latestRuns = await this.payrollRunModel
      .find({ organizationId: orgId, isDeleted: false })
      .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 })
      .limit(3)
      .lean();

    const totalPayrollCost = latestRuns.length > 0
      ? latestRuns[0].summary?.totalNet || 0
      : 0;

    const latestSnapshot = await this.analyticsSnapshotModel
      .findOne({ organizationId: orgId, isDeleted: false })
      .sort({ snapshotDate: -1 });

    const attritionRate = latestSnapshot?.attritionData?.monthlyRate || 0;

    const pendingSalaryStructures = await this.salaryStructureModel.countDocuments({
      organizationId: orgId,
      status: 'pending_approval',
      isDeleted: false,
    });

    const pendingExpenseClaims = await this.expenseClaimModel.countDocuments({
      organizationId: orgId,
      status: 'submitted',
      isDeleted: false,
    });

    return {
      headcount: totalEmployees,
      payrollCost: totalPayrollCost,
      attritionRate,
      pendingApprovals: pendingSalaryStructures + pendingExpenseClaims,
      recentRuns: latestRuns,
    };
  }

  // ===========================================================================
  // Analytics: getHeadcountTrends
  // ===========================================================================
  async getHeadcountTrends(
    query: AnalyticsQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      snapshotDate: { $gte: twelveMonthsAgo },
    };
    if (query.year) filter['period.year'] = query.year;
    if (query.month) filter['period.month'] = query.month;

    const snapshots = await this.analyticsSnapshotModel
      .find(filter)
      .sort({ 'period.year': 1, 'period.month': 1 });

    return snapshots.map((s) => ({
      month: s.period.month,
      year: s.period.year,
      total: s.headcount.total,
      newJoiners: s.headcount.newJoiners,
      exits: s.headcount.exits,
    }));
  }

  // ===========================================================================
  // Analytics: getAttritionTrends
  // ===========================================================================
  async getAttritionTrends(
    query: AnalyticsQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      snapshotDate: { $gte: twelveMonthsAgo },
    };
    if (query.year) filter['period.year'] = query.year;
    if (query.month) filter['period.month'] = query.month;

    const snapshots = await this.analyticsSnapshotModel
      .find(filter)
      .sort({ 'period.year': 1, 'period.month': 1 });

    return snapshots.map((s) => ({
      month: s.period.month,
      year: s.period.year,
      rate: s.attritionData.monthlyRate,
      voluntaryExits: s.attritionData.voluntaryExits,
      involuntaryExits: s.attritionData.involuntaryExits,
    }));
  }

  // ===========================================================================
  // Analytics: getAttritionPredictions
  // ===========================================================================
  async getAttritionPredictions(
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const latestSnapshot = await this.analyticsSnapshotModel
      .findOne({ organizationId: orgId, isDeleted: false })
      .sort({ snapshotDate: -1 });

    if (!latestSnapshot || !latestSnapshot.attritionPredictions) {
      return [];
    }

    return [...latestSnapshot.attritionPredictions].sort(
      (a, b) => b.riskScore - a.riskScore,
    );
  }

  // ===========================================================================
  // Analytics: getLivePredictions (real-time attrition predictions)
  // ===========================================================================
  async getLivePredictions(orgId: string) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.attritionPredictorService.predictAllEmployees(orgId);
  }

  // ===========================================================================
  // Analytics: getCostAnalytics
  // ===========================================================================
  async getCostAnalytics(
    query: AnalyticsQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const runs = await this.payrollRunModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        status: { $in: ['finalized', 'paid'] },
        createdAt: { $gte: twelveMonthsAgo },
      })
      .sort({ 'payPeriod.year': 1, 'payPeriod.month': 1 })
      .lean();

    const monthlyCosts = runs.map((r) => ({
      month: r.payPeriod.month,
      year: r.payPeriod.year,
      totalPayroll: r.summary?.totalNet || 0,
    }));

    const totalPayrollAll = monthlyCosts.reduce((sum, c) => sum + c.totalPayroll, 0);
    const activeCount = await this.salaryStructureModel.countDocuments({
      organizationId: orgId,
      status: 'active',
      isDeleted: false,
    });
    const avgCost = activeCount > 0 ? totalPayrollAll / Math.max(monthlyCosts.length, 1) / activeCount : 0;

    const latestSnapshot = await this.analyticsSnapshotModel
      .findOne({ organizationId: orgId, isDeleted: false })
      .sort({ snapshotDate: -1 });

    return {
      monthlyCosts,
      avgCost,
      byDepartment: latestSnapshot?.departmentBreakdown || [],
    };
  }

  // ===========================================================================
  // Analytics: getAttendanceTrends
  // ===========================================================================
  async getAttendanceTrends(
    query: AnalyticsQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      snapshotDate: { $gte: twelveMonthsAgo },
    };
    if (query.year) filter['period.year'] = query.year;
    if (query.month) filter['period.month'] = query.month;

    const snapshots = await this.analyticsSnapshotModel
      .find(filter)
      .sort({ 'period.year': 1, 'period.month': 1 });

    return snapshots.map((s) => ({
      month: s.period.month,
      year: s.period.year,
      avgAttendance: s.attendanceSummary.avgAttendanceRate,
      avgLate: s.attendanceSummary.avgLatePercentage,
      avgOvertime: s.attendanceSummary.avgOvertimeHours,
    }));
  }

  // ===========================================================================
  // Analytics: getHeadcountForecast
  // ===========================================================================
  async getHeadcountForecast(
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const snapshots = await this.analyticsSnapshotModel
      .find({ organizationId: orgId, isDeleted: false })
      .sort({ 'period.year': -1, 'period.month': -1 })
      .limit(6);

    if (snapshots.length === 0) {
      const current = await this.salaryStructureModel.countDocuments({
        organizationId: orgId,
        status: 'active',
        isDeleted: false,
      });
      return { current, forecast: [] };
    }

    const ordered = [...snapshots].reverse();
    const current = ordered[ordered.length - 1].headcount.total;

    // Calculate average monthly change
    let totalChange = 0;
    for (let i = 1; i < ordered.length; i++) {
      totalChange += ordered[i].headcount.total - ordered[i - 1].headcount.total;
    }
    const avgMonthlyChange = ordered.length > 1 ? totalChange / (ordered.length - 1) : 0;

    // Count known exits (offboarding in notice_period)
    const knownExits = await this.offboardingModel.countDocuments({
      organizationId: orgId,
      status: 'notice_period',
      isDeleted: false,
    });

    const now = new Date();
    const forecast: Array<{ month: number; year: number; projected: number }> = [];
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const projected = Math.max(
        0,
        Math.round(current + avgMonthlyChange * i - (i === 1 ? knownExits : 0)),
      );
      forecast.push({
        month: futureDate.getMonth() + 1,
        year: futureDate.getFullYear(),
        projected,
      });
    }

    return { current, forecast };
  }

  // ===========================================================================
  // Analytics: generateSnapshot
  // ===========================================================================
  async generateSnapshot(
    userId: string,
    orgId: string,
  ): Promise<IAnalyticsSnapshot> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const activeCount = await this.salaryStructureModel.countDocuments({
      organizationId: orgId,
      status: 'active',
      isDeleted: false,
    });

    const onboardingCount = await this.onboardingModel.countDocuments({
      organizationId: orgId,
      status: 'in_progress',
      isDeleted: false,
    });

    const offboardingCount = await this.offboardingModel.countDocuments({
      organizationId: orgId,
      status: { $in: ['initiated', 'notice_period', 'clearance', 'fnf_processing'] },
      isDeleted: false,
    });

    const onNoticeCount = await this.offboardingModel.countDocuments({
      organizationId: orgId,
      status: 'notice_period',
      isDeleted: false,
    });

    // Get latest payroll run summary
    const latestRun = await this.payrollRunModel
      .findOne({
        organizationId: orgId,
        isDeleted: false,
        status: { $in: ['finalized', 'paid'] },
      })
      .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 })
      .lean();

    const totalPayroll = latestRun?.summary?.totalNet || 0;
    const avgCostPerEmployee = activeCount > 0 ? totalPayroll / activeCount : 0;

    // Build department breakdown from salary structures
    const activeStructures = await this.salaryStructureModel.find({
      organizationId: orgId,
      status: 'active',
      isDeleted: false,
    }).lean();

    const deptMap = new Map<string, { count: number; totalSalary: number }>();
    for (const s of activeStructures) {
      const dept = s.structureName?.split(' - ')[0] || 'General';
      const existing = deptMap.get(dept) || { count: 0, totalSalary: 0 };
      existing.count++;
      existing.totalSalary += s.grossSalary || 0;
      deptMap.set(dept, existing);
    }
    const departmentBreakdown = Array.from(deptMap.entries()).map(([dept, data]) => ({
      department: dept,
      count: data.count,
      avgSalary: data.count > 0 ? Math.round(data.totalSalary / data.count / 12) : 0,
    }));

    // Classify exits as voluntary vs involuntary
    const offboardings = await this.offboardingModel.find({
      organizationId: orgId,
      isDeleted: false,
      status: { $nin: ['cancelled'] },
    }).lean();
    const voluntaryExits = offboardings.filter(
      (o) => ['resignation', 'mutual_separation', 'retirement'].includes(o.type),
    ).length;
    const involuntaryExits = offboardings.filter(
      (o) => ['termination'].includes(o.type),
    ).length;

    // Compute real attrition predictions
    let attritionPredictions: any[] = [];
    try {
      attritionPredictions = await this.attritionPredictorService.predictAllEmployees(orgId);
      // Only keep top 20 highest risk
      attritionPredictions = attritionPredictions.slice(0, 20);
    } catch (err) {
      this.logger.warn(`Attrition prediction failed: ${err.message}`);
    }

    const snapshotData = {
      organizationId: orgId,
      snapshotDate: now,
      period: { month, year },
      headcount: {
        total: activeCount + onboardingCount,
        active: activeCount,
        onNotice: onNoticeCount,
        newJoiners: onboardingCount,
        exits: offboardingCount,
        contractors: 0,
      },
      departmentBreakdown,
      attritionData: {
        monthlyRate: activeCount > 0 ? (offboardingCount / activeCount) * 100 : 0,
        annualizedRate: (() => {
          const mRate = activeCount > 0 ? offboardingCount / activeCount : 0;
          return Math.round((1 - Math.pow(1 - mRate, 12)) * 10000) / 100;
        })(),
        voluntaryExits,
        involuntaryExits,
      },
      costMetrics: {
        totalPayroll,
        avgCostPerEmployee,
      },
      attendanceSummary: {
        avgAttendanceRate: 0,
        avgLatePercentage: 0,
        avgOvertimeHours: 0,
      },
      leaveSummary: {
        avgLeaveUtilization: 0,
        topLeaveTypes: [],
      },
      attritionPredictions,
    };

    // Upsert to handle unique index on org+period
    const result = await this.analyticsSnapshotModel.findOneAndUpdate(
      { organizationId: orgId, 'period.year': year, 'period.month': month },
      snapshotData,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    this.logger.log(`Analytics snapshot generated for org ${orgId} period ${month}/${year}`);
    return result;
  }

  // ===========================================================================
  // RECRUITMENT - Job Postings
  // ===========================================================================

  private readonly DEFAULT_PIPELINE = [
    { stageName: 'screening', stageOrder: 1, stageType: 'screening' as const },
    { stageName: 'technical_round', stageOrder: 2, stageType: 'assessment' as const },
    { stageName: 'hr_round', stageOrder: 3, stageType: 'interview' as const },
    { stageName: 'offer', stageOrder: 4, stageType: 'offer' as const },
    { stageName: 'hired', stageOrder: 5, stageType: 'hired' as const },
  ];

  async createJobPosting(
    dto: CreateJobPostingDto,
    userId: string,
    orgId: string,
  ): Promise<IJobPosting> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Creating job posting "${dto.title}" by user ${userId}`);

    const jobPosting = new this.jobPostingModel({
      organizationId: orgId,
      title: dto.title,
      departmentId: dto.departmentId || null,
      location: dto.location,
      employmentType: dto.employmentType,
      description: dto.description,
      requirements: dto.requirements || [],
      skills: dto.skills || [],
      openings: dto.openings || 1,
      hiringManagerId: dto.hiringManagerId,
      pipeline: this.DEFAULT_PIPELINE,
      status: 'draft',
      createdBy: userId,
    });

    return jobPosting.save();
  }

  async getJobPostings(
    query: JobQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { organizationId: orgId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.department) filter.departmentId = query.department;

    const [data, total] = await Promise.all([
      this.jobPostingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.jobPostingModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getJobPosting(
    id: string,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const job = await this.jobPostingModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!job) throw new NotFoundException('Job posting not found');

    // Get candidate counts per stage
    const stageCounts = await this.candidateModel.aggregate([
      { $match: { jobPostingId: id, isDeleted: false } },
      { $group: { _id: '$currentStage', count: { $sum: 1 } } },
    ]);

    const candidatesByStage: Record<string, number> = {};
    for (const sc of stageCounts) {
      candidatesByStage[sc._id] = sc.count;
    }

    return { ...job, candidatesByStage };
  }

  async updateJobPosting(
    id: string,
    dto: UpdateJobPostingDto,
    userId: string,
    orgId: string,
  ): Promise<IJobPosting> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const job = await this.jobPostingModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!job) throw new NotFoundException('Job posting not found');
    if (!['draft', 'open'].includes(job.status)) {
      throw new BadRequestException('Can only update job postings in draft or open status');
    }

    if (dto.title) job.title = dto.title;
    if (dto.location) job.location = dto.location;
    if (dto.description) job.description = dto.description;
    if (dto.requirements) job.requirements = dto.requirements;
    if (dto.skills) job.skills = dto.skills;
    if (dto.openings !== undefined) job.openings = dto.openings;

    return job.save();
  }

  async updateJobStatus(
    id: string,
    dto: UpdateJobStatusDto,
    userId: string,
    orgId: string,
  ): Promise<IJobPosting> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const job = await this.jobPostingModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!job) throw new NotFoundException('Job posting not found');

    const validTransitions: Record<string, string[]> = {
      draft: ['open', 'cancelled'],
      open: ['on_hold', 'closed', 'cancelled'],
      on_hold: ['open', 'closed', 'cancelled'],
      closed: [],
      cancelled: [],
    };

    if (!validTransitions[job.status]?.includes(dto.status)) {
      throw new BadRequestException(`Cannot transition from ${job.status} to ${dto.status}`);
    }

    job.status = dto.status;
    if (dto.status === 'open' && !job.publishedAt) {
      job.publishedAt = new Date();
    }
    if (dto.status === 'closed') {
      job.closedAt = new Date();
    }

    this.logger.log(`Job ${id} status updated to ${dto.status} by ${userId}`);
    return job.save();
  }

  // ===========================================================================
  // RECRUITMENT - Candidates
  // ===========================================================================

  async addCandidate(
    dto: AddCandidateDto,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    // dto must include jobPostingId via the body (passed through from controller)
    const body = dto as AddCandidateDto & { jobPostingId?: string };
    if (!body.jobPostingId) throw new BadRequestException('jobPostingId is required');

    const job = await this.jobPostingModel.findOne({ _id: body.jobPostingId, organizationId: orgId, isDeleted: false });
    if (!job) throw new NotFoundException('Job posting not found');

    // Check for duplicate
    const existing = await this.candidateModel.findOne({
      organizationId: orgId,
      jobPostingId: body.jobPostingId,
      email: dto.email,
      isDeleted: false,
    });
    if (existing) throw new ConflictException('Candidate with this email already exists for this job posting');

    const firstStage = job.pipeline.length > 0
      ? job.pipeline.sort((a, b) => a.stageOrder - b.stageOrder)[0].stageName
      : 'screening';

    const candidate = new this.candidateModel({
      organizationId: orgId,
      jobPostingId: body.jobPostingId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone || null,
      resumeUrl: dto.resumeUrl || null,
      linkedinUrl: dto.linkedinUrl || null,
      source: dto.source || 'direct',
      referredBy: dto.referredBy || null,
      currentStage: firstStage,
      stageHistory: [{ stage: firstStage, enteredAt: new Date() }],
      status: 'screening',
      createdBy: userId,
    });

    this.logger.log(`Candidate ${dto.name} added to job ${body.jobPostingId} by ${userId}`);
    return candidate.save();
  }

  async getCandidates(
    query: CandidateQueryDto,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { organizationId: orgId, isDeleted: false };
    if (query.jobId) filter.jobPostingId = query.jobId;
    if (query.stage) filter.currentStage = query.stage;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      this.candidateModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.candidateModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCandidate(
    id: string,
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  async advanceCandidate(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (['rejected', 'withdrawn', 'hired'].includes(candidate.status)) {
      throw new BadRequestException(`Cannot advance candidate with status ${candidate.status}`);
    }

    const job = await this.jobPostingModel.findOne({ _id: candidate.jobPostingId, organizationId: orgId });
    if (!job) throw new NotFoundException('Associated job posting not found');

    const sortedPipeline = [...job.pipeline].sort((a, b) => a.stageOrder - b.stageOrder);
    const currentIndex = sortedPipeline.findIndex(s => s.stageName === candidate.currentStage);
    if (currentIndex === -1 || currentIndex >= sortedPipeline.length - 1) {
      throw new BadRequestException('Candidate is already at the final stage');
    }

    const nextStage = sortedPipeline[currentIndex + 1];
    const now = new Date();

    // Close current stage
    const currentHistory = candidate.stageHistory.find(
      h => h.stage === candidate.currentStage && !h.exitedAt,
    );
    if (currentHistory) {
      currentHistory.exitedAt = now;
      currentHistory.outcome = 'advanced';
    }

    // Open next stage
    candidate.currentStage = nextStage.stageName;
    candidate.stageHistory.push({ stage: nextStage.stageName, enteredAt: now });

    // Update status based on stage type
    if (nextStage.stageType === 'offer') candidate.status = 'offered';
    else if (nextStage.stageType === 'hired') candidate.status = 'hired';
    else candidate.status = 'in_process';

    this.logger.log(`Candidate ${id} advanced to ${nextStage.stageName} by ${userId}`);
    return candidate.save();
  }

  async rejectCandidate(
    id: string,
    dto: RejectCandidateDto,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (['rejected', 'hired'].includes(candidate.status)) {
      throw new BadRequestException(`Cannot reject candidate with status ${candidate.status}`);
    }

    const now = new Date();
    const currentHistory = candidate.stageHistory.find(
      h => h.stage === candidate.currentStage && !h.exitedAt,
    );
    if (currentHistory) {
      currentHistory.exitedAt = now;
      currentHistory.outcome = 'rejected';
      currentHistory.feedback = dto.reason;
      currentHistory.feedbackBy = userId;
    }

    candidate.status = 'rejected';
    this.logger.log(`Candidate ${id} rejected by ${userId}: ${dto.reason}`);
    return candidate.save();
  }

  // ===========================================================================
  // AI Recruitment: Resume Parsing & Smart Candidate Matching
  // ===========================================================================

  async parseResume(dto: ParseResumeDto, userId: string, orgId: string): Promise<any> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const parsed = await this.externalServices.parseResume(dto.resumeText);
    if (!parsed) {
      throw new BadRequestException('Failed to parse resume. AI service may be unavailable.');
    }

    // If jobPostingId provided, compute match score
    let matchScore: number | undefined;
    let matchDetails: any;
    if (dto.jobPostingId) {
      const job = await this.jobPostingModel.findOne({
        _id: dto.jobPostingId,
        organizationId: orgId,
        isDeleted: false,
      });
      if (job) {
        const jobDesc = `${job.title}\n${job.description}\nRequirements: ${(job.requirements || []).join(', ')}\nSkills: ${(job.skills || []).join(', ')}`;
        const match = await this.externalServices.computeJobMatchScore(jobDesc, parsed);
        if (match) {
          matchScore = match.score;
          matchDetails = match;
        }
      }
    }

    this.logger.log(`Resume parsed by ${userId} for org ${orgId}${dto.jobPostingId ? ` (job ${dto.jobPostingId})` : ''}`);

    return {
      parsed,
      matchScore,
      matchDetails,
    };
  }

  async smartMatchCandidates(dto: SmartMatchDto, userId: string, orgId: string): Promise<any[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const job = await this.jobPostingModel.findOne({
      _id: dto.jobPostingId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!job) throw new NotFoundException('Job posting not found');

    // Get all candidates for this job with parsed resumes
    const candidates = await this.candidateModel
      .find({
        jobPostingId: dto.jobPostingId,
        organizationId: orgId,
        isDeleted: false,
        parsedResume: { $exists: true },
      })
      .lean();

    const jobDesc = `${job.title}\n${job.description}\nRequirements: ${(job.requirements || []).join(', ')}\nSkills: ${(job.skills || []).join(', ')}`;
    const minScore = dto.minScore ?? 0;
    const limit = dto.limit ?? 20;

    // Score each candidate in parallel
    const scored = await Promise.all(
      candidates.map(async (c: any) => {
        // Use cached matchScore if already computed and job hasn't changed
        if (c.parsedResume?.matchScore && c.parsedResume.matchedJobId === dto.jobPostingId) {
          return { ...c, matchScore: c.parsedResume.matchScore };
        }
        const match = await this.externalServices.computeJobMatchScore(jobDesc, c.parsedResume);
        return { ...c, matchScore: match?.score || 0, matchReasoning: match?.reasoning };
      }),
    );

    // Filter and sort by score
    const filtered = scored.filter((c) => (c.matchScore || 0) >= minScore);
    filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    this.logger.log(`Smart match run by ${userId} for job ${dto.jobPostingId}: ${filtered.length} candidates above score ${minScore}`);
    return filtered.slice(0, limit);
  }

  async parseAndCreateCandidate(
    dto: ParseAndCreateCandidateDto,
    userId: string,
    orgId: string,
  ): Promise<any> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    // Parse resume
    const parsed = await this.externalServices.parseResume(dto.resumeText);
    if (!parsed) throw new BadRequestException('Failed to parse resume');

    // Compute match score
    const job = await this.jobPostingModel.findOne({
      _id: dto.jobPostingId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!job) throw new NotFoundException('Job posting not found');

    const jobDesc = `${job.title}\n${job.description}\nRequirements: ${(job.requirements || []).join(', ')}`;
    const match = await this.externalServices.computeJobMatchScore(jobDesc, parsed);

    // Create candidate with parsed data
    const candidate = new this.candidateModel({
      organizationId: orgId,
      jobPostingId: dto.jobPostingId,
      name: parsed.name || 'Unknown',
      email: dto.email || parsed.email,
      phone: parsed.phone,
      parsedResume: {
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
        totalExperienceYears: parsed.totalExperienceYears || 0,
        matchScore: match?.score || 0,
        matchedJobId: dto.jobPostingId,
      },
      currentStage: job.pipeline?.[0]?.stageName || 'Screening',
      status: 'new',
      source: 'ai_parsed',
      createdBy: userId,
    });
    await candidate.save();

    this.logger.log(`AI-parsed candidate ${candidate._id} created for job ${dto.jobPostingId} by ${userId}`);
    return candidate;
  }

  async scheduleInterview(
    id: string,
    dto: ScheduleInterviewDto,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');

    if (['rejected', 'withdrawn', 'hired'].includes(candidate.status)) {
      throw new BadRequestException(`Cannot schedule interviews for a candidate with status '${candidate.status}'`);
    }

    const existingRound = candidate.interviews.find((i: any) => i.round === dto.round);
    if (existingRound) {
      throw new ConflictException(`Interview round ${dto.round} already exists for this candidate`);
    }

    candidate.interviews.push({
      round: dto.round,
      type: dto.type,
      scheduledAt: new Date(dto.scheduledAt),
      interviewerIds: dto.interviewerIds,
      status: 'scheduled',
    });

    this.logger.log(`Interview round ${dto.round} scheduled for candidate ${id} by ${userId}`);
    return candidate.save();
  }

  async interviewFeedback(
    id: string,
    dto: InterviewFeedbackDto,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Find the latest scheduled/completed interview without feedback
    const interview = candidate.interviews
      .filter(i => ['scheduled', 'completed'].includes(i.status) && !i.feedback?.submittedBy)
      .sort((a, b) => b.round - a.round)[0];

    if (!interview) {
      throw new BadRequestException('No pending interview found for feedback');
    }

    interview.status = 'completed';
    interview.feedback = {
      rating: dto.rating,
      strengths: dto.strengths,
      weaknesses: dto.weaknesses,
      recommendation: dto.recommendation,
      submittedBy: userId,
      submittedAt: new Date(),
    };

    this.logger.log(`Interview feedback submitted for candidate ${id} by ${userId}`);
    return candidate.save();
  }

  async createOffer(
    id: string,
    dto: CreateOfferDto,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Validate candidate is in offer-eligible stage (must have completed interviews)
    const offerStages = ['offer', 'hr_round', 'final_round'];
    const jobPosting = await this.jobPostingModel.findOne({ _id: candidate.jobPostingId, isDeleted: false });
    if (jobPosting?.pipeline?.length) {
      const offerStageIdx = jobPosting.pipeline.findIndex(s => s.stageType === 'offer');
      const currentStageIdx = jobPosting.pipeline.findIndex(s => s.stageName === candidate.currentStage);
      if (offerStageIdx >= 0 && currentStageIdx >= 0 && currentStageIdx < offerStageIdx - 1) {
        throw new BadRequestException(
          `Candidate must complete earlier pipeline stages before receiving an offer. Current stage: ${candidate.currentStage}`,
        );
      }
    }

    candidate.offer = {
      ctc: dto.ctc,
      joiningDate: new Date(dto.joiningDate),
      designation: dto.designation,
      status: 'draft',
    };

    if (candidate.status !== 'offered') {
      candidate.status = 'offered';
    }

    this.logger.log(`Offer created for candidate ${id} by ${userId}`);
    return candidate.save();
  }

  async sendOffer(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.offer) throw new BadRequestException('No offer exists for this candidate');
    if (candidate.offer.status !== 'draft') {
      throw new BadRequestException(`Cannot send offer in ${candidate.offer.status} status`);
    }

    candidate.offer.status = 'sent';
    candidate.offer.sentAt = new Date();

    this.logger.log(`Offer sent to candidate ${id} by ${userId}`);
    return candidate.save();
  }

  async convertToEmployee(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ICandidate> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const candidate = await this.candidateModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!candidate) throw new NotFoundException('Candidate not found');

    if (!candidate.offer || candidate.offer.status !== 'accepted') {
      throw new BadRequestException('Offer must be accepted before converting to employee. Current offer status: ' + (candidate.offer?.status || 'none'));
    }

    // Generate a placeholder employee ID (in production, would call HR service)
    const employeeId = `EMP-${Date.now()}`;
    candidate.convertedToEmployeeId = employeeId;
    candidate.status = 'hired';

    // Close final stage
    const now = new Date();
    const currentHistory = candidate.stageHistory.find(
      h => h.stage === candidate.currentStage && !h.exitedAt,
    );
    if (currentHistory) {
      currentHistory.exitedAt = now;
      currentHistory.outcome = 'advanced';
    }

    // Increment filledCount on job
    await this.jobPostingModel.updateOne(
      { _id: candidate.jobPostingId },
      { $inc: { filledCount: 1 } },
    );

    this.logger.log(`Candidate ${id} converted to employee ${employeeId} by ${userId}`);
    return candidate.save();
  }

  // ===========================================================================
  // RECRUITMENT - Analytics
  // ===========================================================================

  async getRecruitmentAnalytics(
    userId: string,
    orgId: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const [
      totalOpenJobs,
      totalCandidates,
      candidatesByStage,
      candidatesByStatus,
      avgTimeInStage,
    ] = await Promise.all([
      this.jobPostingModel.countDocuments({ organizationId: orgId, status: 'open', isDeleted: false }),
      this.candidateModel.countDocuments({ organizationId: orgId, isDeleted: false }),
      this.candidateModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $group: { _id: '$currentStage', count: { $sum: 1 } } },
      ]),
      this.candidateModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.candidateModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $unwind: '$stageHistory' },
        {
          $project: {
            stage: '$stageHistory.stage',
            duration: {
              $cond: {
                if: { $ifNull: ['$stageHistory.exitedAt', false] },
                then: { $subtract: ['$stageHistory.exitedAt', '$stageHistory.enteredAt'] },
                else: { $subtract: [new Date(), '$stageHistory.enteredAt'] },
              },
            },
          },
        },
        {
          $group: {
            _id: '$stage',
            avgDurationMs: { $avg: '$duration' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byStage: Record<string, number> = {};
    for (const s of candidatesByStage) byStage[s._id] = s.count;

    const byStatus: Record<string, number> = {};
    for (const s of candidatesByStatus) byStatus[s._id] = s.count;

    const avgTime: Record<string, { avgDays: number; count: number }> = {};
    for (const s of avgTimeInStage) {
      avgTime[s._id] = {
        avgDays: Math.round((s.avgDurationMs / (1000 * 60 * 60 * 24)) * 10) / 10,
        count: s.count,
      };
    }

    return {
      totalOpenJobs,
      totalCandidates,
      candidatesByStage: byStage,
      candidatesByStatus: byStatus,
      avgTimeInStage: avgTime,
    };
  }

  // ===========================================================================
  // Statutory Reports — Form 16 / PF ECR / ESI / TDS 24Q
  // ===========================================================================

  /**
   * Parse "2025-2026" financial year string → { startDate, endDate, startYear, endYear }
   * Indian FY runs April (month 4) of startYear → March (month 3) of endYear.
   */
  private parseFinancialYear(financialYear: string): {
    startYear: number;
    endYear: number;
    startDate: Date;
    endDate: Date;
  } {
    const match = /^(\d{4})-(\d{4})$/.exec(financialYear);
    if (!match) {
      throw new BadRequestException(
        `Invalid financialYear format '${financialYear}'. Expected 'YYYY-YYYY' (e.g. '2025-2026').`,
      );
    }
    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);
    if (endYear !== startYear + 1) {
      throw new BadRequestException(
        `Invalid financialYear '${financialYear}'. End year must be exactly one more than start year.`,
      );
    }
    return {
      startYear,
      endYear,
      startDate: new Date(Date.UTC(startYear, 3, 1)), // 1 April
      endDate: new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)), // 31 March
    };
  }

  // ===========================================================================
  // generateForm16 — Employee annual tax statement under section 203 of IT Act
  // ===========================================================================
  async generateForm16(
    dto: GenerateForm16Dto,
    userId: string,
    orgId: string,
  ): Promise<IStatutoryReport> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(
      `Generating Form 16 for employee ${dto.employeeId} FY ${dto.financialYear} by ${userId}`,
    );

    const fy = this.parseFinancialYear(dto.financialYear);

    // Find all payslips covering FY months — April of startYear through March of endYear
    const payslips = await this.payslipModel.find({
      organizationId: orgId,
      employeeId: dto.employeeId,
      isDeleted: false,
      $or: [
        { 'payPeriod.year': fy.startYear, 'payPeriod.month': { $gte: 4 } },
        { 'payPeriod.year': fy.endYear, 'payPeriod.month': { $lte: 3 } },
      ],
    });

    if (!payslips.length) {
      throw new NotFoundException(
        `No payslips found for employee ${dto.employeeId} in FY ${dto.financialYear}`,
      );
    }

    // Aggregate annual totals from individual payslips
    let grossEarnings = 0;
    let totalDeductions = 0;
    let totalPFEmployee = 0;
    let totalESIEmployee = 0;
    let totalTDS = 0;
    let totalProfessionalTax = 0;
    let basicSum = 0;
    let hraSum = 0;
    let otherAllowancesSum = 0;

    for (const slip of payslips) {
      grossEarnings += slip.totals?.grossEarnings || 0;
      totalDeductions += slip.totals?.totalDeductions || 0;

      for (const e of slip.earnings || []) {
        const code = (e.code || '').toUpperCase();
        if (code === 'BASIC') basicSum += e.amount || 0;
        else if (code === 'HRA') hraSum += e.amount || 0;
        else otherAllowancesSum += e.amount || 0;
      }

      for (const d of slip.deductions || []) {
        const code = (d.code || '').toUpperCase();
        if (code === 'PF' || code === 'EPF') totalPFEmployee += d.amount || 0;
        else if (code === 'ESI') totalESIEmployee += d.amount || 0;
        else if (code === 'TDS') totalTDS += d.amount || 0;
        else if (code === 'PT' || code === 'PTAX') totalProfessionalTax += d.amount || 0;
      }
    }

    // Fetch verified investment declarations for FY — drives Chapter VI-A deductions
    const declaration = await this.investmentDeclarationModel.findOne({
      organizationId: orgId,
      employeeId: dto.employeeId,
      financialYear: dto.financialYear,
      isDeleted: false,
    });

    const regime = declaration?.regime || 'old';
    const standardDeduction = regime === 'new' ? 75000 : 50000;

    // Chapter VI-A deductions capped per section limits (old regime only)
    let section80C = 0;
    let section80D = 0;
    let section80E = 0;
    let section80G = 0;
    let section24b = 0;

    if (declaration && regime === 'old') {
      for (const sec of declaration.sections || []) {
        const declaredTotal = (sec.items || []).reduce(
          (s, it) => s + (it.verifiedAmount || it.declaredAmount || 0),
          0,
        );
        if (sec.section === '80C') section80C = Math.min(declaredTotal, 150000);
        else if (sec.section === '80D') section80D = Math.min(declaredTotal, 100000);
        else if (sec.section === '80E') section80E = declaredTotal;
        else if (sec.section === '80G') section80G = declaredTotal;
        else if (sec.section === '24b') section24b = Math.min(declaredTotal, 200000);
      }
    }

    const totalChapterVIA =
      regime === 'old' ? section80C + section80D + section80E + section80G : 0;

    // Gross total income after standard deduction, professional tax, and housing loan interest
    const grossTotalIncome = Math.max(
      0,
      grossEarnings - standardDeduction - totalProfessionalTax - section24b,
    );

    // Taxable income after Chapter VI-A
    const taxableIncome = Math.max(0, grossTotalIncome - totalChapterVIA);

    // Fetch employee + org snapshots from most recent payslip for Part A
    const latestSlip = payslips[payslips.length - 1];
    const employeeSnapshot = latestSlip.employeeSnapshot || ({} as any);
    const organizationSnapshot = latestSlip.organizationSnapshot || ({} as any);

    const data = {
      // Part A — Employer/Employee identification & TDS summary
      partA: {
        employerName: organizationSnapshot.name || null,
        employerPAN: organizationSnapshot.pan || null,
        employerTAN: organizationSnapshot.tan || null,
        employerAddress: organizationSnapshot.address || null,
        employeeName: employeeSnapshot.name || null,
        employeePAN: employeeSnapshot.pan || null,
        employeeDesignation: employeeSnapshot.designation || null,
        assessmentYear: `${fy.endYear}-${fy.endYear + 1}`,
        financialYear: dto.financialYear,
        periodFrom: fy.startDate,
        periodTo: fy.endDate,
        totalSalaryPaid: grossEarnings,
        totalTDSDeducted: totalTDS,
        quarterlyTDS: [], // populated via Form 24Q cross-reference if needed
      },
      // Part B — Salary breakup, exemptions, deductions, tax computation
      partB: {
        regime,
        salaryBreakdown: {
          basic: basicSum,
          hra: hraSum,
          otherAllowances: otherAllowancesSum,
          grossSalary: grossEarnings,
        },
        exemptions: {
          standardDeduction,
          professionalTax: totalProfessionalTax,
          housingLoanInterest: section24b,
        },
        chapterVIADeductions: {
          section80C,
          section80D,
          section80E,
          section80G,
          total: totalChapterVIA,
        },
        grossTotalIncome,
        taxableIncome,
        taxComputed: totalTDS, // actual TDS deducted through the year
        statutoryContributions: {
          pfEmployee: totalPFEmployee,
          esiEmployee: totalESIEmployee,
        },
      },
      payslipCount: payslips.length,
    };

    const report = new this.statutoryReportModel({
      organizationId: orgId,
      reportType: 'form_16',
      financialYear: dto.financialYear,
      period: { year: fy.startYear },
      employeeId: dto.employeeId,
      status: 'generated',
      data,
      generatedAt: new Date(),
      generatedBy: userId,
      totals: {
        totalGross: grossEarnings,
        totalDeductions,
        totalTax: totalTDS,
        employeeCount: 1,
      },
      createdBy: userId,
    });

    await report.save();
    this.logger.log(`Form 16 generated (id=${report._id}) for employee ${dto.employeeId}`);
    return report;
  }

  // ===========================================================================
  // generatePFECR — Electronic Challan cum Return for EPFO
  // ===========================================================================
  async generatePFECR(
    dto: GeneratePFECRDto,
    userId: string,
    orgId: string,
  ): Promise<IStatutoryReport> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Generating PF ECR for ${dto.month}/${dto.year} by ${userId}`);

    const run = await this.payrollRunModel.findOne({
      organizationId: orgId,
      'payPeriod.month': dto.month,
      'payPeriod.year': dto.year,
      isDeleted: false,
    });

    if (!run) {
      throw new NotFoundException(
        `No payroll run found for ${dto.month}/${dto.year}`,
      );
    }

    const entries = await this.payrollEntryModel.find({
      organizationId: orgId,
      payrollRunId: run._id,
      isDeleted: false,
    });

    // Build ECR line items — one per covered employee (UAN mandatory)
    const ecrRows: Array<Record<string, unknown>> = [];
    let totalWages = 0;
    let totalPFWages = 0;
    let totalEEContribution = 0;
    let totalERContribution = 0;
    let totalPension = 0;
    let totalEDLI = 0;
    let totalAdminCharges = 0;

    for (const entry of entries) {
      const slip = await this.payslipModel.findOne({
        organizationId: orgId,
        employeeId: entry.employeeId,
        'payPeriod.month': dto.month,
        'payPeriod.year': dto.year,
        isDeleted: false,
      });

      const uan = slip?.employeeSnapshot?.uan || null;
      const name = slip?.employeeSnapshot?.name || null;

      // EPFO split: 8.33% to EPS (capped at ceiling), rest to EPF
      const pfEmployer = entry.statutory?.pfEmployer || 0;
      const pfWage = Math.min(
        entry.totals?.grossEarnings || 0,
        15000, // statutory wage ceiling
      );
      const pensionContribution = Math.round(pfWage * 0.0833);
      const epfEmployer = Math.max(0, pfEmployer - pensionContribution);

      ecrRows.push({
        uan,
        memberName: name,
        grossWages: entry.totals?.grossEarnings || 0,
        epfWages: pfWage,
        epsWages: pfWage,
        edliWages: pfWage,
        epfContribRemitted: entry.statutory?.pfEmployee || 0,
        epsContribRemitted: pensionContribution,
        epfEpsDiffRemitted: epfEmployer,
        ncpDays: entry.attendance?.lopDays || 0,
        refundOfAdvances: 0,
      });

      totalWages += entry.totals?.grossEarnings || 0;
      totalPFWages += pfWage;
      totalEEContribution += entry.statutory?.pfEmployee || 0;
      totalERContribution += epfEmployer;
      totalPension += pensionContribution;
      totalEDLI += entry.statutory?.edli || 0;
      totalAdminCharges += entry.statutory?.pfAdminCharges || 0;
    }

    const data = {
      period: { month: dto.month, year: dto.year },
      payrollRunId: String(run._id),
      runNumber: run.runNumber,
      rows: ecrRows,
      summary: {
        totalMembers: ecrRows.length,
        totalWages,
        totalPFWages,
        totalEEContribution,
        totalERContribution,
        totalPension,
        totalEDLI,
        totalAdminCharges,
        totalChallan:
          totalEEContribution +
          totalERContribution +
          totalPension +
          totalEDLI +
          totalAdminCharges,
      },
    };

    const report = new this.statutoryReportModel({
      organizationId: orgId,
      reportType: 'pf_ecr',
      period: { month: dto.month, year: dto.year },
      status: 'generated',
      data,
      generatedAt: new Date(),
      generatedBy: userId,
      totals: {
        totalGross: totalWages,
        totalDeductions: totalEEContribution,
        totalTax: 0,
        employeeCount: ecrRows.length,
      },
      createdBy: userId,
    });

    await report.save();
    this.logger.log(`PF ECR generated (id=${report._id}) for ${dto.month}/${dto.year}`);
    return report;
  }

  // ===========================================================================
  // generateESIReturn — monthly ESI contribution return
  // ===========================================================================
  async generateESIReturn(
    dto: GenerateESIReturnDto,
    userId: string,
    orgId: string,
  ): Promise<IStatutoryReport> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Generating ESI return for ${dto.month}/${dto.year} by ${userId}`);

    const run = await this.payrollRunModel.findOne({
      organizationId: orgId,
      'payPeriod.month': dto.month,
      'payPeriod.year': dto.year,
      isDeleted: false,
    });

    if (!run) {
      throw new NotFoundException(
        `No payroll run found for ${dto.month}/${dto.year}`,
      );
    }

    const entries = await this.payrollEntryModel.find({
      organizationId: orgId,
      payrollRunId: run._id,
      isDeleted: false,
    });

    const rows: Array<Record<string, unknown>> = [];
    let totalGross = 0;
    let totalEmployeeContribution = 0;
    let totalEmployerContribution = 0;
    let coveredCount = 0;

    for (const entry of entries) {
      const esiEmployee = entry.statutory?.esiEmployee || 0;
      const esiEmployer = entry.statutory?.esiEmployer || 0;
      // Only include employees actually covered under ESI (wages ≤ ceiling, non-zero contribution)
      if (esiEmployee <= 0 && esiEmployer <= 0) continue;

      const slip = await this.payslipModel.findOne({
        organizationId: orgId,
        employeeId: entry.employeeId,
        'payPeriod.month': dto.month,
        'payPeriod.year': dto.year,
        isDeleted: false,
      });

      rows.push({
        ipNumber: slip?.employeeSnapshot?.esiNumber || null,
        memberName: slip?.employeeSnapshot?.name || null,
        employeeId: entry.employeeId,
        numberOfDays:
          (entry.attendance?.presentDays || 0) +
          (entry.attendance?.paidLeaveDays || 0),
        grossWages: entry.totals?.grossEarnings || 0,
        employeeContribution: esiEmployee,
        employerContribution: esiEmployer,
        totalContribution: esiEmployee + esiEmployer,
        reasonForZeroWages: null,
      });

      totalGross += entry.totals?.grossEarnings || 0;
      totalEmployeeContribution += esiEmployee;
      totalEmployerContribution += esiEmployer;
      coveredCount += 1;
    }

    const data = {
      period: { month: dto.month, year: dto.year },
      payrollRunId: String(run._id),
      runNumber: run.runNumber,
      rows,
      summary: {
        coveredEmployees: coveredCount,
        totalGrossWages: totalGross,
        totalEmployeeContribution,
        totalEmployerContribution,
        totalContribution: totalEmployeeContribution + totalEmployerContribution,
      },
    };

    const report = new this.statutoryReportModel({
      organizationId: orgId,
      reportType: 'esi_return',
      period: { month: dto.month, year: dto.year },
      status: 'generated',
      data,
      generatedAt: new Date(),
      generatedBy: userId,
      totals: {
        totalGross,
        totalDeductions: totalEmployeeContribution,
        totalTax: 0,
        employeeCount: coveredCount,
      },
      createdBy: userId,
    });

    await report.save();
    this.logger.log(`ESI return generated (id=${report._id}) for ${dto.month}/${dto.year}`);
    return report;
  }

  // ===========================================================================
  // generateTDSQuarterly — Form 24Q quarterly TDS return on salaries
  // ===========================================================================
  async generateTDSQuarterly(
    dto: GenerateTDSQuarterlyDto,
    userId: string,
    orgId: string,
  ): Promise<IStatutoryReport> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(
      `Generating TDS quarterly (Q${dto.quarter} ${dto.year}) by ${userId}`,
    );

    // Map quarter → month range within the calendar year (Indian FY convention)
    // Q1 Apr-Jun (calendar year = fy startYear)
    // Q2 Jul-Sep
    // Q3 Oct-Dec
    // Q4 Jan-Mar (calendar year = fy endYear)
    const quarterMap: Record<number, { months: number[]; yearOffset: number }> = {
      1: { months: [4, 5, 6], yearOffset: 0 },
      2: { months: [7, 8, 9], yearOffset: 0 },
      3: { months: [10, 11, 12], yearOffset: 0 },
      4: { months: [1, 2, 3], yearOffset: 0 },
    };
    const meta = quarterMap[dto.quarter];
    if (!meta) {
      throw new BadRequestException(`Invalid quarter: ${dto.quarter}`);
    }

    // Financial year label — Q4 (Jan-Mar) belongs to the FY that started the previous calendar year
    const fyStart = dto.quarter === 4 ? dto.year - 1 : dto.year;
    const financialYear = `${fyStart}-${fyStart + 1}`;

    const runs = await this.payrollRunModel.find({
      organizationId: orgId,
      'payPeriod.month': { $in: meta.months },
      'payPeriod.year': dto.year,
      isDeleted: false,
    });

    if (!runs.length) {
      throw new NotFoundException(
        `No payroll runs found for Q${dto.quarter} ${dto.year}`,
      );
    }

    const runIds = runs.map((r) => r._id);
    const entries = await this.payrollEntryModel.find({
      organizationId: orgId,
      payrollRunId: { $in: runIds },
      isDeleted: false,
    });

    // Aggregate TDS per employee across the quarter — one deductee record per PAN
    const perEmployee = new Map<
      string,
      {
        employeeId: string;
        name: string | null;
        pan: string | null;
        totalSalary: number;
        totalTDS: number;
        monthlyBreakup: Array<{
          month: number;
          grossEarnings: number;
          tds: number;
        }>;
      }
    >();

    for (const entry of entries) {
      let agg = perEmployee.get(entry.employeeId);
      if (!agg) {
        const slip = await this.payslipModel.findOne({
          organizationId: orgId,
          employeeId: entry.employeeId,
          isDeleted: false,
        }).sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 });
        agg = {
          employeeId: entry.employeeId,
          name: slip?.employeeSnapshot?.name || null,
          pan: slip?.employeeSnapshot?.pan || null,
          totalSalary: 0,
          totalTDS: 0,
          monthlyBreakup: [],
        };
        perEmployee.set(entry.employeeId, agg);
      }
      agg.totalSalary += entry.totals?.grossEarnings || 0;
      agg.totalTDS += entry.statutory?.tds || 0;
      agg.monthlyBreakup.push({
        month: entry.payPeriod?.month,
        grossEarnings: entry.totals?.grossEarnings || 0,
        tds: entry.statutory?.tds || 0,
      });
    }

    const deducteeRecords = Array.from(perEmployee.values());
    const totalSalaryPaid = deducteeRecords.reduce((s, r) => s + r.totalSalary, 0);
    const totalTDSDeducted = deducteeRecords.reduce((s, r) => s + r.totalTDS, 0);

    const data = {
      formType: '24Q',
      quarter: dto.quarter,
      year: dto.year,
      financialYear,
      months: meta.months,
      payrollRunIds: runIds.map(String),
      deducteeRecords,
      summary: {
        totalDeductees: deducteeRecords.length,
        totalSalaryPaid,
        totalTDSDeducted,
      },
    };

    const report = new this.statutoryReportModel({
      organizationId: orgId,
      reportType: 'tds_quarterly',
      financialYear,
      period: { quarter: dto.quarter, year: dto.year },
      status: 'generated',
      data,
      generatedAt: new Date(),
      generatedBy: userId,
      totals: {
        totalGross: totalSalaryPaid,
        totalDeductions: totalTDSDeducted,
        totalTax: totalTDSDeducted,
        employeeCount: deducteeRecords.length,
      },
      createdBy: userId,
    });

    await report.save();
    this.logger.log(
      `TDS quarterly generated (id=${report._id}) for Q${dto.quarter} ${dto.year}`,
    );
    return report;
  }

  // ===========================================================================
  // listStatutoryReports — Paginated list scoped to org
  // ===========================================================================
  async listStatutoryReports(
    query: StatutoryReportQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{
    data: IStatutoryReport[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = { organizationId: orgId, isDeleted: false };
    if (query.reportType) filter.reportType = query.reportType;
    if (query.financialYear) filter.financialYear = query.financialYear;
    if (query.status) filter.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.statutoryReportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.statutoryReportModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // getStatutoryReport — Single report scoped to org
  // ===========================================================================
  async getStatutoryReport(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IStatutoryReport> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const report = await this.statutoryReportModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!report) throw new NotFoundException('Statutory report not found');
    return report;
  }

  // ===========================================================================
  // getMyForm16 — Self-service: current user's Form 16 reports
  // ===========================================================================
  async getMyForm16(
    userId: string,
    orgId: string,
  ): Promise<IStatutoryReport[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    // userId here corresponds to the authenticated employee's id — scoped strictly to self
    return this.statutoryReportModel
      .find({
        organizationId: orgId,
        reportType: 'form_16',
        employeeId: userId,
        isDeleted: false,
      })
      .sort({ 'period.year': -1, createdAt: -1 });
  }

  // ===========================================================================
  // Performance Management: Goals
  // ===========================================================================

  private computeGoalProgress(keyResults: any[]): number {
    if (!keyResults || keyResults.length === 0) return 0;
    const total = keyResults.reduce((sum, kr) => sum + (kr.progress || 0), 0);
    return Math.round(total / keyResults.length);
  }

  /**
   * True if `actorId` is allowed to manage `targetEmployeeId`'s goals/review.
   * Rules:
   *   - self-management is always allowed
   *   - hr-service reports `managerId` as the target's line manager;
   *     if that matches the actor, it's allowed
   *   - on hr-service lookup failure, fall closed (actor must be the target)
   */
  private async isManagerOfOrSelf(
    actorId: string,
    targetEmployeeId: string,
  ): Promise<boolean> {
    if (!actorId || !targetEmployeeId) return false;
    if (actorId === targetEmployeeId) return true;
    try {
      const target = await this.externalServices.getEmployee(targetEmployeeId);
      if (!target) return false;
      const managerId = target.managerId || target.reportingManagerId || target.lineManagerId;
      return Boolean(managerId && String(managerId) === String(actorId));
    } catch (err) {
      this.logger.warn(
        `isManagerOfOrSelf: hr lookup failed for ${targetEmployeeId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async createGoal(dto: CreateGoalDto, userId: string, orgId: string): Promise<IGoal> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Creating goal "${dto.title}" by user ${userId}`);

    const employeeId = dto.employeeId || userId;

    // SECURITY: A user can create goals for themselves or, if they are the
    // line manager of the target employee, for their direct report. Any
    // other combination is rejected so "create goal on behalf of CEO" does
    // not work.
    if (!(await this.isManagerOfOrSelf(userId, employeeId))) {
      throw new ForbiddenException(
        'You can only create goals for yourself or your direct reports',
      );
    }

    if (dto.cycleId) {
      const cycle = await this.reviewCycleModel.findOne({
        _id: dto.cycleId,
        organizationId: orgId,
        isDeleted: false,
      });
      if (!cycle) throw new NotFoundException(`Review cycle ${dto.cycleId} not found`);
      if (!['goal_setting', 'draft'].includes(cycle.status) && !cycle.config.allowGoalRevisions) {
        throw new BadRequestException(`Goals cannot be added at cycle status "${cycle.status}"`);
      }
    }

    const keyResults = (dto.keyResults || []).map((kr) => ({
      title: kr.title,
      metric: kr.metric || null,
      targetValue: kr.targetValue,
      currentValue: kr.currentValue ?? 0,
      unit: kr.unit || null,
      progress: kr.progress ?? 0,
      status: kr.status || 'not_started',
      notes: kr.notes || null,
    }));

    const goal = new this.goalModel({
      organizationId: orgId,
      employeeId,
      cycleId: dto.cycleId || null,
      title: dto.title,
      description: dto.description || '',
      type: dto.type || 'individual',
      category: dto.category || 'performance',
      status: 'draft',
      priority: dto.priority || 'medium',
      weightage: dto.weightage || 0,
      startDate: new Date(dto.startDate),
      targetDate: new Date(dto.targetDate),
      progress: this.computeGoalProgress(keyResults),
      keyResults,
      checkIns: [],
      parentGoalId: dto.parentGoalId || null,
      alignedGoals: dto.alignedGoals || [],
      tags: dto.tags || [],
      isDeleted: false,
      createdBy: userId,
    });

    return goal.save();
  }

  async getAllGoals(query: GoalQueryDto, userId: string, orgId: string) {
    if (!orgId) throw new ForbiddenException('Organization context required');

    // S-BH18: Scope the goal list to the caller's own goals plus their
    // direct reports'. Previously any org member could read every goal
    // in the org, including leadership performance targets. Managers
    // (fetched via hr-service direct-reports lookup) see their team; ICs
    // see only themselves; if hr-service is unavailable, fall closed to
    // self-only.
    const directReports = await this.externalServices.getDirectReports(userId);
    const allowedEmployeeIds = Array.from(new Set([userId, ...directReports]));

    // If the caller passes ?employeeId=X, enforce that X is within their
    // allowed scope — otherwise return an empty page rather than 403 to
    // avoid leaking which IDs exist.
    let scopedEmployeeIds: string[] = allowedEmployeeIds;
    if (query.employeeId) {
      if (!allowedEmployeeIds.includes(query.employeeId)) {
        return { records: [], total: 0, page: query.page || 1, limit: query.limit || 20, totalPages: 0 };
      }
      scopedEmployeeIds = [query.employeeId];
    }

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      employeeId: { $in: scopedEmployeeIds },
    };
    if (query.status) filter.status = query.status;
    if (query.cycleId) filter.cycleId = query.cycleId;
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.goalModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.goalModel.countDocuments(filter),
    ]);

    return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getMyGoals(query: GoalQueryDto, userId: string, orgId: string) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.getAllGoals({ ...query, employeeId: userId }, userId, orgId);
  }

  async getGoal(id: string, userId: string, orgId: string): Promise<IGoal> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const goal = await this.goalModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!goal) throw new NotFoundException(`Goal ${id} not found`);
    // S-BH18: read authorization — a caller can read a goal iff they own
    // it or they are the owner's line manager. Mutating endpoints use
    // isManagerOfOrSelf independently; keeping this consistent here
    // prevents "read CEO's goal by guessing the ID" enumeration.
    if (!(await this.isManagerOfOrSelf(userId, goal.employeeId))) {
      throw new NotFoundException(`Goal ${id} not found`);
    }
    return goal;
  }

  async updateGoal(
    id: string,
    dto: UpdateGoalDto,
    userId: string,
    orgId: string,
  ): Promise<IGoal> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const goal = await this.getGoal(id, userId, orgId);

    // SECURITY: ownership check — only the goal owner or their manager can
    // mutate the goal.
    if (!(await this.isManagerOfOrSelf(userId, goal.employeeId))) {
      throw new ForbiddenException('You do not have permission to update this goal');
    }

    if (goal.status === 'achieved' || goal.status === 'cancelled') {
      throw new BadRequestException(`Cannot update goal in status "${goal.status}"`);
    }

    if (dto.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['active', 'cancelled'],
        active: ['achieved', 'missed', 'cancelled', 'deferred'],
        deferred: ['active', 'cancelled'],
        missed: ['active'],
      };
      const allowed = validTransitions[goal.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid goal status transition from "${goal.status}" to "${dto.status}"`,
        );
      }
      goal.status = dto.status;
      if (dto.status === 'achieved') {
        goal.completedAt = new Date();
        goal.progress = 100;
      }
    }

    if (dto.title !== undefined) goal.title = dto.title;
    if (dto.description !== undefined) goal.description = dto.description;
    if (dto.type !== undefined) goal.type = dto.type;
    if (dto.category !== undefined) goal.category = dto.category;
    if (dto.priority !== undefined) goal.priority = dto.priority;
    if (dto.weightage !== undefined) goal.weightage = dto.weightage;
    if (dto.startDate !== undefined) goal.startDate = new Date(dto.startDate);
    if (dto.targetDate !== undefined) goal.targetDate = new Date(dto.targetDate);
    if (dto.alignedGoals !== undefined) goal.alignedGoals = dto.alignedGoals;
    if (dto.tags !== undefined) goal.tags = dto.tags;
    if (dto.selfAssessment !== undefined) goal.selfAssessment = dto.selfAssessment;

    if (dto.keyResults !== undefined) {
      goal.keyResults = dto.keyResults.map((kr) => ({
        title: kr.title,
        metric: kr.metric || null,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue ?? 0,
        unit: kr.unit || null,
        progress: kr.progress ?? 0,
        status: kr.status || 'not_started',
        notes: kr.notes || null,
      }));
      if (dto.status !== 'achieved') {
        goal.progress = this.computeGoalProgress(goal.keyResults);
      }
    }

    return goal.save();
  }

  async goalCheckIn(
    id: string,
    dto: GoalCheckInDto,
    userId: string,
    orgId: string,
  ): Promise<IGoal> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const goal = await this.getGoal(id, userId, orgId);

    // SECURITY: Check-in ownership — only the owner may update their own
    // progress. A manager can push updates via updateGoal/rateGoal paths.
    if (goal.employeeId !== userId) {
      throw new ForbiddenException('Only the goal owner can submit a check-in');
    }

    if (!['active', 'draft'].includes(goal.status)) {
      throw new BadRequestException(`Cannot check-in on goal with status "${goal.status}"`);
    }

    if (goal.status === 'draft') goal.status = 'active';

    if (dto.keyResults && dto.keyResults.length > 0) {
      dto.keyResults.forEach((krUpdate, idx) => {
        if (goal.keyResults[idx]) {
          if (krUpdate.currentValue !== undefined) goal.keyResults[idx].currentValue = krUpdate.currentValue;
          if (krUpdate.progress !== undefined) goal.keyResults[idx].progress = krUpdate.progress;
          if (krUpdate.status !== undefined) goal.keyResults[idx].status = krUpdate.status;
          if (krUpdate.notes !== undefined) goal.keyResults[idx].notes = krUpdate.notes;
        }
      });
      goal.progress = this.computeGoalProgress(goal.keyResults);
    } else {
      goal.progress = dto.progress;
    }

    goal.checkIns.push({
      date: new Date(),
      progress: goal.progress,
      notes: dto.notes || '',
      updatedBy: userId,
    });

    if (goal.progress >= 100) {
      goal.status = 'achieved';
      goal.completedAt = new Date();
    }

    return goal.save();
  }

  async rateGoal(
    id: string,
    dto: RateGoalDto,
    userId: string,
    orgId: string,
  ): Promise<IGoal> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const goal = await this.getGoal(id, userId, orgId);

    if (dto.managerRating === undefined && dto.selfRating === undefined) {
      throw new BadRequestException('Either managerRating or selfRating must be provided');
    }

    // SECURITY: selfRating requires the caller to be the goal owner,
    // managerRating requires the caller to be the goal owner's manager.
    // Previously this endpoint had zero authorization — any logged-in user
    // could stuff manager ratings onto arbitrary employees' goals.
    if (dto.selfRating !== undefined && goal.employeeId !== userId) {
      throw new ForbiddenException('selfRating may only be set by the goal owner');
    }
    if (dto.managerRating !== undefined) {
      const isManager = goal.employeeId !== userId && (await this.isManagerOfOrSelf(userId, goal.employeeId));
      if (!isManager) {
        throw new ForbiddenException(
          'managerRating may only be set by the goal owner\'s line manager',
        );
      }
    }

    if (dto.managerRating !== undefined) {
      goal.managerRating = dto.managerRating;
      if (dto.comment) goal.managerComment = dto.comment;
    }
    if (dto.selfRating !== undefined) {
      goal.selfRating = dto.selfRating;
      if (dto.comment) goal.selfAssessment = dto.comment;
    }

    // Compute weighted final score (average of self and manager if both present)
    if (goal.managerRating !== null && goal.managerRating !== undefined) {
      const base = goal.selfRating
        ? (goal.managerRating * 0.7 + goal.selfRating * 0.3)
        : goal.managerRating;
      goal.finalScore = Number(((base * (goal.weightage || 100)) / 100).toFixed(2));
    }

    return goal.save();
  }

  async deleteGoal(id: string, userId: string, orgId: string): Promise<{ deleted: boolean }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const goal = await this.getGoal(id, userId, orgId);
    if (!(await this.isManagerOfOrSelf(userId, goal.employeeId))) {
      throw new ForbiddenException('You do not have permission to delete this goal');
    }
    goal.isDeleted = true;
    await goal.save();
    return { deleted: true };
  }

  // ===========================================================================
  // Performance Management: Review Cycles
  // ===========================================================================

  async createReviewCycle(
    dto: CreateReviewCycleDto,
    userId: string,
    orgId: string,
  ): Promise<IReviewCycle> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Creating review cycle "${dto.name}" by user ${userId}`);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const cycle = new this.reviewCycleModel({
      organizationId: orgId,
      name: dto.name,
      type: dto.type || 'annual',
      status: 'draft',
      startDate,
      endDate,
      goalSettingDeadline: dto.goalSettingDeadline ? new Date(dto.goalSettingDeadline) : null,
      selfReviewDeadline: dto.selfReviewDeadline ? new Date(dto.selfReviewDeadline) : null,
      peerReviewDeadline: dto.peerReviewDeadline ? new Date(dto.peerReviewDeadline) : null,
      managerReviewDeadline: dto.managerReviewDeadline ? new Date(dto.managerReviewDeadline) : null,
      completionDeadline: dto.completionDeadline ? new Date(dto.completionDeadline) : null,
      applicableTo: dto.applicableTo || 'all',
      departments: dto.departments || [],
      designations: dto.designations || [],
      employeeIds: dto.employeeIds || [],
      config: {
        enableSelfReview: dto.config?.enableSelfReview ?? true,
        enablePeerReview: dto.config?.enablePeerReview ?? true,
        enableManagerReview: dto.config?.enableManagerReview ?? true,
        enable360: dto.config?.enable360 ?? false,
        minPeerReviewers: dto.config?.minPeerReviewers ?? 3,
        maxPeerReviewers: dto.config?.maxPeerReviewers ?? 5,
        ratingScale: dto.config?.ratingScale ?? 5,
        enableCalibration: dto.config?.enableCalibration ?? false,
        allowGoalRevisions: dto.config?.allowGoalRevisions ?? true,
      },
      ratingGuide: dto.ratingGuide || [],
      competencies: dto.competencies || [],
      stats: {
        totalEmployees: 0,
        goalsSubmitted: 0,
        selfReviewsCompleted: 0,
        peerReviewsCompleted: 0,
        managerReviewsCompleted: 0,
        finalized: 0,
      },
      isDeleted: false,
      createdBy: userId,
    });

    return cycle.save();
  }

  async listReviewCycles(query: ReviewCycleQueryDto, userId: string, orgId: string) {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { organizationId: orgId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.year) {
      const yearStart = new Date(query.year, 0, 1);
      const yearEnd = new Date(query.year + 1, 0, 1);
      filter.startDate = { $gte: yearStart, $lt: yearEnd };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.reviewCycleModel.find(filter).sort({ startDate: -1 }).skip(skip).limit(limit),
      this.reviewCycleModel.countDocuments(filter),
    ]);

    return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getReviewCycle(id: string, userId: string, orgId: string): Promise<IReviewCycle> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cycle = await this.reviewCycleModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!cycle) throw new NotFoundException(`Review cycle ${id} not found`);
    return cycle;
  }

  async updateReviewCycle(
    id: string,
    dto: UpdateReviewCycleDto,
    userId: string,
    orgId: string,
  ): Promise<IReviewCycle> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cycle = await this.getReviewCycle(id, userId, orgId);

    if (['completed', 'cancelled'].includes(cycle.status)) {
      throw new BadRequestException(`Cannot update cycle in status "${cycle.status}"`);
    }

    if (dto.name !== undefined) cycle.name = dto.name;
    if (dto.type !== undefined) cycle.type = dto.type;
    if (dto.startDate !== undefined) cycle.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) cycle.endDate = new Date(dto.endDate);
    if (dto.goalSettingDeadline !== undefined) cycle.goalSettingDeadline = new Date(dto.goalSettingDeadline);
    if (dto.selfReviewDeadline !== undefined) cycle.selfReviewDeadline = new Date(dto.selfReviewDeadline);
    if (dto.peerReviewDeadline !== undefined) cycle.peerReviewDeadline = new Date(dto.peerReviewDeadline);
    if (dto.managerReviewDeadline !== undefined) cycle.managerReviewDeadline = new Date(dto.managerReviewDeadline);
    if (dto.completionDeadline !== undefined) cycle.completionDeadline = new Date(dto.completionDeadline);
    if (dto.applicableTo !== undefined) cycle.applicableTo = dto.applicableTo;
    if (dto.departments !== undefined) cycle.departments = dto.departments;
    if (dto.designations !== undefined) cycle.designations = dto.designations;
    if (dto.employeeIds !== undefined) cycle.employeeIds = dto.employeeIds;
    if (dto.ratingGuide !== undefined) cycle.ratingGuide = dto.ratingGuide as any;
    if (dto.competencies !== undefined) cycle.competencies = dto.competencies as any;
    if (dto.config !== undefined) {
      cycle.config = { ...cycle.config, ...dto.config } as any;
    }

    return cycle.save();
  }

  async startReviewCycle(
    id: string,
    dto: StartReviewCycleDto,
    userId: string,
    orgId: string,
  ): Promise<{ cycle: IReviewCycle; reviewsCreated: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cycle = await this.getReviewCycle(id, userId, orgId);

    if (cycle.status !== 'draft') {
      throw new BadRequestException(`Cycle must be in draft status to start (current: ${cycle.status})`);
    }

    let employeeIds: string[] = [];
    if (dto.employeeIds && dto.employeeIds.length > 0) {
      employeeIds = dto.employeeIds;
    } else if (cycle.applicableTo === 'specific' && cycle.employeeIds.length > 0) {
      employeeIds = cycle.employeeIds;
    } else {
      // B-H10: Previously derived employee list from salary-structure distinct,
      // which misses new joiners who don't yet have an approved structure.
      // Prefer the authoritative hr-service active employee roster and fall
      // back to salary structures only if hr-service is unreachable.
      try {
        const roster = await this.externalServices.getActiveEmployees?.(orgId);
        if (Array.isArray(roster) && roster.length > 0) {
          employeeIds = roster
            .map((e: any) => e.employeeId || e._id || e.id)
            .filter((v: any) => typeof v === 'string' && v.length > 0);
        }
      } catch (err) {
        this.logger.warn(
          `startReviewCycle: hr-service roster fetch failed: ${(err as Error).message}`,
        );
      }
      if (employeeIds.length === 0) {
        const structures = await this.salaryStructureModel
          .find({ organizationId: orgId, status: { $in: ['approved', 'active'] } })
          .distinct('employeeId');
        employeeIds = structures;
      }
    }

    if (employeeIds.length === 0) {
      throw new BadRequestException('No applicable employees found for this cycle');
    }

    let reviewsCreated = 0;
    for (const empId of employeeIds) {
      const existing = await this.performanceReviewModel.findOne({
        organizationId: orgId,
        cycleId: String(cycle._id),
        employeeId: empId,
      });
      if (existing) continue;

      await this.performanceReviewModel.create({
        organizationId: orgId,
        cycleId: String(cycle._id),
        employeeId: empId,
        managerId: null,
        status: 'goal_setting',
        goalIds: [],
        peerReviews: [],
        isDeleted: false,
        createdBy: userId,
      });
      reviewsCreated++;
    }

    cycle.status = 'goal_setting';
    cycle.stats.totalEmployees = employeeIds.length;
    await cycle.save();

    return { cycle, reviewsCreated };
  }

  async updateCycleStatus(
    id: string,
    dto: UpdateCycleStatusDto,
    userId: string,
    orgId: string,
  ): Promise<IReviewCycle> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cycle = await this.getReviewCycle(id, userId, orgId);

    const validTransitions: Record<string, string[]> = {
      draft: ['goal_setting', 'cancelled'],
      goal_setting: ['self_review', 'cancelled'],
      self_review: ['peer_review', 'manager_review', 'cancelled'],
      peer_review: ['manager_review', 'cancelled'],
      manager_review: ['calibration', 'completed', 'cancelled'],
      calibration: ['completed', 'cancelled'],
    };

    const allowed = validTransitions[cycle.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid cycle status transition from "${cycle.status}" to "${dto.status}"`,
      );
    }

    cycle.status = dto.status;
    return cycle.save();
  }

  // ===========================================================================
  // Performance Management: Reviews
  // ===========================================================================

  async getMyReviews(userId: string, orgId: string): Promise<IPerformanceReview[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.performanceReviewModel
      .find({ organizationId: orgId, employeeId: userId, isDeleted: false })
      .sort({ createdAt: -1 });
  }

  async getPendingReviews(userId: string, orgId: string): Promise<IPerformanceReview[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    // Reviews where user is the manager and awaiting manager review,
    // OR where user is listed as a peer reviewer (best-effort)
    return this.performanceReviewModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        $or: [
          { managerId: userId, status: { $in: ['manager_review_pending', 'self_review_completed'] } },
        ],
      })
      .sort({ updatedAt: -1 });
  }

  async getReview(id: string, userId: string, orgId: string): Promise<IPerformanceReview> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const review = await this.performanceReviewModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!review) throw new NotFoundException(`Performance review ${id} not found`);
    return review;
  }

  async submitSelfReview(
    id: string,
    dto: SubmitSelfReviewDto,
    userId: string,
    orgId: string,
  ): Promise<IPerformanceReview> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const review = await this.getReview(id, userId, orgId);

    if (review.employeeId !== userId) {
      throw new ForbiddenException('Only the reviewee can submit their self-review');
    }

    if (review.selfReview) {
      throw new ConflictException('Self-review already submitted');
    }

    review.selfReview = {
      overallRating: dto.overallRating,
      strengths: dto.strengths || '',
      improvements: dto.improvements || '',
      achievements: dto.achievements || '',
      challenges: dto.challenges || '',
      competencyRatings: (dto.competencyRatings || []) as any,
      submittedAt: new Date(),
    };
    review.status = 'self_review_completed';

    await this.reviewCycleModel.updateOne(
      { _id: review.cycleId, organizationId: orgId },
      { $inc: { 'stats.selfReviewsCompleted': 1 } },
    );

    return review.save();
  }

  /**
   * Assign the roster of users permitted to submit peer reviews for a given
   * performance review.
   *
   * Authorization: only the reviewee's line manager (per hr-service) or an
   * org admin/hr role may set the roster. The controller enforces the
   * admin/hr role via @Roles; this method enforces manager-of-reviewee as
   * an additional path.
   *
   * Idempotent: repeated calls replace the roster. A reviewer already
   * included retains any prior submission.
   */
  async assignPeerReviewers(
    id: string,
    reviewerIds: string[],
    userId: string,
    orgId: string,
  ): Promise<IPerformanceReview> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const review = await this.performanceReviewModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!review) throw new NotFoundException(`Performance review ${id} not found`);

    // The reviewee themselves must NOT be in the roster.
    const cleaned = Array.from(
      new Set(
        (reviewerIds || [])
          .filter((r): r is string => typeof r === 'string' && r.length > 0)
          .filter((r) => r !== review.employeeId),
      ),
    );
    if (cleaned.length === 0) {
      throw new BadRequestException('reviewerIds must contain at least one valid id');
    }
    if (cleaned.length > 20) {
      throw new BadRequestException('Cannot assign more than 20 peer reviewers');
    }

    // Authorization: caller must be the reviewee's manager, the already-set
    // managerId on the review, OR an admin/hr role (enforced at controller
    // via @Roles). We re-check the manager path here so this method is
    // safe to call from other privileged service code paths.
    const isAssignedMgr = review.managerId === userId;
    const isLineMgr = await this.isManagerOfOrSelf(userId, review.employeeId);
    // Note: isManagerOfOrSelf returns true for self; exclude the reviewee
    // from managing their own reviewer roster.
    const isSelf = userId === review.employeeId;
    if (isSelf || (!isAssignedMgr && !isLineMgr)) {
      throw new ForbiddenException(
        'Only the reviewee\'s line manager or an HR admin may assign peer reviewers',
      );
    }

    // Cycle must be in a phase that still allows changing the roster.
    // After peer_review phase has started, new reviewers may still be
    // added, but not after calibration.
    const cycle = await this.reviewCycleModel.findOne({
      _id: review.cycleId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!cycle) throw new NotFoundException('Review cycle not found');
    if (['calibration', 'completed', 'cancelled'].includes(cycle.status)) {
      throw new BadRequestException(
        `Peer reviewer roster cannot be changed while cycle is in "${cycle.status}"`,
      );
    }

    review.assignedPeerReviewerIds = cleaned;
    await review.save();
    this.logger.log(
      `Assigned ${cleaned.length} peer reviewers for review ${id} by ${userId}`,
    );
    return review;
  }

  async submitPeerReview(
    id: string,
    dto: SubmitPeerReviewDto,
    userId: string,
    orgId: string,
  ): Promise<IPerformanceReview> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const review = await this.getReview(id, userId, orgId);

    if (review.employeeId === userId) {
      throw new BadRequestException('Cannot submit peer review for yourself');
    }

    // SECURITY: Only users explicitly assigned as peer reviewers for this
    // review may submit. Previously any logged-in org member could drop a
    // 1-star "peer" review on anyone, including a direct career-sabotage
    // vector. The assigned roster is set by the review-cycle admin via the
    // assignPeerReviewers endpoint.
    const assigned = review.assignedPeerReviewerIds || [];
    if (!assigned.includes(userId)) {
      throw new ForbiddenException(
        'You are not assigned as a peer reviewer for this review',
      );
    }

    // Phase/deadline enforcement: the owning cycle must be in a phase that
    // accepts peer reviews, and the peer-review phase deadline must not have
    // passed. B-H01/B-H02 — previously both checks were missing.
    const cycle = await this.reviewCycleModel.findOne({
      _id: review.cycleId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!cycle) throw new NotFoundException('Review cycle not found');
    if (!['peer_review', 'self_review'].includes(cycle.status)) {
      throw new BadRequestException(
        `Peer reviews are not accepted while cycle is in "${cycle.status}"`,
      );
    }
    const peerDeadline = cycle.peerReviewDeadline || cycle.endDate;
    if (peerDeadline && new Date() > new Date(peerDeadline)) {
      throw new BadRequestException('Peer review phase has ended for this cycle');
    }

    const already = review.peerReviews.find((p) => p.reviewerId === userId);
    if (already) {
      throw new ConflictException('Peer review already submitted by this user');
    }

    review.peerReviews.push({
      reviewerId: userId,
      relationship: dto.relationship,
      overallRating: dto.overallRating,
      strengths: dto.strengths || '',
      improvements: dto.improvements || '',
      competencyRatings: (dto.competencyRatings || []) as any,
      isAnonymous: dto.isAnonymous ?? true,
      submittedAt: new Date(),
    });

    if (review.status === 'self_review_completed' || review.status === 'peer_review_pending') {
      review.status = 'peer_review_completed';
    }

    await this.reviewCycleModel.updateOne(
      { _id: review.cycleId, organizationId: orgId },
      { $inc: { 'stats.peerReviewsCompleted': 1 } },
    );

    return review.save();
  }

  async submitManagerReview(
    id: string,
    dto: SubmitManagerReviewDto,
    userId: string,
    orgId: string,
  ): Promise<IPerformanceReview> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const review = await this.getReview(id, userId, orgId);

    // SECURITY: Only the designated line manager of the reviewee can submit
    // a manager review. If review.managerId is already set, it must match
    // the caller. Otherwise we look up the reviewee's line manager from
    // hr-service and require a match. Previously any manager-role user could
    // write arbitrary manager reviews on arbitrary employees.
    if (review.managerId && review.managerId !== userId) {
      throw new ForbiddenException(
        'Only the assigned line manager can submit this manager review',
      );
    }
    if (!review.managerId && !(await this.isManagerOfOrSelf(userId, review.employeeId))) {
      throw new ForbiddenException(
        'Only the reviewee\'s line manager can submit a manager review',
      );
    }
    if (review.employeeId === userId) {
      throw new BadRequestException('Cannot submit a manager review for yourself');
    }

    // Phase/deadline enforcement (B-H01/B-H02).
    const cycle = await this.reviewCycleModel.findOne({
      _id: review.cycleId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!cycle) throw new NotFoundException('Review cycle not found');
    if (cycle.status !== 'manager_review') {
      throw new BadRequestException(
        `Manager reviews are not accepted while cycle is in "${cycle.status}"`,
      );
    }
    const mgrDeadline = cycle.managerReviewDeadline || cycle.endDate;
    if (mgrDeadline && new Date() > new Date(mgrDeadline)) {
      throw new BadRequestException('Manager review phase has ended for this cycle');
    }

    if (review.managerReview) {
      throw new ConflictException('Manager review already submitted');
    }

    review.managerReview = {
      overallRating: dto.overallRating,
      strengths: dto.strengths || '',
      improvements: dto.improvements || '',
      goalAchievement: dto.goalAchievement || '',
      developmentPlan: dto.developmentPlan || '',
      promotionRecommendation: dto.promotionRecommendation || 'no',
      salaryIncreaseRecommendation: dto.salaryIncreaseRecommendation || 'no_change',
      competencyRatings: (dto.competencyRatings || []) as any,
      submittedAt: new Date(),
    };
    review.managerId = review.managerId || userId;
    review.status = 'manager_review_completed';

    await this.reviewCycleModel.updateOne(
      { _id: review.cycleId, organizationId: orgId },
      { $inc: { 'stats.managerReviewsCompleted': 1 } },
    );

    return review.save();
  }

  async finalizeReview(
    id: string,
    dto: FinalizeReviewDto,
    userId: string,
    orgId: string,
  ): Promise<IPerformanceReview> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const review = await this.getReview(id, userId, orgId);

    if (review.status === 'finalized') {
      throw new ConflictException('Review already finalized');
    }
    if (!review.managerReview) {
      throw new BadRequestException('Manager review must be submitted before finalization');
    }

    // B-H01: the owning cycle must be in calibration or completed before
    // individual reviews can be finalized. Previously finalizeReview
    // ignored cycle state entirely, allowing early finalization that
    // skipped the calibration step.
    const cycle = await this.reviewCycleModel.findOne({
      _id: review.cycleId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!cycle) throw new NotFoundException('Review cycle not found');
    if (!['calibration', 'manager_review', 'completed'].includes(cycle.status)) {
      throw new BadRequestException(
        `Reviews cannot be finalized while cycle is in "${cycle.status}"`,
      );
    }

    review.finalRating = dto.finalRating;
    review.finalLabel = dto.finalLabel || null;
    review.calibrationNotes = dto.calibrationNotes || null;
    review.finalizedBy = userId;
    review.finalizedAt = new Date();
    review.status = 'finalized';

    await this.reviewCycleModel.updateOne(
      { _id: review.cycleId, organizationId: orgId },
      { $inc: { 'stats.finalized': 1 } },
    );

    return review.save();
  }

  // ===========================================================================
  // Employee Engagement: Announcements
  // ===========================================================================

  async createAnnouncement(
    dto: CreateAnnouncementDto,
    userId: string,
    orgId: string,
  ): Promise<IAnnouncement> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    this.logger.log(`Creating announcement "${dto.title}" by user ${userId}`);

    const data: Partial<IAnnouncement> = {
      organizationId: orgId,
      title: dto.title,
      content: dto.content,
      category: dto.category || 'general',
      priority: dto.priority || 'normal',
      targetAudience: dto.targetAudience || 'all',
      departments: dto.departments || [],
      designations: dto.designations || [],
      employeeIds: dto.employeeIds || [],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      isPinned: dto.isPinned ?? false,
      attachments: (dto.attachments || []) as any,
      readBy: [],
      reactions: [],
      commentCount: 0,
      status: 'draft',
      isDeleted: false,
      createdBy: userId,
    };

    if (dto.publishedAt) {
      const publishDate = new Date(dto.publishedAt);
      data.publishedAt = publishDate;
      data.status = publishDate > new Date() ? 'scheduled' : 'published';
    }

    const announcement = new this.announcementModel(data);
    return announcement.save();
  }

  async listAnnouncements(
    query: AnnouncementQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ items: IAnnouncement[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    // B-H08: targetAudience was being ignored, so every employee saw every
    // announcement — including department-scoped HR memos and specific-
    // audience comms. Fetch the viewer's department/designation from
    // hr-service and build an $or filter that matches only the audiences
    // the viewer actually belongs to.
    let viewerDepartment: string | null = null;
    let viewerDesignation: string | null = null;
    try {
      const emp = await this.externalServices.getEmployee(userId);
      if (emp) {
        viewerDepartment = emp.department || emp.departmentId || null;
        viewerDesignation = emp.designation || emp.designationId || emp.title || null;
      }
    } catch (err) {
      this.logger.warn(
        `listAnnouncements: failed to fetch viewer profile for audience filter: ${(err as Error).message}`,
      );
    }

    const audienceClause: any[] = [
      { targetAudience: 'all' },
      { targetAudience: { $exists: false } },
      { targetAudience: null },
      { employeeIds: userId },
    ];
    if (viewerDepartment) {
      audienceClause.push({ targetAudience: 'department', departments: viewerDepartment });
    }
    if (viewerDesignation) {
      audienceClause.push({ targetAudience: 'designation', designations: viewerDesignation });
    }

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      $or: audienceClause,
    };
    // Default: only show published announcements to regular users
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'published';
    }
    if (query.category) filter.category = query.category;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.announcementModel
        .find(filter)
        .sort({ isPinned: -1, publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.announcementModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getPinnedAnnouncements(userId: string, orgId: string): Promise<IAnnouncement[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.announcementModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        status: 'published',
        isPinned: true,
      })
      .sort({ publishedAt: -1 });
  }

  async getAnnouncement(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IAnnouncement> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const announcement = await this.announcementModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async updateAnnouncement(
    id: string,
    dto: UpdateAnnouncementDto,
    userId: string,
    orgId: string,
  ): Promise<IAnnouncement> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const announcement = await this.getAnnouncement(id, userId, orgId);

    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.content !== undefined) announcement.content = dto.content;
    if (dto.category !== undefined) announcement.category = dto.category;
    if (dto.priority !== undefined) announcement.priority = dto.priority;
    if (dto.targetAudience !== undefined) announcement.targetAudience = dto.targetAudience;
    if (dto.departments !== undefined) announcement.departments = dto.departments;
    if (dto.designations !== undefined) announcement.designations = dto.designations;
    if (dto.employeeIds !== undefined) announcement.employeeIds = dto.employeeIds;
    if (dto.publishedAt !== undefined) announcement.publishedAt = new Date(dto.publishedAt);
    if (dto.expiresAt !== undefined) announcement.expiresAt = new Date(dto.expiresAt);
    if (dto.isPinned !== undefined) announcement.isPinned = dto.isPinned;
    if (dto.attachments !== undefined) announcement.attachments = dto.attachments as any;

    return announcement.save();
  }

  async publishAnnouncement(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IAnnouncement> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const announcement = await this.getAnnouncement(id, userId, orgId);
    if (announcement.status === 'published') {
      throw new ConflictException('Announcement already published');
    }
    announcement.status = 'published';
    announcement.publishedAt = new Date();
    return announcement.save();
  }

  async markAnnouncementRead(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IAnnouncement> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const announcement = await this.getAnnouncement(id, userId, orgId);

    const already = announcement.readBy.some((r) => r.userId === userId);
    if (!already) {
      announcement.readBy.push({ userId, readAt: new Date() });
      await announcement.save();
    }
    return announcement;
  }

  async reactToAnnouncement(
    id: string,
    dto: AnnouncementReactDto,
    userId: string,
    orgId: string,
  ): Promise<IAnnouncement> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const announcement = await this.getAnnouncement(id, userId, orgId);

    const existingIdx = announcement.reactions.findIndex(
      (r) => r.userId === userId && r.emoji === dto.emoji,
    );
    if (existingIdx >= 0) {
      // Toggle off
      announcement.reactions.splice(existingIdx, 1);
    } else {
      announcement.reactions.push({ userId, emoji: dto.emoji });
    }
    return announcement.save();
  }

  async deleteAnnouncement(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<{ deleted: boolean }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const announcement = await this.getAnnouncement(id, userId, orgId);
    announcement.isDeleted = true;
    await announcement.save();
    return { deleted: true };
  }

  // ===========================================================================
  // Employee Engagement: Kudos / Recognition
  // ===========================================================================

  async giveKudos(
    dto: CreateKudosDto,
    userId: string,
    orgId: string,
  ): Promise<IKudos> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    if (!dto.toUserIds || dto.toUserIds.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }
    if (dto.toUserIds.includes(userId)) {
      throw new BadRequestException('Cannot give kudos to yourself');
    }

    const kudos = new this.kudosModel({
      organizationId: orgId,
      fromUserId: userId,
      toUserIds: dto.toUserIds,
      type: dto.type,
      message: dto.message,
      visibility: dto.visibility || 'public',
      points: 10,
      reactions: [],
      commentCount: 0,
      isDeleted: false,
    });

    return kudos.save();
  }

  async listKudos(
    query: KudosQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ items: IKudos[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      visibility: 'public',
    };
    if (query.fromUserId) filter.fromUserId = query.fromUserId;
    if (query.toUserId) filter.toUserIds = query.toUserId;
    if (query.type) filter.type = query.type;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.kudosModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.kudosModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getMyReceivedKudos(
    query: KudosQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ items: IKudos[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      toUserIds: userId,
    };
    if (query.type) filter.type = query.type;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.kudosModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.kudosModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getMyGivenKudos(
    query: KudosQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ items: IKudos[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = {
      organizationId: orgId,
      isDeleted: false,
      fromUserId: userId,
    };
    if (query.type) filter.type = query.type;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.kudosModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.kudosModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getKudosLeaderboard(
    userId: string,
    orgId: string,
    limit = 10,
  ): Promise<Array<{ userId: string; totalPoints: number; kudosCount: number }>> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const results = await this.kudosModel.aggregate([
      {
        $match: {
          organizationId: orgId,
          isDeleted: false,
          visibility: { $in: ['public', 'team'] },
        },
      },
      { $unwind: '$toUserIds' },
      {
        $group: {
          _id: '$toUserIds',
          totalPoints: { $sum: '$points' },
          kudosCount: { $sum: 1 },
        },
      },
      { $sort: { totalPoints: -1, kudosCount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          totalPoints: 1,
          kudosCount: 1,
        },
      },
    ]);

    return results;
  }

  async deleteKudos(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<{ deleted: boolean }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const kudos = await this.kudosModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!kudos) throw new NotFoundException('Kudos not found');
    if (kudos.fromUserId !== userId) {
      throw new ForbiddenException('Only the giver can delete kudos');
    }
    const ageMs = Date.now() - new Date((kudos as any).createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      throw new ForbiddenException('Kudos can only be deleted within 24 hours of giving');
    }
    kudos.isDeleted = true;
    await kudos.save();
    return { deleted: true };
  }

  // ===========================================================================
  // Employee Engagement: Surveys / Polls / eNPS
  // ===========================================================================

  async createSurvey(
    dto: CreateSurveyDto,
    userId: string,
    orgId: string,
  ): Promise<ISurvey> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    if (!dto.questions || dto.questions.length === 0) {
      throw new BadRequestException('Survey must have at least one question');
    }

    const survey = new this.surveyModel({
      organizationId: orgId,
      title: dto.title,
      description: dto.description || null,
      type: dto.type,
      status: 'draft',
      isAnonymous: dto.isAnonymous ?? false,
      targetAudience: dto.targetAudience || 'all',
      departments: dto.departments || [],
      designations: dto.designations || [],
      employeeIds: dto.employeeIds || [],
      questions: dto.questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options || [],
        required: q.required ?? true,
        minValue: q.minValue ?? null,
        maxValue: q.maxValue ?? null,
      })),
      startDate,
      endDate,
      allowComments: dto.allowComments ?? true,
      showResults: dto.showResults || 'after_close',
      stats: {
        totalInvited: 0,
        totalResponses: 0,
        responseRate: 0,
      },
      isDeleted: false,
      createdBy: userId,
    });

    return survey.save();
  }

  async listSurveys(
    query: SurveyQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ items: ISurvey[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = { organizationId: orgId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.surveyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.surveyModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getActiveSurveysForUser(
    userId: string,
    orgId: string,
  ): Promise<ISurvey[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const now = new Date();
    const surveys = await this.surveyModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .sort({ endDate: 1 });

    // Filter out surveys already responded to (non-anonymous)
    const result: ISurvey[] = [];
    for (const s of surveys) {
      if (s.isAnonymous) {
        result.push(s);
        continue;
      }
      const existing = await this.surveyResponseModel.findOne({
        organizationId: orgId,
        surveyId: (s as any)._id.toString(),
        employeeId: userId,
        isDeleted: false,
      });
      if (!existing) result.push(s);
    }
    return result;
  }

  async getSurvey(id: string, userId: string, orgId: string): Promise<ISurvey> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const survey = await this.surveyModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!survey) throw new NotFoundException('Survey not found');
    return survey;
  }

  async updateSurvey(
    id: string,
    dto: UpdateSurveyDto,
    userId: string,
    orgId: string,
  ): Promise<ISurvey> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const survey = await this.getSurvey(id, userId, orgId);

    if (survey.status !== 'draft') {
      throw new BadRequestException('Only draft surveys can be updated');
    }

    if (dto.title !== undefined) survey.title = dto.title;
    if (dto.description !== undefined) survey.description = dto.description;
    if (dto.type !== undefined) survey.type = dto.type;
    if (dto.questions !== undefined) {
      survey.questions = dto.questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options || [],
        required: q.required ?? true,
        minValue: q.minValue ?? null,
        maxValue: q.maxValue ?? null,
      })) as any;
    }
    if (dto.startDate !== undefined) survey.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) survey.endDate = new Date(dto.endDate);
    if (dto.targetAudience !== undefined) survey.targetAudience = dto.targetAudience;
    if (dto.departments !== undefined) survey.departments = dto.departments;
    if (dto.designations !== undefined) survey.designations = dto.designations;
    if (dto.employeeIds !== undefined) survey.employeeIds = dto.employeeIds;
    if (dto.isAnonymous !== undefined) survey.isAnonymous = dto.isAnonymous;
    if (dto.allowComments !== undefined) survey.allowComments = dto.allowComments;
    if (dto.showResults !== undefined) survey.showResults = dto.showResults;

    return survey.save();
  }

  async publishSurvey(id: string, userId: string, orgId: string): Promise<ISurvey> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const survey = await this.getSurvey(id, userId, orgId);
    if (survey.status !== 'draft') {
      throw new ConflictException(`Cannot publish survey in ${survey.status} status`);
    }
    survey.status = 'active';
    return survey.save();
  }

  async closeSurvey(id: string, userId: string, orgId: string): Promise<ISurvey> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const survey = await this.getSurvey(id, userId, orgId);
    if (survey.status === 'closed' || survey.status === 'archived') {
      throw new ConflictException('Survey already closed');
    }
    survey.status = 'closed';
    return survey.save();
  }

  async submitSurveyResponse(
    surveyId: string,
    dto: SubmitSurveyResponseDto,
    userId: string,
    orgId: string,
  ): Promise<ISurveyResponse> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const survey = await this.getSurvey(surveyId, userId, orgId);
    if (survey.status !== 'active') {
      throw new BadRequestException('Survey is not currently active');
    }
    const now = new Date();
    if (now > survey.endDate) {
      throw new BadRequestException('Survey has ended');
    }
    if (now < survey.startDate) {
      throw new BadRequestException('Survey has not started yet');
    }

    // Validate required questions answered
    const answerMap = new Map(dto.answers.map((a) => [a.questionId, a.answer]));
    for (const q of survey.questions) {
      if (q.required && (answerMap.get(q.id) === undefined || answerMap.get(q.id) === null || answerMap.get(q.id) === '')) {
        throw new BadRequestException(`Question "${q.question}" is required`);
      }
    }

    // B-H14: Dedupe ALL responses including anonymous ones, using a one-way
    // HMAC so admins still can't correlate the hash back to a user. The
    // secret scopes the hash so leaks of the DB don't let an attacker
    // precompute the mapping for every user in the org.
    const anonymousSecret =
      process.env.SURVEY_ANONYMOUS_SECRET || process.env.JWT_SECRET || 'nexora-survey-fallback';
    const anonymousHash = survey.isAnonymous
      ? crypto
          .createHmac('sha256', anonymousSecret)
          .update(`${surveyId}:${userId}`)
          .digest('hex')
      : null;

    if (survey.isAnonymous) {
      const existingAnon = await this.surveyResponseModel.findOne({
        organizationId: orgId,
        surveyId,
        anonymousHash,
        isDeleted: false,
      });
      if (existingAnon) {
        throw new ConflictException('You have already responded to this survey');
      }
    } else {
      const existing = await this.surveyResponseModel.findOne({
        organizationId: orgId,
        surveyId,
        employeeId: userId,
        isDeleted: false,
      });
      if (existing) {
        throw new ConflictException('You have already responded to this survey');
      }
    }

    const response = new this.surveyResponseModel({
      organizationId: orgId,
      surveyId,
      employeeId: survey.isAnonymous ? null : userId,
      anonymousHash,
      answers: dto.answers.map((a) => ({ questionId: a.questionId, answer: a.answer })),
      comment: dto.comment || null,
      submittedAt: new Date(),
      isDeleted: false,
    });

    const saved = await response.save();

    // Update survey stats
    const totalResponses = await this.surveyResponseModel.countDocuments({
      organizationId: orgId,
      surveyId,
      isDeleted: false,
    });

    const stats: any = {
      ...(survey.stats || {}),
      totalResponses,
      lastResponseAt: new Date(),
    };
    if (stats.totalInvited > 0) {
      stats.responseRate = Math.round((totalResponses / stats.totalInvited) * 100);
    }

    // Calculate eNPS score if applicable
    if (survey.type === 'enps') {
      const npsQuestion = survey.questions.find((q) => q.type === 'nps');
      if (npsQuestion) {
        const allResponses = await this.surveyResponseModel.find({
          organizationId: orgId,
          surveyId,
          isDeleted: false,
        });
        let promoters = 0;
        let detractors = 0;
        let total = 0;
        for (const r of allResponses) {
          const ans = (r.answers || []).find((a) => a.questionId === npsQuestion.id);
          if (ans && typeof ans.answer === 'number') {
            total++;
            if (ans.answer >= 9) promoters++;
            else if (ans.answer <= 6) detractors++;
          }
        }
        if (total > 0) {
          stats.enpsScore = Math.round(((promoters - detractors) / total) * 100);
        }
      }
    }

    // Calculate avg rating if applicable
    if (survey.type === 'pulse' || survey.type === 'engagement') {
      const ratingQuestions = survey.questions.filter((q) => q.type === 'rating' || q.type === 'scale');
      if (ratingQuestions.length > 0) {
        const allResponses = await this.surveyResponseModel.find({
          organizationId: orgId,
          surveyId,
          isDeleted: false,
        });
        let sum = 0;
        let count = 0;
        for (const r of allResponses) {
          for (const q of ratingQuestions) {
            const ans = (r.answers || []).find((a) => a.questionId === q.id);
            if (ans && typeof ans.answer === 'number') {
              sum += ans.answer;
              count++;
            }
          }
        }
        if (count > 0) stats.avgRating = Math.round((sum / count) * 100) / 100;
      }
    }

    await this.surveyModel.updateOne(
      { _id: surveyId, organizationId: orgId },
      { $set: { stats } },
    );

    return saved;
  }

  async getSurveyResults(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<any> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const survey = await this.getSurvey(id, userId, orgId);

    const responses = await this.surveyResponseModel.find({
      organizationId: orgId,
      surveyId: id,
      isDeleted: false,
    });

    const questionResults = survey.questions.map((q) => {
      const answers = responses
        .map((r) => (r.answers || []).find((a) => a.questionId === q.id)?.answer)
        .filter((a) => a !== undefined && a !== null);

      const result: any = {
        questionId: q.id,
        question: q.question,
        type: q.type,
        totalAnswers: answers.length,
      };

      if (q.type === 'single_choice' || q.type === 'yes_no') {
        const counts: Record<string, number> = {};
        for (const a of answers) {
          const key = String(a);
          counts[key] = (counts[key] || 0) + 1;
        }
        result.distribution = Object.entries(counts).map(([option, count]) => ({
          option,
          count,
          percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
        }));
      } else if (q.type === 'multi_choice') {
        const counts: Record<string, number> = {};
        for (const a of answers) {
          const arr = Array.isArray(a) ? a : [a];
          for (const v of arr) {
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
          }
        }
        result.distribution = Object.entries(counts).map(([option, count]) => ({
          option,
          count,
          percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
        }));
      } else if (q.type === 'rating' || q.type === 'scale' || q.type === 'nps') {
        const nums = answers.filter((a) => typeof a === 'number') as number[];
        if (nums.length > 0) {
          result.average = Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
          result.min = Math.min(...nums);
          result.max = Math.max(...nums);
          const dist: Record<string, number> = {};
          for (const n of nums) dist[String(n)] = (dist[String(n)] || 0) + 1;
          result.distribution = Object.entries(dist).map(([value, count]) => ({
            value: Number(value),
            count,
            percentage: Math.round((count / nums.length) * 100),
          }));
        }
        if (q.type === 'nps') {
          const promoters = nums.filter((n) => n >= 9).length;
          const passives = nums.filter((n) => n >= 7 && n <= 8).length;
          const detractors = nums.filter((n) => n <= 6).length;
          result.nps = {
            promoters,
            passives,
            detractors,
            score: nums.length > 0 ? Math.round(((promoters - detractors) / nums.length) * 100) : 0,
          };
        }
      } else if (q.type === 'text') {
        result.responses = answers.map((a) => String(a));
      }

      return result;
    });

    const comments = responses
      .filter((r) => r.comment)
      .map((r) => ({
        comment: r.comment,
        submittedAt: r.submittedAt,
        employeeId: survey.isAnonymous ? null : r.employeeId,
      }));

    return {
      surveyId: id,
      title: survey.title,
      type: survey.type,
      status: survey.status,
      isAnonymous: survey.isAnonymous,
      totalResponses: responses.length,
      stats: survey.stats,
      questionResults,
      comments,
    };
  }

  async getMySurveyResponse(
    surveyId: string,
    userId: string,
    orgId: string,
  ): Promise<ISurveyResponse | null> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const survey = await this.getSurvey(surveyId, userId, orgId);
    if (survey.isAnonymous) {
      throw new BadRequestException('Cannot retrieve responses for anonymous surveys');
    }
    return this.surveyResponseModel.findOne({
      organizationId: orgId,
      surveyId,
      employeeId: userId,
      isDeleted: false,
    });
  }

  // ===========================================================================
  // Learning Management System (LMS)
  // ===========================================================================

  async createCourse(
    dto: CreateCourseDto,
    userId: string,
    orgId: string,
  ): Promise<ICourse> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const lessons = (dto.lessons || []).map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type,
      content: l.content || null,
      videoUrl: l.videoUrl || null,
      duration: l.duration,
      order: l.order,
      isRequired: l.isRequired ?? true,
      resources: l.resources || [],
    }));

    const quiz = dto.quiz
      ? {
          passingScore: dto.quiz.passingScore ?? 70,
          questions: (dto.quiz.questions || []).map((q) => ({
            id: q.id,
            question: q.question,
            type: q.type,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            points: q.points ?? 1,
            explanation: q.explanation || null,
          })),
        }
      : null;

    const course = new this.courseModel({
      organizationId: orgId,
      title: dto.title,
      description: dto.description || '',
      thumbnail: dto.thumbnail || null,
      category: dto.category,
      level: dto.level || 'all',
      duration: dto.duration || 0,
      instructor: dto.instructor || null,
      tags: dto.tags || [],
      lessons,
      quiz,
      certificateTemplate: dto.certificateTemplate || null,
      prerequisites: dto.prerequisites || [],
      skillsGained: dto.skillsGained || [],
      targetAudience: dto.targetAudience || 'all',
      departments: dto.departments || [],
      designations: dto.designations || [],
      employeeIds: dto.employeeIds || [],
      isMandatory: dto.isMandatory ?? false,
      dueInDays: dto.dueInDays || null,
      status: 'draft',
      stats: {
        totalEnrolled: 0,
        totalCompleted: 0,
        avgRating: 0,
        ratingCount: 0,
        avgCompletionDays: 0,
      },
      isDeleted: false,
      createdBy: userId,
    });

    return course.save();
  }

  async listCourses(
    query: CourseQueryDto,
    userId: string,
    orgId: string,
    roles: string[] = [],
  ): Promise<{ items: ICourse[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = { organizationId: orgId, isDeleted: false };

    const isAdmin =
      roles.includes('admin') ||
      roles.includes('hr') ||
      roles.includes('super_admin');

    if (query.status) {
      filter.status = query.status;
    } else if (!isAdmin) {
      // Regular users only see published
      filter.status = 'published';
    }

    if (query.category) filter.category = query.category;
    if (query.level) filter.level = query.level;
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.courseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.courseModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getMandatoryCourses(userId: string, orgId: string): Promise<ICourse[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const courses = await this.courseModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        status: 'published',
        isMandatory: true,
      })
      .sort({ createdAt: -1 });

    return courses;
  }

  async getCourse(id: string, userId: string, orgId: string): Promise<ICourse> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const course = await this.courseModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(
    id: string,
    dto: UpdateCourseDto,
    userId: string,
    orgId: string,
  ): Promise<ICourse> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const course = await this.getCourse(id, userId, orgId);

    if (dto.title !== undefined) course.title = dto.title;
    if (dto.description !== undefined) course.description = dto.description;
    if (dto.thumbnail !== undefined) course.thumbnail = dto.thumbnail;
    if (dto.category !== undefined) course.category = dto.category;
    if (dto.level !== undefined) course.level = dto.level;
    if (dto.duration !== undefined) course.duration = dto.duration;
    if (dto.instructor !== undefined) course.instructor = dto.instructor;
    if (dto.tags !== undefined) course.tags = dto.tags;
    if (dto.lessons !== undefined) {
      course.lessons = dto.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        content: l.content || null,
        videoUrl: l.videoUrl || null,
        duration: l.duration,
        order: l.order,
        isRequired: l.isRequired ?? true,
        resources: l.resources || [],
      })) as any;
    }
    if (dto.quiz !== undefined) {
      course.quiz = {
        passingScore: dto.quiz.passingScore ?? 70,
        questions: (dto.quiz.questions || []).map((q) => ({
          id: q.id,
          question: q.question,
          type: q.type,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          points: q.points ?? 1,
          explanation: q.explanation || null,
        })),
      } as any;
    }
    if (dto.certificateTemplate !== undefined) course.certificateTemplate = dto.certificateTemplate;
    if (dto.prerequisites !== undefined) course.prerequisites = dto.prerequisites;
    if (dto.skillsGained !== undefined) course.skillsGained = dto.skillsGained;
    if (dto.targetAudience !== undefined) course.targetAudience = dto.targetAudience;
    if (dto.departments !== undefined) course.departments = dto.departments;
    if (dto.designations !== undefined) course.designations = dto.designations;
    if (dto.employeeIds !== undefined) course.employeeIds = dto.employeeIds;
    if (dto.isMandatory !== undefined) course.isMandatory = dto.isMandatory;
    if (dto.dueInDays !== undefined) course.dueInDays = dto.dueInDays;

    return course.save();
  }

  async publishCourse(id: string, userId: string, orgId: string): Promise<ICourse> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const course = await this.getCourse(id, userId, orgId);
    if (course.status === 'published') {
      throw new ConflictException('Course is already published');
    }
    if (!course.lessons || course.lessons.length === 0) {
      throw new BadRequestException('Course must have at least one lesson to publish');
    }
    course.status = 'published';
    return course.save();
  }

  async archiveCourse(id: string, userId: string, orgId: string): Promise<ICourse> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const course = await this.getCourse(id, userId, orgId);
    course.status = 'archived';
    return course.save();
  }

  async rateCourse(
    id: string,
    dto: RateCourseDto,
    userId: string,
    orgId: string,
  ): Promise<ICourse> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const course = await this.getCourse(id, userId, orgId);

    // Require enrollment & completed status to rate
    const enrollment = await this.enrollmentModel.findOne({
      organizationId: orgId,
      courseId: id,
      employeeId: userId,
      isDeleted: false,
    });
    if (!enrollment) {
      throw new BadRequestException('You must be enrolled in the course to rate it');
    }
    if (enrollment.status !== 'completed') {
      throw new BadRequestException('You must complete the course before rating');
    }

    const prevRating = enrollment.rating;
    enrollment.rating = dto.rating;
    enrollment.feedback = dto.feedback || null;
    await enrollment.save();

    const stats = course.stats || ({} as any);
    if (prevRating) {
      // Replace existing rating in running average
      const totalSum = stats.avgRating * stats.ratingCount - prevRating + dto.rating;
      stats.avgRating = stats.ratingCount > 0
        ? Math.round((totalSum / stats.ratingCount) * 100) / 100
        : dto.rating;
    } else {
      const newCount = (stats.ratingCount || 0) + 1;
      const newAvg = ((stats.avgRating || 0) * (stats.ratingCount || 0) + dto.rating) / newCount;
      stats.avgRating = Math.round(newAvg * 100) / 100;
      stats.ratingCount = newCount;
    }
    course.stats = stats;
    return course.save();
  }

  async deleteCourse(id: string, userId: string, orgId: string): Promise<{ deleted: boolean }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const course = await this.getCourse(id, userId, orgId);
    course.isDeleted = true;
    await course.save();
    return { deleted: true };
  }

  // ── Enrollments ──

  async enrollInCourse(
    dto: EnrollCourseDto,
    userId: string,
    orgId: string,
  ): Promise<IEnrollment> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const course = await this.getCourse(dto.courseId, userId, orgId);
    if (course.status !== 'published') {
      throw new BadRequestException('Cannot enroll in an unpublished course');
    }

    // Check if already enrolled
    const existing = await this.enrollmentModel.findOne({
      organizationId: orgId,
      courseId: dto.courseId,
      employeeId: userId,
      isDeleted: false,
    });
    if (existing) {
      throw new ConflictException('Already enrolled in this course');
    }

    const lessonProgress = (course.lessons || []).map((l) => ({
      lessonId: l.id,
      status: 'not_started',
      startedAt: null,
      completedAt: null,
      timeSpent: 0,
    }));

    const now = new Date();
    const dueDate = course.dueInDays
      ? new Date(now.getTime() + course.dueInDays * 24 * 60 * 60 * 1000)
      : null;

    const enrollment = new this.enrollmentModel({
      organizationId: orgId,
      courseId: dto.courseId,
      employeeId: userId,
      status: 'enrolled',
      enrolledAt: now,
      dueDate,
      progress: 0,
      lessonProgress,
      quizAttempts: [],
      notes: [],
      isDeleted: false,
    });

    const saved = await enrollment.save();

    // Increment course stats.totalEnrolled
    await this.courseModel.updateOne(
      { _id: dto.courseId, organizationId: orgId },
      { $inc: { 'stats.totalEnrolled': 1 } },
    );

    return saved;
  }

  async getMyEnrollments(
    query: EnrollmentQueryDto,
    userId: string,
    orgId: string,
  ): Promise<{ items: IEnrollment[]; total: number; page: number; limit: number }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = { organizationId: orgId, employeeId: userId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.courseId) filter.courseId = query.courseId;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.enrollmentModel.find(filter).sort({ enrolledAt: -1 }).skip(skip).limit(limit),
      this.enrollmentModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getMyActiveCourses(userId: string, orgId: string): Promise<IEnrollment[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.enrollmentModel
      .find({
        organizationId: orgId,
        employeeId: userId,
        isDeleted: false,
        status: { $in: ['enrolled', 'in_progress', 'overdue'] },
      })
      .sort({ enrolledAt: -1 });
  }

  async getCourseEnrollments(
    courseId: string,
    userId: string,
    orgId: string,
  ): Promise<IEnrollment[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.enrollmentModel
      .find({
        organizationId: orgId,
        courseId,
        isDeleted: false,
      })
      .sort({ enrolledAt: -1 });
  }

  async getEnrollment(id: string, userId: string, orgId: string): Promise<IEnrollment> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const enrollment = await this.enrollmentModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  async markCourseStarted(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<IEnrollment> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const enrollment = await this.getEnrollment(id, userId, orgId);
    if (enrollment.employeeId !== userId) {
      throw new ForbiddenException('Cannot modify another employee enrollment');
    }
    if (enrollment.status === 'enrolled') {
      enrollment.status = 'in_progress';
      enrollment.startedAt = new Date();
    }
    return enrollment.save();
  }

  async updateLessonProgress(
    id: string,
    dto: UpdateLessonProgressDto,
    userId: string,
    orgId: string,
  ): Promise<IEnrollment> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const enrollment = await this.getEnrollment(id, userId, orgId);
    if (enrollment.employeeId !== userId) {
      throw new ForbiddenException('Cannot modify another employee enrollment');
    }

    const course = await this.getCourse(enrollment.courseId, userId, orgId);
    const lesson = (course.lessons || []).find((l) => l.id === dto.lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found in course');
    }

    const now = new Date();
    let progressEntry = enrollment.lessonProgress.find((lp) => lp.lessonId === dto.lessonId);
    if (!progressEntry) {
      progressEntry = {
        lessonId: dto.lessonId,
        status: 'not_started',
        startedAt: null,
        completedAt: null,
        timeSpent: 0,
      } as any;
      enrollment.lessonProgress.push(progressEntry);
    }

    if (dto.status === 'in_progress' && progressEntry.status === 'not_started') {
      progressEntry.startedAt = now;
    }
    if (dto.status === 'completed') {
      progressEntry.completedAt = now;
      if (!progressEntry.startedAt) progressEntry.startedAt = now;
    }
    progressEntry.status = dto.status;
    if (dto.timeSpent !== undefined) {
      progressEntry.timeSpent = (progressEntry.timeSpent || 0) + dto.timeSpent;
    }
    enrollment.currentLessonId = dto.lessonId;

    if (enrollment.status === 'enrolled') {
      enrollment.status = 'in_progress';
      enrollment.startedAt = now;
    }

    // Calculate overall progress
    const totalLessons = (course.lessons || []).length;
    const completedLessons = enrollment.lessonProgress.filter(
      (lp) => lp.status === 'completed',
    ).length;
    enrollment.progress = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    // If 100% and no quiz, mark completed
    const hasQuiz = course.quiz && course.quiz.questions && course.quiz.questions.length > 0;
    if (enrollment.progress === 100 && !hasQuiz && enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = now;

      await this.courseModel.updateOne(
        { _id: course._id, organizationId: orgId },
        { $inc: { 'stats.totalCompleted': 1 } },
      );

      // Auto-issue certificate when no quiz
      const cert = await this.issueCertificate(enrollment, course, userId, orgId);
      enrollment.certificateId = (cert as any)._id.toString();
      enrollment.certificateUrl = `/certificates/${(cert as any)._id.toString()}`;
    }

    return enrollment.save();
  }

  async submitQuiz(
    id: string,
    dto: SubmitQuizDto,
    userId: string,
    orgId: string,
  ): Promise<IEnrollment> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const enrollment = await this.getEnrollment(id, userId, orgId);
    if (enrollment.employeeId !== userId) {
      throw new ForbiddenException('Cannot submit quiz for another employee');
    }

    const course = await this.getCourse(enrollment.courseId, userId, orgId);
    if (!course.quiz || !course.quiz.questions || course.quiz.questions.length === 0) {
      throw new BadRequestException('Course does not have a quiz');
    }

    if (enrollment.progress < 100) {
      throw new BadRequestException('Complete all lessons before submitting quiz');
    }

    // B-H11: Cap quiz attempts. Previously submitQuiz had no limit so the
    // learner could brute-force correct answers one question at a time.
    const maxAttempts = course.quiz.maxAttempts ?? 5;
    const priorAttempts = (enrollment.quizAttempts || []).length;
    if (priorAttempts >= maxAttempts) {
      throw new BadRequestException(
        `Maximum quiz attempts (${maxAttempts}) already reached`,
      );
    }
    // Once passed, the learner should not be able to re-submit to farm
    // certificates or stats.
    if ((enrollment.quizAttempts || []).some((a: any) => a.passed)) {
      throw new ConflictException('Quiz already passed — cannot re-submit');
    }

    const startedAt = new Date();
    let totalPoints = 0;
    let earnedPoints = 0;

    const gradedAnswers = course.quiz.questions.map((q) => {
      const submission = dto.answers.find((a) => a.questionId === q.id);
      totalPoints += q.points || 1;

      let isCorrect = false;
      if (submission) {
        if (q.type === 'multi_choice') {
          const submittedArr = Array.isArray(submission.answer)
            ? [...submission.answer].map(String).sort()
            : [];
          const correctArr = Array.isArray(q.correctAnswer)
            ? [...q.correctAnswer].map(String).sort()
            : [];
          isCorrect =
            submittedArr.length === correctArr.length &&
            submittedArr.every((v, i) => v === correctArr[i]);
        } else {
          isCorrect = String(submission.answer) === String(q.correctAnswer);
        }
      }

      if (isCorrect) earnedPoints += q.points || 1;

      return {
        questionId: q.id,
        answer: submission ? submission.answer : null,
        isCorrect,
      };
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passingScore = course.quiz.passingScore ?? 70;
    const passed = score >= passingScore;
    const completedAt = new Date();

    const attemptNumber = (enrollment.quizAttempts || []).length + 1;
    enrollment.quizAttempts.push({
      attemptNumber,
      score,
      passed,
      answers: gradedAnswers,
      startedAt,
      completedAt,
    } as any);

    if (passed && enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = completedAt;

      await this.courseModel.updateOne(
        { _id: course._id, organizationId: orgId },
        { $inc: { 'stats.totalCompleted': 1 } },
      );

      // Auto-issue certificate
      const cert = await this.issueCertificate(enrollment, course, userId, orgId, score);
      enrollment.certificateId = (cert as any)._id.toString();
      enrollment.certificateUrl = `/certificates/${(cert as any)._id.toString()}`;
    }

    return enrollment.save();
  }

  async dropCourse(id: string, userId: string, orgId: string): Promise<IEnrollment> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const enrollment = await this.getEnrollment(id, userId, orgId);
    if (enrollment.employeeId !== userId) {
      throw new ForbiddenException('Cannot drop enrollment for another employee');
    }
    if (enrollment.status === 'completed') {
      throw new BadRequestException('Cannot drop a completed course');
    }
    enrollment.status = 'dropped';
    return enrollment.save();
  }

  // ── Certificates ──

  private async generateCertificateNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CERT-${year}-`;

    // B-H12 / S-BH08: Atomic counter via the Counter collection. Each org/
    // year pair has its own document (`cert:<orgId>:<year>`). findOneAndUpdate
    // with $inc + upsert is a single MongoDB operation under an implicit
    // write lock, so concurrent callers receive strictly-increasing sequence
    // numbers with zero TOCTOU window.
    //
    // Legacy note: existing CERT-YYYY-NNNNNN records (pre-counter) may
    // already occupy some numbers. On first use per (org, year), we
    // initialize the counter to max(existing, 0) so we don't collide with
    // legacy certs. This one-time probe is non-racy because the subsequent
    // $inc is atomic: if two callers race the initialization, one will
    // set seq=N and the other's init is overridden by its own $inc which
    // returns seq=N+1, etc.
    const counterId = `cert:${orgId}:${year}`;

    // Initialize from legacy data if no counter exists yet.
    const existingCounter = await this.counterModel.findById(counterId).lean();
    if (!existingCounter) {
      const latestLegacy = await this.certificateModel
        .findOne({
          organizationId: orgId,
          certificateNumber: { $regex: `^${prefix}` },
        })
        .sort({ certificateNumber: -1 })
        .select('certificateNumber')
        .lean();
      let initialSeq = 0;
      if (latestLegacy?.certificateNumber) {
        const match = latestLegacy.certificateNumber.match(/(\d+)$/);
        if (match) initialSeq = parseInt(match[1], 10);
      }
      // upsert with $setOnInsert so if another caller has already created
      // the counter, we don't stomp on their value.
      await this.counterModel.updateOne(
        { _id: counterId },
        { $setOnInsert: { seq: initialSeq } },
        { upsert: true },
      );
    }

    const counter = await this.counterModel.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (!counter) {
      throw new ConflictException('Failed to allocate certificate number');
    }
    return `${prefix}${String(counter.seq).padStart(6, '0')}`;
  }

  private generateVerificationCode(): string {
    // B-H13: Math.random is NOT a CSPRNG — predictable verification codes
    // let an attacker enumerate certificates. Use crypto.randomInt for a
    // uniform, unbiased pick per character.
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars, ambiguity-safe
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return code;
  }

  private async issueCertificate(
    enrollment: IEnrollment,
    course: ICourse,
    userId: string,
    orgId: string,
    score?: number,
  ): Promise<ICertificate> {
    let employeeName = userId;
    try {
      const emp = await this.externalServices.getEmployee(enrollment.employeeId);
      if (emp) {
        employeeName =
          emp.fullName ||
          [emp.firstName, emp.lastName].filter(Boolean).join(' ') ||
          emp.name ||
          userId;
      }
    } catch (err) {
      this.logger.warn(`Unable to fetch employee for certificate: ${err}`);
    }

    const completionDays = enrollment.startedAt
      ? Math.ceil(
          (new Date().getTime() - new Date(enrollment.startedAt).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : 0;

    // S-BH08 belt-and-braces: even with the atomic counter, if a legacy
    // record happens to collide on certificateNumber we retry end-to-end
    // (new number + new verification code). 5 attempts is plenty since the
    // counter is already race-safe.
    let saved: ICertificate | null = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const certificateNumber = await this.generateCertificateNumber(orgId);
      const verificationCode = this.generateVerificationCode();
      const cert = new this.certificateModel({
        organizationId: orgId,
        employeeId: enrollment.employeeId,
        courseId: enrollment.courseId,
        enrollmentId: (enrollment as any)._id.toString(),
        certificateNumber,
        courseName: course.title,
        employeeName,
        issuedAt: new Date(),
        score: score ?? null,
        completionDays,
        verificationCode,
        issuedBy: userId,
        isRevoked: false,
        downloadCount: 0,
        isDeleted: false,
      });
      try {
        saved = await cert.save();
        break;
      } catch (err: any) {
        lastErr = err;
        // E11000 duplicate key — retry with fresh number.
        if (err?.code === 11000) {
          this.logger.warn(
            `Certificate collision on attempt ${attempt + 1} (${certificateNumber}); retrying`,
          );
          continue;
        }
        throw err;
      }
    }
    if (!saved) {
      throw new ConflictException(
        `Failed to issue certificate after 5 attempts: ${lastErr?.message || 'unknown'}`,
      );
    }

    // Update course avg completion days running average
    const stats = course.stats || ({} as any);
    const prevCompleted = stats.totalCompleted || 1;
    const prevAvgDays = stats.avgCompletionDays || 0;
    const newAvgDays =
      prevCompleted > 1
        ? Math.round(
            ((prevAvgDays * (prevCompleted - 1) + completionDays) / prevCompleted) * 10,
          ) / 10
        : completionDays;
    await this.courseModel.updateOne(
      { _id: course._id, organizationId: orgId },
      { $set: { 'stats.avgCompletionDays': newAvgDays } },
    );

    return saved;
  }

  async getMyCertificates(userId: string, orgId: string): Promise<ICertificate[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.certificateModel
      .find({
        organizationId: orgId,
        employeeId: userId,
        isDeleted: false,
      })
      .sort({ issuedAt: -1 });
  }

  async getCertificate(id: string, userId: string, orgId: string): Promise<ICertificate> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cert = await this.certificateModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  async incrementCertificateDownload(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ICertificate> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cert = await this.getCertificate(id, userId, orgId);
    cert.downloadCount = (cert.downloadCount || 0) + 1;
    return cert.save();
  }

  async verifyCertificate(code: string): Promise<any> {
    if (!code) throw new BadRequestException('Verification code required');
    const cert = await this.certificateModel.findOne({
      verificationCode: code,
      isDeleted: false,
    });
    if (!cert) {
      return { valid: false, message: 'Certificate not found' };
    }
    if (cert.isRevoked) {
      return {
        valid: false,
        message: 'Certificate has been revoked',
        revokedAt: cert.revokedAt,
        revokedReason: cert.revokedReason,
      };
    }
    return {
      valid: true,
      certificateNumber: cert.certificateNumber,
      courseName: cert.courseName,
      employeeName: cert.employeeName,
      issuedAt: cert.issuedAt,
      validUntil: cert.validUntil,
      score: cert.score,
    };
  }

  async revokeCertificate(
    id: string,
    reason: string,
    userId: string,
    orgId: string,
  ): Promise<ICertificate> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const cert = await this.getCertificate(id, userId, orgId);
    if (cert.isRevoked) {
      throw new ConflictException('Certificate is already revoked');
    }
    cert.isRevoked = true;
    cert.revokedAt = new Date();
    cert.revokedReason = reason || null;
    return cert.save();
  }

  // ── Learning Paths ──

  async createLearningPath(
    dto: CreateLearningPathDto,
    userId: string,
    orgId: string,
  ): Promise<ILearningPath> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    if (!dto.courses || dto.courses.length === 0) {
      throw new BadRequestException('Learning path must have at least one course');
    }

    const path = new this.learningPathModel({
      organizationId: orgId,
      name: dto.name,
      description: dto.description || '',
      category: dto.category || '',
      courses: dto.courses.map((c) => ({
        courseId: c.courseId,
        order: c.order,
        isRequired: c.isRequired ?? true,
      })),
      targetAudience: dto.targetAudience || 'all',
      departments: dto.departments || [],
      designations: dto.designations || [],
      estimatedDurationDays: dto.estimatedDurationDays || 0,
      isMandatory: dto.isMandatory ?? false,
      status: 'draft',
      isDeleted: false,
      createdBy: userId,
    });

    return path.save();
  }

  async listLearningPaths(
    userId: string,
    orgId: string,
    roles: string[] = [],
  ): Promise<ILearningPath[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const filter: any = { organizationId: orgId, isDeleted: false };
    const isAdmin =
      roles.includes('admin') ||
      roles.includes('hr') ||
      roles.includes('super_admin');
    if (!isAdmin) {
      filter.status = 'published';
    }

    return this.learningPathModel.find(filter).sort({ createdAt: -1 });
  }

  async getLearningPath(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<ILearningPath> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const path = await this.learningPathModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!path) throw new NotFoundException('Learning path not found');
    return path;
  }

  async updateLearningPath(
    id: string,
    dto: UpdateLearningPathDto,
    userId: string,
    orgId: string,
  ): Promise<ILearningPath> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const path = await this.getLearningPath(id, userId, orgId);

    if (dto.name !== undefined) path.name = dto.name;
    if (dto.description !== undefined) path.description = dto.description;
    if (dto.category !== undefined) path.category = dto.category;
    if (dto.courses !== undefined) {
      path.courses = dto.courses.map((c) => ({
        courseId: c.courseId,
        order: c.order,
        isRequired: c.isRequired ?? true,
      })) as any;
    }
    if (dto.targetAudience !== undefined) path.targetAudience = dto.targetAudience;
    if (dto.departments !== undefined) path.departments = dto.departments;
    if (dto.designations !== undefined) path.designations = dto.designations;
    if (dto.estimatedDurationDays !== undefined) path.estimatedDurationDays = dto.estimatedDurationDays;
    if (dto.isMandatory !== undefined) path.isMandatory = dto.isMandatory;
    if (dto.status !== undefined) path.status = dto.status;

    return path.save();
  }

  async deleteLearningPath(
    id: string,
    userId: string,
    orgId: string,
  ): Promise<{ deleted: boolean }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const path = await this.getLearningPath(id, userId, orgId);
    path.isDeleted = true;
    await path.save();
    return { deleted: true };
  }
}
