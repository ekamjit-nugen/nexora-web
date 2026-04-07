"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { QualityLevel } from "@/lib/hooks/useCallQuality";

interface CallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isRecording: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  isBlurEnabled?: boolean;
  onToggleAudio: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
  onToggleRecording: () => void;
  onToggleScreenShare: () => void;
  onToggleFullscreen: () => void;
  onToggleBlur?: () => void;
  onAddParticipant: () => void;
  onEndCall: () => void;
  isOnHold?: boolean;
  onToggleHold?: () => void;
  duration?: number;
  /** Connection quality indicator */
  connectionQuality?: QualityLevel;
  /** Reference to the remote video element for PIP */
  remoteVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isRecording,
  isScreenSharing,
  isFullscreen,
  isBlurEnabled = false,
  onToggleAudio,
  onToggleVideo,
  onToggleRecording,
  onToggleScreenShare,
  onToggleFullscreen,
  onToggleBlur,
  onAddParticipant,
  onEndCall,
  isOnHold = false,
  onToggleHold,
  duration,
  connectionQuality,
  remoteVideoRef,
}: CallControlsProps) {
  // ── Call Duration Timer ──
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If a duration prop is provided externally, use it instead
    if (typeof duration === "number") {
      setElapsed(duration);
      return;
    }
    // Otherwise, run a local timer
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [duration]);

  // ── Picture-in-Picture ──
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);

  useEffect(() => {
    setIsPipSupported(
      typeof document !== "undefined" && !!document.pictureInPictureEnabled
    );
  }, []);

  // Listen for PIP enter/leave events on the remote video element
  useEffect(() => {
    const videoEl = remoteVideoRef?.current;
    if (!videoEl) return;
    const onEnter = () => setIsPipActive(true);
    const onLeave = () => setIsPipActive(false);
    videoEl.addEventListener("enterpictureinpicture", onEnter);
    videoEl.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      videoEl.removeEventListener("enterpictureinpicture", onEnter);
      videoEl.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [remoteVideoRef]);

  const togglePip = useCallback(async () => {
    try {
      if (isPipActive) {
        await document.exitPictureInPicture();
      } else {
        const videoEl = remoteVideoRef?.current;
        if (videoEl) {
          await videoEl.requestPictureInPicture();
        }
      }
    } catch (err) {
      console.error("PIP toggle failed:", err);
    }
  }, [isPipActive, remoteVideoRef]);
  const btnBase = "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200";
  const btnActive = "bg-white/10 text-white hover:bg-white/20";
  const btnOff = "bg-red-500/20 text-red-400 hover:bg-red-500/30";

  const qualityColor = connectionQuality === "good" ? "bg-green-500" : connectionQuality === "acceptable" ? "bg-yellow-500" : connectionQuality === "poor" ? "bg-red-500" : "bg-gray-500";
  const qualityLabel = connectionQuality === "good" ? "Good connection" : connectionQuality === "acceptable" ? "Unstable connection" : connectionQuality === "poor" ? "Poor connection" : "Unknown";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Call Duration Timer */}
      <div className="text-white text-sm font-mono tracking-wide">
        {formatDuration(typeof duration === "number" ? duration : elapsed)}
      </div>

      <div className="flex items-center gap-3" role="toolbar" aria-label="Call controls">
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
        aria-label="Toggle microphone"
        aria-pressed={isAudioEnabled}
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
        aria-label="Toggle camera"
        aria-pressed={isVideoEnabled}
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
        aria-label="Share screen"
        aria-pressed={isScreenSharing}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
        </svg>
      </button>

      {/* Blur / Privacy Mode */}
      {onToggleBlur && (
        <button
          onClick={onToggleBlur}
          className={`${btnBase} ${isBlurEnabled ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : btnActive}`}
          title={isBlurEnabled ? "Disable blur" : "Enable blur (Privacy Mode)"}
          aria-label="Toggle background blur"
          aria-pressed={isBlurEnabled}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isBlurEnabled ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            )}
          </svg>
        </button>
      )}

      {/* Record */}
      <button
        onClick={onToggleRecording}
        className={`${btnBase} ${isRecording ? "bg-red-500 text-white hover:bg-red-600 animate-pulse" : btnActive}`}
        title={isRecording ? "Stop recording" : "Start recording"}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
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
        aria-label="Add participant"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </button>

      {/* Hold/Resume */}
      {onToggleHold && (
        <button
          onClick={onToggleHold}
          className={`${btnBase} ${isOnHold ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : btnActive}`}
          title={isOnHold ? "Resume call" : "Hold call"}
          aria-label="Toggle hold"
          aria-pressed={isOnHold}
        >
          {isOnHold ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polygon points="5,3 19,12 5,21" fill="currentColor" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
            </svg>
          )}
        </button>
      )}

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        className={`${btnBase} ${isFullscreen ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : btnActive}`}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
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

      {/* Picture-in-Picture */}
      {isPipSupported && (
        <button
          onClick={togglePip}
          className={`${btnBase} ${isPipActive ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : btnActive}`}
          title={isPipActive ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
          aria-label="Picture in Picture"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="12" y="9" width="9" height="7" rx="1" fill={isPipActive ? "currentColor" : "none"} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* End Call */}
      <button
        onClick={onEndCall}
        className={`${btnBase} bg-red-500 hover:bg-red-600 text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)]`}
        title="End call"
        aria-label="End call"
      >
        <svg className="w-5 h-5 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </button>
      </div>
    </div>
  );
}
