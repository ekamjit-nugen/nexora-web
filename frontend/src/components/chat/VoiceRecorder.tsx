"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      startTimeRef.current = Date.now();
      setRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
    } catch (err) {
      console.error("Microphone access denied:", err);
      toast.error("Microphone access denied. Please allow microphone permissions and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, duration);
    }
  };

  const handleCancel = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  };

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startRecording]);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        {recording && (
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
        <span className="text-sm font-mono text-red-600" aria-live="polite">{formatDuration(duration)}</span>
      </div>

      {/* Waveform visualization placeholder */}
      <div className="flex-1 flex items-center gap-0.5 h-6">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full ${recording ? "bg-red-400" : "bg-red-200"}`}
            style={{ height: recording ? `${8 + Math.random() * 16}px` : "4px", transition: "height 0.1s" }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        {recording ? (
          <button
            onClick={stopRecording}
            className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Stop recording"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          </button>
        ) : audioBlob ? (
          <button
            onClick={handleSend}
            className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            title="Send voice message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        ) : null}
        <button
          onClick={handleCancel}
          className="p-2 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
          title="Cancel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
