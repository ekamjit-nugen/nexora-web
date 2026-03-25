"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCallContext } from "@/lib/call-context";
import { IncomingCallModal } from "./IncomingCallModal";
import { hrApi } from "@/lib/api";

/**
 * Global component rendered in root layout.
 * Listens for incoming calls on ANY page and shows the incoming call modal.
 * When answered, navigates to /messages so the call window can open.
 */
export function GlobalIncomingCall() {
  const { call, isRinging, answerCall, rejectCall } = useCallContext();
  const router = useRouter();
  const [callerName, setCallerName] = useState("Unknown");

  // Resolve caller name — prefer name from socket event, fallback to employee directory
  useEffect(() => {
    if (!call?.initiatorId || !isRinging) return;

    // Use name sent directly in the call event
    if (call.initiatorName) {
      setCallerName(call.initiatorName);
      return;
    }

    // Fallback: look up from employee directory
    const resolve = async () => {
      try {
        const res = await hrApi.getEmployees({ limit: "100" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emp = (res.data || []).find((e: any) => e.userId === call.initiatorId);
        if (emp) {
          setCallerName(`${emp.firstName} ${emp.lastName}`);
        } else {
          setCallerName(call.initiatorId.slice(-6));
        }
      } catch {
        setCallerName(call.initiatorId.slice(-6));
      }
    };
    resolve();
  }, [call?.initiatorId, call?.initiatorName, isRinging]);

  const handleAnswer = useCallback(async () => {
    await answerCall(true, false);
    // Navigate to messages page so the call UI can take over
    // Store the conversation ID so messages page can activate it
    if (call?.conversationId) {
      localStorage.setItem("nexora_active_chat", call.conversationId);
    }
    router.push("/messages");
  }, [answerCall, call?.conversationId, router]);

  const handleReject = useCallback(() => {
    rejectCall("User declined");
    setCallerName("Unknown");
  }, [rejectCall]);

  if (!isRinging || !call) return null;

  return (
    <IncomingCallModal
      callerName={callerName}
      callType={call.type}
      onAnswer={handleAnswer}
      onReject={handleReject}
    />
  );
}
