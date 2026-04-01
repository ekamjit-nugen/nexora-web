import { useEffect, useRef, useCallback, useState } from 'react';

export type WebSocketEventType =
  | 'organization:created'
  | 'organization:updated'
  | 'organization:suspended'
  | 'organization:activated'
  | 'user:created'
  | 'user:updated'
  | 'user:disabled'
  | 'user:enabled'
  | 'audit:log'
  | 'presence:online'
  | 'presence:offline';

export interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: number;
  userId?: string;
}

interface WebSocketOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private autoReconnect: boolean;
  private reconnectAttempts: number;
  private reconnectDelay: number;
  private currentReconnectAttempt = 0;
  private listeners: Map<WebSocketEventType, Set<(data: any) => void>> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private isConnecting = false;

  constructor(options: WebSocketOptions = {}) {
    this.url = options.url || this.getWebSocketURL();
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectAttempts = options.reconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 3000;
  }

  private getWebSocketURL(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
    return `${protocol}//${host}/ws`;
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.currentReconnectAttempt = 0;

          // Send authentication
          this.send({
            type: 'auth',
            data: { token },
            timestamp: Date.now(),
          } as any);

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          this.isConnecting = false;
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          if (this.autoReconnect && this.currentReconnectAttempt < this.reconnectAttempts) {
            this.currentReconnectAttempt++;
            setTimeout(() => this.connect(token), this.reconnectDelay);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  on(eventType: WebSocketEventType, callback: (data: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  off(eventType: WebSocketEventType, callback: (data: any) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle different message types
    if (message.type === 'auth') {
      // Send queued messages
      this.messageQueue.forEach((msg) => this.send(msg));
      this.messageQueue = [];
      return;
    }

    // Emit to listeners
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(message.data);
        } catch (error) {
          console.error(`Error in WebSocket listener for ${message.type}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Global WebSocket instance
let globalWsClient: WebSocketClient | null = null;

export const getWebSocketClient = (): WebSocketClient => {
  if (!globalWsClient) {
    globalWsClient = new WebSocketClient();
  }
  return globalWsClient;
};

// React Hook for WebSocket
export const useWebSocket = (token: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!token) return;

    const client = getWebSocketClient();
    clientRef.current = client;

    client
      .connect(token)
      .then(() => {
        setIsConnected(true);
      })
      .catch((error) => {
        console.error('Failed to connect WebSocket:', error);
      });

    return () => {
      // Don't disconnect globally, just mark as not available
      setIsConnected(false);
    };
  }, [token]);

  const subscribe = useCallback(
    (eventType: WebSocketEventType, callback: (data: any) => void) => {
      if (!clientRef.current) return () => {};
      return clientRef.current.on(eventType, callback);
    },
    [],
  );

  return {
    isConnected,
    subscribe,
    client: clientRef.current,
  };
};
