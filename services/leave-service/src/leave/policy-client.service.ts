import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/**
 * Thin HTTP client for policy-service. Added as part of #10 (policy
 * schema consolidation): leave-service stops treating its local
 * `LeavePolicy` collection as the source of truth and reads leave rules
 * (annual allocation, carry-forward, encashable, etc.) from
 * policy-service instead. The local schema is kept for historical data
 * and for graceful fallback when policy-service is unreachable.
 *
 * See also: attendance-service/policy-client.service.ts — mirror image.
 */
@Injectable()
export class PolicyClientService {
  private readonly logger = new Logger(PolicyClientService.name);
  private readonly policyServiceUrl: string;

  private readonly cache = new Map<string, { policies: any[]; fetchedAt: number }>();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.policyServiceUrl =
      this.configService.get<string>('POLICY_SERVICE_URL') ||
      'http://policy-service:3013';
  }

  private mintServiceToken(orgId?: string): string {
    return this.jwtService.sign(
      {
        sub: 'leave-service',
        email: 'system@leave.nexora',
        firstName: 'Leave',
        lastName: 'System',
        roles: ['admin'],
        orgRole: 'admin',
        organizationId: orgId || null,
        isPlatformAdmin: false,
      },
      { expiresIn: '2m' },
    );
  }

  /**
   * Return the active `leave` category policy for an org, if any.
   * Applicability precedence when multiple `leave` policies exist:
   *   1. `applicableTo:'all'` (org-wide default)
   * Specific-to-employee overrides could be layered here later; leave
   * allocation is initialised once per employee per year, so a
   * background job is what would replay overrides — beyond scope here.
   *
   * Returns the raw policy document (or null) so caller can project the
   * subset of fields it actually needs. 30s in-memory cache.
   */
  async getLeavePolicy(orgId: string): Promise<any | null> {
    if (!orgId) return null;

    const cached = this.cache.get(orgId);
    const cachedHit =
      cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS
        ? cached.policies
        : null;
    const policies = cachedHit ?? (await this.fetchPolicies(orgId));
    if (!cachedHit) {
      this.cache.set(orgId, { policies, fetchedAt: Date.now() });
    }

    const candidates = policies.filter(
      (p) =>
        p &&
        p.category === 'leave' &&
        Array.isArray(p.leaveConfig?.leaveTypes) &&
        p.leaveConfig.leaveTypes.length > 0,
    );
    if (candidates.length === 0) return null;

    // Prefer specific-to-all rules over none; if multiple, most recently
    // updated wins. No per-employee routing here — admin intent at the
    // annual-allocation stage is org-wide consistency.
    const general = candidates
      .filter((p) => p.applicableTo === 'all' || !p.applicableTo)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      );
    return general[0] || candidates[0];
  }

  /**
   * Return the active `wfh` category policy for an org, if any. Used
   * by leave-service.applyLeave to enforce WFH-specific caps
   * (`maxDaysPerMonth`, `allowedDays`, `requiresApproval`). Returns
   * null when the org has no WFH policy configured — caller should
   * treat WFH as uncapped (matches historical behaviour for orgs
   * that haven't configured one). Cache key includes the category
   * so 'leave' and 'wfh' lookups don't trample each other.
   */
  async getWfhPolicy(orgId: string): Promise<any | null> {
    if (!orgId) return null;
    const cacheKey = `${orgId}:wfh`;
    const cached = this.cache.get(cacheKey);
    const cachedHit =
      cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS
        ? cached.policies
        : null;
    const policies = cachedHit ?? (await this.fetchPolicies(orgId, 'wfh'));
    if (!cachedHit) {
      this.cache.set(cacheKey, { policies, fetchedAt: Date.now() });
    }
    const candidates = policies.filter((p) => p && p.category === 'wfh' && p.wfhConfig);
    if (candidates.length === 0) return null;
    const general = candidates
      .filter((p) => p.applicableTo === 'all' || !p.applicableTo)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      );
    return general[0] || candidates[0];
  }

  private async fetchPolicies(orgId: string, category: string = 'leave'): Promise<any[]> {
    const token = this.mintServiceToken(orgId);
    // Server-side boolean filters work now that policy-service dropped
    // `enableImplicitConversion`. Was previously filtering client-side
    // as a workaround.
    const url = `${this.policyServiceUrl}/api/v1/policies?category=${category}&isActive=true&isTemplate=false&limit=50`;
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
        return [];
      }
      const json: any = await res.json();
      const raw = json.data ?? json;
      const all = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.items)
            ? raw.items
            : [];
      return all.filter(
        (p: any) => p && p.isActive !== false && p.isTemplate !== true && p.isDeleted !== true,
      );
    } catch (err) {
      this.logger.warn(`Policy fetch error: ${url} → ${err.message}`);
      return [];
    }
  }
}
