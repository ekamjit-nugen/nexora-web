"use client";

import React from "react";
import type { QualityLevel } from "@/lib/hooks/useCallQuality";

interface CallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isRecording: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  onToggleAudio: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
  onToggleRecording: () => void;
  onToggleScreenShare: () => void;
  onToggleFullscreen: () => void;
  onAddParticipant: () => void;
  onEndCall: () => void;
  duration?: number;
  /** Connection quality indicator */
  connectionQuality?: QualityLevel;
}

export function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isRecording,
  isScreenSharing,
  isFullscreen,
  onToggleAudio,
  onToggleVideo,
  onToggleRecording,
  onToggleScreenShare,
  onToggleFullscreen,
  onAddParticipant,
  onEndCall,
  connectionQuality,
}: CallControlsProps) {
  const btnBase = "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200";
  const btnActive = "bg-white/10 text-white hover:bg-white/20";
  const btnOff = "bg-red-500/20 text-red-400 hover:bg-red-500/30";

  const qualityColor = connectionQuality === "good" ? "bg-green-500" : connectionQuality === "acceptable" ? "bg-yellow-500" : connectionQuality === "poor" ? "bg-red-500" : "bg-gray-500";
  const qualityLabel = connectionQuality === "good" ? "Good connection" : connectionQuality === "acceptable" ? "Unstable connection" : connectionQuality === "poor" ? "Poor connection" : "Unknown";

  return (
    <div className="flex items-center gap-3">
      {/* Connection Quality Indicator */}
      {connectionQuality && (
        <div className="flex items-center gap-1.5 mr-1" title={qualityLabel}>
          <div className="flex items-end gap-0.5 h-4">
            <div className={`w-1 h-1.5 rounded-sm ${qualityColor}`} />
            <div className={`w-1 h-2.5 rounded-sm ${connectionQuality !== "poor" ? qualityColor : "bg-gray-600"}`} />
            <div className={`w-1 h-3.5 rounded-sm ${connectionQuality === "good" ? qualityColor : "bg-gray-600"}`} />
          </div>
        </div>
      )}

      {/* Mic */}
      <button
        onClick={() => onToggleAudio(!isAudioEnabled)}
        className={`${btnBase} ${isAudioEnabled ? btnActive : btnOff}`}
        title={isAudioEnabled ? "Mute" : "Unmute"}
      >
        {isAudioEnabled ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Video */}
      <button
        onClick={() => onToggleVideo(!isVideoEnabled)}
        className={`${btnBase} ${isVideoEnabled ? btnActive : btnOff}`}
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Screen Share */}
      <button
        onClick={onToggleScreenShare}
        className={`${btnBase} ${isScreenSharing ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : btnActive}`}
        title={isScreenSharing ? "Stop sharing" : "Share screen"}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
        </svg>
      </button>

      {/* Record */}
      <button
        onClick={onToggleRecording}
        className={`${btnBase} ${isRecording ? "bg-red-500 text-white hover:bg-red-600 animate-pulse" : btnActive}`}
        title={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Add Participant */}
      <button
        onClick={onAddParticipant}
        className={`${btnBase} ${btnActive}`}
        title="Add participant"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </button>

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        className={`${btnBase} ${isFullscreen ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : btnActive}`}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        )}
      </button>

      {/* End Call */}
      <button
        onClick={onEndCall}
        className={`${btnBase} bg-red-500 hover:bg-red-600 text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)]`}
        title="End call"
      >
        <svg className="w-5 h-5 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </button>
    </div>
  );
}
