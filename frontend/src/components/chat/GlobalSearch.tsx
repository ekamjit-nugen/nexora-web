"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import { chatApi } from "@/lib/api";
import { MessageContent } from "./MessageContent";

interface SearchResult {
  message: {
    _id: string;
    content: string;
    senderId: string;
    senderName?: string;
    conversationId: string;
    type: string;
    createdAt: string;
  };
  conversationName?: string;
  conversationType?: string;
  highlights?: string[];
}

interface GlobalSearchProps {
  onClose: () => void;
  onNavigate: (conversationId: string, messageId: string) => void;
}

export function GlobalSearch({ onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [hasFilter, setHasFilter] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = { q };
      if (fromFilter) params.from = fromFilter;
      if (hasFilter) params.has = hasFilter;
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://192.168.29.218:3005"}/api/v1/chat/search?${qs}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } },
      );
      const data = await res.json();
      setResults(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [fromFilter, hasFilter]);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15vh] z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[60vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleInput(e.target.value)}
              placeholder="Search messages... (try from:userId, has:file)"
              className="flex-1 text-sm focus:outline-none"
            />
            <kbd className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
          </div>

          {/* Quick filters */}
          <div className="flex gap-1 mt-2">
            {["", "file", "image", "link", "poll"].map(f => (
              <button
                key={f}
                onClick={() => { setHasFilter(f); doSearch(query); }}
                className={`px-2 py-0.5 text-[10px] rounded-full ${hasFilter === f ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {f || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 && query ? (
            <p className="text-center text-sm text-slate-400 py-8">No results found</p>
          ) : results.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">Type to search across all conversations</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {total > 0 && (
                <p className="px-4 py-1.5 text-[10px] text-slate-400 bg-slate-50">{total} results</p>
              )}
              {results.map(r => (
                <button
                  key={r.message._id}
                  onClick={() => onNavigate(r.message.conversationId, r.message._id)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-slate-600">
                      {r.message.senderName || r.message.senderId.slice(-6)}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.conversationName && (
                        <span className="text-[10px] text-slate-400">in #{r.conversationName}</span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {new Date(r.message.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 line-clamp-2">
                    {r.highlights?.[0] ? (
                      <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.highlights[0].replace(/\*\*([^*]+)\*\*/g, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>')) }} />
                    ) : (
                      <MessageContent content={r.message.content} className="text-sm" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
