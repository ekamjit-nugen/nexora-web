"use client";

import { useRef, useCallback, useState } from "react";

interface RTCPeerConfig {
  iceServers: Array<{ urls: string[] }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ControlMessageHandler = (msg: any) => void;

export type ReconnectionState = "stable" | "reconnecting" | "failed";

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isConnected: boolean;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  reconnectionState: ReconnectionState;
  error: string | null;
  initializeCall: (
    config: RTCPeerConfig,
    options?: {
      media?: { audio: boolean; video: boolean };
      onIceCandidate?: (candidate: RTCIceCandidate) => void;
      onIceRestart?: (offer: RTCSessionDescriptionInit) => void;
      isInitiator?: boolean;
      onControlMessage?: ControlMessageHandler;
    },
  ) => Promise<void>;
  createOffer: (options?: { iceRestart?: boolean }) => Promise<RTCSessionDescriptionInit | null>;
  createAnswer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit | null>;
  setRemoteDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidate) => Promise<void>;
  restartIce: () => Promise<RTCSessionDescriptionInit | null>;
  endCall: () => void;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => Promise<void>;
  startScreenShare: () => Promise<MediaStream | null>;
  stopScreenShare: (screenStream: MediaStream) => Promise<void>;
  /** Send a control message to the remote peer via DataChannel (peer-to-peer, no server) */
  sendControl: (msg: Record<string, unknown>) => void;
}

const MAX_ICE_RESTART_ATTEMPTS = 3;

export function useWebRTC(): UseWebRTCReturn {
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef<RTCIceCandidate[]>([]);
  const allLocalStreamsRef = useRef<MediaStream[]>([]);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const controlHandlerRef = useRef<ControlMessageHandler | null>(null);
  const onIceRestartRef = useRef<((offer: RTCSessionDescriptionInit) => void) | null>(null);
  const iceRestartAttemptsRef = useRef(0);
  const iceRestartTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState | null>(null);
  const [reconnectionState, setReconnectionState] = useState<ReconnectionState>("stable");
  const [error, setError] = useState<string | null>(null);

  // Set up data channel message handler
  const setupDataChannel = (dc: RTCDataChannel) => {
    dataChannelRef.current = dc;
    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        controlHandlerRef.current?.(msg);
      } catch {}
    };
  };

  // Auto ICE restart with exponential backoff
  const attemptIceRestart = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || pc.connectionState === "closed") return;

    if (iceRestartAttemptsRef.current >= MAX_ICE_RESTART_ATTEMPTS) {
      setReconnectionState("failed");
      setError("Connection lost. Unable to reconnect.");
      return;
    }

    iceRestartAttemptsRef.current++;
    setReconnectionState("reconnecting");

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true,
      });
      await pc.setLocalDescription(offer);

      // Send the restart offer via signaling
      onIceRestartRef.current?.(offer);
    } catch (err) {
      console.error("ICE restart failed:", err);
      // Retry with exponential backoff
      const delay = Math.min(2000 * Math.pow(2, iceRestartAttemptsRef.current - 1), 10000);
      iceRestartTimerRef.current = setTimeout(attemptIceRestart, delay);
    }
  }, []);

  const initializeCall = useCallback(async (
    config: RTCPeerConfig,
    options?: {
      media?: { audio: boolean; video: boolean };
      onIceCandidate?: (candidate: RTCIceCandidate) => void;
      onIceRestart?: (offer: RTCSessionDescriptionInit) => void;
      isInitiator?: boolean;
      onControlMessage?: ControlMessageHandler;
    },
  ) => {
    try {
      setError(null);
      setReconnectionState("stable");
      iceRestartAttemptsRef.current = 0;
      const isInitiator = options?.isInitiator ?? true;

      if (options?.onControlMessage) {
        controlHandlerRef.current = options.onControlMessage;
      }
      if (options?.onIceRestart) {
        onIceRestartRef.current = options.onIceRestart;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      localStreamRef.current = stream;
      allLocalStreamsRef.current.push(stream);
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: config.iceServers,
      });

      // Add audio track
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Only initiator adds video transceiver (receiver gets it from the offer)
      if (isInitiator) {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }

      cameraVideoTrackRef.current = null;

      // DataChannel for control messages (media state, etc.)
      if (isInitiator) {
        const dc = pc.createDataChannel("control", { ordered: true });
        setupDataChannel(dc);
      }
      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel);
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        const track = event.track;

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = event.streams?.[0] || new MediaStream();
        }

        const existing = remoteStreamRef.current.getTracks();
        if (!existing.find((t) => t.id === track.id)) {
          remoteStreamRef.current.addTrack(track);
        }

        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));

        track.onunmute = () => {
          if (remoteStreamRef.current) {
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
          }
        };
        track.onmute = () => {
          if (remoteStreamRef.current) {
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
          }
        };
        track.onended = () => {
          if (remoteStreamRef.current) {
            try { remoteStreamRef.current.removeTrack(track); } catch {}
            if (remoteStreamRef.current.getTracks().length > 0) {
              setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
            }
          }
        };
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && options?.onIceCandidate) {
          options.onIceCandidate(event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        if (pc.connectionState === "connected") {
          setIsConnected(true);
          // Connection recovered — reset reconnection state
          iceRestartAttemptsRef.current = 0;
          setReconnectionState("stable");
          if (iceRestartTimerRef.current) {
            clearTimeout(iceRestartTimerRef.current);
            iceRestartTimerRef.current = null;
          }
        } else if (pc.connectionState === "failed") {
          setIsConnected(false);
          // Auto-attempt ICE restart
          attemptIceRestart();
        } else if (pc.connectionState === "disconnected") {
          setIsConnected(false);
          // Wait 2 seconds then attempt ICE restart if still disconnected
          iceRestartTimerRef.current = setTimeout(() => {
            if (peerConnectionRef.current?.connectionState === "disconnected") {
              attemptIceRestart();
            }
          }, 2000);
        }
      };

      pc.oniceconnectionstatechange = () => {
        setIceConnectionState(pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
          setError("ICE connection failed");
          // Trigger ICE restart if connection state handler hasn't already
          if (reconnectionState !== "reconnecting") {
            attemptIceRestart();
          }
        } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setError(null);
        }
      };

      peerConnectionRef.current = pc;
    } catch (err) {
      let message = err instanceof Error ? err.message : "Failed to initialize call";
      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        (message.includes("not allowed") || message.includes("NotAllowedError") || message.includes("Permission denied") || message.includes("Requested device not found"))
      ) {
        message = "Camera/microphone access requires HTTPS. On Chrome, go to chrome://flags/#unsafely-treat-insecure-origin-as-secure and add this site's URL, then relaunch.";
      }
      setError(message);
      console.error("WebRTC initialization error:", err);
    }
  }, [attemptIceRestart]);

  const createOffer = useCallback(async (options?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit | null> => {
    if (!peerConnectionRef.current) return null;
    try {
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: options?.iceRestart === true,
      });
      await peerConnectionRef.current.setLocalDescription(offer);
      return offer;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create offer";
      setError(message);
      return null;
    }
  }, []);

  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
      if (!peerConnectionRef.current) return null;
      try {
        const pc = peerConnectionRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Ensure video transceivers are sendrecv so both sides can send video
        pc.getTransceivers().forEach((t) => {
          if (t.receiver.track?.kind === "video") {
            try { t.direction = "sendrecv"; } catch {}
          }
        });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        return answer;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create answer";
        setError(message);
        return null;
      }
    },
    [],
  );

  const setRemoteDescription = useCallback(async (desc: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(desc));
      if (pendingIceRef.current.length) {
        const pending = [...pendingIceRef.current];
        pendingIceRef.current = [];
        for (const candidate of pending) {
          try {
            await peerConnectionRef.current.addIceCandidate(candidate);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to add ICE candidate";
            setError(message);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set remote description";
      setError(message);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    if (!peerConnectionRef.current) return;
    try {
      if (!peerConnectionRef.current.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add ICE candidate";
      setError(message);
    }
  }, []);

  const restartIce = useCallback(async (): Promise<RTCSessionDescriptionInit | null> => {
    if (!peerConnectionRef.current) return null;
    try {
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true,
      });
      await peerConnectionRef.current.setLocalDescription(offer);
      return offer;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restart ICE";
      setError(message);
      return null;
    }
  }, []);

  const endCall = useCallback(() => {
    // Clear any pending ICE restart timers
    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
    }
    iceRestartAttemptsRef.current = 0;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    allLocalStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    allLocalStreamsRef.current = [];
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    peerConnectionRef.current = null;
    cameraVideoTrackRef.current = null;
    dataChannelRef.current = null;
    controlHandlerRef.current = null;
    onIceRestartRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setConnectionState(null);
    setIceConnectionState(null);
    setReconnectionState("stable");
    setError(null);
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  // Find the video sender/transceiver reliably on both caller and receiver
  const findVideoSender = useCallback((): RTCRtpSender | null => {
    const pc = peerConnectionRef.current;
    if (!pc) return null;
    const withTrack = pc.getSenders().find((s) => s.track?.kind === "video");
    if (withTrack) return withTrack;
    const videoTransceiver = pc.getTransceivers().find(
      (t) => t.receiver.track?.kind === "video"
    );
    if (videoTransceiver) return videoTransceiver.sender;
    return pc.getSenders().find((s) => s.track === null) || null;
  }, []);

  // Replace track on the video sender and set transceiver direction
  const setVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const sender = findVideoSender();
    if (sender) {
      await sender.replaceTrack(track).catch(() => {});
    }
    const videoTransceiver = pc.getTransceivers().find(
      (t) => t.sender === sender || t.receiver.track?.kind === "video"
    );
    if (videoTransceiver) {
      try {
        videoTransceiver.direction = track ? "sendrecv" : "recvonly";
      } catch {}
    }
  }, [findVideoSender]);

  /** Send a control message to the remote peer via DataChannel */
  const sendControl = useCallback((msg: Record<string, unknown>) => {
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(msg));
    }
  }, []);

  const toggleVideo = useCallback(async (enabled: boolean) => {
    if (enabled) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        const camTrack = camStream.getVideoTracks()[0];
        if (!camTrack) return;

        cameraVideoTrackRef.current = camTrack;
        allLocalStreamsRef.current.push(camStream);

        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
          localStreamRef.current.addTrack(camTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        await setVideoTrack(camTrack);
        sendControl({ type: "media-state", hasVideo: true });
      } catch (err) {
        console.error("Failed to enable camera:", err);
      }
    } else {
      const camTrack = cameraVideoTrackRef.current;
      if (camTrack) {
        camTrack.stop();
        cameraVideoTrackRef.current = null;
        if (localStreamRef.current) {
          try { localStreamRef.current.removeTrack(camTrack); } catch {}
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      }
      await setVideoTrack(null);
      sendControl({ type: "media-state", hasVideo: false });
    }
  }, [setVideoTrack, sendControl]);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 15, max: 30 },
        },
        audio: true, // Enable tab/system audio sharing
      });

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (!screenVideoTrack) return null;

      allLocalStreamsRef.current.push(screenStream);
      await setVideoTrack(screenVideoTrack);
      sendControl({ type: "media-state", hasVideo: true, isScreenShare: true });

      // If screen stream includes audio, add it as a separate track
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (screenAudioTrack && peerConnectionRef.current) {
        peerConnectionRef.current.addTrack(screenAudioTrack, screenStream);
        sendControl({ type: "media-state", hasScreenAudio: true });
      }

      return screenStream;
    } catch (err) {
      if ((err as Error).name === "AbortError" || (err as Error).name === "NotAllowedError") {
        return null;
      }
      console.error("Screen share error:", err);
      return null;
    }
  }, [setVideoTrack, sendControl]);

  const stopScreenShare = useCallback(async (screenStream: MediaStream) => {
    // Remove screen audio track from peer connection if it was added
    const screenAudioTrack = screenStream.getAudioTracks()[0];
    if (screenAudioTrack && peerConnectionRef.current) {
      const sender = peerConnectionRef.current.getSenders().find(
        (s) => s.track === screenAudioTrack
      );
      if (sender) {
        try { peerConnectionRef.current.removeTrack(sender); } catch {}
      }
      sendControl({ type: "media-state", hasScreenAudio: false });
    }

    screenStream.getTracks().forEach((t) => t.stop());

    const cameraTrack = cameraVideoTrackRef.current;
    if (cameraTrack && cameraTrack.readyState === "live") {
      await setVideoTrack(cameraTrack);
      sendControl({ type: "media-state", hasVideo: true, isScreenShare: false });
    } else {
      await setVideoTrack(null);
      sendControl({ type: "media-state", hasVideo: false, isScreenShare: false });
    }
  }, [setVideoTrack, sendControl]);

  return {
    localStream,
    remoteStream,
    peerConnection: peerConnectionRef.current,
    isConnected,
    connectionState,
    iceConnectionState,
    reconnectionState,
    error,
    initializeCall,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    restartIce,
    endCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendControl,
  };
}
