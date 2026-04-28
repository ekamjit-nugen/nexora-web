/**
 * CallingPublicApi — what other modules can ask calling for.
 * Today's known consumers:
 *   - hr-service in legacy reads call-logs to compute billable minutes
 *     for client invoices.
 */
export interface CallSummary {
  _id: string;
  organizationId: string;
  fromUserId: string;
  toUserId: string;
  type: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
}

export interface CallingPublicApi {
  getCallById(organizationId: string, callId: string): Promise<CallSummary | null>;
}

export const CALLING_PUBLIC_API = Symbol('CALLING_PUBLIC_API');
