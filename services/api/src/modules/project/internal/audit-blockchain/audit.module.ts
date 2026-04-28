import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditChainSchema, AuditLogSchema, AuditVerificationSchema } from './audit.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AuditChain', schema: AuditChainSchema },
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'AuditVerification', schema: AuditVerificationSchema },
    ], "nexora_projects"),
  ],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
