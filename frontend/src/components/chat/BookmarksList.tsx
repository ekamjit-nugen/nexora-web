"use client";

import { useState, useEffect, useCallback } from "react";
import { chatApi } from "@/lib/api";
import { MessageContent } from "./MessageContent";

interface BookmarkEntry {
  _id: string;
  messageId: string;
  conversationId: string;
  label?: string;
  note?: string;
  createdAt: string;
  message?: {
    _id: string;
    content: string;
    senderId: string;
    senderName?: string;
    createdAt: string;
  };
}

interface BookmarksListProps {
  onClose: () => void;
  onNavigate?: (conversationId: string, messageId: string) => void;
}

export function BookmarksList({ onClose, onNavigate }: BookmarksListProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatApi.getBookmarks();
      setBookmarks((res.data || []) as BookmarkEntry[]);
    } catch {
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const handleRemove = async (bookmarkId: string) => {
    try {
      await chatApi.removeBookmark(bookmarkId);
      setBookmarks(prev => prev.filter(b => b._id !== bookmarkId));
    } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[360px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-base">🔖</span>
          <h3 className="text-sm font-semibold text-slate-800">Saved Messages</h3>
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
        ) : bookmarks.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No saved messages</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {bookmarks.map(bm => (
              <div key={bm._id} className="px-4 py-3 hover:bg-slate-50 group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {bm.label && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{bm.label}</span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(bm.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(bm._id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
                {bm.message ? (
                  <button
                    onClick={() => onNavigate?.(bm.conversationId, bm.messageId)}
                    className="text-left w-full"
                  >
                    <MessageContent content={bm.message.content} className="text-sm line-clamp-3" />
                    {bm.message.senderName && (
                      <p className="text-[10px] text-slate-400 mt-1">— {bm.message.senderName}</p>
                    )}
                  </button>
                ) : (
                  <p className="text-sm text-slate-400 italic">Message unavailable</p>
                )}
                {bm.note && (
                  <p className="text-[11px] text-slate-500 mt-1 italic">Note: {bm.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
