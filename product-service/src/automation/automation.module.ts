import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationRuleSchema } from './automation.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'AutomationRule', schema: AutomationRuleSchema }])],
  providers: [AutomationService],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
