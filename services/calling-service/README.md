// Calling Service README
# Nexora Calling Service

WebRTC-based calling and video calling service for Nexora.

## Features

- 1-on-1 Audio/Video Calling
- WebSocket Signaling (via Socket.IO)
- WebRTC Peer Connections
- Call History & Analytics
- Real-time call state management

## Running

```bash
npm install
npm run start:dev
```

Service runs on `http://localhost:3051`  
WebSocket Gateway: `ws://localhost:3051/calls`

## Environment Variables

See `.env.example`

## Architecture

- **Controller**: REST endpoints (`/api/v1/calls`)
- **Gateway**: WebSocket signaling (`/calls`)
- **Service**: Business logic & database
- **Schemas**: MongoDB models

## API Endpoints

- `POST /api/v1/calls` - Initiate call
- `POST /api/v1/calls/:callId/answer` - Answer call
- `POST /api/v1/calls/:callId/reject` - Reject call
- `POST /api/v1/calls/:callId/end` - End call
- `GET /api/v1/calls/history` - Get call history
- `GET /api/v1/calls/missed` - Get missed calls
- `GET /api/v1/calls/:callId` - Get call details

## WebSocket Events

**Client → Server**:
- `call:initiate` - Start new call
- `call:answer` - Accept call
- `call:reject` - Decline call
- `call:end` - Terminate call
- `call:offer` - SDP offer (media negotiation)
- `call:answer-sdp` - SDP answer
- `call:ice-candidate` - ICE candidate

**Server → Client**:
- `call:incoming` - Incoming call notification
- `call:connected` - Call connected
- `call:rejected` - Call rejected
- `call:ended` - Call ended
