import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AttendanceController } from './internal/attendance/attendance.controller';
import { AttendanceService } from './internal/attendance/attendance.service';
import { PolicyClientService } from './internal/attendance/policy-client.service';
import { AttendanceSchema } from './internal/attendance/schemas/attendance.schema';
import { ShiftSchema } from './internal/attendance/schemas/shift.schema';
import { PolicySchema } from './internal/attendance/schemas/policy.schema';
import { AlertSchema } from './internal/attendance/schemas/alert.schema';
import { HolidaySchema } from './internal/attendance/schemas/holiday.schema';
import { JwtAuthGuard } from './internal/attendance/guards/jwt-auth.guard';
import { HealthController } from './internal/health/health.controller';

import { ATTENDANCE_PUBLIC_API } from './public-api';
import { AttendancePublicApiImpl } from './public-api/attendance-public-api.impl';

import { ATTENDANCE_DB } from '../../bootstrap/database/database.tokens';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: 'Attendance', schema: AttendanceSchema },
        { name: 'Shift', schema: ShiftSchema },
        // NOTE: this `Policy` schema is attendance's own copy of attendance
        // policies. It's NOT the same model as policy module's Policy. The
        // models live on different connections (ATTENDANCE_DB vs POLICY_DB)
        // so Mongoose keeps them isolated. Same idea applies if a third
        // module ever ships a Policy model.
        { name: 'Policy', schema: PolicySchema },
        { name: 'Alert', schema: AlertSchema },
        { name: 'Holiday', schema: HolidaySchema },
      ],
      ATTENDANCE_DB,
    ),
  ],
  controllers: [AttendanceController, HealthController],
  providers: [
    AttendanceService,
    PolicyClientService,
    JwtAuthGuard,
    { provide: ATTENDANCE_PUBLIC_API, useClass: AttendancePublicApiImpl },
  ],
  exports: [ATTENDANCE_PUBLIC_API, AttendanceService],
})
export class AttendanceModule {}
