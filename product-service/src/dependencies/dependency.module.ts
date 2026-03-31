import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DependencyService } from './dependency.service';
import { DependencyController } from './dependency.controller';
import { DependencyGraphSchema } from './dependency.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'DependencyGraph', schema: DependencyGraphSchema }])],
  providers: [DependencyService],
  controllers: [DependencyController],
  exports: [DependencyService],
})
export class DependencyModule {}
