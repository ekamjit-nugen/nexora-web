import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoadmapService } from './roadmap.service';
import { RoadmapController } from './roadmap.controller';
import { RoadmapSchema } from './roadmap.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Roadmap', schema: RoadmapSchema }])],
  providers: [RoadmapService],
  controllers: [RoadmapController],
  exports: [RoadmapService],
})
export class RoadmapModule {}
