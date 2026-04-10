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

// ── AI Resume Parsing & Smart Match DTOs ──

export class ParseResumeDto {
  @IsString() resumeText: string; // raw text or URL
  @IsOptional() @IsString() jobPostingId?: string; // for auto-match scoring
}

export class SmartMatchDto {
  @IsString() jobPostingId: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minScore?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class ParseAndCreateCandidateDto {
  @IsString() jobPostingId: string;
  @IsString() resumeText: string;
  @IsEmail() email: string;
}

// ── Missing DTOs for raw @Body() parameters ──

export class RejectSalaryStructureDto {
  @IsOptional() @IsString() reason?: string;
}

export class VerifyInvestmentDto {
  @IsBoolean() verified: boolean;
  @IsOptional() @IsString() remarks?: string;
}

export class UploadDocumentDto {
  @IsString() url: string;
}

export class UpdateOnboardingStatusDto {
  @IsEnum(['pending', 'in_progress', 'completed', 'cancelled']) status: string;
}

export class UpdateOffboardingStatusDto {
  @IsEnum(['initiated', 'notice_period', 'clearance', 'fnf_processing', 'fnf_approved', 'completed', 'cancelled']) status: string;
}

export class OnboardingQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class OffboardingQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

// ── Statutory Reports ──

export class GenerateForm16Dto {
  @IsString() employeeId: string;
  @IsString() financialYear: string; // "2025-2026"
}

export class GeneratePFECRDto {
  @IsNumber() @Min(1) @Max(12) month: number;
  @IsNumber() @Min(2020) year: number;
}

export class GenerateESIReturnDto {
  @IsNumber() @Min(1) @Max(12) month: number;
  @IsNumber() @Min(2020) year: number;
}

export class GenerateTDSQuarterlyDto {
  @IsNumber() @Min(1) @Max(4) quarter: number;
  @IsNumber() @Min(2020) year: number;
}

export class StatutoryReportQueryDto {
  @IsOptional() @IsString() reportType?: string;
  @IsOptional() @IsString() financialYear?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

// ── Performance Management ──

export class KeyResultDto {
  @IsString() title: string;
  @IsOptional() @IsString() metric?: string;
  @IsNumber() targetValue: number;
  @IsOptional() @IsNumber() currentValue?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsEnum(['not_started', 'in_progress', 'achieved', 'missed']) status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateGoalDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['individual', 'team', 'company', 'okr']) type?: string;
  @IsOptional() @IsEnum(['performance', 'learning', 'behavior', 'project', 'revenue', 'quality']) category?: string;
  @IsOptional() @IsEnum(['low', 'medium', 'high', 'critical']) priority?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) weightage?: number;
  @IsDateString() startDate: string;
  @IsDateString() targetDate: string;
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() parentGoalId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => KeyResultDto)
  keyResults?: KeyResultDto[];
  @IsOptional() @IsArray() alignedGoals?: string[];
  @IsOptional() @IsArray() tags?: string[];
}

export class UpdateGoalDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['individual', 'team', 'company', 'okr']) type?: string;
  @IsOptional() @IsEnum(['performance', 'learning', 'behavior', 'project', 'revenue', 'quality']) category?: string;
  @IsOptional() @IsEnum(['draft', 'active', 'achieved', 'missed', 'cancelled', 'deferred']) status?: string;
  @IsOptional() @IsEnum(['low', 'medium', 'high', 'critical']) priority?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) weightage?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => KeyResultDto)
  keyResults?: KeyResultDto[];
  @IsOptional() @IsArray() alignedGoals?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() selfAssessment?: string;
}

export class GoalCheckInDto {
  @IsNumber() @Min(0) @Max(100) progress: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => KeyResultDto)
  keyResults?: KeyResultDto[];
}

export class RateGoalDto {
  @IsOptional() @IsNumber() @Min(1) @Max(5) managerRating?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) selfRating?: number;
  @IsOptional() @IsString() comment?: string;
}

export class GoalQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class RatingGuideEntryDto {
  @IsNumber() rating: number;
  @IsString() label: string;
  @IsOptional() @IsString() description?: string;
}

export class CompetencyDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() weightage?: number;
}

export class ReviewCycleConfigDto {
  @IsOptional() @IsBoolean() enableSelfReview?: boolean;
  @IsOptional() @IsBoolean() enablePeerReview?: boolean;
  @IsOptional() @IsBoolean() enableManagerReview?: boolean;
  @IsOptional() @IsBoolean() enable360?: boolean;
  @IsOptional() @IsNumber() minPeerReviewers?: number;
  @IsOptional() @IsNumber() maxPeerReviewers?: number;
  @IsOptional() @IsNumber() ratingScale?: number;
  @IsOptional() @IsBoolean() enableCalibration?: boolean;
  @IsOptional() @IsBoolean() allowGoalRevisions?: boolean;
}

export class CreateReviewCycleDto {
  @IsString() name: string;
  @IsOptional() @IsEnum(['annual', 'half_yearly', 'quarterly', 'monthly', 'continuous', 'adhoc']) type?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsDateString() goalSettingDeadline?: string;
  @IsOptional() @IsDateString() selfReviewDeadline?: string;
  @IsOptional() @IsDateString() peerReviewDeadline?: string;
  @IsOptional() @IsDateString() managerReviewDeadline?: string;
  @IsOptional() @IsDateString() completionDeadline?: string;
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) applicableTo?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @ValidateNested() @Type(() => ReviewCycleConfigDto) config?: ReviewCycleConfigDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RatingGuideEntryDto)
  ratingGuide?: RatingGuideEntryDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompetencyDto)
  competencies?: CompetencyDto[];
}

export class UpdateReviewCycleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(['annual', 'half_yearly', 'quarterly', 'monthly', 'continuous', 'adhoc']) type?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsDateString() goalSettingDeadline?: string;
  @IsOptional() @IsDateString() selfReviewDeadline?: string;
  @IsOptional() @IsDateString() peerReviewDeadline?: string;
  @IsOptional() @IsDateString() managerReviewDeadline?: string;
  @IsOptional() @IsDateString() completionDeadline?: string;
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) applicableTo?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @ValidateNested() @Type(() => ReviewCycleConfigDto) config?: ReviewCycleConfigDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RatingGuideEntryDto)
  ratingGuide?: RatingGuideEntryDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompetencyDto)
  competencies?: CompetencyDto[];
}

export class StartReviewCycleDto {
  @IsOptional() @IsArray() employeeIds?: string[];
}

export class UpdateCycleStatusDto {
  @IsEnum([
    'draft',
    'goal_setting',
    'self_review',
    'peer_review',
    'manager_review',
    'calibration',
    'completed',
    'cancelled',
  ])
  status: string;
}

export class ReviewCycleQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() year?: number;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class CompetencyRatingDto {
  @IsString() name: string;
  @IsNumber() rating: number;
  @IsOptional() @IsString() comment?: string;
}

export class SubmitSelfReviewDto {
  @IsNumber() @Min(1) @Max(5) overallRating: number;
  @IsOptional() @IsString() strengths?: string;
  @IsOptional() @IsString() improvements?: string;
  @IsOptional() @IsString() achievements?: string;
  @IsOptional() @IsString() challenges?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompetencyRatingDto)
  competencyRatings?: CompetencyRatingDto[];
}

export class SubmitPeerReviewDto {
  @IsEnum(['peer', 'cross_functional', 'skip_level', 'subordinate']) relationship: string;
  @IsNumber() @Min(1) @Max(5) overallRating: number;
  @IsOptional() @IsString() strengths?: string;
  @IsOptional() @IsString() improvements?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompetencyRatingDto)
  competencyRatings?: CompetencyRatingDto[];
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
}

export class SubmitManagerReviewDto {
  @IsNumber() @Min(1) @Max(5) overallRating: number;
  @IsOptional() @IsString() strengths?: string;
  @IsOptional() @IsString() improvements?: string;
  @IsOptional() @IsString() goalAchievement?: string;
  @IsOptional() @IsString() developmentPlan?: string;
  @IsOptional() @IsEnum(['yes', 'no', 'consider_next_cycle']) promotionRecommendation?: string;
  @IsOptional() @IsEnum(['no_change', 'small', 'medium', 'large']) salaryIncreaseRecommendation?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompetencyRatingDto)
  competencyRatings?: CompetencyRatingDto[];
}

export class FinalizeReviewDto {
  @IsNumber() @Min(1) @Max(5) finalRating: number;
  @IsOptional() @IsString() finalLabel?: string;
  @IsOptional() @IsString() calibrationNotes?: string;
}

// ===========================================================================
// Employee Engagement: Announcements
// ===========================================================================

export class AnnouncementAttachmentDto {
  @IsString() name: string;
  @IsString() url: string;
  @IsString() type: string;
}

export class CreateAnnouncementDto {
  @IsString() title: string;
  @IsString() content: string;
  @IsOptional() @IsEnum(['general', 'policy', 'event', 'celebration', 'company_update', 'urgent'])
  category?: string;
  @IsOptional() @IsEnum(['low', 'normal', 'high', 'critical']) priority?: string;
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AnnouncementAttachmentDto)
  attachments?: AnnouncementAttachmentDto[];
}

export class UpdateAnnouncementDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsEnum(['general', 'policy', 'event', 'celebration', 'company_update', 'urgent'])
  category?: string;
  @IsOptional() @IsEnum(['low', 'normal', 'high', 'critical']) priority?: string;
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AnnouncementAttachmentDto)
  attachments?: AnnouncementAttachmentDto[];
}

export class AnnouncementQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class AnnouncementReactDto {
  @IsString() emoji: string;
}

export class AnnouncementReadDto {}

// ===========================================================================
// Employee Engagement: Kudos
// ===========================================================================

export class CreateKudosDto {
  @IsArray() toUserIds: string[];
  @IsEnum([
    'teamwork',
    'innovation',
    'leadership',
    'customer_first',
    'above_and_beyond',
    'problem_solving',
    'mentorship',
    'reliability',
    'positivity',
    'learning',
  ])
  type: string;
  @IsString() message: string;
  @IsOptional() @IsEnum(['public', 'team', 'private']) visibility?: string;
}

export class KudosQueryDto {
  @IsOptional() @IsString() fromUserId?: string;
  @IsOptional() @IsString() toUserId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

// ===========================================================================
// Employee Engagement: Surveys
// ===========================================================================

export class SurveyQuestionDto {
  @IsString() id: string;
  @IsEnum(['single_choice', 'multi_choice', 'rating', 'nps', 'text', 'yes_no', 'scale'])
  type: string;
  @IsString() question: string;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsNumber() minValue?: number;
  @IsOptional() @IsNumber() maxValue?: number;
}

export class CreateSurveyDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(['poll', 'pulse', 'enps', '360_feedback', 'exit', 'engagement', 'custom'])
  type: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyQuestionDto)
  questions: SurveyQuestionDto[];
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
  @IsOptional() @IsBoolean() allowComments?: boolean;
  @IsOptional() @IsEnum(['never', 'after_submit', 'after_close', 'always']) showResults?: string;
}

export class UpdateSurveyDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['poll', 'pulse', 'enps', '360_feedback', 'exit', 'engagement', 'custom'])
  type?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyQuestionDto)
  questions?: SurveyQuestionDto[];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
  @IsOptional() @IsBoolean() allowComments?: boolean;
  @IsOptional() @IsEnum(['never', 'after_submit', 'after_close', 'always']) showResults?: string;
}

export class SurveyAnswerDto {
  @IsString() questionId: string;
  answer: any;
}

export class SubmitSurveyResponseDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyAnswerDto)
  answers: SurveyAnswerDto[];
  @IsOptional() @IsString() comment?: string;
}

export class SurveyQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

// ===========================================================================
// Learning Management System (LMS)
// ===========================================================================

export class CourseLessonResourceDto {
  @IsString() title: string;
  @IsString() url: string;
  @IsString() type: string;
}

export class CourseLessonDto {
  @IsString() id: string;
  @IsString() title: string;
  @IsEnum(['video', 'article', 'quiz', 'assignment', 'live_session', 'document'])
  type: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsNumber() @Min(0) duration: number;
  @IsNumber() @Min(0) order: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CourseLessonResourceDto)
  resources?: CourseLessonResourceDto[];
}

export class CourseQuizQuestionDto {
  @IsString() id: string;
  @IsString() question: string;
  @IsEnum(['single_choice', 'multi_choice', 'true_false']) type: string;
  @IsOptional() @IsArray() options?: string[];
  correctAnswer: any;
  @IsOptional() @IsNumber() points?: number;
  @IsOptional() @IsString() explanation?: string;
}

export class CourseQuizDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) passingScore?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CourseQuizQuestionDto)
  questions: CourseQuizQuestionDto[];
}

export class CreateCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsEnum([
    'technical',
    'soft_skills',
    'compliance',
    'leadership',
    'onboarding',
    'product',
    'sales',
    'customer_service',
    'other',
  ])
  category: string;
  @IsOptional() @IsEnum(['beginner', 'intermediate', 'advanced', 'all']) level?: string;
  @IsOptional() @IsNumber() @Min(0) duration?: number;
  @IsOptional() @IsString() instructor?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CourseLessonDto)
  lessons?: CourseLessonDto[];
  @IsOptional() @ValidateNested() @Type(() => CourseQuizDto) quiz?: CourseQuizDto;
  @IsOptional() @IsString() certificateTemplate?: string;
  @IsOptional() @IsArray() prerequisites?: string[];
  @IsOptional() @IsArray() skillsGained?: string[];
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsOptional() @IsNumber() @Min(1) dueInDays?: number;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsEnum([
    'technical',
    'soft_skills',
    'compliance',
    'leadership',
    'onboarding',
    'product',
    'sales',
    'customer_service',
    'other',
  ])
  category?: string;
  @IsOptional() @IsEnum(['beginner', 'intermediate', 'advanced', 'all']) level?: string;
  @IsOptional() @IsNumber() @Min(0) duration?: number;
  @IsOptional() @IsString() instructor?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CourseLessonDto)
  lessons?: CourseLessonDto[];
  @IsOptional() @ValidateNested() @Type(() => CourseQuizDto) quiz?: CourseQuizDto;
  @IsOptional() @IsString() certificateTemplate?: string;
  @IsOptional() @IsArray() prerequisites?: string[];
  @IsOptional() @IsArray() skillsGained?: string[];
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsArray() employeeIds?: string[];
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsOptional() @IsNumber() @Min(1) dueInDays?: number;
}

export class CourseQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

export class EnrollCourseDto {
  @IsString() courseId: string;
}

export class UpdateLessonProgressDto {
  @IsString() lessonId: string;
  @IsEnum(['not_started', 'in_progress', 'completed']) status: string;
  @IsOptional() @IsNumber() @Min(0) timeSpent?: number;
}

export class QuizAnswerDto {
  @IsString() questionId: string;
  answer: any;
}

export class SubmitQuizDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}

export class RateCourseDto {
  @IsNumber() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() feedback?: string;
}

export class LearningPathCourseDto {
  @IsString() courseId: string;
  @IsNumber() @Min(0) order: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
}

export class CreateLearningPathDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LearningPathCourseDto)
  courses: LearningPathCourseDto[];
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsNumber() @Min(0) estimatedDurationDays?: number;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
}

export class UpdateLearningPathDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LearningPathCourseDto)
  courses?: LearningPathCourseDto[];
  @IsOptional() @IsEnum(['all', 'department', 'designation', 'specific']) targetAudience?: string;
  @IsOptional() @IsArray() departments?: string[];
  @IsOptional() @IsArray() designations?: string[];
  @IsOptional() @IsNumber() @Min(0) estimatedDurationDays?: number;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsOptional() @IsEnum(['draft', 'published', 'archived']) status?: string;
}

export class EnrollmentQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}
