"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { useSocket } from "@/lib/use-socket";
import { API_BASE_URL } from "@/lib/api";

const CALL_SOCKET_URL =
  process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://localhost:3051";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Call {
  callId: string;
  initiatorId: string;
  initiatorName?: string;
  recipientId: string;
  type: "audio" | "video";
  status: "initiated" | "ringing" | "connected" | "ended" | "rejected" | "missed";
  conversationId?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export interface AnnotationStroke {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  brushSize: number;
}

interface CallContextState {
  call: Call | null;
  isRinging: boolean;
  connected: boolean;
  initiateCall: (recipientId: string, type: "audio" | "video", conversationId?: string) => Promise<string | null>;
  answerCall: (audioEnabled: boolean, videoEnabled: boolean) => Promise<void>;
  rejectCall: (reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  inviteToCall: (userId: string) => void;
  sendOffer: (sdp: RTCSessionDescriptionInit) => void;
  sendAnswer: (sdp: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (candidate: RTCIceCandidate) => void;
  sendAnnotationStroke: (stroke: AnnotationStroke) => void;
  sendAnnotationClear: () => void;
  onEnded: (handler: (data: any) => void) => () => void;
  onOffer: (handler: (data: any) => void) => () => void;
  onAnswerSdp: (handler: (data: any) => void) => () => void;
  onIceCandidate: (handler: (data: any) => void) => () => void;
  onAnnotationStroke: (handler: (data: AnnotationStroke & { from: string }) => void) => () => void;
  onAnnotationClear: (handler: (data: { from: string }) => void) => () => void;
}

const CallContext = createContext<CallContextState | undefined>(undefined);

// ── Professional ringtone generators ──
function createIncomingRingtone(ctx: AudioContext, gainNode: GainNode): { start: () => void; stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null;
  let oscillators: OscillatorNode[] = [];

  const playRingBurst = () => {
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gain1.gain.linearRampToValueAtTime(0, now + 0.2);
    osc1.connect(gain1).connect(gainNode);
    osc1.start(now);
    osc1.stop(now + 0.2);
    oscillators.push(osc1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.25); // E5
    gain2.gain.setValueAtTime(0, now + 0.25);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.27);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.42);
    gain2.gain.linearRampToValueAtTime(0, now + 0.47);
    osc2.connect(gain2).connect(gainNode);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.47);
    oscillators.push(osc2);

    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(783.99, now + 0.5); // G5
    gain3.gain.setValueAtTime(0, now + 0.5);
    gain3.gain.linearRampToValueAtTime(0.10, now + 0.52);
    gain3.gain.linearRampToValueAtTime(0.10, now + 0.8);
    gain3.gain.linearRampToValueAtTime(0, now + 0.9);
    osc3.connect(gain3).connect(gainNode);
    osc3.start(now + 0.5);
    osc3.stop(now + 0.9);
    oscillators.push(osc3);
  };

  return {
    start: () => {
      playRingBurst();
      intervalId = setInterval(playRingBurst, 2000);
    },
    stop: () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      oscillators.forEach((o) => { try { o.stop(); o.disconnect(); } catch {} });
      oscillators = [];
    },
  };
}

function createOutgoingRingback(ctx: AudioContext, gainNode: GainNode): { start: () => void; stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null;
  let oscillators: OscillatorNode[] = [];

  const playRingback = () => {
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.value = 440;
    osc2.type = "sine";
    osc2.frequency.value = 480;

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.05);
    gain1.gain.setValueAtTime(0.06, now + 1.9);
    gain1.gain.linearRampToValueAtTime(0, now + 2.0);

    osc1.connect(gain1);
    osc2.connect(gain1);
    gain1.connect(gainNode);

    osc1.start(now);
    osc1.stop(now + 2.0);
    osc2.start(now);
    osc2.stop(now + 2.0);

    oscillators.push(osc1, osc2);
  };

  return {
    start: () => {
      playRingback();
      intervalId = setInterval(playRingback, 4000);
    },
    stop: () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      oscillators.forEach((o) => { try { o.stop(); o.disconnect(); } catch {} });
      oscillators = [];
    },
  };
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket, connected, emit, on, off } = useSocket({
    namespace: "/calls",
    enabled: true,
    baseUrl: CALL_SOCKET_URL,
  });

  const [call, setCall] = useState<Call | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const callRef = useRef<Call | null>(null);

  // Keep callRef in sync
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  // Ringtone refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const ringtoneRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // ── Ringtone management ──
  const startRingtone = useCallback((type: "incoming" | "outgoing") => {
    stopRingtone();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    gain.connect(ctx.destination);

    audioCtxRef.current = ctx;
    masterGainRef.current = gain;

    const tone = type === "incoming"
      ? createIncomingRingtone(ctx, gain)
      : createOutgoingRingback(ctx, gain);

    ringtoneRef.current = tone;
    tone.start();
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    masterGainRef.current = null;
  }, []);

  // ── Socket event listeners ──
  useEffect(() => {
    if (!socket || !connected) return;

    const unsub1 = on("call:incoming", (data: any) => {
      setCall({
        callId: data.callId,
        initiatorId: data.initiatorId,
        initiatorName: data.initiatorName || "",
        recipientId: "",
        type: data.type,
        status: "ringing",
        conversationId: data.conversationId,
      });
      setIsRinging(true);
    });

    const unsub2 = on("call:connected", () => {
      setCall((prev) =>
        prev ? { ...prev, status: "connected", startTime: new Date() } : null,
      );
      setIsRinging(false);
    });

    const unsub3 = on("call:rejected", () => {
      setCall((prev) =>
        prev ? { ...prev, status: "rejected", endTime: new Date() } : null,
      );
      setIsRinging(false);
    });

    const unsub4 = on("call:ended", (data: any) => {
      setCall((prev) =>
        prev ? { ...prev, status: "ended", endTime: new Date(), duration: data.duration } : null,
      );
      setIsRinging(false);
    });

    // Dismissed: call was answered/rejected from another tab
    const unsub5 = on("call:dismissed", () => {
      setCall(null);
      setIsRinging(false);
    });

    // Already answered: tried to answer but another tab already did
    const unsub6 = on("call:already-answered", () => {
      setCall(null);
      setIsRinging(false);
    });

    // Missed: ringing timed out
    const unsub7 = on("call:missed", () => {
      setCall((prev) =>
        prev ? { ...prev, status: "missed", endTime: new Date() } : null,
      );
      setIsRinging(false);
    });

    // Reconnection: re-join the call room after socket reconnect
    const unsubReconnect = on("connect", () => {
      const currentCall = callRef.current;
      if (currentCall && currentCall.status === "connected") {
        emit("call:rejoin", { callId: currentCall.callId });
      }
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
      unsub7();
      unsubReconnect();
    };
  }, [socket, connected, on, emit]);

  // ── Auto-play ringtone based on call state ──
  useEffect(() => {
    const status = call?.status;
    if (status === "ringing") {
      startRingtone("incoming");
    } else if (status === "initiated") {
      startRingtone("outgoing");
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [call?.status, startRingtone, stopRingtone]);

  // ── Call actions ──
  const initiateCall = useCallback(
    async (recipientId: string, type: "audio" | "video", conversationId?: string): Promise<string | null> => {
      if (!socket || !connected) return null;
      try {
        const callId = await new Promise<string | null>((resolve) => {
          const unsubscribe = on("call:initiated", (data: any) => {
            unsubscribe();
            if (!data?.callId) { resolve(null); return; }
            setCall({
              callId: data.callId,
              initiatorId: "",
              recipientId,
              type,
              status: "initiated",
              conversationId,
            });
            resolve(data.callId);
          });
          emit("call:initiate", { recipientId, type, conversationId });
          setTimeout(() => { unsubscribe(); resolve(null); }, 8000);
        });
        return callId;
      } catch (err) {
        console.error("Error initiating call:", err);
        return null;
      }
    },
    [emit, on, connected, socket],
  );

  const answerCall = useCallback(
    async (audioEnabled: boolean = true, videoEnabled: boolean = false) => {
      if (!call) return;
      try {
        emit("call:answer", { callId: call.callId, audioEnabled, videoEnabled });
        setCall((prev) =>
          prev ? { ...prev, status: "connected", startTime: new Date() } : null,
        );
        setIsRinging(false);
        await fetch(`${API_BASE_URL}/api/v1/calls/${call.callId}/answer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({ audioEnabled, videoEnabled }),
        });
      } catch (err) {
        console.error("Error answering call:", err);
      }
    },
    [call, emit],
  );

  const rejectCall = useCallback(
    async (reason?: string) => {
      if (!call) return;
      try {
        emit("call:reject", { callId: call.callId, reason });
        await fetch(`${API_BASE_URL}/api/v1/calls/${call.callId}/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({ reason }),
        });
        setCall(null);
        setIsRinging(false);
      } catch (err) {
        console.error("Error rejecting call:", err);
      }
    },
    [call, emit],
  );

  const endCall = useCallback(async () => {
    const callId = call?.callId;
    if (callId) emit("call:end", { callId });
    try {
      if (!callId) return;
      await fetch(`${API_BASE_URL}/api/v1/calls/${callId}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });
    } catch (err) {
      console.error("Error ending call:", err);
    } finally {
      setCall(null);
      setIsRinging(false);
    }
  }, [call, emit]);

  const inviteToCall = useCallback(
    (userId: string) => {
      if (!call) return;
      emit("call:invite", { callId: call.callId, userId });
    },
    [call, emit],
  );

  const sendOffer = useCallback(
    (sdp: RTCSessionDescriptionInit) => {
      if (!call) return;
      emit("call:offer", { callId: call.callId, sdp: sdp.sdp, type: "offer" });
    },
    [call, emit],
  );

  const sendAnswer = useCallback(
    (sdp: RTCSessionDescriptionInit) => {
      if (!call) return;
      emit("call:answer-sdp", { callId: call.callId, sdp: sdp.sdp, type: "answer" });
    },
    [call, emit],
  );

  const sendIceCandidate = useCallback(
    (candidate: RTCIceCandidate) => {
      if (!call || !candidate.candidate) return;
      emit("call:ice-candidate", {
        callId: call.callId,
        candidate: candidate.candidate,
        sdpMLineIndex: candidate.sdpMLineIndex,
        sdpMid: candidate.sdpMid,
      });
    },
    [call, emit],
  );

  // ── Annotation broadcast ──
  const sendAnnotationStroke = useCallback(
    (stroke: AnnotationStroke) => {
      if (!call) return;
      emit("call:annotation-stroke", { callId: call.callId, stroke });
    },
    [call, emit],
  );

  const sendAnnotationClear = useCallback(() => {
    if (!call) return;
    emit("call:annotation-clear", { callId: call.callId });
  }, [call, emit]);

  const onEnded = useCallback((handler: (data: any) => void) => on("call:ended", handler), [on]);
  const onOffer = useCallback((handler: (data: any) => void) => on("call:offer", handler), [on]);
  const onAnswerSdp = useCallback((handler: (data: any) => void) => on("call:answer-sdp", handler), [on]);
  const onIceCandidate = useCallback((handler: (data: any) => void) => on("call:ice-candidate", handler), [on]);
  const onAnnotationStroke = useCallback((handler: (data: AnnotationStroke & { from: string }) => void) => on("call:annotation-stroke", handler), [on]);
  const onAnnotationClear = useCallback((handler: (data: { from: string }) => void) => on("call:annotation-clear", handler), [on]);

  return (
    <CallContext.Provider
      value={{
        call,
        isRinging,
        connected,
        initiateCall,
        answerCall,
        rejectCall,
        endCall,
        inviteToCall,
        sendOffer,
        sendAnswer,
        sendIceCandidate,
        sendAnnotationStroke,
        sendAnnotationClear,
        onEnded,
        onOffer,
        onAnswerSdp,
        onIceCandidate,
        onAnnotationStroke,
        onAnnotationClear,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}
