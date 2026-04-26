import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/**
 * HTTP client for the policy-service. Created as part of #10 (policy
 * schema consolidation) so attendance-service stops maintaining its own
 * `Policy` collection as the source of truth — the admin edits policies
 * in ONE place (policy-service) and consumers read via this client.
 *
 * Design choices:
 *
 * - Service-token minting mirrors payroll-service's `external-services`
 *   pattern. Policy-service requires a valid JWT with `organizationId`
 *   or it returns an empty set; on hot clock-in paths we don't always
 *   have the user token at hand, so we mint a short-lived system token
 *   scoped to the tenant.
 *
 * - Tiny in-memory cache keyed by orgId, TTL 30s. Clock-in is the hottest
 *   call in the system (every employee, every morning, possibly many
 *   times through the day); without caching we'd flood policy-service
 *   with lookups that change at most a few times a quarter. Cache busts
 *   automatically on the next clock-in after TTL expiry. Policy edits
 *   propagate within 30 seconds — acceptable for a human-scale config.
 *
 * - Fetch failures degrade gracefully: we log and return an empty array.
 *   The caller (`resolveShiftPolicy`) then falls back to the local
 *   attendance-service Policy collection so clock-ins don't break when
 *   policy-service is down or being redeployed.
 */
@Injectable()
export class PolicyClientService {
  private readonly logger = new Logger(PolicyClientService.name);
  private readonly policyServiceUrl: string;
  private readonly authServiceUrl: string;
  private readonly hrServiceUrl: string;

  // orgId → { policies, fetchedAt }
  private readonly cache = new Map<string, { policies: any[]; fetchedAt: number }>();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.policyServiceUrl =
      this.configService.get<string>('POLICY_SERVICE_URL') ||
      'http://policy-service:3013';
    this.authServiceUrl =
      this.configService.get<string>('AUTH_SERVICE_URL') ||
      'http://auth-service:3001';
    this.hrServiceUrl =
      this.configService.get<string>('HR_SERVICE_URL') ||
      'http://hr-service:3010';
  }

  private mintServiceToken(orgId?: string): string {
    return this.jwtService.sign(
      {
        sub: 'attendance-service',
        email: 'system@attendance.nexora',
        firstName: 'Attendance',
        lastName: 'System',
        roles: ['admin'],
        orgRole: 'admin',
        organizationId: orgId || null,
        isPlatformAdmin: false,
      },
      { expiresIn: '2m' },
    );
  }

  private async fetchJSON(url: string, orgId?: string): Promise<any> {
    const token = this.mintServiceToken(orgId);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        this.logger.warn(`Policy fetch failed: ${url} → ${res.status}`);
        return null;
      }
      const json: any = await res.json();
      return json.data ?? json;
    } catch (err) {
      this.logger.warn(`Policy fetch error: ${url} → ${err.message}`);
      return null;
    }
  }

  /**
   * List all active non-template policies for an org, with 30s cache.
   * Returns [] on failure so callers don't have to distinguish "policy
   * service is down" from "no policies configured" — both degrade to the
   * same fallback path.
   */
  async listActivePolicies(orgId: string): Promise<any[]> {
    if (!orgId) return [];

    const cached = this.cache.get(orgId);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.policies;
    }

    // Server-side filter works now that policy-service dropped
    // `enableImplicitConversion` (was coercing "false"→true). Kept a
    // tight client-side `isDeleted` guard because the server filter
    // already excludes deleted — the guard is belt-and-braces.
    const raw = await this.fetchJSON(
      `${this.policyServiceUrl}/api/v1/policies?isActive=true&isTemplate=false&limit=100`,
      orgId,
    );
    const all: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : [];

    const rows = all.filter((p) => p && p.isDeleted !== true);

    this.cache.set(orgId, { policies: rows, fetchedAt: Date.now() });
    return rows;
  }

  /**
   * Resolve the HR employee record for an auth-user id. Used by
   * `resolveShiftPolicy` to map the JWT `sub` (auth user id) onto the HR
   * `_id` that policy-service `applicableIds[]` store, and to get the
   * employee's attached `policyIds[]`.
   */
  async getEmployeeByUserId(
    userId: string,
    orgId: string,
  ): Promise<{ _id: string; policyIds: string[] } | null> {
    if (!userId) return null;
    const raw: any = await this.fetchJSON(
      `${this.hrServiceUrl}/api/v1/employees?userId=${encodeURIComponent(userId)}&limit=1`,
      orgId,
    );
    const rows: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : [];
    const match = rows[0];
    if (!match?._id) return null;
    return {
      _id: String(match._id),
      policyIds: Array.isArray(match.policyIds) ? match.policyIds.map(String) : [],
    };
  }
}
