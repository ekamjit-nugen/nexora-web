"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { authApi } from "@/lib/api";

const CHAT_SOCKET_URL = process.env.NEXT_PUBLIC_CHAT_SOCKET_URL || "http://localhost:3002";

interface UseSocketOptions {
  namespace?: string;
  enabled?: boolean;
  baseUrl?: string;
}

export function useSocket(options?: UseSocketOptions) {
  const { namespace = "/chat", enabled = true, baseUrl } = options || {};
  const socketBaseUrl = baseUrl || CHAT_SOCKET_URL;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [tokenVersion, setTokenVersion] = useState(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const socket = io(`${socketBaseUrl}${namespace}`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", async (err) => {
      console.warn("Socket connection error:", err.message);
      setConnected(false);
      const refreshToken = localStorage.getItem("refreshToken");
      if (
        refreshToken &&
        !refreshingRef.current &&
        (err.message?.toLowerCase().includes("jwt expired") || err.message?.toLowerCase().includes("invalid token"))
      ) {
        try {
          refreshingRef.current = true;
          const res = await authApi.refresh(refreshToken);
          if (res.data?.accessToken) {
            localStorage.setItem("accessToken", res.data.accessToken);
          }
          if (res.data?.refreshToken) {
            localStorage.setItem("refreshToken", res.data.refreshToken);
          }
          setTokenVersion((v) => v + 1);
        } catch {
          // If refresh fails, force logout by clearing tokens
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        } finally {
          refreshingRef.current = false;
        }
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [namespace, enabled, tokenVersion]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => { socketRef.current?.off(event, handler); };
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (handler) {
      socketRef.current?.off(event, handler);
    } else {
      socketRef.current?.removeAllListeners(event);
    }
  }, []);

  return { socket: socketRef.current, connected, emit, on, off };
}
