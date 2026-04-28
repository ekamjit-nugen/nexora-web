import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PolicyController } from './internal/policy/policy.controller';
import { PolicyService } from './internal/policy/policy.service';
import { PolicySchema } from './internal/policy/schemas/policy.schema';
import { PolicyAcknowledgementSchema } from './internal/policy/schemas/policy-acknowledgement.schema';
import { JwtAuthGuard } from './internal/policy/guards/jwt-auth.guard';
import { HealthController } from './internal/health/health.controller';

import { POLICY_PUBLIC_API } from './public-api';
import { PolicyPublicApiImpl } from './public-api/policy-public-api.impl';

import { POLICY_DB } from '../../bootstrap/database/database.tokens';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: 'Policy', schema: PolicySchema },
        { name: 'PolicyAcknowledgement', schema: PolicyAcknowledgementSchema },
      ],
      POLICY_DB,
    ),
  ],
  controllers: [PolicyController, HealthController],
  providers: [
    PolicyService,
    JwtAuthGuard,
    { provide: POLICY_PUBLIC_API, useClass: PolicyPublicApiImpl },
  ],
  exports: [POLICY_PUBLIC_API, PolicyService],
})
export class PolicyModule {}
