import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsReportSchema } from './analytics.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'AnalyticsReport', schema: AnalyticsReportSchema }])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
