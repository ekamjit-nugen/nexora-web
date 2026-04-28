import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

// Schemas
import { EmployeeSchema } from './internal/hr/schemas/employee.schema';
import { EmployeeProfileAuditSchema } from './internal/hr/schemas/employee-audit.schema';
import { InvoiceNotificationSchema } from './internal/hr/schemas/invoice-notification.schema';
import { DepartmentSchema } from './internal/hr/schemas/department.schema';
import { DesignationSchema } from './internal/hr/schemas/designation.schema';
import { TeamSchema } from './internal/hr/schemas/team.schema';
import { ClientSchema } from './internal/hr/schemas/client.schema';
import { InvoiceSchema } from './internal/hr/schemas/invoice.schema';
import { InvoiceTemplateSchema } from './internal/hr/schemas/invoice-template.schema';
import { CallLogSchema } from './internal/hr/schemas/call-log.schema';
import { BillingRateSchema } from './internal/hr/schemas/billing-rate.schema';
import { EmployeeStatusSchema } from './internal/hr/schemas/employee-status.schema';

// Domain
import { HrController, BillingController } from './internal/hr/hr.controller';
import { HrService } from './internal/hr/hr.service';
import { InvoiceLifecycleService } from './internal/hr/invoice-lifecycle.service';
import { JwtAuthGuard } from './internal/hr/guards/jwt-auth.guard';

// Health
import { HealthController } from './internal/health/health.controller';

// Public-API contract — the ONLY surface other modules may import.
import { HR_PUBLIC_API } from './public-api';
import { HrPublicApiImpl } from './public-api/hr-public-api.impl';

// Named DB connection — every @InjectModel inside internal/ MUST also
// pass HR_DB or the read/write hits the wrong database.
import { HR_DB } from '../../bootstrap/database/database.tokens';

/**
 * HrModule — second migrated module.
 *
 * Mirrors services/hr-service/src/hr/hr.module.ts but drops the
 * locally-imported JwtModule.registerAsync (it's now @Global() in the
 * BootstrapModule), and ConfigModule.forRoot (also @Global()).
 *
 * Adds the HR_PUBLIC_API binding so payroll, attendance, leave, and
 * any future module can call into hr without reaching across module
 * boundaries.
 */
@Module({
  imports: [
    // Cron jobs (InvoiceLifecycleService.dailyScan). Kept here because
    // ScheduleModule.forRoot() registers a per-process scheduler — in
    // a monolith we want exactly one. If multiple modules need cron
    // we'll lift this to BootstrapModule; for now hr is the only
    // user.
    ScheduleModule.forRoot(),
    MongooseModule.forFeature(
      [
        { name: 'Employee', schema: EmployeeSchema },
        { name: 'EmployeeProfileAudit', schema: EmployeeProfileAuditSchema },
        { name: 'InvoiceNotification', schema: InvoiceNotificationSchema },
        { name: 'Department', schema: DepartmentSchema },
        { name: 'Designation', schema: DesignationSchema },
        { name: 'Team', schema: TeamSchema },
        { name: 'Client', schema: ClientSchema },
        { name: 'Invoice', schema: InvoiceSchema },
        { name: 'InvoiceTemplate', schema: InvoiceTemplateSchema },
        { name: 'CallLog', schema: CallLogSchema },
        { name: 'BillingRate', schema: BillingRateSchema },
        { name: 'EmployeeStatus', schema: EmployeeStatusSchema },
      ],
      HR_DB,
    ),
  ],
  controllers: [HrController, BillingController, HealthController],
  providers: [
    HrService,
    InvoiceLifecycleService,
    JwtAuthGuard,
    // The split lever: bind HR_PUBLIC_API to the in-process impl.
    // On extraction, callers swap to an HTTP-client impl.
    { provide: HR_PUBLIC_API, useClass: HrPublicApiImpl },
  ],
  exports: [
    HR_PUBLIC_API,
    // Legacy in-monolith exports — kept until all callers migrate to
    // the public-API token. Then drop these and the .eslintrc rule
    // prevents reintroduction.
    HrService,
    InvoiceLifecycleService,
  ],
})
export class HrModule {}
