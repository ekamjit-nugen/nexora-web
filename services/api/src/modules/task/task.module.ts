import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskModule as InternalTaskModule } from './internal/task/task.module';
import { HealthController } from './internal/health/health.controller';
import { TaskSchema } from './internal/task/schemas/task.schema';
import { TASK_PUBLIC_API } from './public-api';
import { TaskPublicApiImpl } from './public-api/task-public-api.impl';
import { TASK_DB } from '../../bootstrap/database/database.tokens';

/**
 * TaskModule wrapper.
 *
 * Re-exports the legacy InternalTaskModule (which already contains
 * controllers, providers, and the named-connection forFeature) and
 * adds the public-API binding on top.
 *
 * The wrapper ALSO registers the `Task` schema on TASK_DB so that
 * TaskPublicApiImpl (which lives in the wrapper's DI scope) can
 * inject it. Inner module's forFeature is private to its own scope.
 */
@Module({
  imports: [
    InternalTaskModule,
    MongooseModule.forFeature(
      [{ name: 'Task', schema: TaskSchema }],
      TASK_DB,
    ),
  ],
  controllers: [HealthController],
  providers: [
    { provide: TASK_PUBLIC_API, useClass: TaskPublicApiImpl },
  ],
  exports: [TASK_PUBLIC_API],
})
export class TaskModule {}
