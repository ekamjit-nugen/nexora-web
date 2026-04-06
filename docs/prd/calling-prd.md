# PRD: Calling & Meetings

**Module:** Calling Service
**Version:** 1.0
**Date:** 2026-04-06
**Status:** Implemented
**Service:** `services/calling-service` (Port 3051)
**Owner:** Nexora Platform Team

---

## 1. Purpose

The Calling & Meetings module provides real-time audio/video communication including 1-to-1 calls, group calls, scheduled meetings, screen sharing, recording, live captions, breakout rooms, and voice huddles. It uses a hybrid architecture — WebRTC P2P for small calls, mediasoup SFU for scalable group sessions — with WebSocket signaling across three dedicated namespaces.

---

## 2. Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Low-latency calls | < 200ms RTT for connected peers |
| Reliable connections | Auto ICE restart with 3-attempt recovery |
| Scalable meetings | Up to 100 participants via SFU |
| Meeting productivity | AI-generated notes and action items |
| Enterprise readiness | Recording, transcripts, lobby, breakout rooms |

---

## 3. Architecture Overview

### 3.1 Service Configuration

| Property | Value |
|----------|-------|
| Port | 3051 (env: `CALLING_SERVICE_PORT`) |
| API Prefix | `/api/v1` |
| WebSocket Namespaces | `/calls`, `/meetings`, `/sfu` |
| Database | MongoDB |
| Media Server | mediasoup (SFU) |
| Cache/Pub-Sub | Redis (Socket.IO adapter, distributed state) |
| AI/LLM | Deepseek via `LLM_BASE_URL` |

### 3.2 Hybrid P2P/SFU Architecture

| Scenario | Mode | Technology |
|----------|------|------------|
| 1-to-1 calls | P2P | WebRTC direct peer connection |
| Group calls (2-6) | P2P mesh | WebRTC mesh topology |
| Group calls (6+) | SFU | mediasoup selective forwarding |
| Meetings | SFU | mediasoup with lobby, breakout rooms |
| Voice huddles | SFU | Persistent mediasoup rooms |

**Graceful fallback:** If mediasoup is unavailable, group calls fall back to P2P mesh (capped at 6 participants).

### 3.3 WebSocket Namespaces

| Namespace | Purpose |
|-----------|---------|
| `/calls` | 1-to-1 and legacy call signaling |
| `/meetings` | Meeting lifecycle, chat, reactions, breakout |
| `/sfu` | mediasoup transport/producer/consumer signaling |

---

## 4. Call Types & Modes

### 4.1 Call Types

| Type | Description |
|------|-------------|
| `audio` | Voice-only call |
| `video` | Video call (audio + camera) |

### 4.2 Call Modes

| Mode | Description |
|------|-------------|
| `p2p` | Direct peer-to-peer connection |
| `group` | Multi-participant (P2P mesh or SFU) |

### 4.3 Call Lifecycle States

```
initiated → ringing (45s timeout) → connected → ended
                                  → missed (timeout)
                                  → rejected (user declined)
```

### 4.4 End Reasons

| Reason | Description |
|--------|-------------|
| `user_ended` | Normal call termination |
| `no_answer` | Ringing timeout (45 seconds) |
| `declined` | Recipient rejected |
| `network_error` | Connection failure |

---

## 5. Call Schema

### 5.1 Core Fields

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `callId` | string | Unique identifier |
| `initiatorId` | string | Caller user ID |
| `participantIds` | string[] | All participant IDs |
| `type` | enum | audio, video |
| `mode` | enum | p2p, group |
| `status` | enum | initiated, ringing, connected, ended, missed, rejected |
| `startTime` | Date | Call start |
| `endTime` | Date | Call end |
| `connectedAt` | Date | When connection established |
| `duration` | number | Seconds (endTime - connectedAt) |
| `endedBy` | string | User who ended |
| `endReason` | enum | user_ended, no_answer, declined, network_error |
| `conversationId` | string | Linked chat conversation |
| `rejectionReason` | string | Decline reason text |
| `notes` | string | Post-call notes |

### 5.2 Participants

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Participant ID |
| `joinedAt` | Date | Join time |
| `leftAt` | Date | Leave time |
| `audioEnabled` | boolean | Mic state |
| `videoEnabled` | boolean | Camera state |

### 5.3 Recording

| Field | Type | Notes |
|-------|------|-------|
| `enabled` | boolean | Recording active |
| `startedBy` | string | Who started recording |
| `startedAt` | Date | Recording start |
| `endedAt` | Date | Recording end |
| `fileId` | string | Media service file reference |
| `duration` | number | Recording length (seconds) |

### 5.4 Quality Metrics

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Per-participant metrics |
| `avgBitrate` | number | Average bitrate (kbps) |
| `avgPacketLoss` | number | Average packet loss (%) |
| `avgLatency` | number | Average RTT (ms) |
| `avgJitter` | number | Average jitter (ms) |

### 5.5 Call Transfer History

| Field | Type | Notes |
|-------|------|-------|
| `fromUserId` | string | Transferring user |
| `toUserId` | string | Transfer target |
| `type` | enum | cold, warm |
| `timestamp` | Date | When transfer occurred |

### 5.6 Call Metadata

| Field | Type | Notes |
|-------|------|-------|
| `callQuality` | enum | good, acceptable, poor |
| `bitrate` | number | Last reported bitrate |
| `frameRate` | number | Last reported FPS |
| `packetLoss` | number | Last reported loss % |
| `voicemail` | object | {url, duration} if missed |

---

## 6. Meeting Schema

### 6.1 Core Fields

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `meetingId` | string | UUID, unique |
| `title` | string | Meeting title |
| `description` | string | Optional description |
| `type` | enum | instant, scheduled, recurring, webinar |
| `scheduledAt` | Date | Scheduled start time |
| `durationMinutes` | number | Expected duration (default: 60) |
| `timeZone` | string | Meeting timezone |
| `hostId` | string | Host user ID |
| `hostName` | string | Host display name |
| `coHostIds` | string[] | Co-host user IDs |
| `participantIds` | string[] | Invited user IDs |
| `status` | enum | scheduled, lobby_open, active, ended, cancelled |
| `chatConversationId` | string | Linked chat conversation |
| `joinPassword` | string | Optional meeting password |
| `sprintId` | string | Linked sprint (project management) |
| `startedAt` | Date | Actual start time |
| `endedAt` | Date | Actual end time |

### 6.2 Meeting Participants

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | User ID (null for anonymous) |
| `displayName` | string | Display name |
| `email` | string | Optional email |
| `isAnonymous` | boolean | Anonymous participant |
| `isGuest` | boolean | Guest (non-org) participant |
| `role` | enum | host, co-host, presenter, attendee |
| `joinedAt` | Date | Join time |
| `leftAt` | Date | Leave time |
| `audioEnabled` | boolean | Mic state |
| `videoEnabled` | boolean | Camera state |
| `handRaised` | boolean | Hand raise status |
| `handRaisedAt` | Date | When hand was raised |

### 6.3 Meeting Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `lobby.enabled` | boolean | false | Enable waiting room |
| `lobby.autoAdmit` | enum | — | org_members, no_one, everyone |
| `lobby.message` | string | — | Custom lobby message |
| `recording.autoStart` | boolean | false | Auto-start recording |
| `recording.allowParticipantStart` | boolean | false | Non-hosts can record |
| `allowAnonymous` | boolean | true | Allow anonymous join |
| `maxParticipants` | number | 100 | Participant cap |
| `muteOnEntry` | boolean | false | Auto-mute on join |
| `videoOffOnEntry` | boolean | false | Auto-disable camera |
| `allowScreenShare` | boolean | true | Screen sharing allowed |
| `allowChat` | boolean | true | In-meeting chat |
| `allowReactions` | boolean | true | Emoji reactions |

### 6.4 Lobby Queue

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Waiting user (null for anonymous) |
| `name` | string | Display name |
| `email` | string | Optional email |
| `requestedAt` | Date | When they requested entry |

### 6.5 Recordings

| Field | Type | Notes |
|-------|------|-------|
| `fileId` | string | Media service reference |
| `type` | string | Recording type |
| `startedBy` | string | Who started |
| `startedAt` | Date | Start time |
| `endedAt` | Date | End time |
| `duration` | number | Length in seconds |

### 6.6 Transcript

| Field | Type | Notes |
|-------|------|-------|
| `speakerId` | string | Speaker user ID |
| `speakerName` | string | Speaker name |
| `text` | string | Transcript text |
| `timestamp` | Date | When spoken |

### 6.7 Recurrence Pattern

| Field | Type | Notes |
|-------|------|-------|
| `frequency` | enum | daily, weekly, monthly, yearly |
| `interval` | number | Every N units |
| `daysOfWeek` | string[] | For weekly recurrence |
| `dayOfMonth` | number | For monthly recurrence |
| `endType` | enum | never, date, after |
| `endDate` | Date | End by date |
| `endAfterOccurrences` | number | End after N meetings |
| `exceptions` | Date[] | Cancelled occurrences |
| `timeZone` | string | Recurrence timezone |

### 6.8 Breakout Rooms

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Room identifier |
| `name` | string | Room name |
| `participants` | string[] | Assigned user IDs |
| `status` | enum | pending, active, closed |

---

## 7. WebRTC Signaling — P2P Calls

### 7.1 Call Signaling Events (namespace: `/calls`)

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `call:initiate` | recipientId, type, conversationId? | Start new call |
| `call:answer` | callId?, audioEnabled?, videoEnabled? | Answer incoming call |
| `call:reject` | callId?, reason? | Decline call |
| `call:end` | callId | End active call |
| `call:rejoin` | callId | Reconnect after disconnect |
| `call:invite` | callId, userId | Add participant to call |
| `call:offer` | callId, sdp, type | SDP offer |
| `call:answer-sdp` | callId, sdp, type | SDP answer |
| `call:ice-candidate` | callId, candidate, sdpMLineIndex?, sdpMid? | ICE candidate |
| `call:annotation-stroke` | callId, stroke | Drawing annotation |
| `call:annotation-clear` | callId | Clear annotations |
| `call:quality-report` | callId, bitrate, frameRate, packetLoss | Quality metrics |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | — | Socket connected |
| `call:incoming` | call object | Incoming call notification |
| `call:initiated` | callId | Call created successfully |
| `call:connected` | callId, startTime | Call established |
| `call:rejected` | callId, reason | Call declined |
| `call:ended` | callId, duration | Call terminated |
| `call:dismissed` | callId | Answered/rejected on another device |
| `call:already-answered` | callId | Another tab answered |
| `call:missed` | callId | Ringing timeout |
| `call:participant-left` | callId, userId | Participant disconnected |
| `call:participant-invited` | callId, userId | New participant invited |
| `call:participant-rejoined` | callId, userId | Participant reconnected |
| `call:offer` | callId, sdp | Incoming SDP offer |
| `call:answer-sdp` | callId, sdp | Incoming SDP answer |
| `call:ice-candidate` | callId, candidate | Incoming ICE candidate |
| `call:annotation-stroke` | stroke | Remote drawing stroke |
| `call:annotation-clear` | — | Remote clear command |

### 7.2 Connection Lifecycle

1. **Initiate:** Caller emits `call:initiate` → server creates call record → recipient gets `call:incoming`
2. **Ringing:** 45-second timeout → auto `call:missed` if unanswered
3. **Answer:** Recipient emits `call:answer` → server transitions to `connected`
4. **SDP Exchange:** `call:offer` → `call:answer-sdp` (trickle ICE via `call:ice-candidate`)
5. **Connected:** Both peers have bidirectional media
6. **End:** Either party emits `call:end` → server records duration
7. **Disconnect grace:** 30-second window for reconnection before marking user left

### 7.3 Multi-Tab Support

- Server tracks `socketUsers` (socketId → userId) and `onlineUsers` (userId → Set<socketId>)
- Incoming call sent to all tabs; `call:dismissed` sent to other tabs when one answers/rejects
- `call:already-answered` prevents duplicate answers

---

## 8. WebRTC Signaling — SFU

### 8.1 SFU Events (namespace: `/sfu`)

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `sfu:join` | roomId, userId, rtpCapabilities? | Join SFU room |
| `sfu:connect-transport` | transportId, dtlsParameters | DTLS handshake |
| `sfu:produce` | kind, rtpParameters, appData? | Start producing media |
| `sfu:consume` | producerId, rtpCapabilities | Consume remote producer |
| `sfu:resume-consumer` | consumerId | Resume paused consumer |
| `sfu:set-preferred-layers` | consumerId, spatialLayer, temporalLayer | Simulcast layer selection |
| `sfu:leave` | — | Disconnect from room |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `sfu:joined` | routerRtpCapabilities, existingProducers, sendTransport, recvTransport | Room joined successfully |
| `sfu:transport-connected` | transportId | Transport DTLS complete |
| `sfu:produced` | producerId | Producer created |
| `sfu:consumed` | consumerId, kind, rtpParameters | Consumer created |
| `sfu:consumer-resumed` | consumerId | Consumer resumed |
| `sfu:preferred-layers-set` | consumerId | Layers updated |
| `sfu:new-producer` | producerId, userId, kind | New remote producer |
| `sfu:peer-joined` | userId | New participant |
| `sfu:peer-left` | userId | Participant left |

### 8.2 SFU Connection Flow

1. Client connects to `/sfu` namespace with JWT
2. Emits `sfu:join` with roomId and RTP capabilities
3. Server creates/reuses `SfuRoom` with mediasoup Router
4. Server creates send + receive WebRTC transports for participant
5. Returns `routerRtpCapabilities`, transport params, existing producers
6. Client loads `mediasoup-client` Device, creates local transports
7. Client connects transports via `sfu:connect-transport` (DTLS)
8. Client produces local tracks via `sfu:produce`
9. Client consumes remote producers via `sfu:consume` (created paused)
10. Client resumes consumers via `sfu:resume-consumer`

### 8.3 mediasoup Configuration

| Setting | Value |
|---------|-------|
| Workers | N (env: `MEDIASOUP_WORKERS`, default: 1) |
| RTC Port Range | 10000-10100 (configurable) |
| Audio Codec | Opus (48kHz, stereo) |
| Video Codecs | VP8, H.264 (profile 42e01f) |
| Initial Outgoing Bitrate | 1,000,000 bps |
| Min Outgoing Bitrate | 600,000 bps |
| Max Incoming Bitrate | 1,500,000 bps |
| Transport Protocols | UDP (preferred) + TCP fallback |

### 8.4 Simulcast Encodings (Client)

| Layer | Bitrate | Resolution |
|-------|---------|------------|
| Low | 100 kbps | 1/4 resolution |
| Medium | 300 kbps | 1/2 resolution |
| High | 900 kbps | Full resolution |

Server-side layer selection via `sfu:set-preferred-layers` for adaptive quality.

---

## 9. Meeting Signaling

### 9.1 Meeting Events (namespace: `/meetings`)

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `meeting:join` | meetingId, displayName? | Join meeting |
| `meeting:leave` | meetingId | Leave meeting |
| `meeting:offer` | meetingId, targetUserId, sdp | SDP offer to peer |
| `meeting:answer` | meetingId, targetUserId, sdp | SDP answer |
| `meeting:ice-candidate` | meetingId, targetUserId, candidate | ICE candidate |
| `meeting:media-state` | meetingId, audioEnabled, videoEnabled | Media toggle |
| `meeting:screen-share-start` | meetingId | Start screen share |
| `meeting:screen-share-stop` | meetingId | Stop screen share |
| `meeting:chat` | meetingId, text | Send chat message (max 5000 chars) |
| `meeting:transcript` | meetingId, text, speakerName | Add transcript entry |
| `meeting:hand-raise` | meetingId | Raise hand |
| `meeting:hand-lower` | meetingId | Lower hand |
| `meeting:hand-lower-all` | meetingId | Lower all hands (host) |
| `meeting:reaction` | meetingId, emoji | Send emoji reaction |
| `meeting:mute-participant` | meetingId, targetUserId | Host mutes participant |
| `meeting:lobby-admit` | meetingId, userId | Admit from lobby |
| `meeting:lobby-admit-all` | meetingId | Admit all from lobby |
| `meeting:lobby-deny` | meetingId, userId | Deny lobby entry |
| `meeting:breakout-open` | meetingId, rooms | Open breakout rooms |
| `meeting:breakout-close` | meetingId | Close all breakout rooms |
| `meeting:breakout-move` | meetingId, userId, roomId | Move participant |
| `meeting:breakout-broadcast` | meetingId, message | Broadcast to all rooms |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `meeting:connected` | meetingId | Socket connected to meeting |
| `meeting:joined` | meetingId, participants | Successfully joined |
| `meeting:participant-joined` | userId, displayName | New participant |
| `meeting:participant-left` | userId | Participant left |
| `meeting:chat` | socketId, userId, displayName, text, timestamp | Chat message |
| `meeting:transcript-entry` | entry | Transcript entry |
| `meeting:reaction:broadcast` | userId, displayName, emoji | Emoji reaction (5s ephemeral) |
| `meeting:muted-by-host` | meetingId | Host muted you |
| `meeting:lobby-admitted` | meetingId | You were admitted from lobby |
| `meeting:lobby-denied` | meetingId | You were denied entry |
| `meeting:lobby-updated` | lobbyQueue | Lobby queue changed |
| `meeting:breakout-opened` | rooms | Breakout rooms created |
| `meeting:breakout-closed` | — | Breakout rooms closed |
| `meeting:breakout-assigned` | roomId, roomName | You were assigned to room |

---

## 10. Call Features

### 10.1 Call Transfer

**Cold Transfer:** Transferring user disconnects, target joins.
1. B transfers to C → server marks B as left, rings C
2. Transfer entry recorded: `{fromUserId: B, toUserId: C, type: 'cold'}`

**Warm Transfer:** 3-way consult before connecting.
1. B initiates warm transfer → creates consult call with C
2. B consults with C while A is on hold
3. B completes transfer → A connects to C, B disconnects
4. B can cancel → reverts to original A↔B call

### 10.2 Screen Sharing

| Feature | Details |
|---------|---------|
| Capture | `getDisplayMedia` (1920x1080, up to 30fps) |
| System audio | Supported where available |
| Annotations | Drawing overlay with normalized coordinates (0-1) |
| Colors | Red, orange, yellow, green, blue, purple, white |
| Brush sizes | 2, 4, 6, 8 pixels |
| Remote sync | Real-time broadcast via `call:annotation-stroke` |

### 10.3 Call Recording

| Feature | Details |
|---------|---------|
| Trigger | Manual start/stop via controls |
| Backend | SFU PlainTransport → ffmpeg → MP4 (H.264 + AAC) |
| Storage | Media service (S3/MinIO) |
| UI indicator | Pulsing red dot when recording |

### 10.4 Call Quality Monitoring

Polled every 2 seconds from `RTCStatsReport`:

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| RTT | ≤ 200ms | 200-500ms | > 500ms |
| Jitter | ≤ 50ms | 50-100ms | > 100ms |
| Packet Loss | ≤ 3% | 3-10% | > 10% |

Visual indicator: 3-bar signal (green/yellow/red).

### 10.5 Voicemail

For missed calls:
1. Call goes unanswered (45s timeout)
2. Caller can record voicemail via browser `MediaRecorder`
3. Audio uploaded to media-service
4. Stored in call metadata: `{voicemail: {url, duration}}`
5. Recipient can listen and delete

### 10.6 Voice Huddles

Discord-like always-on voice channels:

| Feature | Details |
|---------|---------|
| Persistence | Always-on per channel (SFU room: `huddle:{channelId}`) |
| Join/leave | Instant (no ringing) |
| State | In-memory Map (Redis for multi-instance) |
| Use case | Drop-in team voice rooms |

---

## 11. Meeting Features

### 11.1 Lobby / Waiting Room

| Feature | Details |
|---------|---------|
| Enable | Per-meeting setting `lobby.enabled` |
| Auto-admit rules | `org_members`, `no_one`, `everyone` |
| Queue | Visible to host/co-host |
| Actions | Admit individual, admit all, deny |
| Custom message | Optional lobby message |

### 11.2 Breakout Rooms

| Feature | Details |
|---------|---------|
| Room count | 2-50 rooms |
| Assignment | Manual or auto-distribute evenly |
| Status | pending → active → closed |
| Host controls | Open/close all, move participants, broadcast to all rooms |
| Participants | See assigned room, can be moved by host |

### 11.3 Hand Raise & Reactions

**Hand Raise:**
- Toggle raise/lower per participant
- `handRaisedAt` for FIFO ordering
- Host can lower all hands

**Reactions:**
- Quick emojis: `clap` `thumbs_up` `heart` `laughing` `surprised` `thinking` `fast_forward` `rewind`
- Ephemeral: displayed 5 seconds, then auto-dismissed
- Animated floating overlay

### 11.4 Live Captions

| Feature | Details |
|---------|---------|
| Source | Web Speech API (browser-side STT) |
| Broadcast | `meeting:transcript` event to all participants |
| Storage | Appended to `transcript[]` on meeting |
| Post-meeting | Whisper API integration for recording transcription (stub) |

### 11.5 AI Meeting Notes

| Feature | Details |
|---------|---------|
| Engine | LLM (Deepseek) via `LLM_BASE_URL` |
| Output | Markdown: Attendees, Decisions, Action Items, Follow-ups |
| Trigger | Post-meeting generation |

### 11.6 Meeting Chat

| Feature | Details |
|---------|---------|
| Delivery | WebSocket `meeting:chat` event |
| Max length | 5,000 characters |
| Persistence | Auto-creates linked chat conversation via Redis pub/sub |
| Integration | `meeting:created` → chat-service creates `meeting_chat` conversation |

### 11.7 Recording

| Feature | Details |
|---------|---------|
| Permissions | Host, co-host, or if `allowParticipantStart` enabled |
| Multiple segments | Stored as `recordings[]` array |
| Pipeline | SFU PlainTransport → RTP → ffmpeg → MP4 → media-service |
| UI | Toggle button with red pulsing indicator |

### 11.8 Calendar Integration

| Feature | Details |
|---------|---------|
| ICS export | `GET /meetings/:id/ics` (RFC 5545) |
| Calendar view | Month view with meeting dots |
| Sprint linking | Meetings can be linked to sprints |

### 11.9 Recurring Meetings

| Feature | Details |
|---------|---------|
| Frequencies | daily, weekly, monthly, yearly |
| Interval | Every N units |
| End types | never, by date, after N occurrences |
| Exceptions | Cancel individual occurrences |
| Timezone | Per-recurrence timezone |

---

## 12. Meeting Permissions

### 12.1 Role Hierarchy

| Role | Level |
|------|-------|
| Host | Highest — full control |
| Co-host | Limited host powers |
| Presenter | Can share screen |
| Attendee | Standard participant |

### 12.2 Permission Matrix

| Action | Host | Co-host | Presenter | Attendee |
|--------|------|---------|-----------|----------|
| End meeting | Yes | No | No | No |
| Update settings | Yes | No | No | No |
| Manage breakout | Yes | Yes | No | No |
| Admit from lobby | Yes | Yes | No | No |
| Mute participant | Yes | Yes | No | No |
| Start recording | Yes | Yes | Configurable | Configurable |
| Remove participant | Yes | Yes | No | No |
| Screen share | Yes | Yes | Yes | Configurable |
| Send chat | Yes | Yes | Yes | Yes |
| Raise hand | Yes | Yes | Yes | Yes |
| Send reaction | Yes | Yes | Yes | Yes |

---

## 13. STUN/TURN Configuration

### 13.1 ICE Servers

| Server | Default |
|--------|---------|
| STUN | `stun:stun.l.google.com:19302` |
| TURN | Configurable via env vars |

### 13.2 Dynamic TURN Credentials

When `TURN_SECRET` is configured:
- HMAC-SHA1 generated credentials
- 12-hour validity (43,200 seconds)
- Username: `{timestamp}:{userId}`
- Credential: HMAC-SHA1 of username with secret

---

## 14. Reconnection Strategy

### 14.1 WebRTC ICE Restart

| Parameter | Value |
|-----------|-------|
| Max attempts | 3 |
| Backoff | Exponential: 2s, 4s, 8s (capped at 10s) |
| Triggers | connectionState=failed, iceConnectionState=failed, disconnected (after 2s wait) |
| Reset | Counter resets on successful connection |

### 14.2 Socket Reconnection

| Parameter | Value |
|-----------|-------|
| Delay | 3,000ms |
| Max attempts | 10 |
| Backoff | Exponential |

### 14.3 Call Rejoin

- 30-second grace period after socket disconnect
- `call:rejoin` event re-establishes call state
- If no rejoin within grace period: participant marked as left

---

## 15. Frontend Architecture

### 15.1 Hooks

| Hook | Purpose |
|------|---------|
| `useCallContext()` | Call state, socket events, actions |
| `useWebRTC()` | Peer connection, media streams, ICE |
| `useCallQuality()` | RTCStats polling, quality level |
| `useGroupCall()` | Group call coordinator (P2P or SFU) |
| `useSfuClient()` | mediasoup client, producers, consumers |
| `useVirtualBackground()` | Background blur/image (stub) |

### 15.2 Call Components

| Component | Purpose |
|-----------|---------|
| `CallButtons` | Audio/video call initiate buttons |
| `IncomingCallModal` | Full-screen incoming call notification with accept/reject |
| `GlobalIncomingCall` | Global listener rendered in root layout |
| `CallControls` | Control bar: mic, camera, screen share, record, fullscreen, end |
| `VideoCallWindow` | Video rendering with PIP, grid, screen share modes |
| `GroupCallInitiator` | Participant selection modal for group calls |

### 15.3 Meeting Components

| Component | Purpose |
|-----------|---------|
| `MeetingLobby` | Waiting room (host queue management + attendee wait screen) |
| `ParticipantGrid` | Dynamic video grid (1-16+ tiles) with speaker/pin indicators |
| `MeetingReactions` | Hand raise + 8 emoji reactions |
| `MeetingChatPanel` | In-meeting chat sidebar |
| `BreakoutRooms` | Host breakout room management + participant view |
| `MeetingCalendar` | Month view calendar with meeting dots |

### 15.4 Video Display Modes

| Mode | Trigger | Layout |
|------|---------|--------|
| **Screen Share** | Active screen share | Large share + thumbnail strip |
| **PIP** | 1 remote + local | Remote full-screen + local corner |
| **Grid** | 3+ participants | Responsive grid (up to 4x3) |

Grid sizing:

| Participants | Columns | Rows |
|-------------|---------|------|
| 2 | 2 | 1 |
| 3-4 | 2 | 2 |
| 5-6 | 3 | 2 |
| 7-9 | 3 | 3 |
| 10+ | 4 | 3 |

### 15.5 Annotation Canvas

- Overlay on screen share stream
- Mouse-based drawing with color/size controls
- Normalized coordinates (0-1) for cross-resolution broadcast
- Real-time sync via `call:annotation-stroke` / `call:annotation-clear`
- Crosshair cursor when drawing active

### 15.6 Ringtone System

Web Audio API synthesized tones:

| Type | Pattern | Notes |
|------|---------|-------|
| Incoming | 3-tone chime (C5, E5, G5) | 2s ring, 0.5s silence |
| Outgoing | Dual-tone (440Hz + 480Hz) | 4s ring, 3.5s silence |

### 15.7 Data Channel

- Name: `"control"`, ordered: true
- Peer-to-peer control messages (no server round-trip)
- Example: `{type: "media-state", hasVideo: true, isScreenShare: true}`

---

## 16. Calls Page (History & Stats)

### 16.1 Features

- **Call history:** Paginated list with type/status filters
- **Missed calls:** Dedicated view
- **Stats dashboard:** Today's total, completed, missed, average duration
- **Call details modal:** Participants, duration, timestamps, status badge, notes editor

### 16.2 Status Colors

| Status | Color |
|--------|-------|
| Initiated | Blue |
| Ringing | Amber |
| Answered | Emerald |
| Missed | Red |
| Declined | Gray |
| Ended | Slate |
| Failed | Red |

---

## 17. API Reference

### 17.1 Call Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/calls` | Yes | Health check |
| POST | `/calls` | Yes | Initiate call |
| POST | `/calls/:id/answer` | Yes | Answer call |
| POST | `/calls/:id/reject` | Yes | Reject call |
| POST | `/calls/:id/end` | Yes | End call |
| GET | `/calls/history` | Yes | Call history (paginated, filterable) |
| GET | `/calls/missed` | Yes | Missed calls (default limit: 10) |
| GET | `/calls/recent` | Yes | Recent calls (last 20) |
| GET | `/calls/stats` | Yes | Today's call statistics |
| GET | `/calls/ice-servers` | Yes | STUN/TURN configuration |
| GET | `/calls/:id` | Yes | Call details |
| PUT | `/calls/:id/notes` | Yes | Update call notes |

### 17.2 Meeting Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meetings` | Yes | Schedule meeting |
| GET | `/meetings` | Yes | List meetings (paginated, filterable) |
| GET | `/meetings/sprint/:sprintId` | Yes | Sprint meetings |
| GET | `/meetings/:id/public` | No | Public meeting info (minimal) |
| GET | `/meetings/:id` | Yes | Full meeting details |
| PUT | `/meetings/:id` | Yes | Update meeting (host only) |
| POST | `/meetings/:id/start` | Yes | Start meeting |
| POST | `/meetings/:id/end` | Yes | End meeting (host only) |
| DELETE | `/meetings/:id` | Yes | Cancel meeting |
| GET | `/meetings/:id/transcript` | Yes | Get transcript |
| POST | `/meetings/:id/recording` | Yes | Toggle recording |
| GET | `/meetings/:id/ics` | No | ICS calendar export |

---

## 18. Cross-Service Integration

| Service | Integration | Mechanism |
|---------|-------------|-----------|
| Chat Service | Meeting chat creation | Redis pub/sub (`meeting:created` → `meeting:chat-created`) |
| Media Service | Recording storage | HTTP upload (S3/MinIO) |
| Auth Service | JWT validation | Shared `JWT_SECRET` |
| HR Service | Employee directory | API lookup for participant names |

---

## 19. Environment Configuration

### 19.1 Required

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing key |
| `MONGODB_URI` | MongoDB connection |

### 19.2 Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `CALLING_SERVICE_PORT` | `3051` | Service port |
| `CORS_ORIGINS` | `localhost:3000,3100,3005` | Allowed origins |
| `STUN_SERVERS` | `stun:stun.l.google.com:19302` | STUN servers |
| `TURN_SERVER_URL` | — | TURN server URL |
| `TURN_SECRET` | — | TURN HMAC secret |
| `MEDIASOUP_WORKERS` | `1` | Worker count |
| `MEDIASOUP_RTC_MIN_PORT` | `10000` | RTC port range start |
| `MEDIASOUP_RTC_MAX_PORT` | `10100` | RTC port range end |
| `MEDIASOUP_LISTEN_IP` | `0.0.0.0` | Listen IP |
| `MEDIASOUP_ANNOUNCED_IP` | — | Public IP (NAT traversal) |
| `REDIS_URI` | — | Redis for adapter + state |
| `LLM_BASE_URL` | — | AI endpoint for meeting notes |
| `LLM_MODEL` | `deepseek` | LLM model name |

---

## 20. Security

| Layer | Mechanism |
|-------|-----------|
| Authentication | JWT validation on all endpoints + socket handshakes |
| Authorization | Role-based guards (member, manager, admin, owner) |
| Meeting permissions | Host > co-host > presenter > attendee hierarchy |
| TURN credentials | Time-limited HMAC-SHA1 (12-hour validity) |
| Rate limiting | 10 calls/minute per user |
| Chat limits | 5,000 char max for meeting chat |
| Lobby | Optional waiting room with admission rules |
| Meeting password | Optional join password |

---

## 21. Known Constraints & Future Considerations

| Area | Current State | Consideration |
|------|---------------|---------------|
| Virtual background | Canvas stub | TensorFlow.js BodyPix or MediaPipe Selfie Segmentation |
| Meeting size | 100 participant cap | Cascade SFU workers for larger meetings |
| Recording pipeline | ffmpeg + media service | Dedicated recording service with cloud transcoding |
| Captions | Web Speech API (browser) | Server-side STT for reliability across browsers |
| Voicemail | Browser MediaRecorder | Server-side recording for reliability |
| Voice huddles | In-memory state | Redis persistence for multi-instance |
| E2E encryption | Not implemented | SRTP with key exchange for enterprise |
| Bandwidth adaptation | Simulcast 3 layers | Dynamic layer switching based on network conditions |
| Screen share audio | Browser-dependent | Ensure cross-browser system audio capture |
| Breakout rooms | Basic implementation | Timer, auto-return, help request features |

---

*Generated by Krillin — Nexora Documentation Agent*
*Last verified against codebase: 2026-04-06*
