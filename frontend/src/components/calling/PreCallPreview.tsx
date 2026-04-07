"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface PreCallPreviewProps {
  recipientName: string;
  callType: "audio" | "video";
  onStartCall: (settings: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    selectedAudioDeviceId?: string;
    selectedVideoDeviceId?: string;
  }) => void;
  onCancel: () => void;
}

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export function PreCallPreview({
  recipientName,
  callType,
  onStartCall,
  onCancel,
}: PreCallPreviewProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(callType === "video");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startCallRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Enumerate devices on mount
  useEffect(() => {
    async function enumerateDevices() {
      try {
        // Request temporary permissions to get labeled device list
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });
        tempStream.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audiInputs = devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` }));
        const vidInputs = devices
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));

        setAudioDevices(audiInputs);
        setVideoDevices(vidInputs);
        if (audiInputs.length > 0) setSelectedAudioDevice(audiInputs[0].deviceId);
        if (vidInputs.length > 0) setSelectedVideoDevice(vidInputs[0].deviceId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to access media devices";
        setPermissionError(message);
      }
    }
    enumerateDevices();
  }, [callType]);

  // Start/restart preview stream when device selection or enabled state changes
  useEffect(() => {
    let cancelled = false;

    async function startPreview() {
      // Stop previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        analyserRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const constraints: MediaStreamConstraints = {};
      if (audioEnabled) {
        constraints.audio = selectedAudioDevice
          ? { deviceId: { exact: selectedAudioDevice } }
          : true;
      }
      if (videoEnabled) {
        constraints.video = selectedVideoDevice
          ? { deviceId: { exact: selectedVideoDevice }, width: 640, height: 480 }
          : { width: 640, height: 480 };
      }

      if (!constraints.audio && !constraints.video) {
        setAudioLevel(0);
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPermissionError(null);

        // Attach video preview
        if (videoRef.current && videoEnabled) {
          videoRef.current.srcObject = stream;
        } else if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        // Set up audio level meter
        if (audioEnabled) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateLevel = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(avg / 128, 1));
              animFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to access media devices";
          setPermissionError(message);
        }
      }
    }

    startPreview();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        analyserRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEnabled, videoEnabled, selectedAudioDevice, selectedVideoDevice]);

  const handleStartCall = useCallback(() => {
    // Stop preview stream before starting real call
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    onStartCall({
      audioEnabled,
      videoEnabled,
      selectedAudioDeviceId: selectedAudioDevice || undefined,
      selectedVideoDeviceId: selectedVideoDevice || undefined,
    });
  }, [audioEnabled, videoEnabled, selectedAudioDevice, selectedVideoDevice, onStartCall]);

  const handleCancel = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    onCancel();
  }, [onCancel]);

  // Auto-focus the Start Call button when dialog opens
  useEffect(() => {
    const timer = setTimeout(() => startCallRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Focus trapping within the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
        return;
      }
      if (e.key !== "Tab") return;

      const focusableEls = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pre-call settings"
        className="relative bg-[#1E293B] rounded-2xl shadow-2xl w-full max-w-md border border-[#334155] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#334155]">
          <h2 className="text-base font-semibold text-white">Call Preview</h2>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            Calling <span className="text-white font-medium">{recipientName}</span>
          </p>
        </div>

        {/* Video Preview */}
        <div className="relative bg-[#0F172A] mx-4 mt-4 rounded-xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
          {videoEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#475569]">
              <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
              </svg>
              <p className="text-sm">Camera off</p>
            </div>
          )}

          {/* Audio Level Meter (bottom of video preview) */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 shrink-0 ${audioEnabled ? "text-green-400" : "text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all duration-75"
                  style={{ width: `${audioEnabled ? audioLevel * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Permission error */}
        {permissionError && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{permissionError}</p>
          </div>
        )}

        {/* Toggle buttons */}
        <div className="flex items-center justify-center gap-4 mt-4 px-4">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${audioEnabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}
            title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {audioEnabled ? (
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

          <button
            onClick={() => setVideoEnabled(!videoEnabled)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${videoEnabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}
            title={videoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {videoEnabled ? (
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
        </div>

        {/* Device selectors */}
        <div className="px-4 mt-4 space-y-3">
          {audioDevices.length > 1 && (
            <div>
              <label className="text-xs text-[#94A3B8] font-medium mb-1 block">Microphone</label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                className="w-full h-9 rounded-lg bg-[#0F172A] border border-[#334155] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#2563EB] appearance-none"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {videoDevices.length > 1 && (
            <div>
              <label className="text-xs text-[#94A3B8] font-medium mb-1 block">Camera</label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                className="w-full h-9 rounded-lg bg-[#0F172A] border border-[#334155] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#2563EB] appearance-none"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 px-4 py-4 mt-2">
          <button
            onClick={handleCancel}
            className="flex-1 h-10 rounded-lg text-sm font-medium text-[#94A3B8] border border-[#334155] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            ref={startCallRef}
            onClick={handleStartCall}
            className="flex-1 h-10 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors shadow-lg shadow-green-600/20"
          >
            Start Call
          </button>
        </div>
      </div>
    </div>
  );
}
