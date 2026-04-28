/**
 * Base type for every domain event published in the monolith.
 *
 * The shape is deliberately compatible with how Kafka / NATS / RabbitMQ
 * messages are typically structured (key + payload + metadata) so the
 * day we swap the in-process emitter for a real broker, publisher and
 * subscriber code stay byte-identical.
 *
 * Naming convention: `<module>.<aggregate>.<past-tense-verb>`
 *   e.g. 'auth.user.registered', 'payroll.run.finalized'
 *
 * Every module owns the events it publishes — declare them in
 * `modules/<name>/events/` and EXPORT the type from public-api/.
 * Subscribers import the type to get compile-time payload safety.
 */
export interface DomainEvent<TPayload = unknown> {
  /** Stable event identifier — the contract for subscribers. */
  readonly name: string;
  /** Time the event was emitted, ISO string. */
  readonly occurredAt: string;
  /** Tenant the event belongs to (for multi-tenant routing). */
  readonly organizationId: string;
  /** Aggregate / entity this event is about — used as broker partition key. */
  readonly aggregateId: string;
  /** Free-form structured data. Each event type narrows this. */
  readonly payload: TPayload;
  /** Optional metadata — userId who triggered, request id, etc. */
  readonly metadata?: Record<string, unknown>;
}

export function makeEvent<T>(
  name: string,
  organizationId: string,
  aggregateId: string,
  payload: T,
  metadata?: Record<string, unknown>,
): DomainEvent<T> {
  return {
    name,
    occurredAt: new Date().toISOString(),
    organizationId,
    aggregateId,
    payload,
    metadata,
  };
}
