import { Module } from '@nestjs/common';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { AuthModule } from './modules/auth/auth.module';
import { HrModule } from './modules/hr/hr.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PolicyModule } from './modules/policy/policy.module';

/**
 * The root app module of the Nexora monolith.
 *
 * Imports BootstrapModule (shared infrastructure) once, then every
 * feature module under src/modules/. Adding a new module is a single
 * line in the imports array.
 *
 * The 18 feature modules will be added here as each one is migrated:
 *
 *   imports: [
 *     BootstrapModule,
 *     AuthModule,        // services/auth-service        -> modules/auth
 *     HrModule,          // services/hr-service          -> modules/hr
 *     PayrollModule,     // services/payroll-service     -> modules/payroll
 *     AttendanceModule,  // services/attendance-service  -> modules/attendance
 *     LeaveModule,       // services/leave-service       -> modules/leave
 *     PolicyModule,      // services/policy-service      -> modules/policy
 *     AssetModule,       // services/asset-service       -> modules/asset
 *     HelpdeskModule,    // services/helpdesk-service    -> modules/helpdesk
 *     KnowledgeModule,   // services/knowledge-service   -> modules/knowledge
 *     ChatModule,        // services/chat-service        -> modules/chat
 *     CallingModule,     // services/calling-service     -> modules/calling
 *     MediaModule,       // services/media-service       -> modules/media
 *     NotificationModule,// services/notification-service-> modules/notification
 *     AiModule,          // services/ai-service          -> modules/ai
 *     BenchModule,       // services/bench-service       -> modules/bench
 *     TaskModule,        // services/task-service        -> modules/task
 *     ProjectModule,     // services/project-service     -> modules/project
 *   ],
 */
@Module({
  imports: [
    BootstrapModule,
    AuthModule,       // services/auth-service       -> modules/auth       (migrated)
    HrModule,         // services/hr-service         -> modules/hr         (migrated)
    PayrollModule,    // services/payroll-service    -> modules/payroll    (migrated)
    AttendanceModule, // services/attendance-service -> modules/attendance (migrated)
    LeaveModule,      // services/leave-service      -> modules/leave      (migrated)
    PolicyModule,     // services/policy-service     -> modules/policy     (migrated)
    // Migration playbook: docs/monolith-migration-playbook.md
  ],
})
export class AppModule {}
