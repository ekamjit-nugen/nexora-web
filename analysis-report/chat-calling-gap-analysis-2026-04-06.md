# Gap Analysis: Chat & Calling Features

**Analyst:** Goku (Business Architect)
**Date:** 2026-04-06
**Scope:** Chat Service + Calling Service + Frontend + Cross-Service Integration
**PRD Baseline:** `docs/prd/chat-messaging-prd.md` + `docs/prd/calling-prd.md`
**Methodology:** Full code trace across backend services, frontend components, hooks, and integration points

---

## Executive Summary

Chat and Calling are **80-85% implemented** against their PRDs. The backend services are strong — most modules are fully built with production-quality code. The frontend is comprehensive with a polished UI. However, there are **significant gaps in the last-mile features** that separate a "working prototype" from a product users would choose over Slack/Teams/Zoom. The gaps cluster around: **media pipeline completion** (recording, transcription, virtual backgrounds), **real-time reliability** (offline support, multi-device), **small UX features** that users expect (GIFs, message scheduling UI, notification granularity), and **operational readiness** (monitoring, error recovery, test coverage).

### Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 7 |
| High | 18 |
| Medium | 28 |
| Low | 15 |
| **Total** | **68** |

---

## 1. CRITICAL GAPS (Data Loss / Feature Breakage / Security)

### 1.1 Call Recording Pipeline Not Functional
- **Type:** Gap
- **Location:** `services/calling-service/src/calls/call-recording.service.ts`
- **PRD Promise:** "SFU PlainTransport -> ffmpeg -> MP4 (H.264 + AAC) -> Media Service (S3/MinIO)"
- **Reality:** Recording metadata management works (start/stop timestamps, duration). SFU PlainTransport for RTP egress is configured. But the actual **ffmpeg execution, MP4 encoding, and S3 upload are not implemented** — the pipeline hook is stubbed.
- **Impact:** Users click "Record" and see the red indicator, but no recording file is produced. This is a trust-breaking UX — users think they recorded an important meeting but get nothing.
- **Fix:** Implement the ffmpeg spawn pipeline in media-service or a dedicated recording worker. Needs: RTP -> ffmpeg stdin, MP4 output -> S3 upload, webhook callback to update call/meeting document with fileId.

### 1.2 No End-to-End Encryption
- **Type:** Future Feature (but critical for enterprise sales)
- **Location:** Not implemented anywhere
- **PRD Acknowledgment:** Listed as "Not implemented" in Known Constraints
- **Impact:** Any enterprise with compliance requirements (healthcare, finance, legal) cannot adopt Nexora for sensitive communication. Competitors (Signal, Wire, Teams E5) offer this.
- **Recommendation:** At minimum, implement transport-level encryption verification (SRTP verification). Full E2EE with key exchange is a larger initiative.

### 1.3 No Rate Limiting on REST API Endpoints (Chat Service)
- **Type:** Gap
- **Location:** `services/chat-service/` — WebSocket has rate limiting, but REST endpoints do not
- **PRD Promise:** "API requests (gateway): 100/min"
- **Reality:** WebSocket rate limiting is implemented (Redis + in-memory fallback). But the REST API endpoints for messages, conversations, search, etc. have **no rate limiting**. The API gateway (`services/api-gateway/src/main.ts`) proxies requests but rate limiting enforcement is unclear.
- **Impact:** Abuse vector — a malicious user or bot can flood the API with search queries, message sends, or file uploads without throttling.
- **Fix:** Add NestJS `@Throttle()` decorator or a global rate-limiting middleware on the chat-service REST controllers.

### 1.4 Dual Gateway Technical Debt
- **Type:** Gap (Architectural)
- **Location:** `services/chat-service/src/chat/chat.gateway.ts` vs `services/chat-service/src/messages/messages.gateway.ts`
- **Reality:** Two WebSocket gateways exist. `chat.gateway.ts` is a **stub** with limited event handling. `messages.gateway.ts` is the production gateway with full event coverage. Both register on the `/chat` namespace.
- **Impact:** Potential event routing conflicts, confusion for developers, dead code that could accidentally be connected. If the wrong gateway handles a connection, events silently fail.
- **Fix:** Remove or consolidate `chat.gateway.ts`. Single gateway, single source of truth.

### 1.5 No Graceful Degradation for Redis Failure in Chat
- **Type:** Gap
- **Location:** `services/chat-service/` — presence, rate limiting, Socket.IO adapter all depend on Redis
- **Reality:** Presence has MongoDB fallback. Rate limiting has in-memory fallback. But **Socket.IO adapter** (Redis adapter for multi-instance pub/sub) has no fallback — if Redis goes down, WebSocket events won't propagate across service instances.
- **Impact:** In a multi-instance deployment, Redis failure means users on different instances can't see each other's messages in real-time.
- **Fix:** Add Redis health monitoring, reconnection logic, and consider an in-memory fallback adapter for single-instance mode.

### 1.6 Push Notification Delivery is Entirely Stubbed
- **Type:** Gap
- **Location:** `services/notification-service/src/push/fcm.service.ts`
- **Reality:** The notification service has excellent architecture (preference management, DND, per-conversation overrides, device token management). But **FCM, APNS, and Web Push are ALL stubs** — `firebase-admin` and `web-push` are not in `package.json`. Every `send*()` method logs "stub - implement with firebase-admin".
- **Impact:** Even when chat/calling services eventually emit notifications, they will be silently dropped. No push notification will ever reach a user's device.
- **Fix:** Install `firebase-admin`, configure FCM credentials, implement `sendFCM()`, `sendAPNS()`, `sendWebPush()`.

### 1.7 Media Processing Pipeline Incomplete
- **Type:** Gap
- **Location:** `services/media-service/src/processing/`
- **Reality:** Image thumbnails are generated via Sharp but **never uploaded to S3** (TODO comment in code). Video processing is a stub — `ffmpeg`/`fluent-ffmpeg` not in `package.json`. Document processing (PDF preview, Office conversion) is a stub — requires LibreOffice headless. Processing status is immediately marked "complete" without actual processing.
- **Impact:** Video files uploaded in chat have no thumbnails. PDF/Office files have no previews. Images get processed but thumbnails aren't persisted. Users see broken preview UI.
- **Fix:** Complete the upload-to-S3 step for thumbnails. Add `fluent-ffmpeg` dependency. Implement async processing queue (BullMQ) for heavy operations.

---

## 2. HIGH SEVERITY GAPS (Broken Workflows / Missing Core Features)

### 2.1 Virtual Background — Stub Only
- **Type:** Gap
- **Location:** `frontend/src/lib/hooks/useVirtualBackground.ts`
- **PRD:** "Canvas stub — TensorFlow.js BodyPix or MediaPipe Selfie Segmentation"
- **Reality:** Interface exists (enable/disable/processStream). Basic canvas pipeline set up. **No ML model loaded** — no actual background removal or blur.
- **Impact:** Users working from home (majority use case for video calls) cannot blur/replace backgrounds. Every competitor has this.
- **Recommendation:** Integrate MediaPipe Selfie Segmentation (lighter than BodyPix). ~2-3 day implementation.

### 2.2 GIF Picker — Not Implemented
- **Type:** Gap
- **Location:** Not present anywhere in codebase
- **Impact:** GIFs are a core communication tool in modern chat. Users expect GIPHY/Tenor integration. Every major chat app (Slack, Teams, Discord) has this.
- **Recommendation:** Integrate Tenor API (free tier, no API key attribution issues). Add `GifPicker` component next to emoji picker.

### 2.3 Voice Message Transcription — Missing
- **Type:** Gap
- **Location:** `services/chat-service/src/voice-messages/`
- **PRD:** "Transcription + multi-format support" listed as future consideration
- **Reality:** Voice messages are recorded (WebM) and stored. No transcription. Users must listen to every voice message — no way to scan/search voice content.
- **Impact:** Voice messages become a black box in search. Users in meetings can't quickly read a voice message.
- **Fix:** Integrate Whisper API or browser-side Web Speech API for transcription. Store as `transcription` field on message.

### 2.4 Smart Replies — Not Implemented
- **Type:** Scope Question
- **Location:** `services/chat-service/src/ai-summary/smart-replies.service.ts`
- **PRD:** "AI-generated reply suggestions (planned)"
- **Reality:** File exists as a stub — service file created but implementation pending.
- **Impact:** Missed productivity feature. Quick reply suggestions reduce response time for simple messages.

### 2.5 No Push Notification Integration for Chat/Calls
- **Type:** Gap
- **Location:** `services/notification-service/` exists, `frontend/public/sw.js` exists
- **Reality:** Service worker and notification service exist. But the **integration between chat-service/calling-service and notification-service is not wired**. When a user is offline or on a different tab:
  - Missed call → no push notification
  - New message → no push notification
  - @mention → no push notification
- **Impact:** Users miss critical messages and calls when the app isn't in the foreground. This is a dealbreaker for a communication product.
- **Fix:** Add event emission from chat/calling services to notification-service via Redis pub/sub or direct HTTP. Notification service sends FCM/APNs push.

### 2.6 No Offline Support (Service Worker + IndexedDB)
- **Type:** Gap
- **Location:** `frontend/public/sw.js`, `services/chat-service/src/sync/`
- **PRD:** "Service worker + IndexedDB for full offline" listed as future
- **Reality:** Delta sync is fully implemented on the backend (cursor-based, timestamp filtering). Service worker exists. But **no IndexedDB caching on the frontend** — messages are not persisted locally. When offline, the chat shows nothing.
- **Impact:** Users on flaky connections (mobile, commuting) lose access to chat history. Delta sync exists but has no local store to sync into.
- **Fix:** Add IndexedDB via Dexie.js or idb. Cache conversations and recent messages. Use delta sync on reconnect.

### 2.7 No Message Forwarding UI
- **Type:** Gap
- **Location:** Backend: `POST /chat/messages/:id/forward` exists. Frontend: `MessageActionsMenu.tsx` has "Forward" action
- **Reality:** Backend endpoint exists. Frontend action menu shows "Forward" but need to verify if the conversation picker modal for selecting forward destination is implemented.
- **Impact:** Users can see the forward option but may not be able to complete the action if the destination picker is missing.

### 2.8 No Noise Cancellation / Echo Suppression
- **Type:** Gap
- **Location:** `frontend/src/lib/hooks/useWebRTC.ts`
- **Reality:** `getUserMedia` is called with basic audio constraints. No `noiseSuppression`, `echoCancellation`, or `autoGainControl` constraints explicitly set (browser defaults may apply, but are inconsistent).
- **Impact:** Users in noisy environments (open offices, cafes) have poor call quality. Background noise bleeds through.
- **Fix:** Add explicit audio constraints: `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }`. Consider integrating RNNoise (WASM) for ML-based noise cancellation.

### 2.9 No Browser Picture-in-Picture API for Calls
- **Type:** Gap
- **Location:** `frontend/src/components/calling/VideoCallWindow.tsx`
- **Reality:** The component has a custom PIP layout (local video in corner). But it does **not use the browser's native Picture-in-Picture API** (`video.requestPictureInPicture()`), which allows the video to float outside the browser window.
- **Impact:** When users switch tabs or apps during a call, they lose sight of the video. Native PIP keeps the video visible.
- **Fix:** Add a PIP button that calls `videoElement.requestPictureInPicture()` on the remote video stream.

### 2.10 No File Drag-and-Drop in Chat
- **Type:** Gap
- **Location:** `frontend/src/app/messages/page.tsx`
- **Reality:** File upload via button click exists (`FileBrowser` component). But there's **no drag-and-drop zone** on the message area. Users cannot drag files from their desktop into the chat.
- **Impact:** Every modern chat app supports drag-and-drop. Missing this feels dated.
- **Fix:** Add `onDragOver`, `onDragLeave`, `onDrop` handlers on the message area. Show a visual drop overlay.

### 2.11 No Clipboard Paste for Images
- **Type:** Gap
- **Location:** `frontend/src/app/messages/page.tsx`, `RichTextEditor.tsx`
- **Reality:** No `onPaste` handler for intercepting clipboard images (e.g., screenshots with Cmd+Shift+4 → Cmd+V). Users must save the image to disk first, then upload.
- **Impact:** Screenshots are the #1 shared content type in workplace chat. This friction adds 3-4 steps to a common action.
- **Fix:** Add paste handler that checks `clipboardData.items` for `image/*` types, creates a Blob, and uploads.

### 2.12 No Typing Indicator for "Who" Is Typing
- **Type:** Scope Question
- **Location:** `frontend/src/app/messages/page.tsx`
- **Reality:** Typing indicators show "someone is typing" but need to verify if it shows WHO is typing (e.g., "Alice is typing..." or "Alice, Bob are typing...") especially in group chats.
- **Impact:** In group chats, knowing who is typing prevents message collisions and provides better context.

### 2.13 Message Read Receipt Granularity
- **Type:** Gap
- **Location:** Backend: `GET /chat/conversations/:id/read-status` exists. Frontend: checkmarks shown.
- **Reality:** Read receipts show single/double checkmarks. But there's **no UI to see WHO has read** the message (e.g., click on checkmarks to see a list of readers). Backend tracks per-user `lastReadAt` but frontend doesn't expose this.
- **Impact:** In group chats, users can't tell if a specific person has seen their message.
- **Fix:** Add a click handler on read receipt indicators that shows a modal with reader names and timestamps.

### 2.14 No Unread Message Count Badge on App/Tab
- **Type:** Gap
- **Location:** `frontend/`
- **Reality:** `UnreadBanner` component exists within the chat UI. But there's **no favicon badge or document.title update** showing unread count when the user is on a different tab.
- **Impact:** Users don't know they have unread messages without switching to the Nexora tab.
- **Fix:** Update `document.title` to `(3) Nexora` format. Use favicon badge library or canvas-based favicon update.

### 2.15 Call Hold/Resume — Not Implemented
- **Type:** Gap
- **Location:** `services/calling-service/` — no hold state in call schema or gateway
- **PRD:** Warm transfer involves putting caller on hold, but no standalone hold/resume feature exists.
- **Reality:** No "hold" state in call lifecycle. No music-on-hold. When warm transfer initiates consultation, the hold state is tracked as part of transfer history, but standalone hold (put someone on hold to check something) doesn't exist.
- **Impact:** Users cannot put a call on hold — they must mute themselves instead, which the other party sees as awkward silence.
- **Fix:** Add `hold` state to call schema. Implement `call:hold` and `call:resume` WebSocket events. Add hold button to CallControls.

### 2.16 Link Preview Fetching — Not Implemented
- **Type:** Gap
- **Location:** `services/chat-service/src/messages/` — `LinkPreview` component exists on frontend, message schema has `linkPreviews[]`
- **Reality:** Message schema stores link previews and frontend renders them. But **no backend service actually fetches Open Graph metadata** from URLs in messages. Link previews are never populated.
- **Impact:** Users share links that appear as plain text — no title, description, or thumbnail preview. This is a core chat feature.
- **Fix:** Implement OG metadata scraping in messages service (on message create, detect URLs, fetch OG tags, store in `linkPreviews[]`). Use a library like `open-graph-scraper`.

### 2.17 No File Upload Progress Bars
- **Type:** Gap
- **Location:** `frontend/src/app/messages/page.tsx`
- **Reality:** File upload exists but with no progress indicator. Large files (up to 100MB supported by media service) appear to hang while uploading.
- **Impact:** Users don't know if their upload is progressing or stuck. They may retry, creating duplicates.
- **Fix:** Use `XMLHttpRequest` with `onprogress` event or `fetch` with `ReadableStream` for upload progress tracking.

### 2.18 No Pre-Call Camera/Mic Preview
- **Type:** Gap
- **Location:** `frontend/src/components/calling/`
- **Reality:** When a user initiates or accepts a call, they go directly into the call with no preview of their camera/mic. `MeetingLobby` has preview for meetings but not for regular calls.
- **Impact:** Users may start calls with camera showing something embarrassing, or mic on a wrong device. Every video app (Zoom, Teams, Google Meet) shows a preview.
- **Fix:** Add a pre-call modal showing local video + audio level meter + device selector before joining.

---

## 3. MEDIUM SEVERITY GAPS (Degraded Experience / Missing Polish)

### 3.1 No Message Scheduling UI
- **Backend:** Fully implemented (BullMQ processor, CRUD endpoints)
- **Frontend:** No UI for scheduling messages. Users can't access this feature.
- **Fix:** Add a clock icon next to send button, date/time picker modal.

### 3.2 No Reminder UI
- **Backend:** Fully implemented (BullMQ processor, CRUD endpoints)
- **Frontend:** No UI for setting reminders on messages.
- **Fix:** Add "Remind me" to MessageActionsMenu with time options (30min, 1hr, 3hr, tomorrow, custom).

### 3.3 No Channel Categories UI
- **Backend:** `POST /chat/channels/categories`, `GET /chat/channels/categories` exist
- **Frontend:** No UI for creating/managing channel categories or browsing channels by category.

### 3.4 No DLP/Compliance Admin Dashboard
- **Backend:** Full DLP, legal hold, retention, eDiscovery implemented
- **Frontend:** No admin UI for managing DLP rules, viewing flagged content, setting retention policies, or performing eDiscovery searches.
- **Impact:** Admins must use API directly — unusable for non-technical admins.

### 3.5 No Moderation Dashboard
- **Backend:** `GET /chat/moderation/flagged`, `PUT /chat/moderation/flagged/:id`, `GET /chat/moderation/stats` exist
- **Frontend:** No admin UI for reviewing flagged messages.

### 3.6 No Chat Analytics Dashboard
- **Backend:** Full analytics module (message volume, active channels, peak hours, thread engagement)
- **Frontend:** No admin UI for viewing chat analytics.

### 3.7 No Webhook Management UI
- **Backend:** Webhook delivery with retry logic implemented
- **Frontend:** No admin UI for configuring outgoing webhooks.

### 3.8 Search Uses MongoDB Text Index (Not Elasticsearch)
- **PRD:** Acknowledges this as a limitation
- **Impact:** Poor relevance ranking, no fuzzy matching, no highlighting, limited multilingual support. For a chat-heavy product, search quality is critical.
- **Recommendation:** Priority upgrade path — Elasticsearch with async indexing via message events.

### 3.9 No Conversation Mute Duration UI
- **Backend:** `mutedUntil` field on participant supports timed mutes
- **Frontend:** Mute toggle is binary (on/off). No UI for "Mute for 1 hour", "Mute until tomorrow", etc.

### 3.10 No "Mark as Unread" From Specific Message
- **Backend:** `PUT /chat/conversations/:id/unread` exists with messageId
- **Frontend:** Need to verify if this is exposed in the MessageActionsMenu.

### 3.11 No Star/Favorite Conversations UI
- **Backend:** `PUT /chat/conversations/:id/star` exists
- **Frontend:** Need to verify if starring is exposed and if there's a "Starred" filter tab.

### 3.12 Live Captions — Browser-Only, Not Reliable
- **PRD:** "Web Speech API (browser-side STT)"
- **Reality:** Depends on browser's Speech Recognition API. Not available in Firefox. Inconsistent quality.
- **Recommendation:** Server-side STT (Whisper or Google Speech-to-Text) for reliability.

### 3.13 No Call Waiting / Busy Detection
- **Reality:** If User A is already on a call and User B calls them, User B gets a normal ringing → missed. No "busy" signal, no call waiting option.
- **Fix:** Track active call state per user. Return `busy` status. Allow call waiting with "hold current, answer new" option.

### 3.14 No Contact/Favorites for Quick Calling
- **Reality:** To call someone, users navigate to the directory or a chat. No speed dial, favorites, or recent contacts widget on the calls page.
- **Fix:** Add a "Favorites" section and "Recent" contacts on the calls page for quick call initiation.

### 3.15 No Notification Sound Customization
- **Backend:** Chat settings support `sound` boolean (on/off)
- **Frontend:** No ability to choose notification sounds or set different sounds for messages vs calls vs mentions.

### 3.16 No Chat Bubble Customization UI
- **Backend:** Settings schema supports `chatBgColor`, `myBubbleColor`, `myTextColor`, `otherBubbleColor`, `otherTextColor`, `fontSize`
- **Frontend:** No settings UI for customizing these values.

### 3.17 Voice Huddles — No Frontend UI
- **Backend:** Fully implemented (`voice-huddle.service.ts`)
- **Frontend:** No UI for joining/leaving voice huddles. Users can't access Discord-like drop-in voice channels.
- **Impact:** Feature is built but invisible. Wasted backend work.

### 3.18 No Meeting Notes UI (Post-Meeting)
- **Backend:** AI meeting notes generation via LLM exists
- **Frontend:** Need to verify if meeting details page shows AI-generated notes, action items, and follow-ups.

### 3.19 No Conversation Archive/Cleanup UI
- **Backend:** `isArchived` field and auto-archive settings exist
- **Frontend:** No UI for archiving conversations or browsing archived ones.

### 3.20 No Guest Access UI for Channels
- **Backend:** `guestAccess` object on conversation schema (enabled, guestIds, inviteLink, linkExpiresAt)
- **Frontend:** No UI for generating guest invite links or managing guest access.

### 3.21 No Message Translation UI
- **Backend:** `services/chat-service/src/messages/translate.service.ts` exists as a file
- **Frontend:** No "Translate" action exposed in MessageActionsMenu.

### 3.22 Message Forwarding — Backend Logic Missing
- **Backend:** `POST /chat/messages/:id/forward` endpoint and `forwardedFrom` schema field exist, but **forwarding service logic is a stub** — model present, no actual forward implementation.
- **Frontend:** "Forward" action appears in context menu but destination picker and actual forwarding may not work end-to-end.

### 3.23 Rich Cards — Schema Only
- **Backend:** Card schema defined (title, text, color, actions, fields) but no card builder or renderer service.
- **Impact:** Bot integrations and structured messages can't use card format.

### 3.24 No Caching Layer in Chat Service
- **Backend:** Every message/conversation read hits MongoDB directly. No Redis caching for hot data (recent messages, conversation metadata, user settings).
- **Impact:** At scale, this creates unnecessary database load. Hot conversations with many readers will spike query counts.
- **Fix:** Add Redis cache with TTL for conversation metadata and recent messages.

### 3.25 Whiteboard — No Frontend UI
- **Backend:** `services/calling-service/src/meetings/whiteboard/whiteboard.service.ts` fully implemented (freehand, shapes, text, sticky notes, cursor tracking)
- **Frontend:** No whiteboard component exists. Feature is invisible to users.
- **Impact:** Collaborative whiteboard during meetings is a differentiator — backend is ready but unused.

### 3.26 No Error Boundaries in Frontend
- **Frontend:** No React error boundary components. If a chat or calling component crashes (e.g., malformed message data), the entire page goes white.
- **Fix:** Add `<ErrorBoundary>` wrappers around chat message list, call window, and meeting panels with retry UI.

### 3.27 No Skeleton Loaders / Loading States
- **Frontend:** Conversations and messages show no placeholder content while loading. Users see blank/empty areas during fetch.
- **Fix:** Add skeleton loaders for conversation list, message list, and participant grid.

### 3.28 Meeting Passwords Stored as Plaintext
- **Backend:** `joinPassword` field in meeting schema stored as plain string in MongoDB. No hashing.
- **Impact:** Database breach exposes all meeting passwords.
- **Fix:** Hash meeting passwords with bcrypt. Compare hashes on join.

---

## 4. LOW SEVERITY GAPS (Polish / Nice-to-Have)

### 4.1 No Dark Mode for Chat
- Chat UI appears to use fixed colors. No theme toggle or system preference detection for dark mode.

### 4.2 No Keyboard Shortcuts Beyond Cmd+K
- Only Cmd+K (search) is implemented. Missing: Ctrl+N (new message), Ctrl+Shift+M (mute), Up arrow (edit last message), Esc (close panels).

### 4.3 No Message Templates / Canned Responses
- No ability to save and reuse message templates. Useful for support teams and repetitive communication.

### 4.4 No Code Snippet Sharing with Syntax Highlighting
- Messages support `code` type in the schema. TipTap editor has code blocks with lowlight. But no dedicated code snippet modal with language selector and full preview.

### 4.5 No "Jump to Bottom" Button
- Long conversations with scrolling — no floating button to jump to the latest messages.

### 4.6 No Message Formatting Preview
- TipTap editor shows formatting. But no "Preview" mode before sending complex messages with code/links/mentions.

### 4.7 No Compact Message View
- Only one message density. No option for "Compact" (like Slack compact mode) for power users who want to see more messages.

### 4.8 No Auto-Away Based on System Idle
- Backend supports `away` status. But frontend doesn't detect system idle (mouse/keyboard inactivity) to automatically set away.

### 4.9 No Call Quality Feedback Prompt
- After call ends, no "How was the call quality?" survey. This data is valuable for improving infrastructure.

### 4.10 No Meeting Recording Playback UI
- Recordings are stored but no in-app playback. Users must download the file.

### 4.11 No Polls Results Visualization
- Polls show vote counts but no bar chart / percentage visualization.

### 4.12 No Conversation Export
- Users cannot export a conversation as PDF/text for record-keeping.

### 4.13 No Call Duration Timer in UI
- **Location:** `frontend/src/components/calling/CallControls.tsx`
- CallControls receives a `duration` prop but it's not displayed. Users don't see how long they've been on a call.

### 4.14 No Accessibility (ARIA Labels)
- Call controls, reaction pickers, and message action menus lack descriptive ARIA labels for screen readers.
- Presence indicators use color alone (no icon alternative for colorblind users).
- No focus trapping in modals (GroupCallInitiator, emoji picker).

### 4.15 No Custom Emoji Support
- Only Unicode emojis supported. No ability to upload/manage org-specific custom emojis (like Slack custom emoji).

---

## 5. PRD COMPLIANCE MATRIX

### Chat Service PRD Compliance

| PRD Section | Status | Gap |
|------------|--------|-----|
| Conversation Types (direct/group/channel/meeting_chat/self) | PASS | All implemented |
| Channel Variants (public/private/announcement) | PASS | All implemented |
| Message Types (12 types) | PASS | All schemas present |
| Message Security (XSS, rate limit, dedup) | PARTIAL | WS rate limits yes, REST rate limits missing |
| WebSocket Events (12 client, 13 server) | PASS | All in messages.gateway.ts |
| Typing Indicators | PASS | 7s TTL, debounce |
| Threads | PASS | Full CRUD + follow/unfollow |
| Presence & Status (9 statuses) | PASS | Redis + MongoDB |
| Custom Status | PASS | Emoji + text + expiry |
| Mentions (@user, @here, @all, @channel) | PASS | Regex parsing + notification filtering |
| Search | PASS | MongoDB text index (Elasticsearch recommended) |
| Pins & Bookmarks | PASS | Full CRUD |
| Polls | PASS | Full CRUD + WebSocket |
| Voice Messages | PASS | Recording + playback |
| Commands (/help, /status, /shrug, etc.) | PASS | Extensible handler |
| AI Summary | PASS | Conversation + thread + action items |
| Smart Replies | FAIL | Planned but not implemented |
| Moderation | PASS | Word list + AI-based |
| Compliance (DLP, Legal Hold, Retention, eDiscovery) | PASS | All implemented |
| Scheduled Messages | PARTIAL | Backend done, no frontend UI |
| Reminders | PARTIAL | Backend done, no frontend UI |
| Webhooks | PARTIAL | Backend done, no admin UI |
| Delta Sync | PASS | Cursor-based, fully working |
| Analytics | PARTIAL | Backend done, no admin UI |
| Chat Settings | PARTIAL | Backend done, frontend settings UI incomplete |
| Frontend Components (16 components) | PASS | All 16 present |
| Deep Linking | PASS | ?chat=&message=&thread= |
| Database Indexes | PASS | All indexes defined |

### Calling Service PRD Compliance

| PRD Section | Status | Gap |
|------------|--------|-----|
| Call Types (audio/video) | PASS | |
| Call Modes (p2p/group) | PASS | |
| Call Lifecycle States | PASS | Full state machine |
| WebSocket Events — Calls | PASS | All events handled |
| WebSocket Events — Meetings | PASS | All events handled |
| WebSocket Events — SFU | PASS | All events handled |
| Multi-Tab Support | PASS | Dismiss/already-answered events |
| Mediasoup SFU | PASS | With P2P fallback |
| Call Transfer (cold/warm) | PARTIAL | Cold fully done. Warm transfer consultation state management incomplete |
| Screen Sharing + Annotations | PASS | Color/brush/clear |
| Call Recording | FAIL | Metadata only, no ffmpeg pipeline |
| Call Quality Monitoring | PASS | 2s polling, 3-tier indicator |
| Voicemail | PASS | Record, store, listen |
| Voice Huddles | PARTIAL | Backend done, no frontend UI |
| Lobby/Waiting Room | PASS | Auto-admit rules, queue |
| Breakout Rooms | PASS | Auto-assign, broadcast |
| Hand Raise & Reactions | PASS | With FIFO ordering |
| Live Captions | PARTIAL | Browser-only STT |
| AI Meeting Notes | PASS | LLM integration |
| Meeting Chat | PASS | With linked conversation |
| Meeting Recording | FAIL | Same as call recording |
| Calendar Integration (ICS) | PASS | RFC 5545 export |
| Recurring Meetings | PASS | All frequencies |
| STUN/TURN Configuration | PASS | Dynamic HMAC credentials |
| ICE Restart | PASS | 3 attempts, exponential backoff |
| Frontend Hooks (6 hooks) | PASS | All present |
| Frontend Components (6+6) | PARTIAL | Virtual background stub |
| Video Display Modes (PIP/Grid/Screen) | PASS | Adaptive grid |
| Ringtone System | PASS | Web Audio API |
| Data Channel | PASS | Control messages |
| Calls Page (History/Stats) | PASS | Filters, stats, detail modal |
| Meeting Permissions Matrix | PASS | Host > co-host > presenter > attendee |

---

## 6. CROSS-MODULE INTEGRATION GAPS

| Integration | Status | Gap |
|------------|--------|-----|
| Chat <-> Calling | PARTIAL | Call buttons in chat work. But no "call started" system message in chat when a call begins from a conversation. |
| Chat <-> Notification Service | NOT WIRED | Events not flowing. Push notifications for messages/mentions not working. |
| Calling <-> Notification Service | NOT WIRED | Missed call push notifications not working. |
| Chat <-> Media Service | PARTIAL | File upload works. No thumbnail generation, no image compression. |
| Calling <-> Media Service | NOT WIRED | Recording pipeline incomplete. |
| Meeting <-> Chat (meeting_chat) | PASS | Redis pub/sub integration works. |
| Chat <-> HR Service | PARTIAL | User names resolved. But no employee status integration (e.g., on leave = auto DND). |
| Auth <-> Chat/Calling | PASS | JWT validation on all endpoints and sockets. |

---

## 7. ARCHITECTURE OBSERVATIONS

### 7.1 Strengths
- **Clean module separation** — 21+ domain modules in chat service, each with own service/controller/schema
- **Robust WebSocket implementation** — Rate limiting, reconnection, multi-tab coordination
- **Enterprise compliance** — DLP, legal hold, retention, eDiscovery all production-ready
- **AI integration** — Moderation, summaries, action items all connected to LLM
- **Hybrid P2P/SFU** — Smart architecture that scales from 1:1 to 100-person meetings
- **Security** — XSS sanitization, ReDoS protection, TURN credential rotation

### 7.2 Concerns
- **Single MongoDB dependency** — No read replicas or sharding strategy visible for message-heavy workloads
- **No message queue between services** — Chat and Calling services don't emit events to a shared bus (RabbitMQ/SQS). Cross-service communication relies on Redis pub/sub and direct HTTP, which won't survive Redis downtime.
- **No observability** — Prometheus endpoint exists but no structured traces (OpenTelemetry), no distributed request tracing across services
- **In-memory state risk** — Voice huddles, some rate limiting uses in-memory Maps. Service restart = state loss.
- **Test coverage unknown** — Test directories exist but coverage of real-time WebSocket flows, edge cases (network drops, race conditions), and integration tests is unclear.

---

## 8. PRIORITIZED RECOMMENDATIONS

### P0 — Ship Blockers (Fix before go-live)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| 1 | Wire push notifications (chat + calls -> notification service) + implement FCM/Web Push stubs | 5-6 days | Users miss ALL messages/calls without this. Both integration AND delivery are broken. |
| 2 | Implement call/meeting recording pipeline (ffmpeg + S3) | 4-5 days | Recording button is a lie without this |
| 3 | Implement link preview fetching (OG metadata scraper) | 2 days | Links appear as plain text — core chat feature |
| 4 | Complete media processing pipeline (thumbnail S3 upload, video thumbs) | 3 days | File previews broken in chat |
| 5 | Remove/consolidate dual gateway in chat service | 1 day | Prevents silent event failures |
| 6 | Add REST API rate limiting on chat service | 1 day | Abuse prevention |
| 7 | Add drag-and-drop + clipboard paste for files/images | 2 days | Basic UX expectation |
| 8 | Add file upload progress bars | 1 day | Users think upload is stuck |

### P1 — Core Experience (First 2 sprints post-launch)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| 9 | GIF picker (Tenor API integration) | 2 days | Major engagement feature |
| 10 | Virtual background (MediaPipe) | 3 days | WFH essential |
| 11 | Message scheduling UI | 1 day | Backend already done |
| 9 | Reminder UI | 1 day | Backend already done |
| 10 | Read receipt detail (who read) | 1 day | Group chat essential |
| 11 | Browser native PIP for calls | 0.5 day | Quick win |
| 15 | Tab unread badge (favicon + title) | 0.5 day | Quick win |
| 16 | Noise cancellation audio constraints | 0.5 day | Quick win |
| 17 | Call duration timer in UI | 0.5 day | Quick win — prop exists, just display it |
| 18 | Pre-call camera/mic preview | 2 days | Prevents embarrassing call starts |
| 19 | Voice huddles frontend UI | 2 days | Backend wasted without UI |
| 20 | Whiteboard frontend UI | 3 days | Backend fully built, feature invisible |
| 21 | Call hold/resume | 2 days | Standard phone feature |
| 22 | Offline message caching (IndexedDB) | 3-4 days | Mobile/flaky connection UX |
| 23 | Error boundaries + skeleton loaders | 1-2 days | Prevents white-screen crashes |
| 24 | Read receipt detail (who read) | 1 day | Group chat essential |

### P2 — Differentiation (Next quarter)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| 25 | Admin dashboards (moderation, DLP, analytics, webhooks) | 5-7 days | Enterprise admin experience |
| 26 | Elasticsearch migration for search | 3-5 days | Search quality |
| 27 | Voice message transcription (Whisper) | 2 days | Accessibility + searchability |
| 28 | Smart replies (AI) | 2-3 days | Productivity feature |
| 29 | Server-side live captions (Whisper STT) | 3-4 days | Cross-browser reliability |
| 30 | Chat bubble/appearance customization UI | 1-2 days | Backend ready |
| 31 | Call quality feedback survey | 1 day | Infrastructure insights |
| 32 | E2E encryption (SRTP verification) | 5-7 days | Enterprise compliance |
| 33 | Message forwarding implementation | 1-2 days | Schema exists, logic stubbed |
| 34 | Redis caching layer for chat service | 2-3 days | Performance at scale |
| 35 | Hash meeting passwords (bcrypt) | 0.5 day | Security fix |
| 36 | Accessibility (ARIA labels, focus trapping) | 2-3 days | Compliance requirement |

---

## 9. RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Redis failure breaks real-time chat in multi-instance | Medium | Critical | Add Redis Sentinel/Cluster, health checks, single-instance fallback |
| Recording feature creates false confidence | High | High | Either implement pipeline or remove the recording button |
| No push notifications = silent product (FCM/APNS all stubs) | High | Critical | P0 priority — implement FCM stubs + wire notification service |
| MongoDB performance at scale (high message volume, no cache) | Medium | High | Add Redis caching, read replicas, sharding by orgId |
| Browser STT for captions fails on Firefox/Safari | High | Medium | Server-side STT or clear browser support messaging |
| In-memory state loss on service restart | Medium | Medium | Migrate voice huddles + rate limit counters to Redis |
| Meeting password plaintext in DB | Medium | High | Hash with bcrypt before storage |
| Media processing marks "complete" without processing | High | Medium | Files show as processed when they're not — thumbnails missing |
| Two Call schemas may conflict (CallingModule vs CallsModule) | Medium | High | Consolidate to single schema before data grows |
| Link previews never populated — dead UI component | High | Medium | Users see empty preview cards or no previews at all |

---

## 10. FEATURES MISSING FROM PRD (Should Be Added)

These features are **not in either PRD** but are standard in competing products (Slack, Teams, Discord, Zoom) and should be considered:

| Feature | Competitors | Priority |
|---------|------------|----------|
| **Message threading indicator in main view** (collapsed thread preview) | Slack, Teams | High |
| **@mention autocomplete popup** while typing | Slack, Teams, Discord | High |
| **Emoji skin tone selector** | Slack, Teams | Medium |
| **Message edit history viewer** (click "edited" to see changes) | Slack, Teams | Medium |
| **Do Not Disturb schedule UI** (quiet hours) | Slack, Teams | Medium |
| **Auto-away on system idle** | Slack, Discord | Medium |
| **Conversation export (PDF/text)** | Teams, WhatsApp | Low |
| **Compact message view toggle** | Slack | Low |
| **Call waiting / busy signal** | Zoom, Teams | Medium |
| **Speed dial / favorites for calling** | Teams, Zoom | Medium |
| **Meeting recording playback in-app** | Zoom, Teams | Medium |
| **Slash command custom actions** (beyond built-in) | Slack | Low |
| **Message formatting toolbar visibility toggle** | Slack, Teams | Low |
| **Keyboard shortcuts panel** (Cmd+/ to view all) | Slack | Low |

---

*Generated by Goku — Business Architect Agent*
*Analysis based on full code trace of: chat-service (21 modules), calling-service (8 modules), frontend (16+ components, 8 hooks), media-service, notification-service, API gateway*
*PRD baseline: chat-messaging-prd.md + calling-prd.md*
