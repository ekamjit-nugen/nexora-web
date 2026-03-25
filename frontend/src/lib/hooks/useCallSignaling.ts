"use client";

import { useCallback, useState, useEffect } from "react";
import { useSocket } from "@/lib/use-socket";
import { API_BASE_URL } from "@/lib/api";

const CALL_SOCKET_URL =
  process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://localhost:3051";

export interface Call {
  callId: string;
  initiatorId: string;
  recipientId: string;
  type: "audio" | "video";
  status: "initiated" | "ringing" | "connected" | "ended" | "rejected" | "missed";
  conversationId?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

interface UseCallSignalingReturn {
  call: Call | null;
  isRinging: boolean;
  connected: boolean;
  initiateCall: (recipientId: string, type: "audio" | "video", conversationId?: string) => Promise<string | null>;
  answerCall: (audioEnabled: boolean, videoEnabled: boolean) => Promise<void>;
  rejectCall: (reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  sendOffer: (sdp: RTCSessionDescriptionInit) => void;
  sendAnswer: (sdp: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (candidate: RTCIceCandidate) => void;
  onEnded: (handler: (data: any) => void) => () => void;
  onOffer: (handler: (data: any) => void) => () => void;
  onAnswerSdp: (handler: (data: any) => void) => () => void;
  onIceCandidate: (handler: (data: any) => void) => () => void;
}

export function useCallSignaling(): UseCallSignalingReturn {
  const { socket, connected, emit, on, off } = useSocket({
    namespace: "/calls",
    enabled: true,
    baseUrl: CALL_SOCKET_URL,
  });
  const [call, setCall] = useState<Call | null>(null);
  const [isRinging, setIsRinging] = useState(false);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribe = on("call:incoming", (data: any) => {
      setCall({
        callId: data.callId,
        initiatorId: data.initiatorId,
        recipientId: "", // Current user
        type: data.type,
        status: "ringing",
        conversationId: data.conversationId,
      });
      setIsRinging(true);
    });

    return unsubscribe;
  }, [socket, connected, on]);

  // Listen for call connected
  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribe = on("call:connected", (data: any) => {
      setCall((prev) =>
        prev ? { ...prev, status: "connected", startTime: new Date() } : null,
      );
      setIsRinging(false);
    });

    return unsubscribe;
  }, [socket, connected, on]);

  // Listen for rejected calls
  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribe = on("call:rejected", (data: any) => {
      setCall((prev) =>
        prev
          ? {
              ...prev,
              status: "rejected",
              endTime: new Date(),
            }
          : null,
      );
      setIsRinging(false);
    });

    return unsubscribe;
  }, [socket, connected, on]);

  // Listen for ended calls
  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribe = on("call:ended", (data: any) => {
      setCall((prev) =>
        prev
          ? {
              ...prev,
              status: "ended",
              endTime: new Date(),
              duration: data.duration,
            }
          : null,
      );
      setIsRinging(false);
    });

    return unsubscribe;
  }, [socket, connected, on]);

  const initiateCall = useCallback(
    async (recipientId: string, type: "audio" | "video", conversationId?: string): Promise<string | null> => {
      if (!socket || !connected) return null;

      try {
        const callId = await new Promise<string | null>((resolve) => {
          const unsubscribe = on("call:initiated", (data: any) => {
            unsubscribe();
            if (!data?.callId) {
              resolve(null);
              return;
            }

            setCall({
              callId: data.callId,
              initiatorId: "", // Current user
              recipientId,
              type,
              status: "initiated",
            });

            resolve(data.callId);
          });

          emit("call:initiate", { recipientId, type, conversationId });

          // Fallback timeout to avoid hanging if server doesn't respond
          setTimeout(() => {
            unsubscribe();
            resolve(null);
          }, 8000);
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
        emit("call:answer", {
          callId: call.callId,
          audioEnabled,
          videoEnabled,
        });
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
    if (callId) {
      emit("call:end", { callId });
    }

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

  const onEnded = useCallback((handler: (data: any) => void) => on("call:ended", handler), [on]);
  const onOffer = useCallback((handler: (data: any) => void) => on("call:offer", handler), [on]);
  const onAnswerSdp = useCallback((handler: (data: any) => void) => on("call:answer-sdp", handler), [on]);
  const onIceCandidate = useCallback((handler: (data: any) => void) => on("call:ice-candidate", handler), [on]);

  return {
    call,
    isRinging,
    connected,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    onEnded,
    onOffer,
    onAnswerSdp,
    onIceCandidate,
  };
}
