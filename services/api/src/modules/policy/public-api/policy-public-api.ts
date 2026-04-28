/**
 * PolicyPublicApi — what other modules can ask policy for.
 *
 * Today's known consumers:
 *   - attendance-service: getActivePoliciesForOrg (drives WFH /
 *     overtime / shift rules at clock-in time).
 *   - leave-service: getActivePoliciesForOrg (drives accrual rules).
 *
 * Both legacy services use a `policy-client.service.ts` to HTTP into
 * policy-service. After full migration, those clients can inject this
 * public-API directly (no network hop).
 */
export interface PolicySummary {
  _id: string;
  organizationId: string;
  name: string;
  category: string;
  rules: Array<Record<string, unknown>>;
  effectiveFrom: Date | null;
  isActive: boolean;
}

export interface PolicyPublicApi {
  /** All ACTIVE policies for an org, optionally filtered by category. */
  getActivePoliciesForOrg(
    organizationId: string,
    category?: string,
  ): Promise<PolicySummary[]>;
}

export const POLICY_PUBLIC_API = Symbol('POLICY_PUBLIC_API');
