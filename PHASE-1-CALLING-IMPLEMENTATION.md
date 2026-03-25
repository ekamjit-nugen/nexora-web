# Phase 1: Calling Feature Implementation — Complete Backend & Starter Frontend

**Status**: ✅ COMPLETE  
**Date**: March 23, 2026  
**Phase**: Phase 1 - 1-on-1 Audio Calling Infrastructure

---

## 🎯 What's Been Built

### Backend (Calling Service)

✅ **New NestJS Microservice** (`services/calling-service/`)

| Component | Files | Purpose |
|---|---|---|
| **DTOs** | `src/calling/dto/index.ts` | Type validation for API requests |
| **Schemas** | `src/calling/schemas/call.schema.ts` | MongoDB Call model with indexes |
| **Service** | `src/calling/calling.service.ts` | Business logic (initiate, answer, reject, end calls) |
| **Gateway** | `src/calling/calling.gateway.ts` | WebSocket signaling (/calls namespace) |
| **Controller** | `src/calling/calling.controller.ts` | REST endpoints (/api/v1/calls) |
| **Module** | `src/calling/calling.module.ts` | NestJS module setup |
| **Main** | `src/main.ts` | Service bootstrap |

**Service Ports & URLs**:
- REST API: `http://localhost:3051/api/v1/calls`
- WebSocket: `ws://localhost:3051/calls`
- Gateway proxies: `http://localhost:3005/api/v1/calls` (via API Gateway)

### Database

✅ **MongoDB Collection**: `nexora_calling`

```javascript
db.calls.insertOne({
  organizationId: "org-123",
  callId: "nxr-call-1234567890-abc123xyz",
  initiatorId: "user-id-1",
  participantIds: ["user-id-1", "user-id-2"],
  type: "audio", // or "video"
  status: "connected", // initiated | ringing | connected | ended | missed | rejected
  startTime: ISODate("2026-03-23T10:00:00Z"),
  endTime: ISODate("2026-03-23T10:05:00Z"),
  duration: 300, // seconds
  participants: [
    {
      userId: "user-id-1",
      joinedAt: ISODate("2026-03-23T10:00:00Z"),
      leftAt: ISODate("2026-03-23T10:05:00Z"),
      audioEnabled: true,
      videoEnabled: false
    }
  ],
  metadata: { callQuality: "good", bitrate: 512, frameRate: 30 }
  // ... indexes for orgId, initiatorId, participantIds
})
```

### Frontend Components

✅ **Calling UI Layer** (`frontend/src/components/calling/`)

| Component | File | Purpose |
|---|---|---|
| **Hooks** | `lib/hooks/useWebRTC.ts` | WebRTC peer connection management |
| **Hooks** | `lib/hooks/useCallSignaling.ts` | Server signaling, call state management |
| **IncomingCallModal** | `components/calling/IncomingCallModal.tsx` | Incoming call notification popup |
| **CallControls** | `components/calling/CallControls.tsx` | Mute/unmute, video toggle, end call buttons |
| **VideoCallWindow** | `components/calling/VideoCallWindow.tsx` | Video tiles (local + remote, PiP layout) |
| **CallButtons** | `components/calling/CallButtons.tsx` | Audio/Video call buttons for chat |

### API Gateway & Docker

✅ **API Gateway** Updated:
- Added `/api/v1/calls` route → calling-service
- Added `CALLING_SERVICE_URL` env variable

✅ **Docker Compose** Updated:
- Added `calling-service` container (port 3051)
- Configured MongoDB connection
- Added health checks and STUN server config
- Added to API Gateway dependencies

✅ **Root Workspace** Updated:
- Added `services/calling-service` to monorepo workspaces
- Updated service references in package.json

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /Users/ekamjitsingh/Projects/Nexora
npm install
```

### 2. Start the Full Stack

```bash
docker compose -f docker-compose.simple.yml up -d
```

### 3. Verify Services

```bash
# Check calling service health
curl http://localhost:3005/api/v1/calls

# Or via API Gateway
curl http://localhost:3005/health

# Check WebSocket connection
# (Use browser DevTools to connect to ws://localhost:3051/calls)
```

---

## 📋 REST API Endpoints

### Initiate Call

**POST** `/api/v1/calls`

```bash
curl -X POST http://localhost:3005/api/v1/calls \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "user-id-2",
    "type": "audio"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Call initiated",
  "data": {
    "callId": "nxr-call-...",
    "status": "initiated",
    "type": "audio",
    "initiatorId": "user-id-1",
    "participantIds": ["user-id-1", "user-id-2"]
  }
}
```

### Answer Call

**POST** `/api/v1/calls/:callId/answer`

```bash
curl -X POST http://localhost:3005/api/v1/calls/nxr-call-xxx/answer \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "audioEnabled": true,
    "videoEnabled": false
  }'
```

### Reject Call

**POST** `/api/v1/calls/:callId/reject`

```bash
curl -X POST http://localhost:3005/api/v1/calls/nxr-call-xxx/reject \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "busy" }'
```

### End Call

**POST** `/api/v1/calls/:callId/end`

```bash
curl -X POST http://localhost:3005/api/v1/calls/nxr-call-xxx/end \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Call History

**GET** `/api/v1/calls/history`

```bash
curl http://localhost:3005/api/v1/calls/history?limit=20&page=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Missed Calls

**GET** `/api/v1/calls/missed`

```bash
curl http://localhost:3005/api/v1/calls/missed?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔌 WebSocket Events (Socket.IO)

### Client → Server

```javascript
socket.emit('call:initiate', {
  recipientId: 'user-id-2',
  type: 'audio' // or 'video'
});

socket.emit('call:answer', {
  callId: 'nxr-call-xxx',
  audioEnabled: true,
  videoEnabled: false
});

socket.emit('call:reject', {
  callId: 'nxr-call-xxx',
  reason: 'busy' // optional
});

socket.emit('call:end', {
  callId: 'nxr-call-xxx'
});

// WebRTC Media Negotiation
socket.emit('call:offer', {
  callId: 'nxr-call-xxx',
  sdp: 'v=0\no=...' // SDP offer
});

socket.emit('call:answer-sdp', {
  callId: 'nxr-call-xxx',
  sdp: 'v=0\no=...' // SDP answer
});

socket.emit('call:ice-candidate', {
  callId: 'nxr-call-xxx',
  candidate: 'candidate:...',
  sdpMLineIndex: 0,
  sdpMid: 'audio'
});
```

### Server → Client

```javascript
socket.on('call:incoming', (data) => {
  // data = { callId, initiatorId, type }
  // Show incoming call UI
});

socket.on('call:connected', (data) => {
  // data = { callId, status, participants }
  // Start media stream exchange
});

socket.on('call:rejected', (data) => {
  // data = { callId, rejectedBy, reason }
  // Show "call rejected" message
});

socket.on('call:ended', (data) => {
  // data = { callId, endedBy, duration }
  // Show call summary
});

socket.on('call:offer', (data) => {
  // data = { callId, sdp, from }
  // WebRTC: setRemoteDescription(offer)
});

socket.on('call:ice-candidate', (data) => {
  // data = { callId, candidate, sdpMLineIndex, sdpMid, from }
  // WebRTC: addIceCandidate()
});
```

---

## 🎮 Frontend Integration Example

### Using the Hooks in a Component

```typescript
'use client';

import { useEffect } from 'react';
import { useWebRTC } from '@/lib/hooks/useWebRTC';
import { useCallSignaling } from '@/lib/hooks/useCallSignaling';
import { CallControls, VideoCallWindow, IncomingCallModal } from '@/components/calling';

export function ChatWithCalling() {
  const webrtc = useWebRTC();
  const signaling = useCallSignaling();

  // Incoming call effect
  useEffect(() => {
    if (signaling.isRinging && signaling.call) {
      // Show incoming call modal
    }
  }, [signaling.isRinging]);

  // Answer call
  const handleAnswerCall = async () => {
    await signaling.answerCall(true, false); // audio: on, video: off
    
    // Initialize WebRTC
    const stunServers = [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] }
    ];
    await webrtc.initializeCall({ iceServers: stunServers });

    // Create SDP offer
    const offer = await webrtc.createOffer();
    if (offer) signaling.sendOffer(offer);
  };

  // Initiate call
  const handleInitiateCall = async (recipientId: string) => {
    const callId = await signaling.initiateCall(recipientId, 'audio');
    if (callId) {
      // Wait for recipient to answer, then setup WebRTC
    }
  };

  return (
    <div>
      {signaling.isRinging && signaling.call && (
        <IncomingCallModal
          callerName="John Doe"
          callType={signaling.call.type}
          onAnswer={handleAnswerCall}
          onReject={() => signaling.rejectCall('busy')}
        />
      )}

      {signaling.call?.status === 'connected' && (
        <div className="space-y-4">
          <VideoCallWindow
            localStream={webrtc.localStream}
            remoteStream={webrtc.remoteStream}
            localUserName="You"
            remoteUserName="John Doe"
            isAudioMuted={!webrtc.localStream?.getAudioTracks()[0]?.enabled}
          />
          <CallControls
            isAudioEnabled={webrtc.localStream?.getAudioTracks()[0]?.enabled ?? true}
            isVideoEnabled={webrtc.localStream?.getVideoTracks()[0]?.enabled ?? false}
            onToggleAudio={webrtc.toggleAudio}
            onToggleVideo={webrtc.toggleVideo}
            onEndCall={() => signaling.endCall()}
            duration={Math.floor((Date.now() - (signaling.call?.startTime?.getTime() ?? 0)) / 1000)}
          />
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Testing Checklist

### Backend Tests

- [ ] Start calling-service: `npm run start:dev --workspace=calling-service`
- [ ] Health check: `curl http://localhost:3051/api/v1/health`
- [ ] Create call via REST API
- [ ] Connect to WebSocket via Socket.IO Client
- [ ] Send/receive WebSocket events

### Frontend Tests

- [ ] Import calling components in a page
- [ ] Render IncomingCallModal
- [ ] Test useWebRTC hook
- [ ] Test useCallSignaling hook
- [ ] Verify Socket.IO connection namespace

### Integration Tests

- [ ] Open two browser windows
- [ ] User A initiates call to User B
- [ ] User B receives `call:incoming` event
- [ ] User B answers call
- [ ] Both exchange SDP offers/answers
- [ ] Both exchange ICE candidates
- [ ] RTCPeerConnection reaches "connected" state
- [ ] User A ends call

---

## 📚 Files Created/Modified

### New Files

```
services/calling-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── calling/
│   │   ├── calling.module.ts
│   │   ├── calling.controller.ts
│   │   ├── calling.service.ts
│   │   ├── calling.gateway.ts
│   │   ├── dto/index.ts
│   │   ├── schemas/call.schema.ts
│   │   └── guards/jwt-auth.guard.ts
│   └── ... (other files)
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── README.md

frontend/src/
├── lib/hooks/
│   ├── useWebRTC.ts
│   └── useCallSignaling.ts
└── components/calling/
    ├── IncomingCallModal.tsx
    ├── CallControls.tsx
    ├── VideoCallWindow.tsx
    ├── CallButtons.tsx
    └── index.ts
```

### Modified Files

```
package.json                      # Added calling-service to workspaces
docker-compose.simple.yml         # Added calling-service container
services/api-gateway/src/main.ts  # Added calling-service routes
```

---

## 🔧 Next Steps (Phase 2)

1. **Create a chat page/component that integrates calling**
   - Add call buttons to conversation headers
   - Handle incoming call notifications
   - Show active call overlay

2. **Build full video calling UI**
   - Gallery view for multiple participants
   - Speaker detection
   - Screen sharing (future)

3. **Add call recording metadata**
   - Store recording URLs in call history
   - Playback UI

4. **Implement call analytics dashboard**
   - Call duration statistics
   - Missed calls report
   - Call quality metrics

5. **Add group calling support**
   - Modify signaling for 3+ participants
   - Implement SFU or mesh topology
   - Update UI for group calls

---

## 🐛 Troubleshooting

### Calling Service Won't Start

```bash
# Check logs
docker logs nexora-calling-service

# Rebuild if needed
docker compose -f docker-compose.simple.yml up -d --build calling-service
```

### WebSocket Connection Failed

- Verify calling-service is running: `curl http://localhost:3051/api/v1/health`
- Check token format: `Authorization: Bearer <token>`
- Verify CORS settings in calling.gateway.ts

### ICE Connection Failed

- Ensure STUN servers are reachable
- Check for firewall blocking port 19302
- Verify `STUN_SERVERS` env var is set correctly

### MongoDB Connection Error

```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check connection string
# Should be: mongodb://root:nexora_dev_password@mongodb:27017/nexora_calling?authSource=admin
```

---

## 📞 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (User A)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chat Page + Calling UI                              │   │
│  │  - CallButtons (Audio/Video)                         │   │
│  │  - IncomingCallModal                                 │   │
│  │  - VideoCallWindow with CallControls                 │   │
│  └──────┬────────────────────────────────┬──────────────┘   │
│         │  REST API                      │  WebSocket       │
└─────────┼────────────────────────────────┼──────────────────┘
          │ /api/v1/calls                  │ ws://
          ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (localhost:3005)                   │
│  Proxy routes: /api/v1/calls → calling-service:3051        │
└─────────────────────────────┬────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│   CALLING SERVICE        │          │   CALLING SERVICE        │
│   (localhost:3051)       │          │   (localhost:3051)       │
│                          │          │                          │
│  REST Controller         │          │  WebSocket Gateway       │
│  ├─ POST /calls          │          │  ├─ call:initiate       │
│  ├─ POST /calls/:id/ans  │          │  ├─ call:offer          │
│  ├─ POST /calls/:id/reject          │  ├─ call:ice-candidate  │
│  └─ GET /calls/history   │          │  └─ ...                  │
│                          │          │                          │
│  CallingService          │          │  CallingGateway          │
│  ├─ initiateCall()       │          │  ├─ handleInitiate()    │
│  ├─ answerCall()         │          │  ├─ handleAnswer()      │
│  └─ endCall()            │          │  └─ ...                  │
└────────────┬─────────────┘          └────────────┬────────────┘
             │                                     │
             └──────────────┬──────────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │  MongoDB (Calls)    │
                  │  ├─ calls coll.     │
                  │  ├─ indexes         │
                  │  └─ call records    │
                  └─────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (User B)                         │
│  WebRTC Direct Link (after signaling):                     │
│  Audio/Video Stream ◄─────────────────► Audio/Video Stream │
└─────────────────────────────────────────────────────────────┘
```

---

**Ready to test?** 🚀

Start with:
```bash
cd /Users/ekamjitsingh/Projects/Nexora
npm install
docker compose -f docker-compose.simple.yml up -d
```

Then open two browser windows with different users and test!
