import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { TaskController, TimesheetController } from './task.controller';
import { ImportExportController } from './import-export.controller';
import { BoardController } from './board.controller';
import { SprintController } from './sprint.controller';
import { TaskReportingController } from './reporting.controller';
import { NotificationController } from './notification.controller';
import { GitWebhookController, GitIntegrationController, TaskGitLinksController } from './git-integration.controller';
import { TaskService } from './task.service';
import { RecurrenceService } from './recurrence.service';
import { GitIntegrationService } from './git-integration.service';
import { BoardService } from './board.service';
import { SprintService } from './sprint.service';
import { TaskReportingService } from './reporting.service';
import { NotificationService } from './notification.service';
import { TaskCronService } from './task-cron.service';
import { TaskSchema } from './schemas/task.schema';
import { CounterSchema } from './schemas/counter.schema';
import { TimesheetSchema } from './schemas/timesheet.schema';
import { BoardSchema } from './schemas/board.schema';
import { SprintSchema } from './schemas/sprint.schema';
import { ActivitySchema } from './schemas/activity.schema';
import { NotificationSchema } from './schemas/notification.schema';
import { GitIntegrationConfigSchema } from './schemas/git-integration.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: 'Task', schema: TaskSchema },
      { name: 'Counter', schema: CounterSchema },
      { name: 'Timesheet', schema: TimesheetSchema },
      { name: 'Board', schema: BoardSchema },
      { name: 'Sprint', schema: SprintSchema },
      { name: 'Activity', schema: ActivitySchema },
      { name: 'Notification', schema: NotificationSchema },
      { name: 'GitIntegrationConfig', schema: GitIntegrationConfigSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [ImportExportController, TaskController, TimesheetController, BoardController, SprintController, TaskReportingController, NotificationController, GitWebhookController, GitIntegrationController, TaskGitLinksController],
  providers: [TaskService, RecurrenceService, BoardService, SprintService, TaskReportingService, NotificationService, TaskCronService, GitIntegrationService, JwtAuthGuard, RolesGuard, Reflector],
  exports: [TaskService, RecurrenceService, BoardService, SprintService, TaskReportingService, NotificationService, GitIntegrationService],
})
export class TaskModule {}
