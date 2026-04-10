# Nexora Tech Debt Tracker

## Active Items

### High Priority

#### 1. Migrate Claude API → Qwen2.5 Coder (self-hosted)
**Status:** Pending
**Owner:** Infrastructure team
**Effort:** 1 week

**Context:**
Nexora currently uses Anthropic Claude API for AI-powered features across the platform. Nugen has an internal self-hosted Qwen2.5 Coder model running that should replace Claude for cost, data privacy, and sovereignty.

**Affected services/features:**
- `ai-service` — Core AI chat endpoint (used by AI Chat page, AI project generation)
- `payroll-service`:
  - Resume parsing (`ExternalServicesService.parseResume`)
  - Smart candidate matching (`ExternalServicesService.computeJobMatchScore`)
- `chat-service` — AI summary generation (`ai-summary.service`)
- `chat-service` — Message translation
- `project-service` — AI project template generation
- `ai-chat` frontend page

**Migration strategy:**
1. Add `AI_PROVIDER` env var (values: `claude` | `qwen`) to `ai-service`
2. Create an adapter pattern in `ai-service` with `ClaudeAdapter` and `QwenAdapter`
3. Both adapters implement a common `IAiProvider` interface:
   ```typescript
   interface IAiProvider {
     chat(messages: Message[], options: ChatOptions): Promise<AiResponse>;
     streamChat(messages: Message[], options: ChatOptions): AsyncIterable<string>;
   }
   ```
4. Qwen adapter should speak the self-hosted model's API (likely OpenAI-compatible format via vLLM/Ollama)
5. All downstream services (`payroll-service`, `chat-service`, `project-service`) already call `ai-service` via HTTP, so they don't need changes
6. Run side-by-side for 2 weeks comparing quality on real prompts
7. Switch default to Qwen, keep Claude as fallback for 1 month, then remove Claude
8. Remove `ANTHROPIC_API_KEY` from env once fully cut over

**Acceptance criteria:**
- All AI features work with `AI_PROVIDER=qwen` without code changes in downstream services
- Latency parity (<20% regression acceptable)
- Structured JSON output quality for resume parsing + match scoring maintained
- Fallback to Claude if Qwen endpoint is down (optional config)

**Files to touch:**
- `services/ai-service/src/ai/ai.service.ts` — add adapter selection
- `services/ai-service/src/ai/providers/claude.provider.ts` — new file
- `services/ai-service/src/ai/providers/qwen.provider.ts` — new file
- `docker-compose.simple.yml` — add Qwen URL env vars
- `.env.example` — document `AI_PROVIDER`, `QWEN_ENDPOINT_URL`

---

### Medium Priority

#### 2. Split payroll.service.ts god class (~4000 lines)
- Extract SalaryStructureService, PayrollRunService, OnboardingService,
  OffboardingService, RecruitmentService, LmsService, EngagementService
- Unblocks parallel development and improves maintainability

#### 3. Add pagination to 2 remaining list endpoints
- `GET /loans/my`, `GET /investment-declarations/my` (currently unbounded)

#### 4. Complete mobile app parity with web payroll
- Expenses, Onboarding, Offboarding, Loans, Analytics screens
- Goals, Reviews, Performance cycles screens

---

### Low Priority

#### 5. 83 gradient uses vs stated white-only theme goal
- Theme decision reversed — keeping current theme. Remove this item.

#### 6. 3 stray `console.log` statements in frontend
- Easy cleanup before production

#### 7. SkeletonLoader component underutilized
- Only used in 14 files out of 50+ pages

#### 8. SOC 2 compliance preparation
- ~2 weeks of documentation + controls setup
- Required for Fortune 500 customer sales

---

## Resolved Items

### Fixed During Main Session (2026-04)

- CORS restricted via env var
- JWT secret validation (no hardcoded fallback)
- RBAC on all 84+ payroll endpoints
- Mandatory orgId on all service methods
- Self-approval prevention (salary + loans)
- Race condition on payroll run initiation (atomic dedup)
- XSS sanitization on AI chat dangerouslySetInnerHTML (5 locations)
- CSRF middleware bypass for Bearer token auth
- Mobile app SDK 54 upgrade with auth fixes
- 16 `as any` casts removed from chat module
- Custom fields + workflow automation (Jira parity)
- Performance Management module (Keka parity)
- Form 16 + statutory reports (legal compliance)
- GDPR export + right to erasure (EU compliance)
- SCIM 2.0 (enterprise SSO provisioning)
- Gantt/Timeline view for projects
- Bank integration (Razorpay Payouts)
- Employee engagement (announcements, kudos, surveys, eNPS)
- LMS with courses + certificates + verification
- AI resume parsing + smart matching
- ML attrition prediction (6-factor model)
- Integration Marketplace foundation (API keys, webhooks)
