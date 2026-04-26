"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";

const SFU_SOCKET_URL = process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://192.168.29.218:3051";

interface SfuProducer {
  id: string;
  kind: string;
  track: MediaStreamTrack;
}

interface SfuConsumer {
  id: string;
  producerId: string;
  userId: string;
  kind: string;
  track: MediaStreamTrack;
}

interface SfuState {
  connected: boolean;
  roomId: string | null;
  localProducers: SfuProducer[];
  remoteStreams: Map<string, MediaStream>;
  participants: string[];
  join: (roomId: string, userId: string, localStream: MediaStream) => Promise<void>;
  leave: () => void;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  setPreferredLayers: (consumerId: string, spatialLayer: number, temporalLayer: number) => void;
}

/**
 * SFU client hook for mediasoup-based group calls.
 *
 * Protocol:
 * 1. Connect to /sfu namespace
 * 2. sfu:join → get routerRtpCapabilities + transport params + existing producers
 * 3. Load mediasoup-client Device with capabilities
 * 4. Connect send/recv transports
 * 5. Produce local audio/video tracks
 * 6. Consume existing producers from other participants
 * 7. Listen for sfu:new-producer → consume new streams
 * 8. Listen for sfu:peer-left → remove streams
 *
 * Falls back to P2P if SFU is unavailable.
 */
export function useSfuClient(): SfuState {
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localProducers, setLocalProducers] = useState<SfuProducer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<any>(null); // mediasoup-client Device
  const sendTransportRef = useRef<any>(null);
  const recvTransportRef = useRef<any>(null);

  const join = useCallback(async (newRoomId: string, userId: string, localStream: MediaStream) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // Connect to SFU namespace
    const socket = io(`${SFU_SOCKET_URL}/sfu`, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Join room
    socket.emit("sfu:join", { roomId: newRoomId, userId });

    socket.on("sfu:joined", async (data: any) => {
      setRoomId(newRoomId);

      try {
        // Load mediasoup-client Device (dynamic import)
        const mediasoupClient = await import("mediasoup-client");
        const { Device } = mediasoupClient;
        const device = new Device();
        await device.load({ routerRtpCapabilities: data.routerRtpCapabilities });
        deviceRef.current = device;

        // Create send transport
        if (data.sendTransport) {
          const sendTransport = device.createSendTransport(data.sendTransport);
          sendTransport.on("connect", ({ dtlsParameters }: any, callback: () => void) => {
            socket.emit("sfu:connect-transport", {
              transportId: sendTransport.id,
              dtlsParameters,
            });
            socket.once("sfu:transport-connected", () => callback());
          });
          sendTransport.on("produce", ({ kind, rtpParameters, appData }: any, callback: (arg: any) => void) => {
            socket.emit("sfu:produce", { kind, rtpParameters, appData });
            socket.once("sfu:produced", ({ producerId }: any) => callback({ id: producerId }));
          });
          sendTransportRef.current = sendTransport;

          // Produce local tracks (with simulcast encodings for video)
          for (const track of localStream.getTracks()) {
            const produceOptions: any = { track };
            if (track.kind === "video") {
              produceOptions.encodings = [
                { maxBitrate: 100000, scaleResolutionDownBy: 4 },   // Low
                { maxBitrate: 300000, scaleResolutionDownBy: 2 },   // Medium
                { maxBitrate: 900000, scaleResolutionDownBy: 1 },   // High
              ];
              produceOptions.codecOptions = { videoGoogleStartBitrate: 1000 };
            }
            const producer = await sendTransport.produce(produceOptions);
            setLocalProducers(prev => [...prev, { id: producer.id, kind: track.kind, track }]);
          }
        }

        // Create recv transport
        if (data.recvTransport) {
          const recvTransport = device.createRecvTransport(data.recvTransport);
          recvTransport.on("connect", ({ dtlsParameters }: any, callback: () => void) => {
            socket.emit("sfu:connect-transport", {
              transportId: recvTransport.id,
              dtlsParameters,
            });
            socket.once("sfu:transport-connected", () => callback());
          });
          recvTransportRef.current = recvTransport;

          // Consume existing producers
          for (const prod of data.existingProducers || []) {
            await consumeProducer(socket, recvTransport, device, prod.producerId, prod.userId);
          }
        }
      } catch (err) {
        console.warn("mediasoup-client not available, SFU mode disabled:", err);
      }
    });

    // New producer from another participant
    socket.on("sfu:new-producer", async ({ userId: producerUserId, producerId, kind }: any) => {
      if (recvTransportRef.current && deviceRef.current) {
        await consumeProducer(socket, recvTransportRef.current, deviceRef.current, producerId, producerUserId);
      }
    });

    // Participant left
    socket.on("sfu:peer-left", ({ userId: leftUserId }: any) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(leftUserId);
        return next;
      });
      setParticipants(prev => prev.filter(id => id !== leftUserId));
    });

    // Participant joined
    socket.on("sfu:peer-joined", ({ userId: joinedUserId }: any) => {
      setParticipants(prev => Array.from(new Set([...prev, joinedUserId])));
    });
  }, []);

  const consumeProducer = async (
    socket: Socket,
    recvTransport: any,
    device: any,
    producerId: string,
    producerUserId: string,
  ) => {
    socket.emit("sfu:consume", {
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    return new Promise<void>((resolve) => {
      socket.once("sfu:consumed", async (data: any) => {
        const consumer = await recvTransport.consume({
          id: data.id,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        // Resume the consumer
        socket.emit("sfu:resume-consumer", { consumerId: consumer.id });

        // Add track to remote streams
        setRemoteStreams(prev => {
          const next = new Map(prev);
          const existing = next.get(producerUserId) || new MediaStream();
          existing.addTrack(consumer.track);
          next.set(producerUserId, existing);
          return next;
        });

        resolve();
      });
    });
  };

  const leave = useCallback(() => {
    socketRef.current?.emit("sfu:leave");
    socketRef.current?.disconnect();
    socketRef.current = null;
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;
    setRoomId(null);
    setConnected(false);
    setLocalProducers([]);
    setRemoteStreams(new Map());
    setParticipants([]);
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    for (const producer of localProducers) {
      if (producer.kind === "audio") {
        producer.track.enabled = enabled;
      }
    }
  }, [localProducers]);

  const toggleVideo = useCallback((enabled: boolean) => {
    for (const producer of localProducers) {
      if (producer.kind === "video") {
        producer.track.enabled = enabled;
      }
    }
  }, [localProducers]);

  const setPreferredLayers = useCallback((consumerId: string, spatialLayer: number, temporalLayer: number) => {
    socketRef.current?.emit("sfu:set-preferred-layers", { consumerId, spatialLayer, temporalLayer });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { leave(); };
  }, [leave]);

  return {
    connected,
    roomId,
    localProducers,
    remoteStreams,
    participants,
    join,
    leave,
    toggleAudio,
    toggleVideo,
    setPreferredLayers,
  };
}
