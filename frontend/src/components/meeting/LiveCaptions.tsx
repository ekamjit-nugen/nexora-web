"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { meetingApi } from "@/lib/api";

interface CaptionEntry {
  id: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

interface LiveCaptionsProps {
  meetingId: string;
  currentUserId: string;
  currentUserName: string;
  /** Socket event handler — parent should call onCaption when receiving 'meeting:caption' events */
  externalCaption?: CaptionEntry | null;
}

export function LiveCaptions({
  meetingId,
  currentUserId,
  currentUserName,
  externalCaption,
}: LiveCaptionsProps) {
  const [enabled, setEnabled] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check server caption availability on mount
  useEffect(() => {
    meetingApi.getCaptionsStatus(meetingId).then((res) => {
      setServerAvailable(res.data?.serverTranscriptionAvailable || false);
    }).catch(() => {});
  }, [meetingId]);

  // Handle external captions (from socket)
  useEffect(() => {
    if (externalCaption && enabled) {
      setCaptions((prev) => [...prev.slice(-4), externalCaption]);
    }
  }, [externalCaption, enabled]);

  // Auto-fade captions after 5 seconds
  useEffect(() => {
    if (captions.length === 0) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setCaptions((prev) => {
        const now = Date.now();
        return prev.filter((c) => now - c.timestamp < 5000);
      });
    }, 5000);
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [captions]);

  // Start/stop browser-side speech recognition (fallback)
  const startBrowserCaptions = useCallback(() => {
    const SpeechRecognitionApi =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) return;

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          const entry: CaptionEntry = {
            id: `${Date.now()}-${i}`,
            speakerName: currentUserName || "You",
            text,
            timestamp: Date.now(),
          };
          setCaptions((prev) => [...prev.slice(-4), entry]);
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if still enabled
      if (recognitionRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [currentUserName]);

  const stopBrowserCaptions = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleToggle = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);

    try {
      const res = await meetingApi.toggleCaptions(meetingId, newEnabled);
      const serverOk = res.data?.serverTranscriptionAvailable || false;
      setServerAvailable(serverOk);

      if (newEnabled) {
        // If server-side is not available, fall back to browser SpeechRecognition
        if (!serverOk) {
          startBrowserCaptions();
        }
      } else {
        stopBrowserCaptions();
        setCaptions([]);
      }
    } catch {
      // If toggle fails, fall back to browser-side anyway
      if (newEnabled) {
        startBrowserCaptions();
      } else {
        stopBrowserCaptions();
        setCaptions([]);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBrowserCaptions();
    };
  }, [stopBrowserCaptions]);

  return (
    <>
      {/* Captions toggle button */}
      <button
        onClick={handleToggle}
        className={`p-2 rounded-lg transition-colors ${
          enabled
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
        }`}
        title={enabled ? "Disable captions" : "Enable captions"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">CC</text>
        </svg>
      </button>

      {/* Caption overlay — subtitle style at bottom of video area */}
      {enabled && captions.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[80%] pointer-events-none">
          <div className="flex flex-col items-center gap-1">
            {captions.slice(-3).map((caption) => (
              <div
                key={caption.id}
                className="px-4 py-2 bg-black/75 rounded-lg backdrop-blur-sm animate-in fade-in duration-200"
              >
                <span className="text-[11px] font-semibold text-blue-300 mr-1.5">
                  {caption.speakerName}:
                </span>
                <span className="text-[13px] text-white">{caption.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listening indicator */}
      {enabled && isListening && (
        <div className="absolute bottom-16 right-4 z-40 flex items-center gap-1.5 px-2 py-1 bg-red-500/80 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-[10px] text-white font-medium">Live</span>
        </div>
      )}
    </>
  );
}
