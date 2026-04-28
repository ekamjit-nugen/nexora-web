import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBus } from './event-bus.service';

/**
 * Global event-bus module. Every feature module gets EventBus injected
 * for free.
 *
 * In the monolith: backed by EventEmitter2, in-process.
 * In the split-services world: replace this provider with a Kafka /
 * NATS / SQS adapter that satisfies the same `EventBus` interface.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Allow nested namespacing: 'payroll.run.finalized' has 3 levels.
      wildcard: true,
      delimiter: '.',
      // Catch unhandled errors in subscribers without crashing the app.
      ignoreErrors: false,
      // Up to 50 listeners per event is plenty for this codebase.
      maxListeners: 50,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [EventBus],
  exports: [EventBus],
})
export class EventBusModule {}
