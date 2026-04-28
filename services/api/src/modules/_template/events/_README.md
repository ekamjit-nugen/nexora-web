# Domain events

Each event is a typed payload class published via `EventBus.publish(...)`
from this module's services. Other modules subscribe via `@OnEvent(...)`
without ever importing this module's internals.

## Naming

`<module>.<aggregate>.<past-tense-verb>` — e.g.

- `auth.user.registered`
- `payroll.run.finalized`
- `hr.employee.terminated`

## Shape

```ts
import { DomainEvent, makeEvent } from '@bootstrap/events/domain-event';

export interface PayrollRunFinalizedPayload {
  runId: string;
  totalNet: number;
  employeeCount: number;
}

export type PayrollRunFinalizedEvent = DomainEvent<PayrollRunFinalizedPayload>;

export const PAYROLL_RUN_FINALIZED = 'payroll.run.finalized';

// Emitter:
//   await this.eventBus.publish(makeEvent(
//     PAYROLL_RUN_FINALIZED,
//     orgId,
//     runId,
//     { runId, totalNet, employeeCount },
//   ));
```

## Subscriber example

```ts
@OnEvent(PAYROLL_RUN_FINALIZED)
async onPayrollFinalized(event: PayrollRunFinalizedEvent) {
  // event.payload is type-checked
}
```

## Re-export from public-api

Every event type that other modules need to subscribe to MUST be
re-exported from `public-api/index.ts`. Keep types and event-name
constants together.
