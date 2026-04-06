import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplianceController } from './compliance.controller';
import { RetentionService } from './retention.service';
import { DlpService } from './dlp.service';
import { EDiscoveryService } from './ediscovery.service';
import { LegalHoldService } from './legal-hold.service';
import { GuestAccessService } from './guest-access.service';
import { RetentionProcessor } from './retention.processor';
import { RetentionPolicySchema, LegalHoldSchema, DlpRuleSchema } from './schemas/retention-policy.schema';
import { MessageSchema } from '../messages/schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'RetentionPolicy', schema: RetentionPolicySchema },
      { name: 'LegalHold', schema: LegalHoldSchema },
      { name: 'DlpRule', schema: DlpRuleSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  controllers: [ComplianceController],
  providers: [RetentionService, DlpService, EDiscoveryService, LegalHoldService, GuestAccessService, RetentionProcessor],
  exports: [RetentionService, DlpService, EDiscoveryService, LegalHoldService, GuestAccessService],
})
export class ComplianceModule {}
