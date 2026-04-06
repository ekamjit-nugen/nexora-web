# PRD: Chat & Messaging

**Module:** Chat Service
**Version:** 1.0
**Date:** 2026-04-06
**Status:** Implemented
**Service:** `services/chat-service` (Port 3002)
**Owner:** Nexora Platform Team

---

## 1. Purpose

The Chat & Messaging module provides real-time team communication across direct messages, group chats, and channels. It includes threading, presence, reactions, polls, voice messages, AI-powered summaries, content moderation, compliance features (retention, legal hold, DLP, eDiscovery), and full-text search — all within a multi-tenant, org-scoped architecture.

---

## 2. Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Real-time delivery | < 200ms message delivery (WebSocket) |
| Reliability | Message deduplication via idempotency keys |
| Engagement | Thread engagement rate tracked via analytics |
| Compliance | Configurable retention, legal holds, DLP rules |
| Discoverability | Full-text search across all user conversations |
| AI productivity | Conversation summaries + action item extraction |

---

## 3. Architecture Overview

### 3.1 Service Configuration

| Property | Value |
|----------|-------|
| Port | 3002 (env: `CHAT_SERVICE_PORT`) |
| API Prefix | `/api/v1` |
| WebSocket | Socket.IO, `/chat` namespace |
| Database | MongoDB |
| Cache/Pub-Sub | Redis (presence, rate limiting, Socket.IO adapter) |
| Queue | BullMQ (webhooks, reminders, retention, scheduled messages) |
| Metrics | Prometheus endpoint |
| Logger | Pino (structured JSON) |

### 3.2 Module Organization

**21 domain modules + 3 infrastructure modules:**

| Category | Modules |
|----------|---------|
| Core | Conversations, Messages, Threads, Channels, Mentions, Presence, Settings |
| Features | Search, Pins, Bookmarks, Polls, Voice Messages, Commands, Scheduled Messages, AI Summary, Reminders, Analytics |
| Governance | Moderation, Compliance (Retention, Legal Hold, DLP, eDiscovery), Webhooks |
| Infrastructure | QueueModule (BullMQ), EventsModule (Redis pub/sub), MetricsModule (Prometheus) |

---

## 4. Conversation Types

### 4.1 Types

| Type | Description | Participants | Creation |
|------|-------------|--------------|----------|
| `direct` | 1-to-1 private chat | Exactly 2 | De-duplicated (returns existing if pair exists) |
| `group` | Multi-user private chat | 3+ | Any user can create |
| `channel` | Team-wide communication | Multiple | Manager+ role required |
| `meeting_chat` | Auto-created for meetings | Meeting attendees | Created by meeting event listener |
| `self` | Personal notes ("Notes to Self") | 1 (self) | Auto-created on first access |

### 4.2 Channel Variants

| Variant | Description |
|---------|-------------|
| `public` | Discoverable, any org member can join |
| `private` | Invite-only, hidden from browse |
| `announcement` | Posting restricted to admins, read-only for members |

### 4.3 Conversation Schema

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `name` | string | Display name (groups/channels) |
| `description` | string | Optional description |
| `type` | enum | direct, group, channel, meeting_chat, self |
| `channelType` | enum | public, private, announcement |
| `participants[]` | array | See participant fields below |
| `lastMessage` | object | {_id, content, senderId, senderName, type, sentAt} |
| `messageCount` | number | Total messages |
| `topic` | string | Channel topic |
| `categoryId` | string | Channel category |
| `settings` | object | Channel-specific settings |
| `meetingId` | string | Linked meeting |
| `guestAccess` | object | {enabled, guestIds, inviteLink, linkExpiresAt} |
| `isArchived` | boolean | Archive status |
| `isDeleted` | boolean | Soft delete |
| `createdBy` | string | Creator user ID |

**Participant Fields:**

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | User ID |
| `role` | enum | owner, admin, member |
| `memberStatus` | enum | active, invited, pending |
| `joinedAt` | Date | When joined |
| `lastReadAt` | Date | Last read timestamp |
| `lastReadMessageId` | string | Last read message |
| `muted` | boolean | Mute notifications |
| `mutedUntil` | Date | Timed mute |
| `isPinned` | boolean | Pin to top |
| `isStarred` | boolean | Star conversation |
| `notifyPreference` | enum | all, mentions, nothing |

### 4.4 Channel Settings

| Setting | Type | Description |
|---------|------|-------------|
| `whoCanPost` | enum | everyone, admins |
| `whoCanMention` | enum | everyone, admins |
| `whoCanPin` | enum | everyone, admins |
| `threadRequirement` | enum | off, encouraged, required |
| `slowModeSeconds` | number | Cooldown between posts (non-admins) |
| `autoArchiveDays` | number | Auto-archive after N days inactive |

---

## 5. Messages

### 5.1 Message Types

| Type | Description |
|------|-------------|
| `text` | Rich text (HTML via TipTap) or plain text |
| `file` | Generic file attachment |
| `image` | Image with preview |
| `video` | Video with player |
| `audio` | Voice message |
| `code` | Code snippet |
| `poll` | Interactive poll |
| `card` | Rich card with actions |
| `meeting` | Meeting notification |
| `call` | Call notification |
| `forwarded` | Forwarded message with source metadata |
| `system` | System-generated message |

### 5.2 Message Schema

| Field | Type | Notes |
|-------|------|-------|
| `conversationId` | string | Parent conversation |
| `threadId` | string | Parent thread (for replies) |
| `senderId` | string | Author user ID |
| `senderName` | string | Author display name |
| `content` | string | HTML content (sanitized) |
| `contentPlainText` | string | Stripped text for search index |
| `type` | enum | See message types above |
| `status` | enum | sending → sent → delivered → read / failed |
| `attachments[]` | array | {fileId, name, url, thumbnailUrl, type, mimeType, size} |
| `reactions[]` | array | {emoji, users[{userId, createdAt}], count} |
| `mentions[]` | array | {type, targetId, displayName, offset, length} |
| `linkPreviews[]` | array | {url, title, description, imageUrl, siteName, fetchedAt} |
| `replyTo` | string | Quoted message ID |
| `editHistory[]` | array | [{content, editedAt}] |
| `isEdited` | boolean | Has been edited |
| `isDeleted` | boolean | Soft deleted |
| `deletedAt` | Date | Deletion timestamp |
| `deletedBy` | string | Who deleted |
| `isPinned` | boolean | Pinned to conversation |
| `pinnedBy`, `pinnedAt` | string, Date | Pin metadata |
| `isFlagged`, `flaggedAt` | boolean, Date | Moderation flag |
| `priority` | string | Message priority |
| `scheduledAt` | Date | Scheduled send time |
| `isScheduled` | boolean | Scheduled message flag |
| `idempotencyKey` | string | Deduplication key |
| `botId` | string | Bot author (if applicable) |
| `webhookId` | string | Webhook source (if applicable) |

### 5.3 Thread Info (on root message)

| Field | Type | Notes |
|-------|------|-------|
| `replyCount` | number | Total thread replies |
| `participantIds` | string[] | Thread participants |
| `lastReplyAt` | Date | Most recent reply |
| `lastReplyBy` | string | Most recent replier |
| `followers` | string[] | Thread followers |

### 5.4 Poll Structure (embedded in message)

| Field | Type | Notes |
|-------|------|-------|
| `question` | string | Poll question |
| `options[]` | array | {id, text, votes: userId[]} |
| `settings.multipleChoice` | boolean | Allow multiple votes |
| `settings.anonymous` | boolean | Hide voter identity |
| `settings.expiresAt` | Date | Auto-close time |
| `settings.allowAddOptions` | boolean | Users can add options |
| `closedAt` | Date | When poll was closed |

### 5.5 Card Structure (embedded in message)

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Card title |
| `text` | string | Card body |
| `color` | string | Accent color |
| `actions[]` | array | {type, text, url, style} |
| `fields[]` | array | {title, value, short} |

### 5.6 Forwarding Metadata

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | string | Original message |
| `conversationId` | string | Source conversation |
| `conversationName` | string | Source name |
| `senderId` | string | Original sender |
| `senderName` | string | Original sender name |

### 5.7 Message Security

| Control | Implementation |
|---------|---------------|
| XSS prevention | DOMPurify whitelist (b, i, u, s, em, strong, a, p, br, ul, ol, li, code, pre, blockquote, h1-h3, span) |
| Content length | 40,000 character limit |
| Rate limiting | 30 messages/minute (distributed: Redis + in-memory fallback) |
| Deduplication | `idempotencyKey` unique index |
| Participant check | Every operation verifies conversation membership |

---

## 6. Real-Time Communication

### 6.1 WebSocket Gateway

- **Namespace:** `/chat`
- **Auth:** JWT in `handshake.auth.token`, query param, or Authorization header
- **Scaling:** Redis adapter for multi-instance pub/sub
- **Rooms:** `user:{userId}` + `conv:{conversationId}` per user

### 6.2 Client → Server Events

| Event | Payload | Rate Limit | Description |
|-------|---------|------------|-------------|
| `message:send` | content, type, replyTo, fileUrl, fileName, fileSize, fileMimeType, idempotencyKey | 30/min | Send message |
| `message:delivered` | messageId, conversationId | — | Mark as delivered |
| `message:read` | conversationId | — | Mark conversation as read |
| `message:edit` | messageId, content, conversationId | — | Edit message |
| `message:delete` | messageId, conversationId | — | Delete message |
| `message:reaction` | messageId, emoji, conversationId | 20/min | Toggle reaction |
| `typing:start` | conversationId | — | Start typing indicator |
| `typing:stop` | conversationId | — | Stop typing indicator |
| `conversation:join` | conversationId | — | Join conversation room |
| `thread:reply` | threadId, content, conversationId | — | Reply to thread |
| `poll:vote` | messageId, optionId, conversationId | — | Vote on poll |
| `presence:heartbeat` | — | — | Keep-alive (every 30s) |

### 6.3 Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | full message object | New message received |
| `message:ack` | messageId, status | Send acknowledgment |
| `message:edited` | messageId, content, conversationId | Message was edited |
| `message:deleted` | messageId, conversationId | Message was deleted |
| `message:status-update` | messageId, status | Delivery/read status change |
| `message:reaction:update` | messageId, reactions[] | Reactions changed |
| `conversation:read` | conversationId, userId | User read conversation |
| `conversation:updated` | conversation object | Conversation metadata changed |
| `conversation:added` | conversation object | User added to new conversation |
| `typing` | userId, conversationId, typing: bool | Typing indicator |
| `users:online-list` | userId[] | Initial online list on connect |
| `user:online` | userId, online: bool | User online/offline |
| `thread:new-reply` | message object | New thread reply |
| `poll:updated` | messageId, poll object | Poll state changed |
| `error` | code, message | Error notification |

### 6.4 Connection Lifecycle

1. Client connects with JWT token
2. Server validates JWT, extracts user identity
3. User joins `user:{userId}` room + all `conv:{conversationId}` rooms
4. Server sends `users:online-list` + `presence:batch`
5. Client sends `presence:heartbeat` every 30 seconds
6. On disconnect: 30-second grace period before broadcasting offline (handles reconnects)

### 6.5 Typing Indicators

- **TTL:** 7 seconds (auto-clears if client doesn't send `typing:stop`)
- **Frontend debounce:** 3-second timeout after last keystroke
- **Prevents:** Ghost typing indicators from disconnected clients

---

## 7. Threads

### 7.1 Features

- Any message can become a thread root
- Replies stored as separate messages with `threadId` reference
- Thread metadata tracked on root message (replyCount, participants, lastReply)
- Auto-follow on reply; manual follow/unfollow
- Thread panel opens as side panel in UI

### 7.2 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chat/threads/:messageId` | Get thread replies (paginated) |
| POST | `/chat/threads/:messageId/reply` | Reply to thread |
| POST | `/chat/threads/:messageId/follow` | Follow thread |
| DELETE | `/chat/threads/:messageId/follow` | Unfollow thread |

### 7.3 WebSocket

- `thread:reply` (client → server) — send reply
- `thread:new-reply` (server → client) — broadcast reply to conversation

---

## 8. Presence & Status

### 8.1 Architecture

- **Primary store:** Redis hash `presence:{organizationId}` (10-min TTL)
- **Persistence:** MongoDB `UserPresence` collection
- **Lookup:** Redis first, MongoDB fallback
- **Batch:** Optimized multi-user lookup on connect

### 8.2 Status Values

| Status | Description |
|--------|-------------|
| `online` | Active and connected |
| `away` | Idle (auto-set after 5 min inactive) |
| `busy` | User-set busy |
| `dnd` | Do Not Disturb |
| `in_meeting` | In a meeting |
| `in_call` | On a call |
| `presenting` | Screen sharing |
| `offline` | Disconnected |
| `ooo` | Out of Office |

### 8.3 Custom Status

Users can set:
- `customEmoji` — emoji icon
- `customText` — status text
- `expiresAt` — auto-clear time

### 8.4 Automated Status Transitions

| Trigger | Action |
|---------|--------|
| No heartbeat for 5 min | Status → `away` |
| Heartbeat received while `away` | Status → `online` |
| Disconnect + 30s grace period | Status → `offline` |
| DND schedule start | Status → `dnd` |
| DND schedule end | Status → previous |

### 8.5 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chat/users/online` | Online user IDs |
| PUT | `/chat/presence/status` | Set status + custom text |
| GET | `/chat/presence/batch?userIds=` | Batch presence lookup |
| GET | `/chat/presence/dnd` | Get DND schedule |
| PUT | `/chat/presence/dnd` | Update DND schedule |

---

## 9. Mentions & Notifications

### 9.1 Mention Types

| Pattern | Type | Behavior |
|---------|------|----------|
| `@{userId}` | `user` | Notify specific user |
| `@here` | `here` | Notify online participants |
| `@all` | `all` | Notify all participants |
| `@channel` | `channel` | Notify all participants |

### 9.2 Parsing

- Regex: `/@(here|all|channel|[a-f0-9]{24})/gi`
- Extracted: type, targetId, displayName, offset, length
- Stored in `mentions[]` array on message

### 9.3 Notification Filtering

Respects per-user `notifyPreference` on conversation:
- `all` — receive all message notifications
- `mentions` — only @mentions and @here/@all
- `nothing` — no notifications

### 9.4 Channel Restrictions

- `whoCanMention` setting controls who can use @here/@all
- Admins always allowed; members restricted if setting = `admins`

---

## 10. Search

### 10.1 Implementation

- MongoDB text index on `contentPlainText`
- Falls back to regex search for queries < 2 characters
- Scoped to user's conversations only (not org-wide)

### 10.2 Filters

| Filter | Type | Description |
|--------|------|-------------|
| `q` | string | Search query |
| `from` | string | Sender user ID |
| `in` | string | Conversation ID |
| `has` | enum | file, image, link, code, poll |
| `before` | Date | Messages before date |
| `after` | Date | Messages after date |
| `type` | enum | Message type filter |
| `page`, `limit` | number | Pagination |

### 10.3 Endpoint

`GET /chat/search?q=...&from=...&in=...&has=...&before=...&after=...`

Returns `SearchResult[]` with highlights and metadata.

### 10.4 Security

- Regex escaping prevents ReDoS attacks in search queries
- User can only search their own conversations

---

## 11. Pins & Bookmarks

### 11.1 Pins

Org-shared pins per conversation.

| Constraint | Value |
|------------|-------|
| Max pins per conversation | 50 |
| Who can pin | Controlled by `whoCanPin` channel setting |

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/messages/:id/pin` | Pin message |
| DELETE | `/chat/messages/:id/pin` | Unpin message |
| GET | `/chat/conversations/:id/pins` | Get pinned messages |

### 11.2 Bookmarks

Personal saved messages per user.

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Owner |
| `messageId` | string | Saved message |
| `conversationId` | string | Source conversation |
| `label` | string | User-defined label |
| `note` | string | User-defined note |

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/bookmarks` | Save bookmark |
| GET | `/chat/bookmarks` | List bookmarks (with message content) |
| PUT | `/chat/bookmarks/:id` | Update label/note |
| DELETE | `/chat/bookmarks/:id` | Remove bookmark |

---

## 12. Polls

### 12.1 Features

- Created as messages with type `poll`
- Single or multiple choice
- Anonymous voting
- Auto-expiry
- Users can add options (if allowed)
- Creator can close poll

### 12.2 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/polls` | Create poll in conversation |
| POST | `/chat/polls/:id/vote` | Toggle vote (auto-clears if single choice) |
| POST | `/chat/polls/:id/close` | Close poll (creator only) |

### 12.3 WebSocket

- `poll:vote` (client → server) — cast vote
- `poll:updated` (server → client) — broadcast updated poll state

---

## 13. Voice Messages

### 13.1 Flow

1. User records audio in browser (WebM format)
2. Audio uploaded to media-service
3. Message created with type `audio`
4. Content set to `"Voice message (mm:ss)"` with duration

### 13.2 Fields

| Field | Value |
|-------|-------|
| `type` | `audio` |
| `fileUrl` | Media service URL |
| `fileName` | `voice-message.webm` |
| `fileMimeType` | `audio/webm` |
| `content` | `Voice message (duration)` |

---

## 14. Commands

### 14.1 Built-in Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/status` | Set presence status |
| `/shrug` | Append ¯\\_(ツ)_/¯ |
| `/tableflip` | Append (╯°□°)╯︵ ┻━┻ |
| `/remind` | Set message reminder |

### 14.2 Parsing

- Slash command detection: `/command [args]`
- Extensible handler registry for custom commands

---

## 15. AI Features

### 15.1 Conversation Summary

- Summarizes last 50 messages (200-word limit)
- LLM integration via `LLM_BASE_URL` (Deepseek)
- Accessible via AI Summary panel in UI

### 15.2 Thread Summary

- Summarizes thread replies (150-word limit)
- Useful for catching up on long threads

### 15.3 Action Item Extraction

- Parses conversation for action items
- Returns structured JSON array
- Extracted items can be converted to tasks

### 15.4 Smart Replies

- AI-generated reply suggestions (planned)

### 15.5 Conversation Catchup

- Summarize unread messages for late joiners

---

## 16. Moderation

### 16.1 Detection

| Method | Description |
|--------|-------------|
| Quick check | Word list (~30 abusive terms) |
| AI flagging | LLM-based multi-language abuse detection (English, Hindi, Punjabi, Tamil, etc.) |

### 16.2 Severity Levels

`info` | `warning` | `critical`

### 16.3 Flagged Message Flow

1. Message content checked on send
2. If flagged → stored in `FlaggedMessage` collection (status: `pending`)
3. Admin reviews → status: `reviewed` → `dismissed` or `actioned`

### 16.4 Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/moderation/flagged` | Admin/Owner | List flagged messages |
| PUT | `/chat/moderation/flagged/:id` | Admin/Owner | Review flagged message |
| GET | `/chat/moderation/stats` | Admin/Owner | Flagged message counts by status |

---

## 17. Compliance & Governance

### 17.1 Retention Policies

| Feature | Description |
|---------|-------------|
| Scope | Org-wide or per-conversation |
| Configuration | `retentionDays` per policy |
| Execution | BullMQ cron deletes messages older than retention period |
| Legal hold exemption | Messages under active holds are preserved |

### 17.2 Legal Holds

| Feature | Description |
|---------|-------------|
| Scope | Organization, conversation, or user |
| Target | `targetConversationIds[]`, `targetUserIds[]` |
| Effect | Prevents message deletion during retention cleanup |
| Lifecycle | Create → active → released (inactive + endedAt) |
| Check | `isUnderHold()` validates before any deletion |

### 17.3 Data Loss Prevention (DLP)

| Feature | Description |
|---------|-------------|
| Rules | Regex patterns with configurable actions |
| Actions | `block` (prevent send), `warn` (alert sender), `redact` (mask content), `flag` (moderation review) |
| Safety | ReDoS protection: nested quantifier detection + 100ms regex timeout |
| Built-in patterns | Credit card, Aadhaar, PAN, SSN, phone bulk, email bulk |
| Admin endpoints | Create/update/delete DLP rules |

### 17.4 eDiscovery

| Feature | Description |
|---------|-------------|
| Search | Admin-only cross-conversation org-wide search |
| Bypass | Ignores participant restrictions (audit logged) |
| Export | JSON export up to 10,000 messages |
| Audit | All eDiscovery searches logged for compliance |

---

## 18. Scheduled Messages

| Feature | Description |
|---------|-------------|
| Fields | `scheduledAt`, `isScheduled` on message |
| Execution | BullMQ processes scheduled messages at target time |
| Status | Pending until sent, then regular message |

---

## 19. Reminders

### 19.1 Schema

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Reminder owner |
| `messageId` | string | Target message |
| `conversationId` | string | Source conversation |
| `reminderAt` | Date | When to remind |
| `note` | string | Optional note |
| `status` | enum | pending, sent, cancelled |

### 19.2 Processing

- BullMQ checks due reminders every 60 seconds
- Sends notification when `reminderAt` is reached
- User can cancel before trigger

---

## 20. Webhooks

### 20.1 Outgoing Webhooks

| Feature | Description |
|---------|-------------|
| Events | message:created, message:edited, message:deleted, etc. |
| Delivery | BullMQ queue with 5 concurrent workers |
| Retry | 3 attempts with exponential backoff (starting 5s) |
| Tracking | Failure count per webhook, last triggered timestamp |

---

## 21. Sync & Offline Support

### 21.1 Delta Sync

| Feature | Description |
|---------|-------------|
| Endpoint | `getSyncDelta(userId, since, cursor?, batchSize=200)` |
| Returns | Updated conversations, new messages, presence changes |
| Pagination | Cursor-based (returns `nextCursor` if batch full) |
| Use case | Mobile reconnect — fetch changes since last sync |

---

## 22. Analytics

### 22.1 Metrics (Admin-only)

| Metric | Description |
|--------|-------------|
| Message volume | Messages per day |
| Messages by type | Breakdown by text/file/image/poll/etc. |
| Most active channels | Top 10 by message count |
| Peak activity hours | Hourly message distribution |
| Thread engagement rate | Threads with replies / total threads |
| Unique active users | Distinct senders per period |

### 22.2 Privacy

- No individual message content exposed
- No private DM analytics
- Date range filter (default: last 30 days)

### 22.3 Endpoint

`GET /chat/analytics/...` — Admin/Owner only

---

## 23. Chat Settings

### 23.1 Per-User Settings

| Category | Settings |
|----------|----------|
| Read Receipts | `showMyReadStatus`, `showOthersReadStatus` |
| Appearance | `chatBgColor`, `myBubbleColor`, `myTextColor`, `otherBubbleColor`, `otherTextColor`, `fontSize` (small/medium/large) |
| Notifications | `sound`, `desktop`, `muteAll` |

### 23.2 Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/settings` | User | Get own settings |
| PUT | `/chat/settings` | User | Update own settings |
| PUT | `/chat/settings/:userId/override` | Admin/Owner | Override user settings |

---

## 24. Frontend Architecture

### 24.1 Page Layout

Three-column layout:
1. **Left sidebar (300px):** Conversation list with tabs (all/direct/group/channel), search, pin/mute indicators
2. **Center (flex):** Active conversation — message list, input, typing indicators, date separators
3. **Right panel (conditional):** Threads, pinned messages, bookmarks, file browser, AI summary, member list

### 24.2 Chat Components

| Component | Purpose |
|-----------|---------|
| `MessageContent` | Renders HTML/markdown with @mention highlighting |
| `ThreadPanel` | Side panel for thread replies |
| `RichTextEditor` | TipTap-based editor (bold, italic, code, lists, links) |
| `PresenceIndicator` | Colored dot for user status |
| `StatusSetter` | Modal to set custom status |
| `FileBrowser` | Conversation file listing with filter tabs |
| `LinkPreview` | URL preview card |
| `GlobalSearch` | Full-screen search modal (Cmd+K) |
| `PinnedMessages` | Side panel for pinned messages |
| `BookmarksList` | Side panel for saved messages |
| `VoiceRecorder` | Recording UI with timer + waveform |
| `AiSummaryPanel` | AI conversation summary + action items |
| `UserProfileCard` | Hover card with user info |
| `ChannelMembersList` | Member list for groups/channels |
| `UnreadBanner` | Unread count + mark-as-read button |
| `MessageActionsMenu` | Context menu (react, reply, forward, pin, edit, delete) |

### 24.3 Message Display Features

| Feature | Implementation |
|---------|---------------|
| Emoji-only messages | Rendered at 32px size |
| Edited messages | "(edited)" indicator |
| Deleted messages | "This message was deleted" placeholder |
| Reactions | Emoji + count, click to toggle |
| Read receipts | Single/double checkmarks (customizable) |
| Timestamps | Relative format (now, 5m, 2h, Yesterday, Jan 15) |
| Date separators | Group messages by date |
| File previews | Image preview, video player, file download button |

### 24.4 Quick Reactions

Default reaction bar: `thumbs_up` `heart` `laughing` `surprised` `sad` `fire`

### 24.5 Message Actions

| Action | Availability |
|--------|--------------|
| React | All members |
| Reply in thread | All members |
| Forward | All members |
| Copy text | All members |
| Bookmark | All members |
| Pin/Unpin | Per channel settings |
| Edit | Own messages only |
| Delete | Own messages or admin |

### 24.6 State Persistence

| Key | Storage | Purpose |
|-----|---------|---------|
| `nexora_active_chat` | localStorage | Active conversation ID |
| `nexora-draft:{conversationId}` | localStorage | Unsent message drafts |
| `nexora-notification-preferences` | localStorage | Notification fallback |

### 24.7 Hooks

| Hook | Purpose |
|------|---------|
| `useGlobalSocket()` | Socket state from SocketProvider |
| `useConversationDrafts()` | Draft persistence (get/set/clear/preview) |
| `useMessageDeepLink()` | URL-based navigation (?chat=&message=&thread=) |

### 24.8 Deep Linking

URL parameters for direct message navigation:
- `?chat={conversationId}` — open conversation
- `?message={messageId}` — scroll to message
- `?thread={threadId}` — open thread panel

---

## 25. Event Listeners

### 25.1 Cross-Service Events

| Event | Source | Action |
|-------|--------|--------|
| Meeting started | Calling service | Create `meeting_chat` conversation |
| File deleted | Media service | Clean up messages referencing file |
| Invite accepted | Auth service | Activate invited participants in conversations |

---

## 26. Guards & Security

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validates Bearer token, extracts user identity |
| `RolesGuard` | RBAC check via `@Roles()` decorator |
| `ChannelPermissionGuard` | Enforces whoCanPost, whoCanMention, whoCanPin, slowMode, threadRequirement |
| `WsRateLimit` | WebSocket rate limiting (distributed Redis + in-memory) |

### 26.1 Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Send message (WS) | 30 | 1 minute |
| Reactions (WS) | 20 | 1 minute |
| API requests (gateway) | 100 | 1 minute |

### 26.2 Rate Limit Implementation

- **Primary:** Redis INCR with expiry (distributed across instances)
- **Fallback:** In-memory Map when Redis unavailable
- **Cleanup:** Stale in-memory entries purged every 60 seconds

---

## 27. Database Indexes

### Conversations

| Index | Purpose |
|-------|---------|
| `participants.userId + type + isDeleted` | User's conversations by type |
| `organizationId + channelType` | Channel browsing |
| `participants.userId + lastMessage.sentAt` | Sort by recent activity |
| `organizationId + channelType + isArchived` | Active channels |
| `categoryId + organizationId` | Channel categories |
| `meetingId` | Meeting chat lookup |

### Messages

| Index | Purpose |
|-------|---------|
| `conversationId + createdAt DESC` | Message list (primary) |
| `conversationId + threadId + createdAt DESC` | Thread replies |
| `conversationId + isDeleted` | Non-deleted messages |
| `conversationId + isPinned + pinnedAt DESC` | Pinned messages |
| `senderId + createdAt DESC` | User's messages |
| `contentPlainText` (text) | Full-text search |
| `mentions.targetId + createdAt DESC` | Mention lookup |
| `conversationId + type + createdAt DESC` | Messages by type |
| `idempotencyKey` (unique, sparse) | Deduplication |
| `scheduledAt + isScheduled` | Scheduled messages |

---

## 28. API Reference

### 28.1 Conversation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/conversations/direct` | Yes | Create direct conversation |
| POST | `/chat/conversations/group` | Yes | Create group |
| POST | `/chat/conversations/channel` | Yes | Create channel (manager+) |
| GET | `/chat/conversations` | Yes | List user's conversations |
| GET | `/chat/conversations/:id` | Yes | Get conversation |
| PUT | `/chat/conversations/:id/pin` | Yes | Toggle pin |
| PUT | `/chat/conversations/:id/mute` | Yes | Toggle mute |
| PUT | `/chat/conversations/:id/unarchive` | Yes | Unarchive |
| PUT | `/chat/conversations/:id/star` | Yes | Star/unstar |
| PUT | `/chat/conversations/:id/unread` | Yes | Mark unread from message |
| POST | `/chat/conversations/:id/participants` | Yes | Add participants |
| DELETE | `/chat/conversations/:id/participants/:userId` | Yes | Remove participant |
| POST | `/chat/conversations/:id/leave` | Yes | Leave conversation |
| POST | `/chat/conversations/:id/convert-group` | Yes | Convert direct → group |
| POST | `/chat/conversations/:id/invite-participants` | Yes | Add invited users |
| POST | `/chat/conversations/activate-user` | Yes | Activate invited user |
| GET | `/chat/conversations/self` | Yes | Get/create self-notes |

### 28.2 Message Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/conversations/:id/messages` | Yes | Send message |
| GET | `/chat/conversations/:id/messages` | Yes | Get messages (paginated, default 50) |
| PUT | `/chat/messages/:id` | Yes | Edit message (own only) |
| DELETE | `/chat/messages/:id` | Yes | Soft-delete message |
| POST | `/chat/messages/:id/forward` | Yes | Forward to conversation |
| POST | `/chat/messages/:id/create-task` | Yes | Create task from message |
| GET | `/chat/conversations/:id/read-status` | Yes | Read receipt count |

### 28.3 Thread Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/threads/:messageId` | Yes | Get thread replies |
| POST | `/chat/threads/:messageId/reply` | Yes | Reply to thread |
| POST | `/chat/threads/:messageId/follow` | Yes | Follow thread |
| DELETE | `/chat/threads/:messageId/follow` | Yes | Unfollow thread |

### 28.4 Channel Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/channels/browse` | Yes | Browse public channels |
| POST | `/chat/channels/:id/join` | Yes | Join public channel |
| GET | `/chat/channels/categories` | Yes | Get channel categories |
| POST | `/chat/channels/categories` | Yes | Create category |

### 28.5 Search, Pins, Bookmarks, Polls

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/search` | Yes | Global message search |
| POST | `/chat/messages/:id/pin` | Yes | Pin message |
| DELETE | `/chat/messages/:id/pin` | Yes | Unpin message |
| GET | `/chat/conversations/:id/pins` | Yes | Get pinned messages |
| POST | `/chat/bookmarks` | Yes | Save bookmark |
| GET | `/chat/bookmarks` | Yes | List bookmarks |
| PUT | `/chat/bookmarks/:id` | Yes | Update bookmark |
| DELETE | `/chat/bookmarks/:id` | Yes | Remove bookmark |
| POST | `/chat/polls` | Yes | Create poll |
| POST | `/chat/polls/:id/vote` | Yes | Vote on poll |
| POST | `/chat/polls/:id/close` | Yes | Close poll |

---

## 29. Environment Configuration

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing key |

### Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAT_SERVICE_PORT` | `3002` | Service port |
| `CORS_ORIGINS` | `localhost:3000,3100,3005` | Allowed origins |
| `REDIS_URI` | — | Redis for presence, rate limits, Socket.IO |
| `LLM_BASE_URL` | — | AI/LLM endpoint for summaries + moderation |
| `TASK_SERVICE_URL` | — | Task service for create-task-from-message |

---

## 30. Known Constraints & Future Considerations

| Area | Current State | Consideration |
|------|---------------|---------------|
| File size | 10MB limit | Increase for enterprise; chunked upload |
| Search | MongoDB text index | Elasticsearch for better relevance + highlighting |
| Message history | Full load per conversation | Virtual scroll / infinite pagination |
| Voice messages | WebM only | Transcription + multi-format support |
| AI summaries | Last 50 messages | Sliding window or full-conversation summarization |
| DLP | Regex-based | ML-based sensitive data detection |
| Webhooks | 3 retries | Dead letter queue + retry dashboard |
| E2E encryption | Not implemented | Per-conversation encryption for enterprise |
| Message reactions | Unlimited emojis | Reaction limit per message |
| Offline support | Delta sync available | Service worker + IndexedDB for full offline |

---

*Generated by Krillin — Nexora Documentation Agent*
*Last verified against codebase: 2026-04-06*
