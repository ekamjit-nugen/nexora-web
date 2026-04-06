# QA Report: P0 Ship Blocker Fixes

**Auditor:** Vegeta (QA Sentinel)
**Date:** 2026-04-07
**Scope:** All 8 P0 fixes across chat-service, calling-service, notification-service, media-service, frontend
**Method:** Static code audit of every modified file + security analysis + edge case testing

---

## Executive Summary

The P0 fixes are **functionally solid** — the core features work as designed. However, Vegeta found **6 CRITICAL**, **11 HIGH**, **17 MEDIUM**, and **14 LOW** severity issues across the 8 fixes. The most dangerous findings are **SSRF vulnerabilities** in the link preview scraper (can probe internal networks), **path traversal** in recording file paths, and an **inverted Web Push urgency** that delivers critical notifications as lowest priority.

### Severity Distribution

| Severity | Count | Must Fix Before Deploy |
|----------|-------|----------------------|
| CRITICAL | 6 | YES |
| HIGH | 11 | YES |
| MEDIUM | 17 | Recommended |
| LOW | 14 | Nice to have |
| PASS | 10 | Verified correct |
| **Total** | **58** | |

---

## CRITICAL FINDINGS (Fix Immediately)

### SSRF-001 | Link Preview: No Private IP Blocking
- **File:** `chat-service/src/messages/link-preview.service.ts`
- **Attack:** User sends message with `http://169.254.169.254/latest/meta-data/` — scraper fetches AWS metadata, cloud credentials exposed.
- **Also affects:** `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`
- **Fix:** Add URL validation that resolves DNS and blocks private/reserved IP ranges before fetch.

### SSRF-002 | Link Preview: Redirect-Based SSRF Bypass
- **File:** `chat-service/src/messages/link-preview.service.ts`, line 89
- **Attack:** Attacker hosts URL at public IP that 302-redirects to `http://127.0.0.1:8080/internal-api`. Initial DNS check passes but redirect reaches internal network.
- **Fix:** Set `redirect: 'manual'`, handle redirects manually with IP validation at each hop.

### REC-001 | Path Traversal via callId/meetingId in File Paths
- **File:** `calling-service/src/calls/call-recording.service.ts`, line 141
- **File:** `calling-service/src/meetings/recording.service.ts`, line 145
- **Attack:** If `meetingId` contains `../../etc/cron.d/evil`, `path.join('/tmp', 'recording-../../etc/...')` writes arbitrary files.
- **Fix:** Validate IDs contain only `[a-zA-Z0-9_-]` before using in file paths.

### REC-002 | S3 Credentials Default to Empty Strings
- **File:** `media-service/src/processing/s3-upload.helper.ts`, lines 24-25
- **Impact:** S3 client initializes without error but all uploads silently fail with cryptic auth errors. Processing appears to work but thumbnails never persist.
- **Fix:** Throw error at construction if `S3_ACCESS_KEY`/`S3_SECRET_KEY` not configured.

### B-003 | Web Push Urgency is INVERTED
- **File:** `notification-service/src/push/push.service.ts`, line 195
- **Bug:** `priority === 'critical'` maps to `urgency: 'very-low'`. Incoming call notifications are delivered as lowest priority — delayed or dropped on mobile.
- **Fix:** Invert the mapping: critical = `'very-high'`, low = `'very-low'`.

### B-001 | Unhandled Promise Rejection Crashes Notification Service
- **File:** `notification-service/src/delivery/delivery.service.ts`, line 28
- **Bug:** `this.deliver(payload)` called without `await` or `.catch()`. If `sendToUser` throws, the rejection is unhandled — can crash the process.
- **Fix:** Add `.catch(err => this.logger.error(...))`.

---

## HIGH FINDINGS (Fix Before Go-Live)

### B-002 | Redis Subscriber Has No Reconnection or Cleanup
- **File:** `notification-service/src/delivery/delivery.service.ts`
- **Impact:** If Redis drops, subscriber silently dies. No further notifications delivered. No `OnModuleDestroy` cleanup.

### B-004 | @here Mentions Miss Users on Other Instances
- **File:** `chat-service/src/messages/messages.gateway.ts`, lines 526-528
- **Impact:** `@here` uses local `onlineUsers` map — only notifies users connected to THIS pod. Multi-instance deploys miss users.

### REC-003 | No Graceful Shutdown — Zombie ffmpeg Processes
- **Files:** `calling-service/src/calls/call-recording.service.ts`, `meetings/recording.service.ts`
- **Impact:** Service restart orphans all active ffmpeg processes. Temp files leaked.
- **Fix:** Implement `OnModuleDestroy` to kill all processes in `activeRecordings`.

### REC-004 | No Recording Duration/Size Limit — Disk Exhaustion
- **Files:** Same as above
- **Impact:** A call left recording indefinitely fills `/tmp`, crashes the service.
- **Fix:** Add `-t 7200` (2hr max) and `-fs 2147483648` (2GB max) to ffmpeg args.

### REC-005 | Race Condition on Concurrent startRecording
- **Files:** Same as above
- **Impact:** Two concurrent requests both pass the `enabled` check, spawn two ffmpeg processes, one becomes zombie.
- **Fix:** Use atomic `findOneAndUpdate` with condition `'recording.enabled': { $ne: true }`.

### REC-006 | Entire Video File Loaded Into Memory
- **File:** `media-service/src/upload/upload.service.ts`, lines 213-231
- **Impact:** 100MB video = 100MB heap per upload. Concurrent uploads cause OOM.
- **Fix:** Stream S3 response to temp file using `pipeline()`.

### REC-007 | Image Decompression Bombs
- **File:** `media-service/src/processing/image.processor.ts`
- **Impact:** 25MB PNG decompresses to 500MB+ in Sharp. No pixel dimension check.
- **Fix:** Use `sharp({ limitInputPixels: 268435456 })` (16384x16384 max).

### S-001 | Unsanitized User Input in Notification Payloads
- **File:** `chat-service/src/messages/messages.gateway.ts`, lines 552-568
- **Impact:** `senderName` and `conversation.name` pass through to service worker. Potential XSS if client renders with innerHTML.

### S-003 | SSRF via Crafted Web Push Subscription Endpoint
- **File:** `notification-service/src/push/push.service.ts`, line 176
- **Impact:** Attacker registers push endpoint `http://169.254.169.254/...` — web-push library POSTs to that URL.
- **Fix:** Validate endpoints match known push service origins (fcm.googleapis.com, etc).

### S1 (Frontend) | No CSRF Token on XHR Upload
- **File:** `frontend/src/lib/api.ts`, line 851-858
- **Impact:** `uploadFileWithProgress` only sets `Authorization` header. Missing `X-XSRF-TOKEN` unlike all other API calls.

### S2 (Frontend) | No File Type Validation on Drag-Drop/Paste
- **File:** `frontend/src/app/messages/page.tsx`, lines 560-608
- **Impact:** Users can drag-drop `.exe`, `.bat`, `.sh` files. Only size is checked. The `<input accept>` restriction only applies to file picker, not drag-drop.

---

## MEDIUM FINDINGS (17 total)

| ID | Area | Issue |
|----|------|-------|
| SSRF-003 | Link Preview | Hex/decimal IP encodings bypass string-based checks |
| RESOURCE-001 | Link Preview | Content-Length lie bypasses 256KB cap via `response.text()` |
| B-005 | Chat Gateway | HTML strip regex is naive — doesn't handle entities |
| B-006 | Chat Gateway | Redis pub client has no reconnect or cleanup |
| B-007 | FCM Service | `Function()` constructor for dynamic import fails with strict CSP |
| B-008 | FCM Service | `admin.initializeApp()` without checking if app already exists |
| S-004 | Calling Gateway | `conversationId` from client not verified before notification |
| RL-002 | Rate Limiting | WebSocket events (edit, delete, typing, thread) have no rate limiting |
| REC-008 | Recording | SDP file not cleaned up if ffmpeg never emits end/error |
| REC-009 | Recording | `stopRecording` doesn't verify userId has permission |
| REC-010 | Media Service | File extension from user-supplied originalName (HTTP header injection) |
| REC-011 | Media Service | S3 key extension doesn't match MIME type |
| REC-012 | Recording | Content-Length may be incorrect if ffmpeg still flushing |
| REC-013 | Recording | SDP port offset assumes video on rtpPort+2 |
| F1 (Frontend) | Paste Handler | Text+image paste silently drops text |
| F2 (Frontend) | Drop Handler | Cancel doesn't stop multi-file batch |
| R2 (Frontend) | React | XHR not aborted on component unmount |

---

## LOW FINDINGS (14 total)

| ID | Area | Issue |
|----|------|-------|
| XSS-001 | Link Preview | OG metadata stored without sanitization |
| XSS-002 | Link Preview | No length limit on title/siteName |
| B-009 | Chat Gateway | Module-level rateLimitCounters Map grows unbounded |
| GW-005 | Gateway | Duplicate Message schema registration in ChatModule |
| RL-003 | Rate Limiting | ChatController.sendMessage bypasses stricter MessagesController limit |
| RL-006 | Rate Limiting | IP-based throttling behind proxy needs trust config |
| REC-014 | Media Service | eval-based dynamic import for fluent-ffmpeg |
| REC-015 | Recording | No timeout on media-service upload HTTP request |
| REC-016 | Image Processor | Thumbnail height can be 0 for extreme aspect ratios |
| REC-017 | Media Service | `scanStatus: 'clean'` set without actual scanning |
| S5 (Frontend) | Upload | Inconsistent size limits: 10MB (button) vs 25MB (drag-drop) |
| E3 (Frontend) | Paste | SVG+XML extension extraction produces invalid extension |
| E4 (Frontend) | Paste | Rapid pastes cause parallel uploads with progress conflicts |
| U3 (Frontend) | UX | Progress bar vanishes without showing 100% |

---

## VERIFIED CORRECT (PASS)

| Area | Check | Status |
|------|-------|--------|
| Gateway Consolidation | `chat.gateway.ts` deleted | PASS |
| Gateway Consolidation | No remaining ChatGateway references | PASS |
| Gateway Consolidation | ChatController uses MessagesGateway correctly | PASS |
| Gateway Consolidation | forwardRef circular dependency resolved | PASS |
| Rate Limiting | ThrottlerModule.forRoot config correct (ms units) | PASS |
| Rate Limiting | HealthController exempt from throttling | PASS |
| Rate Limiting | Per-route throttle overrides correct | PASS |
| Link Preview | URL regex correctly excludes file:// and javascript:// | PASS |
| Frontend | Drag counter handles nested elements correctly | PASS |
| Frontend | Event handlers properly memoized with useCallback | PASS |

---

## SECURITY SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| Input Validation | 4/10 | SSRF wide open, path traversal, no file type validation |
| Authentication | 7/10 | JWT works, but hardcoded fallback secret and missing CSRF |
| Authorization | 6/10 | stopRecording has no permission check |
| Data Protection | 5/10 | OG metadata unsanitized, notification payloads unsanitized |
| Error Handling | 6/10 | Unhandled promise rejections, missing cleanup |
| Resource Management | 4/10 | Memory bombs, zombie processes, no size limits |
| Configuration | 5/10 | Silent S3 credential failures, inverted urgency mapping |

---

## PRIORITIZED ACTION PLAN

### Immediate (Before ANY deployment)

| # | Finding | Effort | Fix |
|---|---------|--------|-----|
| 1 | SSRF-001 + SSRF-002 | 2-3 hrs | Add private IP blocklist + manual redirect handling in link-preview.service.ts |
| 2 | B-003 (inverted urgency) | 5 min | Swap urgency values in push.service.ts |
| 3 | B-001 (unhandled rejection) | 5 min | Add `.catch()` in delivery.service.ts |
| 4 | REC-001 (path traversal) | 30 min | Validate callId/meetingId with regex before file path construction |
| 5 | REC-002 (S3 credentials) | 15 min | Throw error instead of empty string default |
| 6 | S1 (CSRF on upload) | 15 min | Add X-XSRF-TOKEN header to XHR |

### Before Go-Live (Within 1 sprint)

| # | Finding | Effort | Fix |
|---|---------|--------|-----|
| 7 | REC-003 (zombie processes) | 1 hr | Add OnModuleDestroy to recording services |
| 8 | REC-004 (no size limit) | 15 min | Add -t 7200 -fs 2G to ffmpeg args |
| 9 | REC-005 (race condition) | 1 hr | Atomic findOneAndUpdate for recording start |
| 10 | REC-006 (memory bomb) | 2 hrs | Stream video files instead of Buffer.concat |
| 11 | REC-007 (decompression bomb) | 15 min | Add limitInputPixels to Sharp |
| 12 | S2 (file type validation) | 30 min | Add MIME type allowlist on drag-drop |
| 13 | S-003 (push endpoint SSRF) | 30 min | Validate push endpoints against known origins |
| 14 | B-002 (Redis subscriber) | 1 hr | Add reconnection + OnModuleDestroy |

### Post-Launch (Next sprint)

All MEDIUM and LOW findings — see tables above.

---

*Vegeta has spoken. Fix the 6 CRITICALs or don't deploy. No exceptions.*

*Generated by Vegeta - QA Sentinel Agent*
*Audit date: 2026-04-07*
