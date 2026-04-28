import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { authApi } from "./api";

// In the legacy 18-service stack, chat ran on :3002 (chat-service) and
// calling on :3051 (calling-service) — separate ports for separate
// processes. In the monolith, both Socket.IO gateways are mounted on
// the same Nest app, so all WS traffic multiplexes through :3015.
// Override via EXPO_PUBLIC_CHAT_SOCKET_URL only if chat is ever split
// back out to its own service (see docs/extract-to-microservice.md).
const CHAT_SOCKET_URL =
  process.env.EXPO_PUBLIC_CHAT_SOCKET_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://192.168.29.218:3015";

type EventHandler = (...args: any[]) => void;

class ChatSocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private reconnecting = false;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await SecureStore.getItemAsync("accessToken");
    if (!token) return;

    this.socket = io(`${CHAT_SOCKET_URL}/chat`, {
      auth: { token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });

    this.socket.on("connect", () => {
      this.notifyListeners("connection:status", true);
    });

    this.socket.on("disconnect", () => {
      this.notifyListeners("connection:status", false);
    });

    this.socket.on("connect_error", async () => {
      if (this.reconnecting) return;
      this.reconnecting = true;
      try {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        if (refreshToken) {
          const res = await authApi.refresh(refreshToken);
          if (res.data) {
            await SecureStore.setItemAsync("accessToken", res.data.accessToken);
            await SecureStore.setItemAsync("refreshToken", res.data.refreshToken);
            if (this.socket) {
              this.socket.io.opts.auth = { token: res.data.accessToken };
              this.socket.connect();
            }
          }
        }
      } catch {
        // Token refresh failed
      } finally {
        this.reconnecting = false;
      }
    });

    // Forward socket events to local listeners
    const forwardEvents = [
      "message:new",
      "message:updated",
      "message:deleted",
      "typing:start",
      "typing:stop",
      "user:online",
      "user:offline",
      "conversation:updated",
      "presence:update",
    ];

    for (const event of forwardEvents) {
      this.socket.on(event, (...args: any[]) => {
        this.notifyListeners(event, ...args);
      });
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  joinConversation(conversationId: string): void {
    this.emit("conversation:join", { conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.emit("conversation:leave", { conversationId });
  }

  sendTyping(conversationId: string): void {
    this.emit("typing:start", { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.emit("typing:stop", { conversationId });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  off(event: string, handler?: EventHandler): void {
    if (handler) {
      this.listeners.get(event)?.delete(handler);
    } else {
      this.listeners.delete(event);
    }
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private notifyListeners(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        if (__DEV__) console.warn("[Socket] Listener error:", err);
      }
    });
  }
}

export const chatSocket = new ChatSocketService();
