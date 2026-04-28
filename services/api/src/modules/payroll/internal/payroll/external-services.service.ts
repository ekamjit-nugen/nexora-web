import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ExternalServicesService {
  private readonly logger = new Logger(ExternalServicesService.name);
  private readonly hrServiceUrl: string;
  private readonly attendanceServiceUrl: string;
  private readonly leaveServiceUrl: string;
  private readonly authServiceUrl: string;
  private readonly aiServiceUrl: string;
  private readonly policyServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.hrServiceUrl = this.configService.get<string>('HR_SERVICE_URL') || 'http://localhost:3010';
    this.attendanceServiceUrl = this.configService.get<string>('ATTENDANCE_SERVICE_URL') || 'http://localhost:3011';
    this.leaveServiceUrl = this.configService.get<string>('LEAVE_SERVICE_URL') || 'http://localhost:3012';
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://ai-service:3080';
    this.policyServiceUrl = this.configService.get<string>('POLICY_SERVICE_URL') || 'http://policy-service:3013';
  }

  /**
   * Mint a short-lived service-to-service JWT with admin scope and a given
   * org context. HR / attendance / auth all require a valid token with
   * `organizationId`; previously payroll called them anonymously and got a
   * blanket 401, so every cross-service lookup silently fell back to
   * defaults (wrong payroll numbers). Used when no user token is available
   * (e.g. inside background processing of a run).
   */
  private mintServiceToken(orgId?: string): string {
    return this.jwtService.sign(
      {
        sub: 'payroll-service',
        email: 'system@payroll.nexora',
        firstName: 'Payroll',
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
   * fetchJSON accepts either a forwarded user token, or — if none is
   * provided — an optional orgId so it can mint a service token with that
   * tenant scope. Callers that already have a user token should pass it
   * through so downstream audit logs record the real actor.
   */
  private async fetchJSON(
    url: string,
    token?: string,
    orgIdForServiceToken?: string,
  ): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = token || this.mintServiceToken(orgIdForServiceToken);
    headers['Authorization'] = `Bearer ${authToken}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`External call failed: ${url} → ${res.status}`);
        return null;
      }
      const json: any = await res.json();
      return json.data || json;
    } catch (err) {
      this.logger.warn(`External call error: ${url} → ${err.message}`);
      return null;
    }
  }

  // Fetch employee details from hr-service. Accepts either a raw
  // ObjectId or a business employeeId (e.g. "NXR-0003") — if the input
  // isn't a valid ObjectId, we fall back to `GET /employees?search=<id>`
  // and pick the exact match on `employeeId`. This unifies the two
  // callsite shapes (payroll uses ObjectIds; offboarding uses business
  // ids) without requiring callers to know which they have.
  async getEmployee(employeeId: string, token?: string, orgId?: string): Promise<any> {
    if (!employeeId) return null;
    if (/^[0-9a-fA-F]{24}$/.test(employeeId)) {
      return this.fetchJSON(`${this.hrServiceUrl}/api/v1/employees/${employeeId}`, token, orgId);
    }
    // Business id path — search + exact match, then re-fetch by ObjectId
    // so the response includes the populated dept/designation names that
    // the list endpoint doesn't return.
    const listRaw: any = await this.fetchJSON(
      `${this.hrServiceUrl}/api/v1/employees?search=${encodeURIComponent(employeeId)}&limit=5`,
      token,
      orgId,
    );
    const rows: any[] = Array.isArray(listRaw)
      ? listRaw
      : Array.isArray(listRaw?.data)
        ? listRaw.data
        : Array.isArray(listRaw?.items)
          ? listRaw.items
          : [];
    const match = rows.find((e: any) => e?.employeeId === employeeId) || rows[0] || null;
    if (!match?._id) return match;
    return this.fetchJSON(`${this.hrServiceUrl}/api/v1/employees/${String(match._id)}`, token, orgId);
  }

  // Resolve the HR employee row for a given auth user. Used by endpoints
  // like `/salary-structures/me` where the caller doesn't know their
  // HR-employee _id but is authenticated with a user token.
  //
  // Prefers email as the join key because the HR `userId` column is an
  // internal synthetic id for records created outside the invite flow
  // (legacy imports, synthetic tenants) and may not equal the auth-service
  // user `_id`. Email is guaranteed unique within an org by the compound
  // index and matches between services. Falls back to userId if email is
  // unavailable. Returns null if no HR row exists in the org.
  async getEmployeeByUserIdentity(
    identity: { userId?: string; email?: string },
    token?: string,
    orgId?: string,
  ): Promise<any | null> {
    const tryQuery = async (qs: string) => {
      const result = await this.fetchJSON(
        `${this.hrServiceUrl}/api/v1/employees?${qs}&limit=1`,
        token,
        orgId,
      );
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.items)
            ? result.items
            : [];
      return list[0] || null;
    };

    if (identity.email) {
      const byEmail = await tryQuery(`search=${encodeURIComponent(identity.email)}`);
      // `search` is a fuzzy regex match; ensure exact email equality.
      if (byEmail && String(byEmail.email || '').toLowerCase() === identity.email.toLowerCase()) {
        return byEmail;
      }
    }
    if (identity.userId) {
      return tryQuery(`userId=${encodeURIComponent(identity.userId)}`);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Canonical employee-id resolver (P3.1)
  //
  // Nexora has historically leaked three distinct ID shapes into
  // collections that all name their field `employeeId: string`:
  //
  //   • HR `_id` (Mongo ObjectId, 24 hex chars) — canonical HR master
  //     record. Used by: PayrollEntry, Payslip, SalaryStructure.
  //   • Auth user `_id` (Mongo ObjectId, 24 hex chars) — JWT sub.
  //     Used by: Leave, LeaveBalance, Attendance, ExpenseClaim,
  //     InvestmentDeclaration.
  //   • Business id (e.g. "NXR-0003") — human-readable display id.
  //     Used by: Onboarding, Offboarding.
  //
  // The existing `getEmployee(id)` accepts HR-_id OR business-id (and
  // fuzzy-search-falls-back). `getEmployeeByUserIdentity({userId})` takes
  // auth sub. Neither can tell whether a 24-hex ObjectId is the HR _id
  // or the auth user _id — they're indistinguishable shape-wise.
  //
  // `canonicalizeEmployeeId` inspects the input, tries the cheap paths
  // first (business-id pattern → search; non-hex → reject), then probes
  // hr-service with the ObjectId as the HR `_id`, then falls back to
  // treating it as an auth user `_id`. Returns a full record object so
  // callers can read whichever shape they need without another round-trip.
  //
  // Use this instead of building another ad-hoc resolver. All future
  // cross-service lookups should funnel through here — it's the single
  // source of truth for "who is this actually?".
  //
  // The proper fix (write schemas using HR `_id` consistently, migrate
  // data) is tracked as #19 — multi-day project. This helper is the
  // bridge until that ships.
  // ─────────────────────────────────────────────────────────────────────
  async canonicalizeEmployeeId(
    input: string,
    orgId: string,
    token?: string,
  ): Promise<{
    hrId: string | null;
    authUserId: string | null;
    businessId: string | null;
    shape: 'hr_id' | 'auth_user_id' | 'business_id' | 'unknown';
    employee: any | null;
  }> {
    const none = {
      hrId: null,
      authUserId: null,
      businessId: null,
      shape: 'unknown' as const,
      employee: null,
    };
    if (!input) return none;

    const trimmed = String(input).trim();
    const isHex24 = /^[0-9a-fA-F]{24}$/.test(trimmed);

    // Business id — obvious shape (not hex, contains non-hex chars).
    if (!isHex24) {
      const emp = await this.getEmployee(trimmed, token, orgId);
      if (emp?._id) {
        return {
          hrId: String(emp._id),
          authUserId: emp.userId || null,
          businessId: emp.employeeId || trimmed,
          shape: 'business_id',
          employee: emp,
        };
      }
      return { ...none, businessId: trimmed };
    }

    // 24-hex ObjectId — could be HR _id or auth user _id. Try HR first
    // (one query), fall back to auth-user lookup via getEmployeeByUserIdentity.
    const asHr = await this.getEmployee(trimmed, token, orgId);
    if (asHr?._id && String(asHr._id) === trimmed) {
      return {
        hrId: trimmed,
        authUserId: asHr.userId || null,
        businessId: asHr.employeeId || null,
        shape: 'hr_id',
        employee: asHr,
      };
    }

    const asAuthUser = await this.getEmployeeByUserIdentity(
      { userId: trimmed },
      token,
      orgId,
    );
    if (asAuthUser?._id) {
      return {
        hrId: String(asAuthUser._id),
        authUserId: trimmed,
        businessId: asAuthUser.employeeId || null,
        shape: 'auth_user_id',
        employee: asAuthUser,
      };
    }

    // Unknown — return the raw input in whichever slot is least wrong.
    // Callers should treat this as "employee not found" and surface it.
    return { ...none, shape: 'unknown' };
  }

  // Fetch the direct-report employeeIds for a given manager. Used for
  // authorization scoping on manager-facing endpoints (e.g., getAllGoals).
  // Returns [] on any failure so callers fall closed (caller sees only
  // their own rows, not their reports').
  async getDirectReports(managerId: string, token?: string, orgId?: string): Promise<string[]> {
    try {
      const result = await this.fetchJSON(
        `${this.hrServiceUrl}/api/v1/employees?managerId=${encodeURIComponent(managerId)}&limit=5000`,
        token,
        orgId,
      );
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.items)
            ? result.items
            : [];
      return list
        .map((e: any) => e.employeeId || e._id || e.id)
        .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
    } catch {
      return [];
    }
  }

  // Fetch active employee roster for an org. Used for review-cycle startup
  // to ensure new joiners are included even before they have a salary
  // structure provisioned. Returns null on any failure so callers can fall
  // back to an alternate source of truth.
  async getActiveEmployees(orgId: string, token?: string): Promise<any[] | null> {
    try {
      const result = await this.fetchJSON(
        `${this.hrServiceUrl}/api/v1/employees?status=active&limit=5000`,
        token,
        orgId,
      );
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.data)) return result.data;
      if (result && Array.isArray(result.items)) return result.items;
      return null;
    } catch {
      return null;
    }
  }

  // Fetch attendance summary for a month from attendance-service.
  // attendance-service's `AttendanceQueryDto` accepts `startDate`/`endDate`
  // (ISO date strings), NOT `month`/`year`. Previously payroll called with
  // month/year query params and got a 400 ("property month should not
  // exist"), silently falling back to "full attendance" defaults. Convert
  // the pay period into a start/end date range here.
  async getMonthlyAttendance(employeeId: string, month: number, year: number, token?: string, orgId?: string): Promise<any> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate(); // month is 1-indexed input
    const startDate = `${year}-${pad(month)}-01`;
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;
    return this.fetchJSON(
      `${this.attendanceServiceUrl}/api/v1/attendance?employeeId=${encodeURIComponent(employeeId)}&startDate=${startDate}&endDate=${endDate}&limit=100`,
      token,
      orgId,
    );
  }

  // Fetch leave records for a period from leave-service
  async getLeaveRecords(employeeId: string, startDate: string, endDate: string, token?: string, orgId?: string): Promise<any> {
    return this.fetchJSON(
      `${this.leaveServiceUrl}/api/v1/leaves/my?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`,
      token,
      orgId,
    );
  }

  // Fetch org payroll config from auth-service
  async getPayrollConfig(orgId: string, token?: string): Promise<any> {
    return this.fetchJSON(`${this.authServiceUrl}/api/v1/settings/payroll`, token, orgId);
  }

  /**
   * Fetch declared holidays for the given year. Used by processPayrollRun
   * to reclassify absents-on-holiday as holiday status (so they don't
   * trigger LOP). Returns ISO date strings (YYYY-MM-DD) at UTC midnight,
   * ready for Set-based `has(date)` lookups in the engine.
   *
   * Falls back to an empty array on any network error — worst case,
   * the engine treats a holiday as a regular working day and an absent
   * employee eats an LOP day they shouldn't. HR can fix via Adjust.
   * Better than blocking the entire payroll run on an attendance-service blip.
   */
  async getHolidayDates(
    orgId: string,
    year: number,
    token?: string,
  ): Promise<string[]> {
    const raw = await this.fetchJSON(
      `${this.attendanceServiceUrl}/api/v1/holidays?year=${year}`,
      token,
      orgId,
    );
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];
    return list
      .map((h) => {
        const d = h?.date ? new Date(h.date) : null;
        return d && !isNaN(d.getTime())
          ? d.toISOString().slice(0, 10)
          : null;
      })
      .filter((x): x is string => !!x);
  }

  /**
   * Walks the target employee's reporting chain upward and returns true
   * if the chain contains `callerHrId`. Used by salary-visibility role
   * gating (P2.3) — managers should see salaries only for their direct
   * + indirect reports, not peers or skip-level employees.
   *
   * Guards:
   *   - Bounded depth (max 6 hops) — prevents run-away recursion if the
   *     HR data has a cycle (shouldn't, but defence in depth).
   *   - Caches visited employees within a single call so a diamond in
   *     the hierarchy (rare but possible) doesn't re-fetch.
   *   - Returns false on any network error; the caller layers its own
   *     "privileged roles bypass this check" logic on top so a
   *     transient hr-service blip doesn't wedge the whole salary UI.
   */
  async isReportOfCaller(
    callerHrId: string,
    targetHrId: string,
    orgId: string,
    token?: string,
  ): Promise<boolean> {
    if (!callerHrId || !targetHrId) return false;
    if (callerHrId === targetHrId) return true; // self always allowed
    const visited = new Set<string>();
    let currentId: string | null = targetHrId;
    for (let hops = 0; hops < 6 && currentId; hops++) {
      if (visited.has(currentId)) return false; // cycle
      visited.add(currentId);
      const emp = await this.getEmployee(currentId, token, orgId);
      const mgrId = emp?.reportingManagerId ? String(emp.reportingManagerId) : null;
      if (!mgrId) return false;
      if (mgrId === callerHrId) return true;
      currentId = mgrId;
    }
    return false;
  }

  /**
   * Create a hr-service Employee record. Used by the recruitment flow
   * (#17) when a candidate's offer is accepted and we need to promote
   * them into the HR directory so payroll / attendance / leave can
   * key off a real employee id. Was previously a placeholder (`EMP-${Date.now()}`)
   * that never synced to hr-service — onboarding couldn't find the hire.
   *
   * Returns the created employee doc on success, or `null` on failure
   * so caller can decide whether to fall back to the placeholder.
   */
  async createHrEmployee(
    payload: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      joiningDate: string; // ISO
      designationId?: string;
      departmentId?: string;
      employmentType?: string;
      location?: string;
    },
    token?: string,
    orgId?: string,
  ): Promise<any> {
    const method = 'POST';
    const url = `${this.hrServiceUrl}/api/v1/employees`;
    const authToken = token || this.mintServiceToken(orgId);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `createHrEmployee failed ${res.status}: ${text.slice(0, 400)}`,
        );
        return null;
      }
      const json: any = await res.json();
      return json.data ?? json;
    } catch (err) {
      this.logger.warn(`createHrEmployee error: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetch an employee's leave balance with `encashable` flags attached
   * per leave type. Used during offboarding F&F (#13) so the encashment
   * block is computed against the actual unused-but-encashable count,
   * not the old hardcoded 15 days.
   *
   * `userId` here is the AUTH user id (JWT sub) — that's what
   * `LeaveBalance.employeeId` stores. Payroll callers have the HR `_id`
   * and must resolve to `userId` via `getEmployee(hrId)` first.
   *
   * Returns `null` on any leave-service failure — the F&F calculator
   * then falls back to a safer zero-encashment default and logs so
   * HR can adjust manually. Better than exploding the whole F&F flow
   * when leave-service is transiently down.
   */
  async getLeaveBalanceForEncashment(
    userId: string,
    year: number,
    token?: string,
    orgId?: string,
  ): Promise<any> {
    if (!userId) return null;
    return this.fetchJSON(
      `${this.leaveServiceUrl}/api/v1/leaves/balance/by-user/${encodeURIComponent(userId)}?year=${year}`,
      token,
      orgId,
    );
  }

  /**
   * Fetch a batch of policies by id. Used by payroll to resolve the
   * `employee.policyIds[]` attachments during a run so per-employee
   * overrides (PF rate tweaks, state-specific PT, etc.) can be layered
   * on top of the org-level config.
   *
   * policy-service exposes a list endpoint `/api/v1/policies?ids=a,b,c`
   * but isn't deployed in every environment — we tolerate that by
   * returning an empty array on any transport failure, letting payroll
   * fall through to org-level defaults gracefully.
   */
  async getPoliciesByIds(policyIds: string[], token?: string, orgId?: string): Promise<any[]> {
    if (!Array.isArray(policyIds) || policyIds.length === 0) return [];
    // Fetch each policy by id. Parallelised via Promise.all; failures per
    // policy become nulls and are filtered out so one broken id doesn't
    // black-hole the entire set.
    const results = await Promise.all(
      policyIds.map((id) =>
        this.fetchJSON(`${this.policyServiceUrl}/api/v1/policies/${encodeURIComponent(id)}`, token, orgId).catch(() => null),
      ),
    );
    return results.filter(Boolean);
  }

  // Fetch org business details from auth-service
  async getOrgDetails(orgId: string, token?: string): Promise<any> {
    return this.fetchJSON(`${this.authServiceUrl}/api/v1/settings/business`, token, orgId);
  }

  // Parse resume using AI service
  async parseResume(resumeText: string): Promise<any | null> {
    const prompt = `Extract structured data from this resume. Return JSON only with this exact shape:
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "location": "...",
  "summary": "...",
  "skills": ["skill1", "skill2"],
  "experience": [{"company": "...", "role": "...", "duration": "...", "description": "..."}],
  "education": [{"institution": "...", "degree": "...", "year": 2020}],
  "totalExperienceYears": 5,
  "languages": ["English"],
  "certifications": []
}

Resume:
${resumeText}

Return only valid JSON, no markdown, no commentary.`;

    // ai-service guards `/ai/chat` with JwtAuthGuard — the old call
    // skipped the Authorization header entirely and 401'd, which the
    // fetchJSON wrapper then surfaced as a generic 503. Mint a short
    // service token so the payroll → ai-service hop is authenticated.
    // Field shape fixes: ai-service returns `{data: {text, usage}}`;
    // old code read `.response` / `.content` which were never present.
    // Camel-case `maxTokens` to match the ai-service DTO.
    try {
      const serviceToken = this.mintServiceToken();
      const res = await fetch(`${this.aiServiceUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 2000,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.logger.warn(`parseResume: ai-service ${res.status}: ${txt.slice(0, 300)}`);
        return null;
      }
      const json: any = await res.json();
      const text: string = json.data?.text ?? json.text ?? json.data?.response ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        this.logger.warn(`parseResume: no JSON object found in LLM output (len=${text.length})`);
        return null;
      }
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        this.logger.warn(`parseResume: JSON.parse failed: ${e.message}`);
        return null;
      }
    } catch (err) {
      this.logger.warn(`Resume parsing failed: ${err.message}`);
      return null;
    }
  }

  // Compute match score using AI
  async computeJobMatchScore(
    jobDescription: string,
    candidateResume: any,
  ): Promise<{ score: number; reasoning: string; matchedSkills: string[]; missingSkills: string[] } | null> {
    const prompt = `Rate this candidate's fit for the job on a scale of 0-100. Return JSON only:
{
  "score": 85,
  "reasoning": "...",
  "matchedSkills": [],
  "missingSkills": []
}

Job Description:
${jobDescription}

Candidate:
Skills: ${JSON.stringify(candidateResume?.skills || [])}
Experience: ${JSON.stringify(candidateResume?.experience || [])}
Total Experience: ${candidateResume?.totalExperienceYears || 0} years
Summary: ${candidateResume?.summary || ''}

Return only valid JSON.`;

    // Same auth + response-shape + field-name fixes as parseResume above.
    try {
      const serviceToken = this.mintServiceToken();
      const res = await fetch(`${this.aiServiceUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          maxTokens: 1000,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.logger.warn(`matchScore: ai-service ${res.status}: ${txt.slice(0, 300)}`);
        return null;
      }
      const json: any = await res.json();
      const text: string = json.data?.text ?? json.text ?? json.data?.response ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    } catch (err) {
      this.logger.warn(`Match score computation failed: ${err.message}`);
      return null;
    }
  }
}
