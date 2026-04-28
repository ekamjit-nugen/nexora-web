/**
 * AuthPublicApi — the cross-module surface of the auth module.
 *
 * Methods here are what the OTHER 17 modules call into auth for. Today
 * the only documented cross-service auth call is `payroll-service`'s
 * `getOrgDetails(orgId)` which fetches business info for the payslip
 * header. Other internal needs (validate JWT, lookup user) are handled
 * locally by the bootstrap-level JwtAuthGuard since every module shares
 * the same JWT secret — no auth round-trip required.
 *
 * Adding a method here is a deliberate API decision, NOT a refactor.
 * Once a method is exposed, callers will start depending on it; future
 * changes need to be backward-compatible. Keep this surface small.
 */
export interface OrganizationBusinessDetails {
  organizationId: string;
  companyName: string;
  registeredAddress: string | null;
  pan: string | null;
  tan: string | null;
  gstin: string | null;
  cin: string | null;
  signingAuthority: { name: string; designation: string } | null;
  logo: string | null;
}

export interface UserSummary {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isPlatformAdmin: boolean;
  setupStage: string;
}

export interface OrgSummary {
  organizationId: string;
  name: string;
  type: string | null;
  size: string | null;
  country: string | null;
  isDeleted: boolean;
}

export interface AuthPublicApi {
  /**
   * Fetch business / statutory details about an organization.
   *
   * Used by payroll-service to populate the `organizationSnapshot` block
   * on every payslip (PAN, TAN, registered address). Any module that
   * generates org-branded output (PDFs, emails) can consume this.
   *
   * Returns null if the org doesn't exist or is soft-deleted.
   */
  getOrganizationBusiness(organizationId: string): Promise<OrganizationBusinessDetails | null>;

  /** Lightweight user lookup. Returns null on miss. */
  getUserById(userId: string): Promise<UserSummary | null>;

  /** Lightweight org lookup. Returns null on miss / soft-delete. */
  getOrganizationById(organizationId: string): Promise<OrgSummary | null>;

  /**
   * Mint a short-lived service-to-service token for inter-module RPCs
   * that still need a JWT (e.g. when the monolith calls a sidecar
   * worker, or after a future microservice extraction). The token has
   * `roles: ['service']` and a 5-min expiry.
   */
  mintServiceToken(organizationId: string): Promise<string>;
}

/** DI token. Inject with `@Inject(AUTH_PUBLIC_API) auth: AuthPublicApi`. */
export const AUTH_PUBLIC_API = Symbol('AUTH_PUBLIC_API');
