"use client";

import { useState, useRef, useEffect } from "react";
import { chatApi } from "@/lib/api";

interface ClipPlayerProps {
  clipId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  duration: number;
  transcription?: string;
  senderName: string;
  isMe?: boolean;
}

export default function ClipPlayer({
  clipId,
  mediaUrl,
  thumbnailUrl,
  duration,
  transcription: initialTranscription,
  senderName,
  isMe,
}: ClipPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [transcription, setTranscription] = useState(initialTranscription || "");
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>(
    initialTranscription ? "complete" : "pending"
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Fetch transcription if not provided initially
  useEffect(() => {
    if (!initialTranscription && clipId) {
      chatApi.getClipTranscription(clipId).then((res) => {
        if (res.data) {
          setTranscription(res.data.transcription || "");
          setTranscriptionStatus(res.data.transcriptionStatus || "pending");
        }
      }).catch(() => {
        // Silently fail — transcription not critical
      });
    }
  }, [clipId, initialTranscription]);

  const handlePlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = `clip-${clipId}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-[320px] rounded-xl overflow-hidden shadow-sm border border-[#E2E8F0] bg-white">
      {/* Video area */}
      <div className="relative bg-[#0F172A] aspect-video">
        {isPlaying ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            controls
            className="w-full h-full object-contain"
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <button
            onClick={handlePlay}
            className="w-full h-full flex items-center justify-center group cursor-pointer"
          >
            {/* Thumbnail or gradient background */}
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Clip thumbnail"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E293B] to-[#0F172A]" />
            )}

            {/* Play button */}
            <div className="relative z-10 w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/60 text-white text-[11px] font-mono">
              {formatDuration(duration)}
            </div>

            {/* Clip icon badge */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Clip
            </div>
          </button>
        )}
      </div>

      {/* Info area */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[#334155] truncate">
            {senderName}
          </p>
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-[#F1F5F9] transition-colors text-[#94A3B8] hover:text-[#64748B]"
            title="Download clip"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
        </div>

        {/* Transcription */}
        {transcriptionStatus === "pending" || transcriptionStatus === "processing" ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="animate-spin w-3 h-3 border border-[#94A3B8] border-t-transparent rounded-full" />
            <p className="text-[11px] text-[#94A3B8] italic">Transcription pending...</p>
          </div>
        ) : transcription ? (
          <div className="mt-1.5">
            <button
              onClick={() => setShowTranscription(!showTranscription)}
              className="flex items-center gap-1 text-[11px] text-[#2E86C1] hover:text-[#2471A3] transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showTranscription ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              {showTranscription ? "Hide" : "Show"} transcription
            </button>
            {showTranscription && (
              <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed bg-[#F8FAFC] rounded-lg p-2 border border-[#E2E8F0]">
                {transcription}
              </p>
            )}
          </div>
        ) : transcriptionStatus === "failed" ? (
          <p className="mt-1.5 text-[11px] text-[#EF4444] italic">Transcription failed</p>
        ) : null}
      </div>
    </div>
  );
}
