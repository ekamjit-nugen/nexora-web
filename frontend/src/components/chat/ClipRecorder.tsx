"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ClipRecorderProps {
  onClipReady: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

const MAX_DURATION = 5 * 60; // 5 minutes in seconds

export default function ClipRecorder({ onClipReady, onCancel }: ClipRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const previewRef = useRef<HTMLVideoElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-stop at max duration
  useEffect(() => {
    if (elapsed >= MAX_DURATION && isRecording) {
      handleStop();
    }
  }, [elapsed, isRecording]);

  const stopAllStreams = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    cameraStreamRef.current = null;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setElapsed((prev) => prev + 1);
      }
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleStartRecording = async (withCamera: boolean) => {
    setIsStarting(true);
    setError(null);

    try {
      // Get screen capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = screenStream;

      let combinedStream = screenStream;

      // Optionally add camera overlay
      if (withCamera) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          cameraStreamRef.current = cameraStream;
          setHasCamera(true);

          // Combine screen + camera audio tracks
          const tracks = [
            ...screenStream.getVideoTracks(),
            ...screenStream.getAudioTracks(),
            ...cameraStream.getAudioTracks(),
          ];
          combinedStream = new MediaStream(tracks);
        } catch {
          // Camera not available, continue with screen only
          setHasCamera(false);
        }
      }

      // Show preview
      if (previewRef.current) {
        previewRef.current.srcObject = screenStream;
      }

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onClipReady(blob, elapsed);
        stopAllStreams();
      };

      // Stop recording if screen share ends
      screenStream.getVideoTracks()[0].addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state !== "inactive") {
          handleStop();
        }
      });

      recorder.start(1000); // Collect data every second
      setIsRecording(true);
      startTimeRef.current = Date.now();
      startTimer();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Screen sharing permission denied.");
      } else {
        setError("Failed to start recording. Please try again.");
      }
      stopAllStreams();
    } finally {
      setIsStarting(false);
    }
  };

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleStop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null; // Prevent onClipReady from firing
      mediaRecorderRef.current.stop();
    }
    stopAllStreams();
    setIsRecording(false);
    setIsPaused(false);
    setElapsed(0);
    onCancel();
  };

  // Pre-recording: show start options
  if (!isRecording && !isStarting) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#1E293B]">Record a Clip</h3>
              <p className="text-[12px] text-[#94A3B8]">Max 5 minutes</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] text-[#EF4444] text-[12px]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => handleStartRecording(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
              </svg>
              <div>
                <p className="text-[13px] font-medium text-[#334155]">Screen Only</p>
                <p className="text-[11px] text-[#94A3B8]">Record your screen with audio</p>
              </div>
            </button>

            <button
              onClick={() => handleStartRecording(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <div>
                <p className="text-[13px] font-medium text-[#334155]">Screen + Camera</p>
                <p className="text-[11px] text-[#94A3B8]">Record screen with camera overlay</p>
              </div>
            </button>
          </div>

          <button
            onClick={handleCancel}
            className="w-full mt-3 py-2 text-[13px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Starting state
  if (isStarting) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-[13px] text-[#64748B]">Starting screen capture...</p>
        </div>
      </div>
    );
  }

  // Recording state
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <video
          ref={previewRef}
          autoPlay
          muted
          className="max-w-full max-h-full rounded-xl shadow-2xl"
        />
      </div>

      {/* Recording controls bar */}
      <div className="bg-[#1E293B] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pulsing red dot */}
          <span className="relative flex h-3 w-3">
            {!isPaused && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isPaused ? "bg-[#F59E0B]" : "bg-[#EF4444]"}`} />
          </span>
          <span className="text-white text-[14px] font-mono font-medium">
            {formatTime(elapsed)}
          </span>
          {isPaused && (
            <span className="text-[#F59E0B] text-[11px] font-medium">PAUSED</span>
          )}
          <span className="text-[#64748B] text-[11px]">/ {formatTime(MAX_DURATION)}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Pause / Resume */}
          <button
            onClick={handlePauseResume}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            className="w-12 h-12 rounded-full bg-[#EF4444] hover:bg-[#DC2626] flex items-center justify-center text-white transition-colors"
            title="Stop recording"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>

          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            title="Cancel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {hasCamera && (
            <span className="text-[11px] text-[#22C55E] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              Camera on
            </span>
          )}
        </div>
      </div>

      {/* Progress bar showing time remaining */}
      <div className="h-1 bg-[#1E293B]">
        <div
          className="h-full bg-[#EF4444] transition-all duration-1000 ease-linear"
          style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }}
        />
      </div>
    </div>
  );
}
