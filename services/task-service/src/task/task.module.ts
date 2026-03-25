import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskController, TimesheetController } from './task.controller';
import { BoardController } from './board.controller';
import { SprintController } from './sprint.controller';
import { TaskService } from './task.service';
import { BoardService } from './board.service';
import { SprintService } from './sprint.service';
import { TaskSchema } from './schemas/task.schema';
import { TimesheetSchema } from './schemas/timesheet.schema';
import { BoardSchema } from './schemas/board.schema';
import { SprintSchema } from './schemas/sprint.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Task', schema: TaskSchema },
      { name: 'Timesheet', schema: TimesheetSchema },
      { name: 'Board', schema: BoardSchema },
      { name: 'Sprint', schema: SprintSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [TaskController, TimesheetController, BoardController, SprintController],
  providers: [TaskService, BoardService, SprintService, JwtAuthGuard],
  exports: [TaskService, BoardService, SprintService],
})
export class TaskModule {}
