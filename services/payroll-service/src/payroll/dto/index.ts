import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, Min, Max, IsBoolean, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

// ── Salary Component DTO ──

export class SalaryComponentDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(['earning', 'deduction', 'employer_contribution', 'reimbursement'])
  type: string;

  @IsEnum(['fixed', 'percentage_basic', 'percentage_ctc', 'percentage_gross'])
  calculationMethod: string;

  @IsNumber() @Min(0)
  annualAmount: number;

  @IsOptional() @IsNumber()
  percentage?: number;

  @IsBoolean()
  isTaxable: boolean;

  @IsOptional() @IsNumber()
  taxExemptionLimit?: number;

  @IsBoolean()
  isPFApplicable: boolean;

  @IsBoolean()
  isESIApplicable: boolean;

  @IsOptional() @IsBoolean()
  showInPayslip?: boolean;

  @IsOptional() @IsNumber()
  order?: number;
}

// ── Create Salary Structure DTO ──

export class CreateSalaryStructureDto {
  @IsString()
  employeeId: string;

  @IsString()
  structureName: string;

  @IsDateString()
  effectiveFrom: string;

  @IsNumber() @Min(0)
  ctc: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components?: SalaryComponentDto[];
}

// ── Update Salary Structure DTO ──

export class UpdateSalaryStructureDto {
  @IsOptional() @IsString()
  employeeId?: string;

  @IsOptional() @IsString()
  structureName?: string;

  @IsOptional() @IsDateString()
  effectiveFrom?: string;

  @IsOptional() @IsNumber() @Min(0)
  ctc?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components?: SalaryComponentDto[];
}

// ── Simulate CTC DTO ──

export class SimulateCTCDto {
  @IsNumber() @Min(0)
  ctc: number;

  @IsOptional() @IsString()
  employeeId?: string;
}

// ── Initiate Payroll Run DTO ──

export class InitiatePayrollRunDto {
  @IsNumber() @Min(1) @Max(12)
  month: number;

  @IsNumber() @Min(2020)
  year: number;
}

// ── Update Payroll Status DTO ──

export class UpdatePayrollStatusDto {
  @IsEnum(['review', 'approved', 'finalized', 'paid', 'cancelled', 'draft'])
  status: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  paymentReference?: string;
}

// ── Ad Hoc Item DTO ──

export class AdHocItemDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber() @Min(0)
  amount: number;

  @IsOptional() @IsBoolean()
  isTaxable?: boolean;

  @IsOptional() @IsString()
  description?: string;
}

// ── Override Entry DTO ──

export class OverrideEntryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdHocItemDto)
  additionalEarnings?: AdHocItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdHocItemDto)
  additionalDeductions?: AdHocItemDto[];

  @IsOptional() @IsString()
  notes?: string;
}

// ── Hold Entry DTO ──

export class HoldEntryDto {
  @IsString()
  reason: string;
}

// ── Investment Item DTO ──

export class InvestmentItemDto {
  @IsString()
  description: string;

  @IsNumber() @Min(0)
  declaredAmount: number;

  @IsOptional() @IsString()
  proofUrl?: string;
}

// ── Investment Section DTO ──

export class InvestmentSectionDto {
  @IsString()
  section: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvestmentItemDto)
  items: InvestmentItemDto[];
}

// ── Submit Investment Declaration DTO ──

export class SubmitInvestmentDeclarationDto {
  @IsString()
  financialYear: string;

  @IsEnum(['old', 'new'])
  regime: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvestmentSectionDto)
  sections: InvestmentSectionDto[];
}

// ── Payroll Query DTO ──

export class PayrollQueryDto {
  @IsOptional() @IsEnum(['draft', 'processing', 'review', 'approved', 'finalized', 'paid', 'cancelled'])
  status?: string;

  @IsOptional() @IsNumber() @Min(2020)
  year?: number;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}

// ── Payslip Query DTO ──

export class PayslipQueryDto {
  @IsOptional() @IsNumber()
  year?: number;

  @IsOptional() @IsNumber()
  month?: number;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}

// ── Expense Item DTO ──

export class ExpenseItemDto {
  @IsString()
  description: string;

  @IsNumber() @Min(0)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional() @IsString()
  receiptUrl?: string;

  @IsOptional() @IsString()
  merchant?: string;
}

// ── Create Expense Claim DTO ──

export class CreateExpenseClaimDto {
  @IsString()
  title: string;

  @IsEnum(['travel', 'food', 'medical', 'internet', 'phone', 'office_supplies', 'training', 'client_entertainment', 'other'])
  category: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemDto)
  items: ExpenseItemDto[];
}

// ── Update Expense Claim DTO ──

export class UpdateExpenseClaimDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsEnum(['travel', 'food', 'medical', 'internet', 'phone', 'office_supplies', 'training', 'client_entertainment', 'other'])
  category?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemDto)
  items?: ExpenseItemDto[];
}

// ── Approve Expense DTO ──

export class ApproveExpenseDto {
  @IsEnum(['approved', 'rejected'])
  status: string;

  @IsOptional() @IsString()
  remarks?: string;
}

// ── Expense Query DTO ──

export class ExpenseQueryDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  employeeId?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}

// ── Onboarding DTOs ──

export class OnboardingChecklistItemDto {
  @IsString() title: string;
  @IsEnum(['documents', 'it_setup', 'training', 'compliance', 'welcome', 'other']) category: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class InitiateOnboardingDto {
  @IsString() employeeId: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() targetCompletionDate?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OnboardingChecklistItemDto) checklist?: OnboardingChecklistItemDto[];
  @IsOptional() @IsString() buddyId?: string;
  @IsOptional() @IsDateString() probationEndDate?: string;
}

export class CompleteChecklistItemDto {
  @IsString() taskId: string;
  @IsOptional() @IsString() notes?: string;
}

export class VerifyDocumentDto {
  @IsEnum(['verified', 'rejected']) status: string;
  @IsOptional() @IsString() rejectionReason?: string;
}

// ── Offboarding DTOs ──

export class InitiateOffboardingDto {
  @IsString() employeeId: string;
  @IsEnum(['resignation', 'termination', 'retirement', 'contract_end', 'mutual_separation']) type: string;
  @IsDateString() resignationDate: string;
  @IsDateString() lastWorkingDate: string;
  @IsOptional() @IsNumber() noticePeriodDays?: number;
  @IsOptional() @IsBoolean() noticePeriodWaived?: boolean;
}

export class ClearanceDepartmentDto {
  @IsString() department: string;
  @IsOptional() @IsString() approver?: string;
}

export class UpdateClearanceDto {
  @IsString() department: string;
  @IsEnum(['cleared', 'issues_found']) status: string;
  @IsOptional() @IsString() remarks?: string;
}

export class ExitInterviewDto {
  @IsOptional() @IsNumber() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsString() feedback?: string;
  @IsOptional() @IsString() reasonForLeaving?: string;
  @IsOptional() @IsBoolean() wouldRecommend?: boolean;
}

export class ApproveFnFDto {
  @IsOptional() @IsString() notes?: string;
}

// ── Analytics ──

export class AnalyticsQueryDto {
  @IsOptional() @IsNumber() year?: number;
  @IsOptional() @IsNumber() month?: number;
  @IsOptional() @IsString() department?: string;
}

// ── Employee Loans DTOs ──

export class ApplyLoanDto {
  @IsEnum(['salary_advance', 'personal_loan', 'emergency_loan', 'festival_advance'])
  type: string;

  @IsNumber() @Min(100)
  amount: number;

  @IsNumber() @Min(1) @Max(60)
  tenure: number;

  @IsString()
  reason: string;

  @IsOptional() @IsNumber() @Min(0)
  interestRate?: number;
}

export class ApproveLoanDto {
  @IsEnum(['approved', 'rejected'])
  status: string;

  @IsOptional() @IsString()
  comments?: string;
}

export class LoanQueryDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  employeeId?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}

// ── Recruitment DTOs ──

export class CreateJobPostingDto {
  @IsString() title: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsString() location: string;
  @IsEnum(['full_time', 'part_time', 'contract', 'intern']) employmentType: string;
  @IsString() description: string;
  @IsOptional() @IsArray() requirements?: string[];
  @IsOptional() @IsArray() skills?: string[];
  @IsOptional() @IsNumber() openings?: number;
  @IsString() hiringManagerId: string;
}

export class UpdateJobPostingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() requirements?: string[];
  @IsOptional() @IsArray() skills?: string[];
  @IsOptional() @IsNumber() openings?: number;
}

export class UpdateJobStatusDto {
  @IsEnum(['open', 'on_hold', 'closed', 'cancelled']) status: string;
}

export class AddCandidateDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() resumeUrl?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsEnum(['portal', 'referral', 'linkedin', 'naukri', 'agency', 'direct', 'other']) source?: string;
  @IsOptional() @IsString() referredBy?: string;
}

export class ScheduleInterviewDto {
  @IsNumber() round: number;
  @IsEnum(['phone', 'video', 'onsite', 'panel', 'technical']) type: string;
  @IsDateString() scheduledAt: string;
  @IsArray() @IsString({ each: true }) interviewerIds: string[];
}

export class InterviewFeedbackDto {
  @IsNumber() @Min(1) @Max(5) rating: number;
  @IsString() strengths: string;
  @IsString() weaknesses: string;
  @IsEnum(['strong_hire', 'hire', 'no_hire', 'strong_no_hire']) recommendation: string;
}

export class CreateOfferDto {
  @IsNumber() @Min(0) ctc: number;
  @IsDateString() joiningDate: string;
  @IsString() designation: string;
}

export class RejectCandidateDto {
  @IsString() reason: string;
}

export class JobQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class CandidateQueryDto {
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}
