"use client";

import { useState, useEffect, useCallback } from "react";
import { chatApi, type ChatMessage } from "@/lib/api";
import { MessageContent } from "./MessageContent";

interface PinnedMessagesProps {
  conversationId: string;
  onClose: () => void;
  onUnpin?: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PinnedMessages({ conversationId, onClose, onUnpin }: PinnedMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPinned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatApi.getPinnedMessages(conversationId);
      setMessages((res.data || []) as ChatMessage[]);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { fetchPinned(); }, [fetchPinned]);

  const handleUnpin = async (messageId: string) => {
    try {
      await chatApi.unpinMessage(messageId);
      setMessages(prev => prev.filter(m => m._id !== messageId));
      onUnpin?.();
    } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[340px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-base">📌</span>
          <h3 className="text-sm font-semibold text-slate-800">Pinned Messages</h3>
          <span className="text-xs text-slate-400">({messages.length})</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No pinned messages</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map(msg => (
              <div key={msg._id} className="px-4 py-3 hover:bg-slate-50 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">{formatTime(msg.createdAt)}</span>
                  <button
                    onClick={() => handleUnpin(msg._id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600"
                  >
                    Unpin
                  </button>
                </div>
                <MessageContent content={msg.content || ""} className="text-sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
