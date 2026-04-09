# Nexora Mobile App — QA Audit Report

**Auditor:** Vegeta, QA Sentinel
**Target:** `/Users/ekamjitsingh/Projects/Nexora/mobile/`
**Date:** 2026-04-09
**Scope:** Full mobile app — API layer, auth, all 18 screens, navigation, state management, performance, security

---

## Executive Summary

The mobile app has a functioning happy path for tab navigation and core features (attendance, leave, timesheets, chat, kanban). However, the audit uncovered **75 findings** across 3 parallel audit streams:

| Severity | Count |
|----------|-------|
| **CRITICAL** | 11 |
| **HIGH** | 20 |
| **MEDIUM** | 29 |
| **LOW** | 15 |

**The app is NOT production-ready.** Three categories of show-stoppers must be resolved first:
1. **Security** — Dev credentials exposed, no auth guards on deep links, no token refresh
2. **Core UX broken** — Chat tab conversations not tappable, notification navigation broken, quick actions dead
3. **Stability** — Potential crashes from null access, memory leaks, no error boundaries

---

## CRITICAL FINDINGS (11)

### Security

```
[S-001] [CRITICAL] [Confirmed]
Hardcoded dev OTP "000000" and admin emails shown in production login UI.
No __DEV__ or environment check guards the dev banner.
File: mobile/app/(auth)/login.tsx:334-348
Impact: Full account takeover of admin accounts if server accepts 000000 in prod.
Fix: Wrap in {__DEV__ && (...)}. Ensure server rejects 000000 OTP in production.
```

```
[S-002] [CRITICAL] [Confirmed]
No automatic token refresh on 401 responses in HTTP API layer.
The request() function throws on non-2xx status with no retry. The refresh endpoint
exists (authApi.refresh) but is NEVER called from the HTTP pipeline.
File: mobile/lib/api.ts:17-43
Impact: App becomes unusable after access token expires. Users must re-login.
Fix: Implement 401 interceptor with mutex-guarded token refresh + request queue.
```

```
[S-003] [CRITICAL] [Confirmed]
No root-level auth guard. Auth check only exists in (tabs)/_layout.tsx via useEffect.
All other route groups (chat/, leave/, timesheets/, directory/, policies/, profile/,
projects/, notifications) have ZERO auth checks.
File: mobile/app/_layout.tsx, all non-tabs layouts
Impact: Unauthenticated deep-link access to all protected routes.
Fix: Add root-level auth gate using Expo Router's Redirect component.
```

### Crashes & Broken Flows

```
[B-001] [CRITICAL] [Confirmed]
Crash on Home screen: today.sessions.length accessed without optional chaining.
If `today` exists but `sessions` is undefined, throws TypeError.
File: mobile/app/(tabs)/index.tsx:240
Fix: Change to today?.sessions?.length with fallback.
```

```
[B-002] [CRITICAL] [Confirmed]
Chat tab is completely non-functional — conversations render but cannot be opened.
TouchableOpacity on line 105 has NO onPress handler.
File: mobile/app/(tabs)/chat.tsx:105
Impact: Entire chat tab is a dead end.
Fix: Add onPress={() => router.push(`/chat/${item._id}`)}.
```

```
[B-003] [CRITICAL] [Confirmed]
Quick-done button on work screen uses stale React state.
setSelectedTask(task) followed immediately by handleStatusChange("done") which reads
selectedTask — still the OLD value due to async state updates.
File: mobile/app/(tabs)/work.tsx:291-294
Impact: Updates wrong task or fails silently.
Fix: Pass task directly to handleStatusChange.
```

```
[B-004] [CRITICAL] [Confirmed]
Chat thread socket timeouts never cleaned up on unmount — memory leak.
setTimeout in typing:start handler fires after unmount, calling setState on
unmounted component. typingTimeoutRef also not cleared.
File: mobile/app/chat/[id].tsx:170, 261
Fix: Clear all timeout refs in useEffect cleanup.
```

```
[B-005] [CRITICAL] [Confirmed]
Notification tap navigates to non-existent routes: /project/${id} and /task/${id}.
App has /projects/[id]/board but NOT /project/[id]. No /task/[id] route exists.
File: mobile/app/notifications.tsx:120-123
Impact: Every notification tap shows blank screen or crashes.
Fix: Use correct route paths matching file-based routing structure.
```

```
[B-006] [CRITICAL] [Confirmed]
Quick Actions "Projects" and "Directory" buttons do nothing on tap.
onPress handler only handles "leave" and "time" keys.
File: mobile/app/(tabs)/index.tsx:291-294
Impact: 2 of 4 quick action buttons are dead UI.
Fix: Add router.push cases for "projects" and "directory".
```

```
[B-007] [CRITICAL] [Confirmed]
Leave detail fetches ALL leaves to find one by ID (client-side filter).
If leave is on page 2+, returns "not found" even though it exists.
File: mobile/app/leave/[id].tsx:83-96
Impact: Leave detail broken for any leave beyond first page.
Fix: Add getById(id) API endpoint or pass data via navigation params.
```

---

## HIGH FINDINGS (20)

### Security & Auth

```
[S-004] [HIGH] [Confirmed]
Token refresh race condition in WebSocket — no mutex.
Multiple connect_error events can trigger concurrent refresh calls.
File: mobile/lib/socket.ts:39-57
Fix: Shared singleton refresh promise/mutex across HTTP and WebSocket.
```

```
[S-005] [HIGH] [Confirmed]
API_BASE defaults to http://localhost:3005 (not HTTPS).
No validation that configured URL uses HTTPS in production.
File: mobile/lib/api.ts:3, mobile/lib/socket.ts:5-8
Fix: Runtime check for https:// prefix in production builds.
```

```
[S-006] [HIGH] [Confirmed]
No OTP rate limiting on client side.
Unlimited resend and verification attempts, no cooldown timer.
File: mobile/app/(auth)/login.tsx:121-134, 307-317
Fix: 60-second resend cooldown, max verification attempts with lockout.
```

```
[S-007] [HIGH] [Confirmed]
Silent error swallowing in auth-context catch blocks.
Org fetch, logout, and org switch failures silently ignored.
File: mobile/lib/auth-context.tsx:80, 109, 125
Fix: Log to crash reporting, surface actionable errors via toast/alert.
```

```
[AUTH-003] [HIGH] [Confirmed]
Tabs auth guard uses useEffect redirect — renders one frame unauthenticated.
File: mobile/app/(tabs)/_layout.tsx:25-39
Fix: Use Expo Router's <Redirect> component instead of useEffect.
```

```
[AUTH-004] [HIGH] [Confirmed]
Login screen accesses res.data?.tokens but API types say tokens are at res.data level.
Type mismatch suggests login is broken or types are wrong.
File: mobile/app/(auth)/login.tsx:103-108 vs mobile/lib/api.ts:52-59
Fix: Align type definition with actual response shape.
```

```
[AUTH-005] [HIGH] [Confirmed]
Multi-org users not routed to org selector after login.
No check for organizations.length > 1 before redirecting to tabs.
File: mobile/app/(auth)/login.tsx:110
Fix: Check org count and redirect to select-org if needed.
```

### Navigation

```
[NAV-003] [HIGH] [Confirmed]
Root layout only registers (auth), (tabs), notifications, chat, leave as Stack screens.
timesheets/, directory/, policies/, profile/, projects/ are NOT declared.
File: mobile/app/_layout.tsx:25-49
Fix: Explicitly declare all route groups as Stack.Screen children.
```

```
[NAV-004] [HIGH] [Confirmed]
chat/ route group has no index.tsx. Navigating to /chat shows unmatched route.
File: mobile/app/chat/
Fix: Add chat/index.tsx that redirects to tab chat list.
```

```
[NAV-005] [HIGH] [Confirmed]
projects/ route group has no index.tsx.
File: mobile/app/projects/
Fix: Add projects/index.tsx.
```

### UX & Data

```
[B-008] [HIGH] [Confirmed]
Home screen Clock In/Out has no loading state, no error feedback, no double-tap prevention.
Rapid tapping triggers multiple API calls. Errors silently swallowed.
File: mobile/app/(tabs)/index.tsx:91-101, 262-278
Fix: Add loading state, disable during request, show error toast.
```

```
[B-009] [HIGH] [Confirmed]
Leave form in Time tab uses raw text input for dates with no format validation.
Users can type anything — invalid strings sent to API.
File: mobile/app/(tabs)/time.tsx:499-523
Fix: Use DateTimePicker component (as done in leave/apply.tsx).
```

```
[B-010] [HIGH] [Confirmed]
Notification keyExtractor falls back to String(Math.random()) — causes list flicker.
File: mobile/app/notifications.tsx:261
Fix: Use String(index) as deterministic fallback.
```

```
[B-011] [HIGH] [Confirmed]
Kanban board nested ScrollViews break RefreshControl on Android.
File: mobile/app/projects/[id]/board.tsx:517-533, 408-425
Fix: Move RefreshControl to wrapper or use refresh button in header.
```

```
[B-012] [HIGH] [Confirmed]
Employee name in leave approval shows "undefined undefined" when employee object missing.
File: mobile/app/leave/index.tsx:332
Fix: Proper null-safe string construction with fallback.
```

### Performance & Architecture

```
[PERF-001] [HIGH] [Confirmed]
No FlatList in the app provides getItemLayout — all lists dynamically measured.
Files: All FlatList usages
Fix: Provide getItemLayout for lists with estimable item heights.
```

```
[PERF-002] [HIGH] [Confirmed]
Chat message list sorts entire array on every render: [...messages].sort(...).
File: mobile/app/chat/[id].tsx:294-296
Fix: Wrap in useMemo with [messages] dependency.
```

```
[STATE-002] [HIGH] [Confirmed]
Entire parallel codebase at mobile/src/ is dead code (zustand store, screens, hooks).
Disconnected from Expo Router app/ directory.
File: mobile/src/, package.json (zustand ^5.0.0)
Fix: Remove zustand dependency and delete mobile/src/.
```

```
[NET-001] [HIGH] [Confirmed]
ZERO network state detection. No netinfo, no offline handling, no offline banner.
File: Entire mobile codebase
Fix: Add @react-native-community/netinfo, configure React Query onlineManager.
```

```
[UX-001] [HIGH] [Confirmed]
Overview stats on Home screen are hardcoded to "--" — never fetches real data.
Active Projects, Open Tasks, Leaves Left are permanently placeholder.
File: mobile/app/(tabs)/index.tsx:310-323
Fix: Fetch from projectApi, taskApi, leaveApi and display real data.
```

---

## MEDIUM FINDINGS (29)

| ID | Description | File |
|----|-------------|------|
| S-008 | No input sanitization on URL path params (path traversal risk) | api.ts |
| S-009 | Query params not URL-encoded (injection risk) | api.ts |
| S-010 | WebSocket emit has no input validation | socket.ts |
| S-011 | WebSocket listener errors silently caught and discarded | socket.ts:130-134 |
| S-012 | Pervasive `any` types in API layer — zero TypeScript protection | api.ts |
| S-013 | fetch() network errors not distinguished from HTTP errors, no timeout | api.ts:31-42 |
| B-013 | Settings menu item has no onPress — dead button | more.tsx:62 |
| B-014 | Phone call button in chat header has no onPress | chat/[id].tsx:470 |
| B-015 | Attach button in chat input has no onPress | chat/[id].tsx:521-527 |
| B-016 | Kanban task card onPress is empty — no navigation | board.tsx:305-307 |
| B-017 | Employee directory cards have no onPress | directory/index.tsx:100 |
| B-018 | Leave date validation allows past end dates | leave/apply.tsx:108-114 |
| B-019 | useMemo weeks in create timesheet uses empty deps — stale after overnight | timesheets/create.tsx:58 |
| B-020 | Chat dual source of truth — local state duplicates React Query cache | chat/[id].tsx:104-132 |
| B-021 | Socket not disconnected on logout — ghost connections | socket.ts + auth-context |
| B-022 | Dimensions.get at module scope — stale on rotation (4 files) | index.tsx, work.tsx, login.tsx, board.tsx |
| UX-002 | Notifications screen breaks gradient header pattern | notifications.tsx:209-250 |
| UX-003 | Chat phone button and attach button render but do nothing | chat/[id].tsx |
| UX-004 | Switch Org item shows but does nothing with 1 org, no feedback | more.tsx:53-57 |
| AUTH-004 | Login→token type mismatch (res.data.tokens vs res.data) | login.tsx vs api.ts |
| AUTH-005 | Multi-org redirect missing after login | login.tsx:110 |
| PLAT-001 | StatusBar "auto" makes text invisible on dark gradient headers (iOS) | _layout.tsx:24 |
| PLAT-002 | KeyboardAvoidingView undefined behavior on Android | chat/[id].tsx:478-481 |
| DEP-001 | react-native-vector-icons redundant with @expo/vector-icons (+2MB) | package.json |
| DEP-002 | No ErrorBoundary — render errors crash entire app | entire codebase |
| STATE-003 | QueryClient has no global onError handler | _layout.tsx:9-16 |
| STATE-004 | QueryClient created at module scope — stale on fast refresh | _layout.tsx:9 |
| PERF-003 | renderMessage not memoized — FlatList re-renders all items | chat/[id].tsx:298 |
| PERF-004 | ItemSeparatorComponent as inline arrow — new ref every render | select-org, notifications |
| B-021 | No accessibility labels on ANY interactive element (all 18 screens) | all screens |

---

## LOW FINDINGS (15)

| ID | Description | File |
|----|-------------|------|
| S-014 | Logout doesn't clear React Query cache — stale data for next user | auth-context.tsx |
| S-015 | WebSocket starts with polling before upgrading to websocket | socket.ts:25 |
| S-016 | Select-org shows no error on org switch failure | select-org.tsx:33-36 |
| S-017 | QueryClient staleTime 5min — potentially stale security data | _layout.tsx:9-16 |
| B-022 | Timesheet totalHours reduce may produce NaN → toFixed crash | timesheets/index.tsx:121 |
| B-023 | formatDate crashes on Invalid Date if both date fields undefined | time.tsx:295 |
| B-024 | Kanban board Animated import unused | board.tsx:10 |
| B-025 | Unused imports across multiple screens (Button, FlatList, etc) | multiple files |
| B-026 | Separator uses COLORS.divider which may not exist | notifications.tsx:414 |
| DEP-003 | TypeScript pinned to ~5.3.3 vs Expo SDK 52 supporting 5.5+ | package.json |
| PERF-005 | InlineSeparator components as arrows in select-org, notifications | multiple files |
| UX-005 | Notification keyExtractor Math.random() fallback | notifications.tsx:261 |
| NET-002 | Attendance clock action no loading/error/retry | index.tsx:91-102 |
| B-027 | Chat typing timeout cleanup missing on unmount (duplicate of B-004) | chat/[id].tsx |
| PLAT-003 | KeyboardAvoidingView behavior undefined on Android hides input | chat/[id].tsx |

---

## Security Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| Authentication | 2/10 | Dev creds exposed, no token refresh, no rate limiting |
| Authorization | 3/10 | Auth guard only on tabs, deep links bypass auth |
| Input Validation | 3/10 | No client-side validation, raw interpolation |
| Transport Security | 4/10 | HTTP fallback, no cert pinning |
| Data Protection | 5/10 | SecureStore for tokens (good), but no cache clearing |
| Error Handling | 2/10 | Silent swallowing everywhere, no error boundaries |
| **Overall** | **3/10** | **Not production-ready** |

---

## Prioritized Action Plan

### P0 — Fix Before Any Beta Release (Critical Security + Crashes)

| # | Finding | Effort |
|---|---------|--------|
| 1 | S-001: Remove dev OTP banner (wrap in __DEV__) | 5 min |
| 2 | S-003: Add root-level auth guard for all routes | 1 hr |
| 3 | S-002: Implement 401 interceptor with token refresh | 2 hr |
| 4 | B-002: Wire chat conversation tap navigation | 10 min |
| 5 | B-005: Fix notification route paths | 15 min |
| 6 | B-003: Fix stale state in quick-done button | 15 min |
| 7 | B-001: Fix null access crash on home screen | 10 min |
| 8 | B-004: Clean up chat socket timeouts on unmount | 15 min |
| 9 | B-006: Wire quick action buttons (projects, directory) | 10 min |
| 10 | DEP-002: Add ErrorBoundary at root | 30 min |

### P1 — Fix Before Production Launch (High)

| # | Finding | Effort |
|---|---------|--------|
| 1 | S-004: Shared token refresh mutex (HTTP + WebSocket) | 2 hr |
| 2 | S-005: HTTPS enforcement in production | 15 min |
| 3 | S-006: OTP resend cooldown + attempt limiting | 30 min |
| 4 | NET-001: Add netinfo + offline handling | 2 hr |
| 5 | NAV-003: Register all routes in root layout | 30 min |
| 6 | NAV-004/005: Add missing index.tsx for chat/, projects/ | 30 min |
| 7 | UX-001: Fetch real data for home stats | 30 min |
| 8 | B-009: Replace text date input with DateTimePicker | 30 min |
| 9 | B-012: Fix employee name null display | 5 min |
| 10 | STATE-002: Remove dead code (mobile/src/, zustand) | 15 min |
| 11 | PERF-002: Memoize sorted messages in chat | 10 min |
| 12 | B-008: Clock in/out loading state + error feedback | 20 min |

### P2 — Fix Before Scale (Medium)

- Wire all dead buttons (settings, call, attach, task card, directory card)
- URL-encode all query params, validate path params
- Add accessibility labels to all interactive elements
- Use useWindowDimensions() instead of Dimensions.get()
- Add global React Query error handler
- Fix StatusBar style for dark header screens
- Fix KeyboardAvoidingView on Android
- Remove redundant dependencies

---

**Verdict:** The mobile app is a solid prototype with correct visual patterns and feature coverage. But it has critical security holes (dev creds, no auth guards, no token refresh) and broken core flows (chat navigation, notifications, quick actions) that make it unfit for production. The P0 fixes are all straightforward — estimated 4-5 hours total to make it beta-ready.
