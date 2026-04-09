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
import { PayrollCalculationService } from './payroll-calculation.service';
import { ExternalServicesService } from './external-services.service';
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
    private calculationService: PayrollCalculationService,
    private externalServices: ExternalServicesService,
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
      checklist: checklist as any,
      documents: this.getDefaultOnboardingDocuments() as any,
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
      clearance: this.getDefaultClearanceDepartments() as any,
      exitInterview: {
        conducted: false,
      } as any,
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
      } as any,
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
    } as any;

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
    } as any;

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
      .limit(3);

    const totalPayrollCost = latestRuns.length > 0
      ? (latestRuns[0] as any).summary?.totalNetPay || 0
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
      .sort({ 'payPeriod.year': 1, 'payPeriod.month': 1 });

    const monthlyCosts = runs.map((r) => ({
      month: (r as any).payPeriod.month,
      year: (r as any).payPeriod.year,
      totalPayroll: (r as any).summary?.totalNetPay || 0,
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
      .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 });

    const totalPayroll = (latestRun as any)?.summary?.totalNetPay || 0;
    const avgCostPerEmployee = activeCount > 0 ? totalPayroll / activeCount : 0;

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
      departmentBreakdown: [],
      attritionData: {
        monthlyRate: activeCount > 0 ? (offboardingCount / activeCount) * 100 : 0,
        annualizedRate: (() => {
          const mRate = activeCount > 0 ? offboardingCount / activeCount : 0;
          return Math.round((1 - Math.pow(1 - mRate, 12)) * 10000) / 100;
        })(),
        voluntaryExits: 0,
        involuntaryExits: 0,
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
      attritionPredictions: [],
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
    candidate.stageHistory.push({ stage: nextStage.stageName, enteredAt: now } as any);

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
    } as any);

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
    } as any;

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
    } as any;

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
}
