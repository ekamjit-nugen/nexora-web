import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';

// Schemas
import { SalaryStructureSchema } from './internal/payroll/schemas/salary-structure.schema';
import { PayrollRunSchema } from './internal/payroll/schemas/payroll-run.schema';
import { PayrollEntrySchema } from './internal/payroll/schemas/payroll-entry.schema';
import { PayslipSchema } from './internal/payroll/schemas/payslip.schema';
import { InvestmentDeclarationSchema } from './internal/payroll/schemas/investment-declaration.schema';
import { ExpenseClaimSchema } from './internal/payroll/schemas/expense-claim.schema';
import { EmployeeLoanSchema } from './internal/payroll/schemas/employee-loan.schema';
import { OnboardingSchema } from './internal/payroll/schemas/onboarding.schema';
import { OffboardingSchema } from './internal/payroll/schemas/offboarding.schema';
import { AnalyticsSnapshotSchema } from './internal/payroll/schemas/analytics-snapshot.schema';
import { JobPostingSchema } from './internal/payroll/schemas/job-posting.schema';
import { CandidateSchema } from './internal/payroll/schemas/candidate.schema';
import { StatutoryReportSchema } from './internal/payroll/schemas/statutory-report.schema';
import { GoalSchema } from './internal/payroll/schemas/goal.schema';
import { ReviewCycleSchema } from './internal/payroll/schemas/review-cycle.schema';
import { PerformanceReviewSchema } from './internal/payroll/schemas/performance-review.schema';
import { AnnouncementSchema } from './internal/payroll/schemas/announcement.schema';
import { KudosSchema } from './internal/payroll/schemas/kudos.schema';
import { SurveySchema } from './internal/payroll/schemas/survey.schema';
import { SurveyResponseSchema } from './internal/payroll/schemas/survey-response.schema';
import { BankTransactionSchema } from './internal/payroll/schemas/bank-transaction.schema';
import { CourseSchema } from './internal/payroll/schemas/course.schema';
import { EnrollmentSchema } from './internal/payroll/schemas/enrollment.schema';
import { CertificateSchema } from './internal/payroll/schemas/certificate.schema';
import { LearningPathSchema } from './internal/payroll/schemas/learning-path.schema';
import { CounterSchema } from './internal/payroll/schemas/counter.schema';

// Domain
import { PayrollController } from './internal/payroll/payroll.controller';
import { PayrollService } from './internal/payroll/payroll.service';
import { PayrollCalculationService } from './internal/payroll/payroll-calculation.service';
import { ExternalServicesService } from './internal/payroll/external-services.service';
import { BankPayoutService } from './internal/payroll/bank-payout.service';
import { AttritionPredictorService } from './internal/payroll/attrition-predictor.service';
import { PayslipPdfService } from './internal/payroll/payslip-pdf.service';
import { Form16PdfService } from './internal/payroll/form16-pdf.service';
import { OffboardingLetterPdfService } from './internal/payroll/offboarding-letter-pdf.service';
import { StatutoryExportService } from './internal/payroll/statutory-export.service';
import { JwtAuthGuard } from './internal/payroll/guards/jwt-auth.guard';

// Health
import { HealthController } from './internal/health/health.controller';

// Public-API contract.
import { PAYROLL_PUBLIC_API } from './public-api';
import { PayrollPublicApiImpl } from './public-api/payroll-public-api.impl';

// Named DB connection.
import { PAYROLL_DB } from '../../bootstrap/database/database.tokens';

/**
 * PayrollModule — third migrated module.
 *
 * Important note about cross-module calls:
 *   The internal `ExternalServicesService` still calls hr-service /
 *   auth-service / attendance-service / leave-service over HTTP via
 *   axios + AUTH_SERVICE_URL etc. In the legacy split-services world
 *   that's fine. In the monolith, those HTTP calls go to the OLD
 *   legacy services that are still running (the safety net). That's
 *   acceptable for now because:
 *     (a) it preserves identical behaviour to the legacy run, and
 *     (b) when hr/auth/attendance/leave finish migrating, we can
 *         refactor ExternalServicesService to inject HR_PUBLIC_API
 *         and AUTH_PUBLIC_API directly (no network hop, no JWT
 *         re-validation, ~10x faster).
 *   That refactor is queued as a separate change — see the migration
 *   playbook step 6.
 */
@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: 'SalaryStructure', schema: SalaryStructureSchema },
        { name: 'PayrollRun', schema: PayrollRunSchema },
        { name: 'PayrollEntry', schema: PayrollEntrySchema },
        { name: 'Payslip', schema: PayslipSchema },
        { name: 'InvestmentDeclaration', schema: InvestmentDeclarationSchema },
        { name: 'ExpenseClaim', schema: ExpenseClaimSchema },
        { name: 'EmployeeLoan', schema: EmployeeLoanSchema },
        { name: 'Onboarding', schema: OnboardingSchema },
        { name: 'Offboarding', schema: OffboardingSchema },
        { name: 'AnalyticsSnapshot', schema: AnalyticsSnapshotSchema },
        { name: 'JobPosting', schema: JobPostingSchema },
        { name: 'Candidate', schema: CandidateSchema },
        { name: 'StatutoryReport', schema: StatutoryReportSchema },
        { name: 'Goal', schema: GoalSchema },
        { name: 'ReviewCycle', schema: ReviewCycleSchema },
        { name: 'PerformanceReview', schema: PerformanceReviewSchema },
        { name: 'Announcement', schema: AnnouncementSchema },
        { name: 'Kudos', schema: KudosSchema },
        { name: 'Survey', schema: SurveySchema },
        { name: 'SurveyResponse', schema: SurveyResponseSchema },
        { name: 'BankTransaction', schema: BankTransactionSchema },
        { name: 'Course', schema: CourseSchema },
        { name: 'Enrollment', schema: EnrollmentSchema },
        { name: 'Certificate', schema: CertificateSchema },
        { name: 'LearningPath', schema: LearningPathSchema },
        { name: 'Counter', schema: CounterSchema },
      ],
      PAYROLL_DB,
    ),
  ],
  controllers: [PayrollController, HealthController],
  providers: [
    PayrollService,
    PayrollCalculationService,
    ExternalServicesService,
    BankPayoutService,
    AttritionPredictorService,
    PayslipPdfService,
    Form16PdfService,
    OffboardingLetterPdfService,
    StatutoryExportService,
    JwtAuthGuard,
    Reflector,
    { provide: PAYROLL_PUBLIC_API, useClass: PayrollPublicApiImpl },
  ],
  exports: [
    PAYROLL_PUBLIC_API,
    // Legacy in-monolith exports — drop once all callers migrate to PUBLIC_API.
    PayrollService,
    ExternalServicesService,
    BankPayoutService,
    AttritionPredictorService,
    PayslipPdfService,
    Form16PdfService,
    OffboardingLetterPdfService,
    StatutoryExportService,
  ],
})
export class PayrollModule {}
