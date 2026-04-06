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
 * Virtual background hook using Canvas-based blur pipeline.
 *
 * Current implementation provides a "Soft Focus / Privacy Mode" that applies
 * a Gaussian blur to the entire video frame via CanvasRenderingContext2D.filter.
 *
 * TODO: Full background replacement with person segmentation requires
 * MediaPipe Selfie Segmentation or TensorFlow.js BodyPix. When integrated,
 * the blur would only be applied to background pixels behind the segmentation mask.
 */
export function useVirtualBackground(): VirtualBackgroundState {
  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState<BackgroundType>("none");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const enabledRef = useRef(false);
  const typeRef = useRef<BackgroundType>("none");
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Keep refs in sync for the animation loop
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  // Check if the browser supports the required APIs
  const supported =
    typeof window !== "undefined" &&
    "MediaStream" in window &&
    "HTMLCanvasElement" in window;

  const stopProcessing = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    outputStreamRef.current = null;
  }, []);

  const enable = useCallback(
    async (bgType: BackgroundType, bgImageUrl?: string) => {
      setLoading(true);
      try {
        setType(bgType);
        setImageUrl(bgImageUrl || null);
        setEnabled(true);
        enabledRef.current = true;
        typeRef.current = bgType;

        // Pre-load background image if provided
        if (bgType === "image" && bgImageUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = bgImageUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load background image"));
          });
          bgImageRef.current = img;
        } else {
          bgImageRef.current = null;
        }
      } catch (err) {
        console.error("Failed to enable virtual background:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const disable = useCallback(() => {
    setEnabled(false);
    enabledRef.current = false;
    setType("none");
    typeRef.current = "none";
    setImageUrl(null);
    bgImageRef.current = null;
    stopProcessing();
  }, [stopProcessing]);

  const processStream = useCallback(
    (inputStream: MediaStream): MediaStream | null => {
      if (!enabledRef.current || typeRef.current === "none") return inputStream;

      // Create main output canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      // Create a secondary canvas for the blurred layer
      if (!blurCanvasRef.current) {
        blurCanvasRef.current = document.createElement("canvas");
      }

      const canvas = canvasRef.current;
      const blurCanvas = blurCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const blurCtx = blurCanvas.getContext("2d");
      if (!ctx || !blurCtx) return inputStream;

      const videoTrack = inputStream.getVideoTracks()[0];
      if (!videoTrack) return inputStream;

      const settings = videoTrack.getSettings();
      const width = settings.width || 640;
      const height = settings.height || 480;
      canvas.width = width;
      canvas.height = height;
      blurCanvas.width = width;
      blurCanvas.height = height;

      // Create a hidden video element to read frames from the input
      stopProcessing(); // Clean up any previous processing loop
      const video = document.createElement("video");
      video.srcObject = inputStream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
      videoRef.current = video;

      const processFrame = () => {
        if (!enabledRef.current) return;

        const currentType = typeRef.current;

        if (currentType === "blur") {
          // Step 1: Draw the blurred version to the blur canvas
          blurCtx.filter = "blur(15px)";
          blurCtx.drawImage(video, 0, 0, width, height);
          blurCtx.filter = "none";

          // Step 2: Composite — draw blurred background to output canvas
          // Without segmentation we apply blur to the whole frame (Privacy / Soft Focus mode)
          ctx.drawImage(blurCanvas, 0, 0, width, height);

          // TODO: With MediaPipe segmentation mask:
          // 1. Run segmentation to get person mask
          // 2. Draw blurred frame as background
          // 3. Use mask as clip path and draw sharp original frame on top
        } else if (currentType === "image" && bgImageRef.current) {
          // Draw the background image scaled to fill
          ctx.drawImage(bgImageRef.current, 0, 0, width, height);

          // TODO: With segmentation, draw person on top of background image
          // For now, draw semi-transparent video on top to show it's active
          ctx.globalAlpha = 0.7;
          ctx.drawImage(video, 0, 0, width, height);
          ctx.globalAlpha = 1.0;
        } else {
          // Fallback: pass-through
          ctx.drawImage(video, 0, 0, width, height);
        }

        animFrameRef.current = requestAnimationFrame(processFrame);
      };

      // Wait for video to be ready before starting the loop
      video.addEventListener("loadeddata", () => {
        processFrame();
      });
      // If already ready, start immediately
      if (video.readyState >= 2) {
        processFrame();
      }

      // Capture processed stream from canvas at 30 FPS
      const outputStream = canvas.captureStream(30);

      // Preserve audio tracks from the original stream
      const audioTracks = inputStream.getAudioTracks();
      for (const track of audioTracks) {
        outputStream.addTrack(track);
      }

      outputStreamRef.current = outputStream;
      return outputStream;
    },
    [stopProcessing]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProcessing();
    };
  }, [stopProcessing]);

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
