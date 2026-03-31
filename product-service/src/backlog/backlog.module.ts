import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BacklogService } from './backlog.service';
import { BacklogController } from './backlog.controller';
import { BacklogSchema } from './backlog.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Backlog', schema: BacklogSchema }])],
  providers: [BacklogService],
  controllers: [BacklogController],
  exports: [BacklogService],
})
export class BacklogModule {}
