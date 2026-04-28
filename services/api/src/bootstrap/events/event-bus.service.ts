import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from './domain-event';

/**
 * In-process event bus — the monolith side of the split lever.
 *
 * Publisher API:
 *   await this.eventBus.publish(makeEvent('payroll.run.finalized', orgId, runId, { ... }));
 *
 * Subscriber API (in any module):
 *   @OnEvent('payroll.run.finalized')
 *   async handle(event: DomainEvent<PayrollFinalizedPayload>) { ... }
 *
 * When you split a module out tomorrow:
 *   1. Replace this `EventBus` provider with one that publishes to Kafka
 *      / NATS / SQS instead of the in-process emitter.
 *   2. Subscribers in OTHER services replace `@OnEvent` with their broker's
 *      consumer decorator — but the payload shape (DomainEvent<T>) is
 *      identical, so the handler body doesn't change.
 *
 * No publisher code changes. That's the whole point.
 */
@Injectable()
export class EventBus {
  private readonly log = new Logger(EventBus.name);

  constructor(private readonly emitter: EventEmitter2) {}

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    this.log.debug(
      `event=${event.name} org=${event.organizationId} agg=${event.aggregateId}`,
    );
    // emitAsync awaits all listeners — useful for tests, harmless in prod.
    await this.emitter.emitAsync(event.name, event);
  }
}
