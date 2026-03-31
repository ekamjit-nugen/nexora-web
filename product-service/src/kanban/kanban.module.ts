import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KanbanService } from './kanban.service';
import { KanbanController } from './kanban.controller';
import { KanbanBoardSchema } from './kanban.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'KanbanBoard', schema: KanbanBoardSchema }])],
  providers: [KanbanService],
  controllers: [KanbanController],
  exports: [KanbanService],
})
export class KanbanModule {}
