"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CALL_SOCKET_URL =
  process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://localhost:3051";

interface HuddleParticipant {
  userId: string;
  name: string;
}

interface HuddleState {
  channelId: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  sfuRoomId: string;
}

interface VoiceHuddleProps {
  channelId: string;
  currentUserId: string;
  currentUserName: string;
}

export function VoiceHuddle({ channelId, currentUserId, currentUserName }: VoiceHuddleProps) {
  const [huddle, setHuddle] = useState<HuddleState | null>(null);
  const [isInHuddle, setIsInHuddle] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const socketRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Connect to calling service websocket for huddle events
  useEffect(() => {
    let socket: any = null;

    async function connectSocket() {
      try {
        const { io } = await import("socket.io-client");
        const token = localStorage.getItem("accessToken");
        socket = io(`${CALL_SOCKET_URL}/calls`, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          // Request current huddle state for this channel
          socket.emit("huddle:get", { channelId });
        });

        socket.on("huddle:state", (data: HuddleState | null) => {
          if (data && data.channelId === channelId) {
            setHuddle(data);
            setIsInHuddle(data.participantIds.includes(currentUserId));
          } else {
            setHuddle(null);
            setIsInHuddle(false);
          }
        });

        socket.on("huddle:started", (data: HuddleState) => {
          if (data.channelId === channelId) {
            setHuddle(data);
            if (data.participantIds.includes(currentUserId)) {
              setIsInHuddle(true);
            }
          }
        });

        socket.on("huddle:joined", (data: { channelId: string; userId: string; userName: string; huddle: HuddleState }) => {
          if (data.channelId === channelId) {
            setHuddle(data.huddle);
            if (data.userId === currentUserId) {
              setIsInHuddle(true);
            }
          }
        });

        socket.on("huddle:left", (data: { channelId: string; userId: string; huddle: HuddleState | null }) => {
          if (data.channelId === channelId) {
            if (data.huddle) {
              setHuddle(data.huddle);
            } else {
              // Huddle ended (last person left)
              setHuddle(null);
            }
            if (data.userId === currentUserId) {
              setIsInHuddle(false);
            }
          }
        });

        socket.on("huddle:ended", (data: { channelId: string }) => {
          if (data.channelId === channelId) {
            setHuddle(null);
            setIsInHuddle(false);
          }
        });
      } catch {
        // Socket connection failed — silent fallback
      }
    }

    connectSocket();

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [channelId, currentUserId]);

  const handleStartHuddle = useCallback(async () => {
    if (!socketRef.current || loading) return;
    setLoading(true);
    try {
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      socketRef.current.emit("huddle:start", {
        channelId,
        userName: currentUserName,
      });
      setIsInHuddle(true);
      setIsMuted(false);
    } catch {
      // Mic permission denied
    } finally {
      setLoading(false);
    }
  }, [channelId, currentUserName, loading]);

  const handleJoinHuddle = useCallback(async () => {
    if (!socketRef.current || loading) return;
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      socketRef.current.emit("huddle:join", {
        channelId,
        userName: currentUserName,
      });
      setIsInHuddle(true);
      setIsMuted(false);
    } catch {
      // Mic permission denied
    } finally {
      setLoading(false);
    }
  }, [channelId, currentUserName, loading]);

  const handleLeaveHuddle = useCallback(() => {
    if (!socketRef.current) return;

    // Stop audio stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    socketRef.current.emit("huddle:leave", { channelId });
    setIsInHuddle(false);
    setIsMuted(false);
    setShowParticipants(false);
  }, [channelId]);

  const handleToggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = isMuted; // toggle: if muted, enable; if unmuted, disable
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const participants: HuddleParticipant[] = huddle
    ? huddle.participantIds.map((id) => ({
        userId: id,
        name: huddle.participantNames[id] || "Unknown",
      }))
    : [];

  // No huddle active — show start button
  if (!huddle) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <button
          onClick={handleStartHuddle}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#475569] hover:text-[#2E86C1] hover:bg-[#EBF5FF] rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          Start a Huddle
        </button>
      </div>
    );
  }

  // Huddle active, user NOT in it
  if (!isInHuddle) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border-t border-[#E2E8F0] bg-[#F0FFF4]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
          </div>
          {/* Participant avatars */}
          <div className="flex -space-x-1.5">
            {participants.slice(0, 4).map((p) => (
              <div
                key={p.userId}
                className="w-6 h-6 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white"
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {participants.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-[#94A3B8] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white">
                +{participants.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-[#475569] truncate">
            {participants.length} in huddle
          </span>
        </div>
        <button
          onClick={handleJoinHuddle}
          disabled={loading}
          className="px-3 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          Join
        </button>
      </div>
    );
  }

  // User IS in the huddle
  return (
    <div className="border-t border-[#E2E8F0] bg-[#F0FFF4]">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-medium text-green-700">In Huddle</span>
          {/* Participant avatars */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex -space-x-1.5 hover:opacity-80 transition-opacity"
          >
            {participants.slice(0, 4).map((p) => (
              <div
                key={p.userId}
                className="w-6 h-6 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white"
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {participants.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-[#94A3B8] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white">
                +{participants.length - 4}
              </div>
            )}
          </button>
          <span className="text-[10px] text-[#64748B]">{participants.length}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mic toggle */}
          <button
            onClick={handleToggleMute}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-100 text-red-500 hover:bg-red-200" : "bg-white text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]"}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Leave button */}
          <button
            onClick={handleLeaveHuddle}
            className="w-8 h-8 rounded-full bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center transition-colors"
            title="Leave huddle"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded participant list */}
      {showParticipants && (
        <div className="px-3 pb-2 border-t border-[#E2E8F0]/60">
          <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide py-1.5">Participants</p>
          <div className="space-y-1">
            {participants.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 py-1">
                <div className="w-5 h-5 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[8px] font-bold">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-[#334155] truncate">
                  {p.name}
                  {p.userId === currentUserId && <span className="text-[#94A3B8] ml-1">(you)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
