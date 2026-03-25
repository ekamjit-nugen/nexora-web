# Nexora Calling & Video Calling Feature — Implementation Plan

**Status**: Planning Phase  
**Last Updated**: March 23, 2026  
**Version**: 1.0

## Executive Summary

This document outlines the architecture, implementation strategy, and phased approach for adding **voice calling** and **video calling** capabilities to Nexora, similar to Microsoft Teams functionality.

---

## 1. Architecture Overview

### 1.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                     │
│  Chat UI + Calling UI Component (Voice/Video Buttons)       │
└─────────────────────────────────────┬───────────────────────┘
                                      │ Socket.IO + WebRTC
                                      ▼
┌─────────────────────────────────────────────────────────────┐
│               CHAT SERVICE (WebSocket Gateway)              │
│  - Signaling & Call Negotiation                             │
│  - Call State Management                                     │
│  - Media Negotiation (SDP/ICE)                              │
└─────────────────────────────────────┬───────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────┐
│           CALLING SERVICE (New NestJS Service)              │
│  - Call History & Records                                   │
│  - Call Metrics & Analytics                                 │
│  - Call Workflows (initiate, accept, reject, end)          │
│  - Integration with presence/online status                 │
└─────────────────────────────────────┬───────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────┐
│  MONGODB (nexora_calling collection)                         │
│  - Calls history, participants, duration, status           │
│  - Call recordings metadata (future)                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| **Signaling** | Socket.IO (existing) | Call invitation, answer, reject, media negotiation |
| **Peer Connection** | WebRTC (PeerConnection API) | Direct audio/video between peers |
| **NAT Traversal** | STUN/TURN servers | (Public STUN initially, TURN for complex networks) |
| **Video/Audio** | getUserMedia (Web Audio API) | Capture device streams |
| **Call State** | NestJS Service + MongoDB | Persist call records |
| **Frontend UI** | React + Tailwind CSS (shadcn/ui) | Call UI components |

---

## 2. Phase 1: Foundation (Week 1)

### Goals
- Establish calling service backend
- Implement signaling protocol over Socket.IO
- Build core data models
- Enable 1-on-1 audio calling

### Tasks

#### 2.1 Backend: Create Calling Service
**Location**: `services/calling-service/` (new)

```bash
# Structure
services/calling-service/
├── src/
│   ├── main.ts                          # Service entry point
│   ├── calling.module.ts                # Module setup
│   ├── calling/
│   │   ├── calling.controller.ts        # REST endpoints
│   │   ├── calling.service.ts           # Business logic
│   │   ├── calling.gateway.ts           # WebSocket signaling
│   │   ├── dto/
│   │   │   ├── initiate-call.dto.ts     # Start call request
│   │   │   ├── answer-call.dto.ts       # Accept call
│   │   │   ├── ice-candidate.dto.ts     # STUN/TURN candidates
│   │   │   └── end-call.dto.ts          # Terminate call
│   │   ├── schemas/
│   │   │   ├── call.schema.ts           # Call history
│   │   │   ├── call-session.schema.ts   # Active session tracking
│   │   │   └── call-participant.schema.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts
│   └── app.module.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

#### 2.2 Database Models

**Call Schema** (nexora_calling.calls)
```json
{
  "_id": "ObjectId",
  "organizationId": "string",
  "callId": "string (nxr-call-XXXX)",
  "initiatorId": "ObjectId (User)",
  "participantIds": ["ObjectId"],
  "type": "audio | video",
  "status": "initiated | ringing | connected | ended | missed | rejected",
  "startTime": "Date",
  "endTime": "Date?",
  "duration": "number (seconds)",
  "participants": [
    {
      "userId": "ObjectId",
      "joinedAt": "Date",
      "leftAt": "Date?",
      "audioEnabled": "boolean",
      "videoEnabled": "boolean"
    }
  ],
  "metadata": {
    "callQuality": "good | acceptable | poor",
    "bitrate": "number",
    "frameRate": "number",
    "packetLoss": "number"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**Call Session Schema** (in-memory / Redis for real-time tracking)
```json
{
  "sessionId": "string",
  "callId": "string",
  "participantSockets": {
    "userId": "socketId"
  },
  "sdpOffers": {
    "userId": "RTCSessionDescription"
  },
  "iceCandidates": {
    "userId": ["RTCIceCandidate"]
  }
}
```

#### 2.3 WebSocket Events (Signaling)

**Chat Service Enhancement** (existing chat.gateway.ts)
- Add `call:initiate` — Initiator sends call invitation
- Add `call:answer` — Recipient accepts call
- Add `call:reject` — Recipient declines call
- Add `call:offer` — SDP offer for media negotiation
- Add `call:answer-sdp` — SDP answer response
- Add `call:ice-candidate` — ICE candidate for NAT traversal
- Add `call:end` — Terminate call
- Add `call:status-update` — Call state changes

#### 2.4 REST Endpoints (Calling Service)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/calls` | POST | Initiate new call |
| `/api/v1/calls/:id/answer` | POST | Accept call |
| `/api/v1/calls/:id/reject` | POST | Reject call |
| `/api/v1/calls/:id/end` | POST | End call |
| `/api/v1/calls/history` | GET | Get call history |
| `/api/v1/calls/:id` | GET | Get call details |
| `/api/v1/calls/missed` | GET | Get missed calls |
| `/api/v1/health` | GET | Health check |

#### 2.5 Frontend: Calling UI Components

**Location**: `frontend/src/components/calling/`

```bash
components/calling/
├── CallIndicator.tsx              # Shows incoming call UI
├── CallWindow.tsx                 # Active call UI (video/audio)
├── CallControls.tsx               # Mute, end, video toggle buttons
├── CallHistory.tsx                # Recent calls list
├── IncomingCallModal.tsx          # Accept/Reject modal
├── useWebRTC.ts                   # WebRTC logic hook
└── useCallSignaling.ts            # Signaling logic hook
```

#### 2.6 Frontend: Integrate Into Chat

- Add **voice call button** (📞) in direct conversations
- Add **video call button** (📹) in direct conversations
- Show incoming call notification with accept/reject
- Display active call overlay on chat window

#### 2.7 API Gateway: Add Route

**File**: `services/api-gateway/src/main.ts`

```typescript
{ paths: ['/api/v1/calls'], target: SERVICES.calling, name: 'calling-service' }
```

**Docker Compose**: Add calling-service

```yaml
calling-service:
  build:
    context: ./services/calling-service
    dockerfile: Dockerfile
  container_name: nexora-calling-service
  ports:
    - "3051:3051"
  environment:
    CALLING_SERVICE_PORT: 3051
    MONGODB_URI: mongodb://root:nexora_dev_password@mongodb:27017/nexora_calling?authSource=admin
    JWT_SECRET: ${JWT_SECRET}
    CHAT_SERVICE_URL: http://chat-service:3002
  depends_on:
    - mongodb
  networks:
    - nexora-network
```

---

## 3. Phase 2: Video Calling & Active Call Management (Week 2)

### Goals
- Extend audio calling to support video
- Build call UI with video preview
- Implement call recording (metadata tracking)
- Add group calling preparation

### Tasks

- [ ] Add video stream management to WebRTC hook
- [ ] Build `VideoCallWindow.tsx` with peer video display
- [ ] Add camera/microphone permission handling
- [ ] Implement device selection (camera, mic, speaker dropdown)
- [ ] Add call duration timer
- [ ] Implement "Hold" functionality
- [ ] Add call recording toggle (metadata only in Phase 1)
- [ ] Build call history with participant details

---

## 4. Phase 3: Group Calling (Week 3)

### Goals
- Support 3+ participant calls
- Implement call routing
- Build group call UI (gallery/speaker view)

### Tasks

- [ ] Modify signaling to support multiple peers
- [ ] Implement selective forwarding unit (SFU) pattern or full mesh for small groups
- [ ] Add `call:group-join`, `call:group-leave` events
- [ ] Build gallery view (multiple video tiles)
- [ ] Add speaker detection and speaker view
- [ ] Handle group call bandwidth optimization

---

## 5. Phase 4: Advanced Features (Week 4+)

### Goals
- Call recordings
- Call transfer
- Call scheduling
- Analytics dashboard

### Tasks

- [ ] Implement call recording (S3 storage)
- [ ] Add call transfer feature
- [ ] Build call analytics dashboard
- [ ] Implement do-not-disturb / call forwarding
- [ ] Add call scheduling/calendar integration

---

## 6. Database Collections to Create

```javascript
// In mongo-init.js, add:
db.createCollection('calls', {
  validator: {
    $jsonSchema: {
      // schema above
    }
  }
});

db.calls.createIndex({ organizationId: 1, createdAt: -1 });
db.calls.createIndex({ initiatorId: 1, status: 1 });
db.calls.createIndex({ "participants.userId": 1 });
```

---

## 7. Environment Variables

Add to `.env` and `docker-compose.simple.yml`:

```bash
CALLING_SERVICE_PORT=3051
CALLING_SERVICE_URL=http://calling-service:3051
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
TURN_SERVER_URL=   # (optional, for production)
TURN_SERVER_USERNAME=   # (optional)
TURN_SERVER_CREDENTIAL=   # (optional)
```

---

## 8. WebRTC Configuration

**STUN Servers** (Free, public):
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

**TURN Servers** (Future production, for restricted networks):
- coturn (self-hosted)
- TURN.me or Twilio-like service

---

## 9. Security Considerations

1. **JWT Validation** on all Socket.IO events
2. **Encryption** in transit (TLS/SSL)
3. **User Privacy** — participants see only call data they're involved in
4. **Call Recordings** — require explicit consent (future phase)
5. **Rate Limiting** — prevent spam calls via Redis
6. **Audit Logging** — log all call events for compliance

---

## 10. Testing Strategy

- [ ] Unit tests: Calling service business logic
- [ ] Integration tests: WebSocket signaling flow
- [ ] E2E tests: 2-party call flow (initiate → accept → end)
- [ ] Performance tests: Signaling under load
- [ ] Browser compatibility: Chrome, Firefox, Safari (WebRTC support)

---

## 11. Next Steps

1. **Approve this plan** ✅
2. Create `services/calling-service` bootstrap
3. Implement Phase 1 (1-on-1 audio)
4. Test with 2 browser instances
5. Iterate on UI/UX based on feedback
6. Move to Phase 2 (video)

---

## Appendix: WebRTC Signaling Flow Example

```
User A                          Chat Service                      User B
  │                                  │                                │
  ├──── call:initiate ─────────────→ │                                │
  │      (userId: B, type: audio)    │                                │
  │                                  ├──── call:incoming ────────────→│
  │                                  │      (userId: A, type: audio)  │
  │                                  │                                │
  │                                  │  ← call:answer ────────────────┤
  │                                  │    (signal accepted)           │
  │                                  │                                │
  │  ← call:offer ──────────────────── (get SDP offer from B)        │
  │    (RTCSessionDescription)       │                                │
  │                                  │                                │
  │    call:answer-sdp ──────────────→ (send SDP answer to B)       │
  │    (RTCSessionDescription)       │                             ──→│
  │                                  │                                │
  │    call:ice-candidate ───────────→ (send ICE candidates)        │
  │    call:ice-candidate ←─────────── (receive ICE candidates)    ←│
  │                                  │                                │
  │  [WebRTC Peer Connection Established]                            │
  │ ────────────── Audio/Video Stream ────────────────────────────→ │
  │                                  │                                │
  │    call:end ────────────────────→ │                             │
  │                                  ├────── call:ended ────────────→│
```

---

## References

- WebRTC Specification: https://www.w3.org/TR/webrtc/
- Socket.IO Namespaces: https://socket.io/docs/v4/namespaces/
- NestJS WebSocket: https://docs.nestjs.com/websockets/gateways
- STUN/TURN Explained: https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/
