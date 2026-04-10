import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { SalaryStructureSchema } from './schemas/salary-structure.schema';
import { PayrollRunSchema } from './schemas/payroll-run.schema';
import { PayrollEntrySchema } from './schemas/payroll-entry.schema';
import { PayslipSchema } from './schemas/payslip.schema';
import { InvestmentDeclarationSchema } from './schemas/investment-declaration.schema';
import { ExpenseClaimSchema } from './schemas/expense-claim.schema';
import { EmployeeLoanSchema } from './schemas/employee-loan.schema';
import { OnboardingSchema } from './schemas/onboarding.schema';
import { OffboardingSchema } from './schemas/offboarding.schema';
import { AnalyticsSnapshotSchema } from './schemas/analytics-snapshot.schema';
import { JobPostingSchema } from './schemas/job-posting.schema';
import { CandidateSchema } from './schemas/candidate.schema';
import { StatutoryReportSchema } from './schemas/statutory-report.schema';
import { GoalSchema } from './schemas/goal.schema';
import { ReviewCycleSchema } from './schemas/review-cycle.schema';
import { PerformanceReviewSchema } from './schemas/performance-review.schema';
import { AnnouncementSchema } from './schemas/announcement.schema';
import { KudosSchema } from './schemas/kudos.schema';
import { SurveySchema } from './schemas/survey.schema';
import { SurveyResponseSchema } from './schemas/survey-response.schema';
import { BankTransactionSchema } from './schemas/bank-transaction.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ExternalServicesService } from './external-services.service';
import { BankPayoutService } from './bank-payout.service';

@Module({
  imports: [
    MongooseModule.forFeature([
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
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start payroll-service without a JWT secret.');
        }
        return { secret };
      },
    }),
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollCalculationService, ExternalServicesService, BankPayoutService, JwtAuthGuard, Reflector],
  exports: [PayrollService, ExternalServicesService, BankPayoutService],
})
export class PayrollModule {}
