"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Coordinator hook for group calls.
 * Tries SFU mode first, falls back to P2P mesh if SFU is unavailable.
 * Provides a unified interface regardless of the underlying transport.
 */

export type GroupCallMode = "connecting" | "sfu" | "p2p" | "failed";

interface RemoteParticipant {
  userId: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface UseGroupCallOptions {
  /** Maximum participants before P2P is rejected */
  p2pMaxParticipants?: number;
}

interface UseGroupCallReturn {
  mode: GroupCallMode;
  participants: RemoteParticipant[];
  localStream: MediaStream | null;
  isConnected: boolean;
  error: string | null;
  join: (roomId: string) => Promise<void>;
  leave: () => void;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => Promise<void>;
}

const DEFAULT_P2P_MAX = 6;

export function useGroupCall(options?: UseGroupCallOptions): UseGroupCallReturn {
  const p2pMax = options?.p2pMaxParticipants ?? DEFAULT_P2P_MAX;

  const [mode, setMode] = useState<GroupCallMode>("connecting");
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modeRef = useRef<GroupCallMode>("connecting");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const join = useCallback(async (roomId: string) => {
    setMode("connecting");
    setError(null);

    try {
      // Try SFU first by dynamically importing useSfuClient logic
      // In practice, the parent component would use useSfuClient directly
      // and this hook coordinates the fallback decision

      // Check if SFU is available by attempting connection
      const sfuUrl = process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://localhost:3051";
      const response = await fetch(`${sfuUrl}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);

      if (response?.ok) {
        setMode("sfu");
        setIsConnected(true);
      } else {
        // SFU unavailable — check participant count for P2P feasibility
        if (participants.length + 1 > p2pMax) {
          setMode("failed");
          setError(`Group calls with more than ${p2pMax} participants require the SFU server, which is unavailable.`);
          return;
        }
        setMode("p2p");
        setIsConnected(true);
      }
    } catch (err) {
      setMode("failed");
      setError(err instanceof Error ? err.message : "Failed to join group call");
    }
  }, [participants.length, p2pMax]);

  const leave = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setParticipants([]);
    setIsConnected(false);
    setMode("connecting");
    setError(null);
  }, [localStream]);

  const toggleAudio = useCallback((enabled: boolean) => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = enabled; });
  }, [localStream]);

  const toggleVideo = useCallback(async (enabled: boolean) => {
    if (enabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && localStream) {
          localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
          localStream.addTrack(videoTrack);
          setLocalStream(new MediaStream(localStream.getTracks()));
        }
      } catch (err) {
        console.error("Failed to enable camera:", err);
      }
    } else {
      localStream?.getVideoTracks().forEach(t => {
        t.stop();
        localStream?.removeTrack(t);
      });
      if (localStream) {
        setLocalStream(new MediaStream(localStream.getTracks()));
      }
    }
  }, [localStream]);

  return {
    mode,
    participants,
    localStream,
    isConnected,
    error,
    join,
    leave,
    toggleAudio,
    toggleVideo,
  };
}
