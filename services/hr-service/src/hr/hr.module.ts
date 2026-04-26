import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HrController, BillingController } from './hr.controller';
import { HrService } from './hr.service';
import { EmployeeSchema } from './schemas/employee.schema';
import { DepartmentSchema } from './schemas/department.schema';
import { DesignationSchema } from './schemas/designation.schema';
import { TeamSchema } from './schemas/team.schema';
import { ClientSchema } from './schemas/client.schema';
import { InvoiceSchema } from './schemas/invoice.schema';
import { InvoiceTemplateSchema } from './schemas/invoice-template.schema';
import { CallLogSchema } from './schemas/call-log.schema';
import { BillingRateSchema } from './schemas/billing-rate.schema';
import { EmployeeStatusSchema } from './schemas/employee-status.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Employee', schema: EmployeeSchema },
      { name: 'Department', schema: DepartmentSchema },
      { name: 'Designation', schema: DesignationSchema },
      { name: 'Team', schema: TeamSchema },
      { name: 'Client', schema: ClientSchema },
      { name: 'Invoice', schema: InvoiceSchema },
      { name: 'InvoiceTemplate', schema: InvoiceTemplateSchema },
      { name: 'CallLog', schema: CallLogSchema },
      { name: 'BillingRate', schema: BillingRateSchema },
      { name: 'EmployeeStatus', schema: EmployeeStatusSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [HrController, BillingController],
  providers: [HrService, JwtAuthGuard],
  exports: [HrService],
})
export class HrModule {}
