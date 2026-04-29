import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatbotController } from './internal/chatbot.controller';
import { ChatbotService } from './internal/chatbot.service';
import { OllamaClient } from './internal/ollama.client';
import { ConversationSchema } from './internal/schemas/conversation.schema';
import { TenantContextService } from './internal/tenant-context.service';
import { IntentEnrichmentService } from './internal/intent-enrichment.service';
import { CHATBOT_PUBLIC_API } from './public-api';
import { ChatbotPublicApiImpl } from './public-api/chatbot-public-api.impl';
import {
  CHATBOT_DB, AUTH_DB, HR_DB, PAYROLL_DB, ATTENDANCE_DB, LEAVE_DB,
} from '../../bootstrap/database/database.tokens';

// Cross-module schemas — read-only here. We register them on each
// module's named connection so reads stay consistent with the owning
// module's writes. We never write through these — TenantContextService
// is strictly a read-only snapshot builder.
import { OrganizationSchema } from '../auth/internal/auth/schemas/organization.schema';
import { UserSchema } from '../auth/internal/auth/schemas/user.schema';
import { EmployeeSchema } from '../hr/internal/hr/schemas/employee.schema';
import { DepartmentSchema } from '../hr/internal/hr/schemas/department.schema';
import { PayrollRunSchema } from '../payroll/internal/payroll/schemas/payroll-run.schema';
import { SalaryStructureSchema } from '../payroll/internal/payroll/schemas/salary-structure.schema';
import { AttendanceSchema } from '../attendance/internal/attendance/schemas/attendance.schema';
import { LeaveSchema } from '../leave/internal/leave/schemas/leave.schema';

/**
 * The chatbot is a unique consumer — it reads from many modules' DBs
 * to build a "live tenant snapshot" the LLM uses to feel aware. To
 * keep the boundary clean we:
 *
 *   1. Only ever READ. The TenantContextService never updates anyone
 *      else's data.
 *   2. Use each module's named connection (AUTH_DB, HR_DB, etc.) so
 *      reads stay consistent with the owning module's writes.
 *   3. Document the cross-module schema imports here as an explicit
 *      exception to the boundary rule. Future cleanup: have each
 *      module expose a `summary(orgId, userId)` method on its
 *      public-API; chatbot calls those instead of touching schemas
 *      directly. For now, this is fine because it's read-only.
 */
@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'Conversation', schema: ConversationSchema }],
      CHATBOT_DB,
    ),
    MongooseModule.forFeature(
      [
        { name: 'Organization', schema: OrganizationSchema },
        { name: 'User', schema: UserSchema },
      ],
      AUTH_DB,
    ),
    MongooseModule.forFeature(
      [
        { name: 'Employee', schema: EmployeeSchema },
        { name: 'Department', schema: DepartmentSchema },
      ],
      HR_DB,
    ),
    MongooseModule.forFeature(
      [
        { name: 'PayrollRun', schema: PayrollRunSchema },
        { name: 'SalaryStructure', schema: SalaryStructureSchema },
      ],
      PAYROLL_DB,
    ),
    MongooseModule.forFeature(
      [{ name: 'Attendance', schema: AttendanceSchema }],
      ATTENDANCE_DB,
    ),
    MongooseModule.forFeature(
      [{ name: 'Leave', schema: LeaveSchema }],
      LEAVE_DB,
    ),
  ],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    OllamaClient,
    TenantContextService,
    IntentEnrichmentService,
    { provide: CHATBOT_PUBLIC_API, useClass: ChatbotPublicApiImpl },
  ],
  exports: [CHATBOT_PUBLIC_API, ChatbotService, OllamaClient],
})
export class ChatbotModule {}
