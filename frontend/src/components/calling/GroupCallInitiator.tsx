"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, type Employee } from "@/lib/api";
import { getInitials } from "@/lib/utils";

interface GroupCallInitiatorProps {
  onStartCall: (participantIds: string[], type: "audio" | "video") => void;
  onClose: () => void;
  preselectedIds?: string[];
  currentUserId: string;
}

export function GroupCallInitiator({ onStartCall, onClose, preselectedIds = [], currentUserId }: GroupCallInitiatorProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(preselectedIds));
  const [search, setSearch] = useState("");
  const [callType, setCallType] = useState<"audio" | "video">("video");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrApi.getEmployees({ limit: "100" }).then(res => {
      setEmployees((res.data || []).filter((e: Employee) => e.userId !== currentUserId && e._id !== currentUserId));
    }).finally(() => setLoading(false));
  }, [currentUserId]);

  const toggleSelect = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const filtered = employees.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[420px] max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Start Group Call</h3>
          <p className="text-xs text-slate-500 mt-0.5">Select participants ({selected.size} selected)</p>
        </div>

        {/* Call type toggle */}
        <div className="flex gap-2 px-5 py-2 border-b border-slate-100">
          <button
            onClick={() => setCallType("audio")}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${callType === "audio" ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-slate-500 hover:bg-slate-50"}`}
          >
            🎤 Audio Call
          </button>
          <button
            onClick={() => setCallType("video")}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${callType === "video" ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-slate-500 hover:bg-slate-50"}`}
          >
            📹 Video Call
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people..."
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto px-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-4">No contacts found</p>
          ) : (
            filtered.map(emp => {
              const isSelected = selected.has(emp.userId);
              return (
                <button
                  key={emp.userId}
                  onClick={() => toggleSelect(emp.userId)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left mb-0.5 ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {isSelected ? "✓" : getInitials(emp.firstName, emp.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{emp.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onStartCall(Array.from(selected), callType)}
            disabled={selected.size < 1}
            className="px-5 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {callType === "video" ? "📹" : "🎤"} Start Call ({selected.size + 1})
          </button>
        </div>
      </div>
    </div>
  );
}
