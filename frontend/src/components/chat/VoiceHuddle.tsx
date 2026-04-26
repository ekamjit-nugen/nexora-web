"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/lib/use-socket";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CALL_SOCKET_URL =
  process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://192.168.29.218:3051";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

interface HuddleParticipant {
  userId: string;
  joinedAt: string;
  muted: boolean;
}

interface HuddleState {
  active: boolean;
  startedBy: string;
  startedAt: string;
  participants: HuddleParticipant[];
}

interface VoiceHuddleProps {
  conversationId: string;
  currentUserId: string;
  employeeMap: Record<string, { firstName?: string; lastName?: string }>;
}

export default function VoiceHuddle({ conversationId, currentUserId, employeeMap }: VoiceHuddleProps) {
  const { socket, connected, emit, on } = useSocket({
    namespace: "/calls",
    enabled: true,
    baseUrl: CALL_SOCKET_URL,
  });

  const [huddle, setHuddle] = useState<HuddleState | null>(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  // WebRTC refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(new Map());
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const isInHuddle = joined && huddle?.active;

  // Get display name for a userId
  const getDisplayName = useCallback((userId: string) => {
    const emp = employeeMap[userId];
    if (emp) {
      return [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "User";
    }
    return userId === currentUserId ? "You" : "User";
  }, [employeeMap, currentUserId]);

  // Get initials for avatar
  const getInitials = useCallback((userId: string) => {
    const emp = employeeMap[userId];
    if (emp) {
      return `${(emp.firstName || "")[0] || ""}${(emp.lastName || "")[0] || ""}`.toUpperCase();
    }
    return "?";
  }, [employeeMap]);

  // ── Voice Activity Detection ──
  const startVAD = useCallback((stream: MediaStream, userId: string) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      analyserNodesRef.current.set(userId, { analyser, source });
    } catch {
      // VAD is optional — don't fail the huddle
    }
  }, []);

  // Poll all analyser nodes for speaking detection
  useEffect(() => {
    if (!isInHuddle) return;

    vadIntervalRef.current = setInterval(() => {
      const speaking = new Set<string>();
      for (const [userId, { analyser }] of analyserNodesRef.current.entries()) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 15) {
          speaking.add(userId);
        }
      }
      setSpeakingUsers(speaking);
    }, 150);

    return () => {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
    };
  }, [isInHuddle]);

  // ── WebRTC peer connection management ──
  const createPeerConnection = useCallback((remoteUserId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(remoteUserId)) {
      return peerConnectionsRef.current.get(remoteUserId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(remoteUserId, pc);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        // Play audio
        let audio = remoteAudiosRef.current.get(remoteUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudiosRef.current.set(remoteUserId, audio);
        }
        audio.srcObject = remoteStream;
        audio.play().catch(() => {});

        // Start VAD for remote user
        startVAD(remoteStream, remoteUserId);
      }
    };

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit("huddle:ice-candidate", {
          conversationId,
          targetUserId: remoteUserId,
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        // Clean up this peer
        pc.close();
        peerConnectionsRef.current.delete(remoteUserId);
        const audio = remoteAudiosRef.current.get(remoteUserId);
        if (audio) {
          audio.srcObject = null;
          remoteAudiosRef.current.delete(remoteUserId);
        }
        analyserNodesRef.current.delete(remoteUserId);
      }
    };

    // If we are the initiator (polite peer for mesh), create and send offer
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            emit("huddle:offer", {
              conversationId,
              targetUserId: remoteUserId,
              sdp: pc.localDescription.sdp,
            });
          }
        })
        .catch(err => console.error("Error creating offer:", err));
    }

    return pc;
  }, [conversationId, emit, startVAD]);

  // ── Cleanup all WebRTC state ──
  const cleanupWebRTC = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    for (const [, pc] of peerConnectionsRef.current) {
      pc.close();
    }
    peerConnectionsRef.current.clear();

    // Stop all remote audio
    for (const [, audio] of remoteAudiosRef.current) {
      audio.srcObject = null;
    }
    remoteAudiosRef.current.clear();

    // Clean up VAD
    for (const [, { source }] of analyserNodesRef.current) {
      try { source.disconnect(); } catch {}
    }
    analyserNodesRef.current.clear();

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    setSpeakingUsers(new Set());
  }, []);

  // ── Socket event handlers ──
  useEffect(() => {
    if (!socket || !connected) return;

    // Listen for huddle state updates
    const unsubState = on("huddle:state", (data: any) => {
      if (data.conversationId === conversationId) {
        setHuddle(data.huddle);
        if (!data.huddle || !data.huddle.active) {
          // Huddle ended
          if (joined) {
            setJoined(false);
            cleanupWebRTC();
          }
        }
      }
    });

    const unsubEnded = on("huddle:ended", (data: any) => {
      if (data.conversationId === conversationId) {
        setHuddle(null);
        if (joined) {
          setJoined(false);
          cleanupWebRTC();
        }
      }
    });

    // When a new participant joins, initiate a peer connection to them (if we're in the huddle)
    const unsubJoined = on("huddle:participant-joined", (data: any) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId && joined) {
        // We are already in the huddle — initiate connection to the new joiner
        createPeerConnection(data.userId, true);
      }
    });

    // When a participant leaves, clean up their peer connection
    const unsubLeft = on("huddle:participant-left", (data: any) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        const pc = peerConnectionsRef.current.get(data.userId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.userId);
        }
        const audio = remoteAudiosRef.current.get(data.userId);
        if (audio) {
          audio.srcObject = null;
          remoteAudiosRef.current.delete(data.userId);
        }
        analyserNodesRef.current.delete(data.userId);
      }
    });

    // Handle incoming SDP offer
    const unsubOffer = on("huddle:offer", (data: any) => {
      if (data.conversationId === conversationId && data.from !== currentUserId && joined) {
        const pc = createPeerConnection(data.from, false);
        pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }))
          .then(() => pc.createAnswer())
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
            if (pc.localDescription) {
              emit("huddle:answer", {
                conversationId,
                targetUserId: data.from,
                sdp: pc.localDescription.sdp,
              });
            }
          })
          .catch(err => console.error("Error handling huddle offer:", err));
      }
    });

    // Handle incoming SDP answer
    const unsubAnswer = on("huddle:answer", (data: any) => {
      if (data.conversationId === conversationId && data.from !== currentUserId) {
        const pc = peerConnectionsRef.current.get(data.from);
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }))
            .catch(err => console.error("Error handling huddle answer:", err));
        }
      }
    });

    // Handle incoming ICE candidate
    const unsubIce = on("huddle:ice-candidate", (data: any) => {
      if (data.conversationId === conversationId && data.from !== currentUserId) {
        const pc = peerConnectionsRef.current.get(data.from);
        if (pc) {
          pc.addIceCandidate(new RTCIceCandidate({
            candidate: data.candidate,
            sdpMLineIndex: data.sdpMLineIndex,
            sdpMid: data.sdpMid,
          })).catch(err => console.error("Error adding ICE candidate:", err));
        }
      }
    });

    // Request initial huddle state
    emit("huddle:get", { conversationId });

    return () => {
      unsubState();
      unsubEnded();
      unsubJoined();
      unsubLeft();
      unsubOffer();
      unsubAnswer();
      unsubIce();
    };
  }, [socket, connected, conversationId, currentUserId, joined, on, emit, createPeerConnection, cleanupWebRTC]);

  // ── Start or Join Huddle ──
  const handleStartOrJoin = useCallback(async () => {
    setConnecting(true);
    setError(null);

    try {
      // Acquire microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Start local VAD
      startVAD(stream, currentUserId);

      if (huddle?.active) {
        // Join existing huddle
        emit("huddle:join", { conversationId });
      } else {
        // Start new huddle
        emit("huddle:start", { conversationId });
      }

      setJoined(true);

      // Establish peer connections with existing participants
      if (huddle?.participants) {
        for (const p of huddle.participants) {
          if (p.userId !== currentUserId) {
            createPeerConnection(p.userId, true);
          }
        }
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow microphone access.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError("Failed to start audio. Please try again.");
      }
      console.error("Huddle start error:", err);
    } finally {
      setConnecting(false);
    }
  }, [huddle, conversationId, currentUserId, emit, startVAD, createPeerConnection]);

  // ── Leave Huddle ──
  const handleLeave = useCallback(() => {
    emit("huddle:leave", { conversationId });
    setJoined(false);
    cleanupWebRTC();
  }, [conversationId, emit, cleanupWebRTC]);

  // ── Toggle Mute ──
  const handleToggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = muted; // toggle: if currently muted, enable
        setMuted(!muted);
      }
    }
  }, [muted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (joined) {
        emit("huddle:leave", { conversationId });
        cleanupWebRTC();
      }
    };
  }, []);

  // No huddle and not joined — show start button
  if (!huddle?.active && !joined) {
    return (
      <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#FAFBFC]">
        {error && (
          <p className="text-[11px] text-red-500 mb-2">{error}</p>
        )}
        <button
          onClick={handleStartOrJoin}
          disabled={connecting || !connected}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors w-full justify-center"
        >
          {connecting ? (
            <div className="w-3.5 h-3.5 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
          Start Huddle
        </button>
      </div>
    );
  }

  // Huddle active — show participants + join/controls
  return (
    <div className="border-t border-[#E2E8F0] bg-gradient-to-b from-[#F0FDF4] to-[#FAFBFC]">
      {error && (
        <p className="text-[11px] text-red-500 px-4 pt-2">{error}</p>
      )}

      {/* Huddle header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-[12px] font-semibold text-[#16A34A]">Huddle</span>
          <span className="text-[11px] text-[#64748B]">
            {huddle?.participants.length || 0} participant{(huddle?.participants.length || 0) !== 1 ? "s" : ""}
          </span>
        </div>
        {!joined && (
          <button
            onClick={handleStartOrJoin}
            disabled={connecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-50 rounded-lg transition-colors"
          >
            {connecting ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
            Join
          </button>
        )}
      </div>

      {/* Participants */}
      <div className="px-4 pb-2 flex flex-wrap gap-2">
        {huddle?.participants.map((p) => {
          const isSpeaking = speakingUsers.has(p.userId);
          const isMe = p.userId === currentUserId;
          return (
            <div key={p.userId} className="flex items-center gap-1.5" title={getDisplayName(p.userId)}>
              <div className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold bg-[#2E86C1] transition-all ${
                isSpeaking ? "ring-2 ring-[#22C55E] ring-offset-1" : ""
              }`}>
                {getInitials(p.userId)}
                {p.muted && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-[#64748B]">{isMe ? "You" : getDisplayName(p.userId)}</span>
            </div>
          );
        })}
      </div>

      {/* Controls (only when joined) */}
      {joined && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
              muted
                ? "text-red-600 bg-red-50 hover:bg-red-100 border border-red-200"
                : "text-[#475569] bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0]"
            }`}
          >
            {muted ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
            {muted ? "Unmute" : "Mute"}
          </button>

          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
