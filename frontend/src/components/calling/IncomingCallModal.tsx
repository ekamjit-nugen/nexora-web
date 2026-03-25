"use client";

import React from "react";

interface IncomingCallModalProps {
  callerName: string;
  callType: "audio" | "video";
  onAnswer: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

export function IncomingCallModal({
  callerName,
  callType,
  onAnswer,
  onReject,
  isLoading = false,
}: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-gradient-to-b from-[#0F172A] to-[#1E293B] rounded-3xl p-8 shadow-2xl w-80 border border-[#334155]">
        <div className="text-center">
          {/* Animated avatar with initials */}
          <div className="relative mx-auto mb-5">
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-[#22C55E]/20 animate-ping mx-auto" style={{ animationDuration: "1.5s" }} />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center text-white text-2xl font-bold mx-auto shadow-[0_0_40px_rgba(34,197,94,0.3)]">
              {getInitials(callerName)}
            </div>
          </div>

          <p className="text-white text-lg font-semibold">{callerName}</p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <span className="text-[#94A3B8] text-sm">
              {callType === "video" ? "Video call" : "Audio call"}
            </span>
            <span className="flex gap-0.5 ml-1">
              <span className="w-1 h-1 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
              <span className="w-1 h-1 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "400ms" }} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 mt-8">
          <button
            onClick={onReject}
            disabled={isLoading}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-red-500/30 disabled:opacity-50"
            title="Decline"
          >
            <svg className="w-6 h-6 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button
            onClick={onAnswer}
            disabled={isLoading}
            className="w-14 h-14 rounded-full bg-[#22C55E] hover:bg-[#16A34A] flex items-center justify-center text-white transition-colors shadow-lg shadow-green-500/30 disabled:opacity-50"
            title="Answer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
