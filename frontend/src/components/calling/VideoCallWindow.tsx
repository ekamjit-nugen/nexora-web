"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

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
      <style jsx>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-200px) scale(1.3); opacity: 0.8; }
          100% { transform: translateY(-400px) scale(0.8); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// ── Screen Share Annotation Canvas ──
interface AnnotationCanvasProps {
  isEnabled: boolean;
  color?: string;
  brushSize?: number;
  onClear?: () => void;
}

export function AnnotationCanvas({ isEnabled, color = "#FF3B30", brushSize = 3, onClear }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Clear canvas when onClear changes
  useEffect(() => {
    if (!onClear) return;
  }, [onClear]);

  const getPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEnabled) return;
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingRef.current || !isEnabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPosRef.current) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const handleMouseUp = () => {
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

  // Expose clearCanvas
  useEffect(() => {
    if (canvasRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvasRef.current as any).__clearCanvas = clearCanvas;
    }
  }, [clearCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0 z-30",
        isEnabled ? "cursor-crosshair" : "pointer-events-none"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
    <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
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
  floatingEmojis?: FloatingEmoji[];
  additionalParticipants?: ParticipantStream[];
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
  floatingEmojis = [],
  additionalParticipants = [],
}: VideoCallWindowProps) {
  // Build list of all participants for grid
  const allParticipants: ParticipantStream[] = [];

  // If screen sharing, show screen share as main content
  if (screenShareStream && isScreenSharing) {
    return (
      <div className="relative h-full w-full">
        {/* Screen share as main view */}
        <div className="relative h-full w-full">
          <VideoTile
            stream={screenShareStream}
            label="Screen Share"
            muteAudio
            className="h-full w-full"
          />
          {/* Annotation overlay for viewers */}
          {onAnnotationToggle && (
            <>
              <AnnotationCanvas
                isEnabled={isViewerAnnotating}
                color={annotationColor}
                brushSize={annotationBrushSize}
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
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 justify-center z-10">
          {localStream && (
            <div className="w-32 h-24 rounded-lg shadow-lg overflow-hidden border-2 border-white/20">
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
            <div className="w-32 h-24 rounded-lg shadow-lg overflow-hidden border-2 border-white/20">
              <VideoTile
                stream={remoteStream}
                label={remoteUserName}
                muteAudio
                className="h-full w-full"
              />
            </div>
          )}
          {additionalParticipants.map((p) => (
            <div key={p.userId} className="w-32 h-24 rounded-lg shadow-lg overflow-hidden border-2 border-white/20">
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

  // Calculate grid layout - equal sizing for all participants
  const getGridClass = () => {
    if (totalParticipants <= 1) return "grid-cols-1 grid-rows-1";
    if (totalParticipants === 2) return "grid-cols-2 grid-rows-1";
    if (totalParticipants <= 4) return "grid-cols-2 grid-rows-2";
    if (totalParticipants <= 6) return "grid-cols-3 grid-rows-2";
    if (totalParticipants <= 9) return "grid-cols-3 grid-rows-3";
    return "grid-cols-4 grid-rows-3";
  };

  // If only 1 remote + local, use the classic PIP layout
  if (totalParticipants === 2 && additionalParticipants.length === 0) {
    return (
      <div className="relative h-full w-full">
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
          <div className="absolute bottom-4 right-4 h-32 w-32 rounded-lg shadow-lg border-2 border-white/20">
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
