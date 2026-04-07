"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { chatApi } from "@/lib/api";
import type { Conversation } from "@/lib/api";
import { toast } from "sonner";

interface ForwardModalProps {
  messageId: string;
  onClose: () => void;
}

export function ForwardModal({ messageId, onClose }: ForwardModalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatApi.getConversations().then((res) => {
      const data = (res.data ?? []) as unknown as Conversation[];
      setConversations(Array.isArray(data) ? data : []);
    }).catch(() => {
      toast.error("Failed to load conversations");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (c.name || "").toLowerCase();
    const participants = (c.participants || []).map((p: { userId?: string }) => p.userId || "").join(" ").toLowerCase();
    return name.includes(q) || participants.includes(q);
  });

  const handleForward = useCallback(async (targetConversationId: string) => {
    if (forwarding) return;
    setForwarding(true);
    try {
      await chatApi.forwardMessage(messageId, targetConversationId);
      toast.success("Message forwarded");
      onClose();
    } catch {
      toast.error("Failed to forward message");
    } finally {
      setForwarding(false);
    }
  }, [messageId, onClose, forwarding]);

  const getConversationLabel = (c: Conversation) => {
    if (c.name) return c.name;
    if (c.type === "direct") {
      const other = c.participants?.find((p: { userId?: string }) => p.userId !== undefined);
      return other?.userId ? `User ${other.userId.toString().slice(-6)}` : "Direct Message";
    }
    return c.type === "channel" ? "Channel" : "Group";
  };

  const getTypeIcon = (type: string) => {
    if (type === "channel") return "#";
    if (type === "group") return (
      <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    );
    return (
      <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    );
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="text-sm font-semibold text-[#0F172A]">Forward Message</h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#334155] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#E2E8F0]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2E86C1] focus:ring-1 focus:ring-[#2E86C1]/20"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="max-h-[340px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#94A3B8] mt-2">Loading conversations...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[#94A3B8]">No conversations found</p>
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c._id}
                onClick={() => handleForward(c._id)}
                disabled={forwarding}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors text-left disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-full bg-[#EBF5FF] flex items-center justify-center text-sm font-medium text-[#2E86C1] shrink-0">
                  {typeof getTypeIcon(c.type) === "string" ? getTypeIcon(c.type) : getTypeIcon(c.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{getConversationLabel(c)}</p>
                  <p className="text-[11px] text-[#94A3B8] capitalize">{c.type}{c.participants ? ` - ${c.participants.length} members` : ""}</p>
                </div>
                <svg className="w-4 h-4 text-[#CBD5E1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
