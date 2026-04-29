import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AUTH_DB } from '../database/database.tokens';

/**
 * Feature-flag enforcement at the API layer.
 *
 * Use:
 *
 *   @Controller('helpdesk')
 *   @UseGuards(JwtAuthGuard, FeatureGuard)
 *   @RequireFeature('helpdesk')
 *   export class HelpdeskController { ... }
 *
 * Or per-handler when only some routes should be gated:
 *
 *   @Get('list')
 *   @RequireFeature('learning')
 *   async list() { ... }
 *
 * What it does:
 *   1. Reads the JWT-derived organizationId from request.user (set by
 *      JwtAuthGuard, which MUST run before FeatureGuard).
 *   2. Looks up the org's features doc (cached 30s — see
 *      FeatureLookupService).
 *   3. If the named feature is disabled, throws ForbiddenException with
 *      a stable error code so the frontend can detect it and react
 *      (toast, redirect, etc.).
 *   4. Platform admins always pass — they sit above tenants.
 *
 * What it does NOT do:
 *   - Owner / admin bypass. The frontend has an explicit
 *     "preview disabled features" toggle for that. Backend enforces
 *     the actual contract uniformly: if the flag is off, the API is
 *     off, period.
 */

export const REQUIRE_FEATURE_KEY = 'nexora.requireFeature';
export const RequireFeature = (featureKey: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, featureKey);

/**
 * Path → feature key map. ORDER MATTERS — first match wins. More
 * specific paths must come before more general ones. Used by FeatureGuard
 * when no @RequireFeature metadata is set on the route — covers the
 * payroll mega-controller which serves dozens of feature areas off
 * one class. Add new entries here when shipping a new flag-gated
 * route family.
 */
const PATH_FEATURE_RULES: Array<{ re: RegExp; feature: string }> = [
  // Strip query string before matching. The regex has /api/v1 prefix
  // because that's the global prefix set in main.ts.

  // ── Payroll sub-features (the mega-controller's many faces) ──
  { re: /^\/api\/v1\/loans(\/|$|\?)/,                   feature: 'loans' },
  { re: /^\/api\/v1\/employee-loans(\/|$|\?)/,          feature: 'loans' },
  { re: /^\/api\/v1\/investment-declarations(\/|$|\?)/, feature: 'declarations' },
  { re: /^\/api\/v1\/expense-claims(\/|$|\?)/,          feature: 'expenseManagement' },
  { re: /^\/api\/v1\/expenses(\/|$|\?)/,                feature: 'expenseManagement' },
  { re: /^\/api\/v1\/jobs(\/|$|\?)/,                    feature: 'recruitment' },
  { re: /^\/api\/v1\/job-postings(\/|$|\?)/,            feature: 'recruitment' },
  { re: /^\/api\/v1\/candidates(\/|$|\?)/,              feature: 'recruitment' },
  { re: /^\/api\/v1\/courses(\/|$|\?)/,                 feature: 'learning' },
  { re: /^\/api\/v1\/enrollments(\/|$|\?)/,             feature: 'learning' },
  { re: /^\/api\/v1\/certificates(\/|$|\?)/,            feature: 'learning' },
  { re: /^\/api\/v1\/learning-paths(\/|$|\?)/,          feature: 'learning' },
  { re: /^\/api\/v1\/surveys(\/|$|\?)/,                 feature: 'surveys' },
  { re: /^\/api\/v1\/kudos(\/|$|\?)/,                   feature: 'kudos' },
  { re: /^\/api\/v1\/announcements(\/|$|\?)/,           feature: 'announcements' },
  { re: /^\/api\/v1\/reviews(\/|$|\?)/,                 feature: 'performance' },
  { re: /^\/api\/v1\/performance-cycles(\/|$|\?)/,      feature: 'performance' },
  { re: /^\/api\/v1\/goals(\/|$|\?)/,                   feature: 'performance' },
  { re: /^\/api\/v1\/onboarding(\/|$|\?)/,              feature: 'recruitment' },
  // /offboarding is part of standard HR — leave open even if recruitment is off.

  // ── HR sub-features ──
  { re: /^\/api\/v1\/timesheets(\/|$|\?)/,              feature: 'timesheets' },
  { re: /^\/api\/v1\/invoices(\/|$|\?)/,                feature: 'invoices' },
  { re: /^\/api\/v1\/clients(\/|$|\?)/,                 feature: 'clients' },
  { re: /^\/api\/v1\/billing-rates(\/|$|\?)/,           feature: 'invoices' },
  { re: /^\/api\/v1\/call-logs(\/|$|\?)/,               feature: 'calls' },

  // ── Whole-module gates (also class-level @RequireFeature; this is a backup) ──
  { re: /^\/api\/v1\/helpdesk(\/|$|\?)/,                feature: 'helpdesk' },
  { re: /^\/api\/v1\/assets(\/|$|\?)/,                  feature: 'assetManagement' },
  { re: /^\/api\/v1\/bench(\/|$|\?)/,                   feature: 'bench' },
  { re: /^\/api\/v1\/knowledge(\/|$|\?)/,               feature: 'knowledge' },
  { re: /^\/api\/v1\/calls(\/|$|\?)/,                   feature: 'calls' },
  { re: /^\/api\/v1\/meetings(\/|$|\?)/,                feature: 'calls' },
  { re: /^\/api\/v1\/messages(\/|$|\?)/,                feature: 'chat' },
  { re: /^\/api\/v1\/conversations(\/|$|\?)/,           feature: 'chat' },
  { re: /^\/api\/v1\/channels(\/|$|\?)/,                feature: 'chat' },
];

function inferFeatureFromPath(url: string): string | undefined {
  if (!url) return undefined;
  // Strip query string + hash before matching.
  const path = url.split('?')[0].split('#')[0];
  for (const rule of PATH_FEATURE_RULES) {
    if (rule.re.test(path)) return rule.feature;
  }
  return undefined;
}

/**
 * Resolves `org.features.<key>.enabled` with a small in-memory cache
 * (30s TTL) so we don't hit Mongo on every request. Cache key is orgId;
 * value is the entire features map projected to a flat `Record<string,
 * boolean>` so each subsequent feature check is O(1).
 *
 * Defined ABOVE FeatureGuard because TypeScript / Node's class-load
 * order requires the type referenced in a constructor to be defined
 * before the class that depends on it — otherwise we hit
 * "Cannot access 'FeatureLookupService' before initialization" at
 * Nest factory time.
 */
/**
 * Features that default to OFF when an org's `features` doc doesn't
 * explicitly include the key. Reasoning: these are either
 *   (a) "tier 2" modules that aren't core to running payroll/HR for a
 *       typical Indian SMB (recruitment, learning, surveys, kudos),
 *   (b) features whose end-to-end implementation isn't 100% verified
 *       yet (loans, declarations) — see docs/feature-readiness.md.
 *
 * For all other keys, missing means ENABLED. This is so a brand-new
 * module shipping doesn't accidentally lock everyone out until each
 * tenant's flags get backfilled.
 */
const DEFAULT_OFF: Record<string, true> = {
  // Modules already gated by frontend OPT_IN_FLAGS
  customFields: true,
  automations: true,
  // Off by default in the schema's defaults
  ai: true,
  recruitment: true,
  expenseManagement: true,
  assetManagement: true,
  // "Tier 2" — exists but not verified end-to-end for any tenant yet
  loans: true,
  declarations: true,
  surveys: true,
  kudos: true,
  announcements: true,
  learning: true,
  performance: true,
  bench: true,
  helpdesk: true,
  knowledge: true,
  invoices: true,
  timesheets: true,
  clients: true,
  chat: true,
  calls: true,
};

interface CacheEntry {
  flags: Record<string, boolean>;
  expiresAt: number;
}

@Injectable()
export class FeatureLookupService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 30_000;

  constructor(
    @InjectModel('Organization', AUTH_DB)
    private readonly orgModel: Model<any>,
  ) {}

  async isEnabled(organizationId: string, key: string): Promise<boolean> {
    let entry = this.cache.get(organizationId);
    if (!entry || entry.expiresAt < Date.now()) {
      entry = await this.refresh(organizationId);
    }
    if (key in entry.flags) return entry.flags[key];
    return !DEFAULT_OFF[key];
  }

  /** Force-clear the cache for an org — call after flag updates. */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  private async refresh(organizationId: string): Promise<CacheEntry> {
    const org: any = await this.orgModel
      .findById(organizationId, { features: 1 })
      .lean();
    const flags: Record<string, boolean> = {};
    if (org?.features) {
      for (const [k, v] of Object.entries(org.features)) {
        flags[k] = (v as any)?.enabled === true;
      }
    }
    const entry: CacheEntry = {
      flags,
      expiresAt: Date.now() + this.TTL_MS,
    };
    this.cache.set(organizationId, entry);
    return entry;
  }
}

@Injectable()
export class FeatureGuard implements CanActivate {
  private readonly log = new Logger(FeatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureLookupService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // 1. Explicit @RequireFeature metadata wins.
    let required = this.reflector.getAllAndOverride<string>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    // 2. Else, infer from the URL path. This is what gates the giant
    //    payroll.controller.ts which serves loans, declarations,
    //    surveys, kudos, learning, etc. on the same controller class
    //    — too many routes to decorate one by one.
    if (!required) required = inferFeatureFromPath(req.url || '');
    // 3. No match anywhere → no gating.
    if (!required) return true;

    const user = req.user;

    // JwtAuthGuard didn't fire (e.g. @Public route) → don't second-guess
    // upstream auth. If the route is public AND feature-gated, we
    // require an org somehow; without one we can't decide, so pass.
    if (!user || !user.organizationId) return true;

    // Platform admins always pass — they sit above tenants.
    if (user.isPlatformAdmin === true) return true;

    const enabled = await this.features.isEnabled(user.organizationId, required);
    if (enabled) return true;

    this.log.debug(
      `403 FEATURE_DISABLED: ${required} for org=${user.organizationId} on ${req.method} ${req.url}`,
    );
    throw new ForbiddenException({
      code: 'FEATURE_DISABLED',
      message: `This feature ('${required}') is not enabled for your organization. Ask your admin to turn it on in Settings → Features.`,
      feature: required,
    });
  }
}
