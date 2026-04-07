"use client";

import { useState, useCallback } from "react";

interface AiSummaryPanelProps {
  conversationId: string;
  onClose: () => void;
}

export function AiSummaryPanel({ conversationId, onClose }: AiSummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "actions">("summary");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${API_BASE}/api/v1/chat/ai/conversations/${conversationId}/summary`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = await res.json();
      setSummary(data.data?.summary || "No summary available.");
    } catch {
      setSummary("Failed to generate summary.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const fetchActionItems = useCallback(async () => {
    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${API_BASE}/api/v1/chat/ai/conversations/${conversationId}/action-items`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = await res.json();
      setActionItems(data.data?.actionItems || []);
    } catch {
      setActionItems([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-full md:w-[360px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-semibold text-slate-800">AI Assistant</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "summary" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab("actions")}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "actions" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Action Items
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "summary" ? (
          <>
            {!summary && !loading && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-3">Get an AI-generated summary of this conversation</p>
                <button
                  onClick={fetchSummary}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Generate Summary
                </button>
              </div>
            )}
            {loading && (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Analyzing conversation...</p>
              </div>
            )}
            {summary && !loading && (
              <div>
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{summary}</div>
                <button
                  onClick={fetchSummary}
                  className="mt-3 text-xs text-blue-500 hover:text-blue-700"
                >
                  Regenerate
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {actionItems.length === 0 && !loading && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-3">Extract action items from the conversation</p>
                <button
                  onClick={fetchActionItems}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Extract Action Items
                </button>
              </div>
            )}
            {loading && (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Extracting action items...</p>
              </div>
            )}
            {actionItems.length > 0 && !loading && (
              <div className="space-y-2">
                {actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                    <span className="text-xs mt-0.5">☐</span>
                    <p className="text-sm text-slate-700">{item}</p>
                  </div>
                ))}
                <button
                  onClick={fetchActionItems}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-700"
                >
                  Regenerate
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
