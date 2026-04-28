import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LeaveController } from './internal/leave/leave.controller';
import { LeaveService } from './internal/leave/leave.service';
import { PolicyClientService } from './internal/leave/policy-client.service';
import { LeaveSchema } from './internal/leave/schemas/leave.schema';
import { LeaveBalanceSchema } from './internal/leave/schemas/leave-balance.schema';
import { LeavePolicySchema } from './internal/leave/schemas/leave-policy.schema';
import { JwtAuthGuard } from './internal/leave/guards/jwt-auth.guard';
import { HealthController } from './internal/health/health.controller';

import { LEAVE_PUBLIC_API } from './public-api';
import { LeavePublicApiImpl } from './public-api/leave-public-api.impl';

import { LEAVE_DB } from '../../bootstrap/database/database.tokens';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: 'Leave', schema: LeaveSchema },
        { name: 'LeaveBalance', schema: LeaveBalanceSchema },
        { name: 'LeavePolicy', schema: LeavePolicySchema },
      ],
      LEAVE_DB,
    ),
  ],
  controllers: [LeaveController, HealthController],
  providers: [
    LeaveService,
    PolicyClientService,
    JwtAuthGuard,
    { provide: LEAVE_PUBLIC_API, useClass: LeavePublicApiImpl },
  ],
  exports: [LEAVE_PUBLIC_API, LeaveService],
})
export class LeaveModule {}
