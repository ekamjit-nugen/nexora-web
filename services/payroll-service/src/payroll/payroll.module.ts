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
import { OnboardingSchema } from './schemas/onboarding.schema';
import { OffboardingSchema } from './schemas/offboarding.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ExternalServicesService } from './external-services.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SalaryStructure', schema: SalaryStructureSchema },
      { name: 'PayrollRun', schema: PayrollRunSchema },
      { name: 'PayrollEntry', schema: PayrollEntrySchema },
      { name: 'Payslip', schema: PayslipSchema },
      { name: 'InvestmentDeclaration', schema: InvestmentDeclarationSchema },
      { name: 'ExpenseClaim', schema: ExpenseClaimSchema },
      { name: 'Onboarding', schema: OnboardingSchema },
      { name: 'Offboarding', schema: OffboardingSchema },
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
  providers: [PayrollService, PayrollCalculationService, ExternalServicesService, JwtAuthGuard, Reflector],
  exports: [PayrollService, ExternalServicesService],
})
export class PayrollModule {}
