"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type BackgroundType = "none" | "blur" | "image";

interface VirtualBackgroundState {
  enabled: boolean;
  type: BackgroundType;
  imageUrl: string | null;
  loading: boolean;
  supported: boolean;
  enable: (type: BackgroundType, imageUrl?: string) => Promise<void>;
  disable: () => void;
  processStream: (inputStream: MediaStream) => MediaStream | null;
}

/**
 * Virtual background hook using Canvas + OffscreenCanvas.
 *
 * Production implementation would use:
 * - TensorFlow.js BodyPix or MediaPipe Selfie Segmentation for person detection
 * - WebGL for compositing (GPU-accelerated)
 *
 * This stub provides the interface and a basic canvas pipeline.
 * The actual ML segmentation model should be loaded lazily.
 */
export function useVirtualBackground(): VirtualBackgroundState {
  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState<BackgroundType>("none");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);

  // Check if the browser supports the required APIs
  const supported = typeof window !== "undefined" && "MediaStream" in window && "HTMLCanvasElement" in window;

  const enable = useCallback(async (bgType: BackgroundType, bgImageUrl?: string) => {
    setLoading(true);
    try {
      setType(bgType);
      setImageUrl(bgImageUrl || null);
      setEnabled(true);

      // In production: load TensorFlow.js BodyPix model here
      // const model = await bodyPix.load({ architecture: 'MobileNetV1', ... });

    } catch (err) {
      console.error("Failed to enable virtual background:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    setType("none");
    setImageUrl(null);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const processStream = useCallback((inputStream: MediaStream): MediaStream | null => {
    if (!enabled || type === "none") return inputStream;

    // Create offscreen canvas for processing
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return inputStream;

    const videoTrack = inputStream.getVideoTracks()[0];
    if (!videoTrack) return inputStream;

    const settings = videoTrack.getSettings();
    canvas.width = settings.width || 640;
    canvas.height = settings.height || 480;

    // Create a video element to read frames from
    const video = document.createElement("video");
    video.srcObject = inputStream;
    video.muted = true;
    video.play();

    // Process frames
    const processFrame = () => {
      if (!enabled) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (type === "blur") {
        // Simple blur effect (production: use segmentation mask)
        ctx.filter = "blur(10px)";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
        // In production: only blur background pixels using segmentation mask
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();

    // Capture processed stream from canvas
    const outputStream = canvas.captureStream(30);

    // Preserve audio tracks
    const audioTracks = inputStream.getAudioTracks();
    for (const track of audioTracks) {
      outputStream.addTrack(track);
    }

    outputStreamRef.current = outputStream;
    return outputStream;
  }, [enabled, type]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    enabled,
    type,
    imageUrl,
    loading,
    supported,
    enable,
    disable,
    processStream,
  };
}
