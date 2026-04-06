"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { authApi } from "@/lib/api";

const CHAT_SOCKET_URL = process.env.NEXT_PUBLIC_CHAT_SOCKET_URL || "http://localhost:3002";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserPresenceInfo {
  status: string;
  customEmoji?: string;
  customText?: string;
}

interface SocketState {
  connected: boolean;
  onlineUsers: Set<string>;
  presenceMap: Map<string, UserPresenceInfo>;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

const SocketContext = createContext<SocketState | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresenceInfo>>(new Map());
  const [tokenVersion, setTokenVersion] = useState(0);
  const refreshingRef = useRef(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const sock = io(`${CHAT_SOCKET_URL}/chat`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });

    sock.on("connect", () => setConnected(true));
    sock.on("disconnect", () => setConnected(false));
    sock.on("connect_error", async (err) => {
      setConnected(false);
      const refreshToken = localStorage.getItem("refreshToken");
      if (
        refreshToken &&
        !refreshingRef.current &&
        (err?.message?.toLowerCase().includes("jwt expired") || err?.message?.toLowerCase().includes("invalid token"))
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
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        } finally {
          refreshingRef.current = false;
        }
      }
    });

    // Receive the full list of currently online users on initial connect
    sock.on("users:online-list", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    // Incremental online/offline updates
    sock.on("user:online", ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
      // Update presence map
      setPresenceMap(prev => {
        const next = new Map(prev);
        const existing = next.get(userId) || { status: "offline" };
        next.set(userId, { ...existing, status: online ? "online" : "offline" });
        return next;
      });
    });

    // Rich presence updates
    sock.on("presence:changed", ({ userId, status, customEmoji, customText }: { userId: string; status: string; customEmoji?: string; customText?: string }) => {
      setPresenceMap(prev => {
        const next = new Map(prev);
        next.set(userId, { status, customEmoji, customText });
        return next;
      });
    });

    // Batch presence on connect
    sock.on("presence:batch", (entries: Array<{ userId: string; status: string; customEmoji?: string; customText?: string }>) => {
      setPresenceMap(prev => {
        const next = new Map(prev);
        for (const e of entries) {
          next.set(e.userId, { status: e.status, customEmoji: e.customEmoji, customText: e.customText });
        }
        return next;
      });
    });

    // Presence heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      sock.emit("presence:heartbeat", {});
    }, 30000);

    setSocket(sock);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sock.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [tokenVersion]); // Reconnect when token refreshes

  // Reconnect when token changes (login/logout)
  useEffect(() => {
    const handleStorage = () => {
      const token = localStorage.getItem("accessToken");
      if (!token && socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      } else if (token) {
        setTokenVersion((v) => v + 1);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [socket]);

  const emit = useCallback((event: string, data: any) => {
    socket?.emit(event, data);
  }, [socket]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socket?.on(event, handler);
    return () => { socket?.off(event, handler); };
  }, [socket]);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (handler) socket?.off(event, handler);
    else socket?.removeAllListeners(event);
  }, [socket]);

  return (
    <SocketContext.Provider value={{ connected, onlineUsers, presenceMap, emit, on, off }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useGlobalSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useGlobalSocket must be used within SocketProvider");
  return ctx;
}
