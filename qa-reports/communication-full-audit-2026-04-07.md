# Communication Stack Full Audit Report

**Auditor:** Vegeta (QA Sentinel)
**Date:** 2026-04-07
**Scope:** Chat Service, Calling Service, Notification Service, Media Service, API Gateway, Frontend (55+ components, 8 hooks)
**Method:** 5 parallel deep-dive agents reading every file, tracing 12 integration flows, auditing 65 modules

---

## Executive Summary

The Nexora communication stack is **functionally rich but has serious security and integration gaps** that will cause production incidents. The codebase has strong architecture and comprehensive feature coverage, but critical enforcement layers are missing — DLP rules exist but are never called, retention cron never runs, meeting events have zero authorization, and the API gateway uses `jwt.decode()` instead of `jwt.verify()`.

**88% of modules have ZERO test coverage.** The real-time layer (WebSocket gateways, presence, sync) and supporting services (notifications, media) are a complete testing desert.

### Finding Distribution

| Severity | Chat | Calling | Frontend | Media/Notif/Integration | Total |
|----------|------|---------|----------|------------------------|-------|
| CRITICAL | 6 | 8 | 5 | 4 | **23** |
| HIGH | 12 | 13 | 9 | 8 | **42** |
| MEDIUM | 20 | 18 | 16 | 14 | **68** |
| LOW | 14 | 15 | 17 | 10 | **56** |
| **Total** | **52** | **54** | **47** | **36** | **189** |

### Use Cases Missing: 26 production-failure scenarios identified
### Test Coverage: 12% of modules tested (8 of 65)

---

## TOP 20 MUST-FIX ITEMS

### Security — Fix Before Any Deployment

| # | ID | Service | Finding | Impact |
|---|-----|---------|---------|--------|
| 1 | GW-001 | API Gateway | `jwt.decode()` used instead of `jwt.verify()` — forged tokens accepted | Any attacker can spoof organizationId across all services |
| 2 | C-005 | Chat | Hardcoded JWT fallback `'nexora-secret-key-change-in-production'` | Full system compromise if env var unset |
| 3 | C-001 (calling) | Calling | Same hardcoded JWT fallback in calling service | Same as above |
| 4 | C-004/C-005/C-006 | Calling | Meeting lobby/breakout/mute events have ZERO authorization | Any participant can admin any meeting |
| 5 | C-003 | Calling | Meeting gateway silently downgrades expired tokens to anonymous | Expired tokens get anonymous access |
| 6 | C01/C02 | Frontend | `dangerouslySetInnerHTML` with unsanitized content (2 locations) | XSS → token theft → full account takeover |
| 7 | C-001 (chat) | Chat | Webhook auth is optional — missing signature header accepted | Attackers can inject messages into any channel |
| 8 | MS-001 | Media | Presigned URL bypasses org isolation via header spoofing | Cross-tenant file access |
| 9 | H-011/H-012 | Calling | Cross-tenant data via spoofed `x-organization-id` header | Users access other org's call/meeting data |
| 10 | C04 | Frontend | Tokens in localStorage + XSS = full account takeover chain | Combined with C01/C02, this is critical |

### Integration — Broken Flows

| # | ID | Flow | Finding | Impact |
|---|-----|------|---------|--------|
| 11 | XS-008 | DLP → Message Block | DLP service exists but is NEVER called in message send flow | All DLP rules (block/redact) are completely ineffective |
| 12 | XS-011 | Retention → Deletion | Cron job passes empty `{}` data, processor skips execution | Retention policies never run — messages never cleaned up |
| 13 | XS-005 | Recording → Upload | Upload sends NO auth header — media-service rejects with 401 | Recordings captured but never stored |
| 14 | XS-003 | File → Chat Display | No media-service integration — raw frontend URLs stored | Thumbnails generated but unreachable from chat |
| 15 | XS-004 | Meeting → Chat | Meeting chat is ephemeral WebSocket only — not persisted | Meeting chat messages lost on disconnect/refresh |

### Data Integrity — Will Cause Compliance Issues

| # | ID | Service | Finding | Impact |
|---|-----|---------|---------|--------|
| 16 | UC-003 | Chat | Delete message under legal hold — NOT prevented | Compliance violation — legally held evidence destroyed |
| 17 | H-001/H-002 | Calling | Dual schema registrations for Call and Meeting models | Runtime errors when wrong schema loads first |
| 18 | UC-019 | All | Token never re-validated during WebSocket session | Revoked/expired tokens maintain indefinite access |
| 19 | UC-015 | Calling | Meeting host disconnect — no host transfer | Meetings become unmanageable |
| 20 | C05 | Frontend | `setNewMessage` undefined — runtime crash on paste | Image+text paste crashes the app |

---

## SECURITY SCORECARD

| Category | Score | Key Issues |
|----------|-------|------------|
| Authentication | 3/10 | jwt.decode() in gateway, hardcoded secrets, no token re-validation |
| Authorization | 2/10 | Meeting events zero auth, webhook auth optional, cross-tenant access |
| Input Validation | 4/10 | Missing DTOs on compliance endpoints, unbounded limits, no DLP enforcement |
| Data Protection | 4/10 | XSS via dangerouslySetInnerHTML, tokens in localStorage, webhook content unsanitized |
| Infrastructure | 5/10 | No graceful shutdown in 3 services, inconsistent CORS, no request tracing |
| Org Isolation | 3/10 | Header spoofing for org ID, cross-org moderation data, channel join without org check |

---

## TEST COVERAGE

| Metric | Value |
|--------|-------|
| Total source modules | ~65 |
| Modules with ANY test | 8 (12%) |
| Modules with ZERO tests | 57 (88%) |
| Unit test files | 6 |
| Integration test files | 6 |
| E2E test files | 0 |
| WebSocket gateway tests | 0 |
| Notification service tests | 0 |
| Media service tests | 0 |
| Critical untested use cases | 26 |

### Critical Paths With Zero Tests
1. WebSocket message send/receive flow (730 lines)
2. Call signaling gateway (907 lines)
3. Recording pipeline (ffmpeg + S3)
4. Push notification delivery
5. File upload MIME validation
6. Presence heartbeat/auto-away
7. DLP enforcement on send
8. Rate limiting (REST + WebSocket)

---

## CROSS-SERVICE INTEGRATION STATUS

| Flow | Status | Issue |
|------|--------|-------|
| Message → Notification → Push | WORKS (fragile) | Lost on Redis restart, no queue |
| Call → Ring → Notification | WORKS | No "unreachable" feedback to caller |
| @mention → Notification | WORKS | Correct flow |
| File Upload → Processing → S3 | WORKS | No chat integration for thumbnails |
| Meeting → Chat Conversation | NOT IMPLEMENTED | Chat is ephemeral only |
| Recording → Upload → Media | BROKEN | 401 auth failure |
| DLP → Message Block/Redact | NOT ENFORCED | Service never called |
| Moderation → Flag → Review | PARTIAL | No auto-hide, no admin notification |
| Scheduled Message → Delivery | PARTIAL | No WebSocket emit, no push notification |
| Retention → Deletion | BROKEN | Cron job data empty, never executes |
| Delta Sync → Reconnect | WORKS (limited) | No deleted message tracking |
| Legal Hold → Prevent Delete | NOT ENFORCED | Delete proceeds regardless |

---

## PRODUCTION READINESS

| Area | Status | Gap |
|------|--------|-----|
| Health Checks | PARTIAL | Media + notification return "healthy" unconditionally |
| Graceful Shutdown | PARTIAL | Only notification-service implements properly |
| Env Validation | INCONSISTENT | Auth-service fails fast; others use silent defaults |
| Error Format | INCONSISTENT | 4 different response formats across services |
| Request Tracing | MISSING | No correlation IDs across services |
| Log Levels | INCONSISTENT | Chat-service drops `logger.log()` calls |
| WebSocket Proxy | MISSING | Gateway doesn't proxy WS — clients connect directly |
| CORS | INCONSISTENT | Different configs across services |

---

## PRIORITIZED ACTION PLAN

### Wave 1 — Security (1-2 days)
Fix gateway jwt.decode→verify, remove hardcoded JWT fallbacks, add meeting event authorization, fix XSS in frontend, remove dead SSRF file, fix webhook auth, fix cross-tenant header spoofing.

### Wave 2 — Integration (2-3 days)
Wire DLP into message send flow, fix retention cron data, add auth to recording upload, enforce legal hold on delete, fix meeting chat persistence, add media-chat thumbnail integration.

### Wave 3 — Data Integrity (1-2 days)
Consolidate dual schemas (Call + Meeting), fix race conditions (reactions, recording start), add token re-validation in WS sessions, fix runtime crash (setNewMessage), add meeting host transfer.

### Wave 4 — Testing (3-5 days)
WebSocket gateway tests, notification pipeline tests, media upload tests, DLP enforcement tests, legal hold tests, rate limiting tests.

### Wave 5 — Production Hardening (2-3 days)
Graceful shutdown across all services, env var validation, health check improvements, error format standardization, request tracing, log level consistency.

---

*Vegeta has spoken. 189 findings. 23 CRITICAL. Fix them or face the consequences in production.*

*Generated by Vegeta — QA Sentinel Agent*
*Full audit date: 2026-04-07*
