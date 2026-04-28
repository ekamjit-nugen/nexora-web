import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollaborationService } from './collaboration.service';
import { CollaborationController } from './collaboration.controller';
import {
  CollaborationSessionSchema,
  CollaborativeEditSchema,
  ConflictResolutionSchema,
} from './collaboration.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CollaborationSession', schema: CollaborationSessionSchema },
      { name: 'CollaborativeEdit', schema: CollaborativeEditSchema },
      { name: 'ConflictResolution', schema: ConflictResolutionSchema },
    ], "nexora_projects"),
  ],
  providers: [CollaborationService],
  controllers: [CollaborationController],
  exports: [CollaborationService],
})
export class CollaborationModule {}
