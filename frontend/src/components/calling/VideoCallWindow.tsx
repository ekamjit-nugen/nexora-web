"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ReconnectionState } from "@/lib/hooks/useWebRTC";
import type { AnnotationStroke } from "@/lib/call-context";

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  isMuted?: boolean;
  isLocal?: boolean;
  muteAudio?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  label,
  isMuted = false,
  isLocal = false,
  muteAudio = false,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play?.().catch(() => {});

      const handleTrackChange = () => {
        video.play?.().catch(() => {});
      };
      stream.addEventListener("addtrack", handleTrackChange);
      stream.addEventListener("removetrack", handleTrackChange);

      return () => {
        stream.removeEventListener("addtrack", handleTrackChange);
        stream.removeEventListener("removetrack", handleTrackChange);
      };
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-gray-900",
        className,
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muteAudio || isMuted || isLocal}
        className="h-full w-full object-cover"
      />

      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded bg-black/50 px-3 py-1">
        <span className="text-xs font-medium text-white">{label}</span>
        {isMuted && (
          <div className="h-2 w-2 rounded-full bg-red-500" />
        )}
      </div>
    </div>
  );
}

// ── Floating Emoji Component ──
interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  startTime: number;
}

// Module-level constant to avoid re-injecting styles each render
const FLOAT_UP_STYLES = `
  @keyframes float-up {
    0% { transform: translateY(0) scale(1); opacity: 1; }
    50% { transform: translateY(-200px) scale(1.3); opacity: 0.8; }
    100% { transform: translateY(-400px) scale(0.8); opacity: 0; }
  }
  .animate-float-up {
    animation: float-up 3s ease-out forwards;
  }
`;

export function FloatingEmojiOverlay({ emojis }: { emojis: FloatingEmoji[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {emojis.map((e) => (
        <div
          key={e.id}
          className="absolute text-4xl animate-float-up"
          style={{
            left: `${e.x}%`,
            bottom: "10%",
          }}
        >
          {e.emoji}
        </div>
      ))}
      <style jsx>{FLOAT_UP_STYLES}</style>
    </div>
  );
}

// ── Reconnecting Overlay ──
export function ReconnectingOverlay({ state }: { state: ReconnectionState }) {
  if (state === "stable") return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="text-center">
        {state === "reconnecting" ? (
          <>
            <div className="mb-3 flex items-center justify-center gap-1">
              <div className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-lg font-semibold text-white">Reconnecting...</p>
            <p className="mt-1 text-sm text-white/60">Please wait while we restore your connection</p>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <p className="text-lg font-semibold text-white">Connection Lost</p>
            <p className="mt-1 text-sm text-white/60">Unable to reconnect. The call may have ended.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Screen Share Annotation Canvas (with remote stroke support) ──
interface AnnotationCanvasProps {
  isEnabled: boolean;
  color?: string;
  brushSize?: number;
  onClear?: () => void;
  /** Called with normalized stroke coordinates (0-1 range) for broadcast */
  onStroke?: (stroke: AnnotationStroke) => void;
}

export function AnnotationCanvas({ isEnabled, color = "#FF3B30", brushSize = 3, onClear, onStroke }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      // Preserve existing drawing when resizing
      const imgData = canvas.width > 0 && canvas.height > 0
        ? canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height)
        : null;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (imgData) {
        canvas.getContext("2d")?.putImageData(imgData, 0, 0);
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  // Normalize coordinates to 0-1 range for cross-resolution broadcast
  const normalize = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return { x: 0, y: 0 };
    return { x: x / canvas.width, y: y / canvas.height };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEnabled) return;
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !isEnabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPosRef.current) return;

    const pos = getPos(e);

    // Draw locally
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Broadcast normalized stroke
    if (onStroke) {
      const from = normalize(lastPosRef.current.x, lastPosRef.current.y);
      const to = normalize(pos.x, pos.y);
      onStroke({
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        color,
        brushSize,
      });
    }

    lastPosRef.current = pos;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Expose clearCanvas and drawRemoteStroke via ref
  useEffect(() => {
    if (canvasRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = canvasRef.current as any;
      el.__clearCanvas = clearCanvas;
      el.__drawRemoteStroke = (stroke: AnnotationStroke) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        // Denormalize coordinates
        const fromX = stroke.fromX * canvas.width;
        const fromY = stroke.fromY * canvas.height;
        const toX = stroke.toX * canvas.width;
        const toY = stroke.toY * canvas.height;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
      };
    }
  }, [clearCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0 z-30",
        isEnabled ? "cursor-crosshair" : "pointer-events-none"
      )}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
    />
  );
}

// ── Annotation Toolbar ──
interface AnnotationToolbarProps {
  isAnnotating: boolean;
  onToggle: () => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onClear: () => void;
}

export function AnnotationToolbar({
  isAnnotating,
  onToggle,
  selectedColor,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  onClear,
}: AnnotationToolbarProps) {
  const colors = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE", "#FFFFFF"];
  const sizes = [2, 4, 6, 8];

  return (
    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-40 flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-[calc(100%-1rem)]">
      <button
        onClick={onToggle}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          isAnnotating
            ? "bg-[#FF3B30] text-white shadow-lg"
            : "bg-black/50 text-white/80 hover:bg-black/70"
        )}
      >
        {isAnnotating ? "Stop Drawing" : "Draw"}
      </button>
      {isAnnotating && (
        <>
          <div className="flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-transform",
                  selectedColor === c ? "border-white scale-125" : "border-transparent hover:scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => onBrushSizeChange(s)}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded transition-colors",
                  brushSize === s ? "bg-white/20" : "hover:bg-white/10"
                )}
              >
                <span
                  className="rounded-full bg-white"
                  style={{ width: s + 2, height: s + 2 }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={onClear}
            className="px-2 py-1 bg-black/50 text-white/80 hover:bg-black/70 rounded-lg text-xs"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

// ── Main Video Call Window ──
interface ParticipantStream {
  userId: string;
  name: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isMuted?: boolean;
}

interface VideoCallWindowProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localUserName: string;
  remoteUserName: string;
  isAudioMuted: boolean;
  screenShareStream?: MediaStream | null;
  isScreenSharing?: boolean;
  isViewerAnnotating?: boolean;
  annotationColor?: string;
  annotationBrushSize?: number;
  onAnnotationToggle?: () => void;
  onAnnotationColorChange?: (color: string) => void;
  onAnnotationBrushSizeChange?: (size: number) => void;
  onAnnotationClear?: () => void;
  onAnnotationStroke?: (stroke: AnnotationStroke) => void;
  floatingEmojis?: FloatingEmoji[];
  additionalParticipants?: ParticipantStream[];
  reconnectionState?: ReconnectionState;
}

export function VideoCallWindow({
  localStream,
  remoteStream,
  localUserName,
  remoteUserName,
  isAudioMuted,
  screenShareStream,
  isScreenSharing,
  isViewerAnnotating = false,
  annotationColor = "#FF3B30",
  annotationBrushSize = 3,
  onAnnotationToggle,
  onAnnotationColorChange,
  onAnnotationBrushSizeChange,
  onAnnotationClear,
  onAnnotationStroke,
  floatingEmojis = [],
  additionalParticipants = [],
  reconnectionState = "stable",
}: VideoCallWindowProps) {
  // Build list of all participants for grid
  const allParticipants: ParticipantStream[] = [];

  // If screen sharing, show screen share as main content
  if (screenShareStream && isScreenSharing) {
    return (
      <div className="relative h-full w-full">
        {/* Reconnecting overlay */}
        <ReconnectingOverlay state={reconnectionState} />

        {/* Screen share as main view */}
        <div className="relative h-full w-full">
          <VideoTile
            stream={screenShareStream}
            label="Screen Share"
            muteAudio
            className="h-full w-full"
          />
          {/* Annotation overlay for viewers — now with broadcast support */}
          {onAnnotationToggle && (
            <>
              <AnnotationCanvas
                isEnabled={isViewerAnnotating}
                color={annotationColor}
                brushSize={annotationBrushSize}
                onStroke={onAnnotationStroke}
              />
              <AnnotationToolbar
                isAnnotating={isViewerAnnotating}
                onToggle={onAnnotationToggle}
                selectedColor={annotationColor}
                onColorChange={onAnnotationColorChange || (() => {})}
                brushSize={annotationBrushSize}
                onBrushSizeChange={onAnnotationBrushSizeChange || (() => {})}
                onClear={onAnnotationClear || (() => {})}
              />
            </>
          )}
        </div>

        {/* Participant thumbnails strip at bottom */}
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 flex gap-1.5 sm:gap-2 justify-center z-10">
          {localStream && (
            <div className="w-20 h-16 sm:w-32 sm:h-24 rounded-lg shadow-lg overflow-hidden border-2 border-white/20">
              <VideoTile
                stream={localStream}
                label={localUserName}
                isLocal
                isMuted={isAudioMuted}
                className="h-full w-full"
              />
            </div>
          )}
          {remoteStream && (
            <div className="w-20 h-16 sm:w-32 sm:h-24 rounded-lg shadow-lg overflow-hidden border-2 border-white/20">
              <VideoTile
                stream={remoteStream}
                label={remoteUserName}
                muteAudio
                className="h-full w-full"
              />
            </div>
          )}
          {additionalParticipants.map((p) => (
            <div key={p.userId} className="w-20 h-16 sm:w-32 sm:h-24 rounded-lg shadow-lg overflow-hidden border-2 border-white/20">
              <VideoTile
                stream={p.stream}
                label={p.name}
                isLocal={p.isLocal}
                isMuted={p.isMuted}
                muteAudio={!p.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

        {/* Floating emojis */}
        <FloatingEmojiOverlay emojis={floatingEmojis} />
      </div>
    );
  }

  // Normal call: build participant grid
  if (remoteStream) {
    allParticipants.push({ userId: "remote", name: remoteUserName, stream: remoteStream, isMuted: false });
  }
  additionalParticipants.forEach((p) => allParticipants.push(p));
  if (localStream) {
    allParticipants.push({ userId: "local", name: localUserName, stream: localStream, isLocal: true, isMuted: isAudioMuted });
  }

  const totalParticipants = allParticipants.length;

  // Calculate grid layout - responsive: single column on mobile, multi-col on larger screens
  const getGridClass = () => {
    if (totalParticipants <= 1) return "grid-cols-1 grid-rows-1";
    if (totalParticipants === 2) return "grid-cols-1 sm:grid-cols-2 grid-rows-1";
    if (totalParticipants <= 4) return "grid-cols-1 sm:grid-cols-2 grid-rows-2";
    if (totalParticipants <= 6) return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 grid-rows-2";
    if (totalParticipants <= 9) return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 grid-rows-3";
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 grid-rows-3";
  };

  // If only 1 remote + local, use the classic PIP layout
  if (totalParticipants === 2 && additionalParticipants.length === 0) {
    return (
      <div className="relative h-full w-full">
        {/* Reconnecting overlay */}
        <ReconnectingOverlay state={reconnectionState} />

        {remoteStream ? (
          <VideoTile
            stream={remoteStream}
            label={remoteUserName}
            muteAudio
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-blue-900 to-blue-700">
            <div className="text-center">
              <div className="mb-4 text-5xl">
                <span role="img" aria-label="user">&#128100;</span>
              </div>
              <p className="text-lg font-semibold text-white">{remoteUserName}</p>
              <p className="text-sm text-blue-200">Connecting...</p>
            </div>
          </div>
        )}

        {localStream && (
          <div className="absolute bottom-3 right-3 h-20 w-20 sm:h-32 sm:w-32 rounded-lg shadow-lg border-2 border-white/20">
            <VideoTile
              stream={localStream}
              label={localUserName}
              isLocal
              isMuted={isAudioMuted}
              className="h-full w-full"
            />
          </div>
        )}

        <FloatingEmojiOverlay emojis={floatingEmojis} />
      </div>
    );
  }

  // Grid layout for 3+ participants
  return (
    <div className="relative h-full w-full p-2">
      {/* Reconnecting overlay */}
      <ReconnectingOverlay state={reconnectionState} />

      <div className={`grid ${getGridClass()} gap-2 h-full w-full`}>
        {allParticipants.map((p) => (
          <VideoTile
            key={p.userId}
            stream={p.stream}
            label={p.name}
            isLocal={p.isLocal}
            isMuted={p.isMuted}
            muteAudio={p.isLocal || p.userId !== "local"}
            className="h-full w-full"
          />
        ))}
      </div>
      <FloatingEmojiOverlay emojis={floatingEmojis} />
    </div>
  );
}
