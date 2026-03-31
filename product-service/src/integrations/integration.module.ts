import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { IntegrationSchema } from './integration.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Integration', schema: IntegrationSchema }])],
  providers: [IntegrationService],
  controllers: [IntegrationController],
  exports: [IntegrationService],
})
export class IntegrationModule {}
