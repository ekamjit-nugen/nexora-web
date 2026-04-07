"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { chatApi, type ChatMessage, type Employee } from "@/lib/api";
import { MessageContent } from "./MessageContent";
import { getInitials, formatTime } from "@/lib/utils";

interface ThreadPanelProps {
  rootMessage: ChatMessage;
  employeeMap: Record<string, Employee>;
  currentUserId: string;
  onClose: () => void;
  onReply?: (reply: ChatMessage) => void;
}

export function ThreadPanel({ rootMessage, employeeMap, currentUserId, onClose, onReply }: ThreadPanelProps) {
  const [replies, setReplies] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await chatApi.getThreadReplies(rootMessage._id);
      setReplies((res.data as any)?.data || []);
    } catch {
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [rootMessage._id]);

  useEffect(() => { fetchReplies(); }, [fetchReplies]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await chatApi.replyToThread(rootMessage._id, replyText.trim());
      if (res.data) {
        setReplies(prev => [...prev, res.data as ChatMessage]);
        setReplyText("");
        onReply?.(res.data as ChatMessage);
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const rootSender = employeeMap[rootMessage.senderId];
  const replyCount = (rootMessage as any).threadInfo?.replyCount || replies.length;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[380px] min-w-[340px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Thread</h3>
          <p className="text-xs text-slate-500">{replyCount} {replyCount === 1 ? "reply" : "replies"}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Root message */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
            {rootSender ? getInitials(rootSender.firstName, rootSender.lastName) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {rootSender ? `${rootSender.firstName} ${rootSender.lastName}` : "Unknown"}
              </span>
              <span className="text-xs text-slate-400">{formatTime(rootMessage.createdAt)}</span>
            </div>
            <MessageContent content={rootMessage.content || ""} className="mt-0.5" />
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : replies.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No replies yet</p>
        ) : (
          replies.map((reply) => {
            const sender = employeeMap[reply.senderId];
            return (
              <div key={reply._id} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {sender ? getInitials(sender.firstName, sender.lastName) : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {sender ? `${sender.firstName} ${sender.lastName}` : "Unknown"}
                    </span>
                    <span className="text-xs text-slate-400">{formatTime(reply.createdAt)}</span>
                  </div>
                  <MessageContent content={reply.content || ""} className="mt-0.5 text-sm" />
                </div>
              </div>
            );
          })
        )}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply input */}
      <div className="px-3 py-2 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendReply()}
            placeholder="Reply in thread..."
            className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            disabled={sending}
          />
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || sending}
            className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
