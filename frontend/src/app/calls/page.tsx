"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { callApi, hrApi } from "@/lib/api";
import type { CallLog, Employee } from "@/lib/api";
import { useGlobalSocket } from "@/lib/socket-context";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

// ── Helpers ──

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
}

const statusColors: Record<string, string> = {
  initiated: "bg-blue-100 text-blue-700 border-blue-200",
  ringing: "bg-amber-100 text-amber-700 border-amber-200",
  answered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  missed: "bg-red-100 text-red-700 border-red-200",
  declined: "bg-gray-100 text-gray-600 border-gray-200",
  ended: "bg-slate-100 text-slate-600 border-slate-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

// ── Call Detail Modal ──

function CallDetailModal({
  call,
  onClose,
  onNotesUpdate,
  currentUserId,
}: {
  call: CallLog;
  onClose: () => void;
  onNotesUpdate: (id: string, notes: string) => void;
  currentUserId: string;
}) {
  const [notes, setNotes] = useState(call.notes || "");
  const [saving, setSaving] = useState(false);
  const isOutgoing = call.initiatorId === currentUserId;
  const getCallerName = (c: CallLog) => c.initiatorId?.slice(-6) || 'Unknown';
  const getReceiverName = (c: CallLog) => {
    const otherId = c.participantIds?.find(id => id !== c.initiatorId);
    return otherId?.slice(-6) || 'Unknown';
  };

  async function saveNotes() {
    setSaving(true);
    try {
      await callApi.updateNotes(call._id, notes);
      onNotesUpdate(call._id, notes);
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#0F172A]">Call Details</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] text-[#94A3B8]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#2E86C1] flex items-center justify-center text-white font-semibold">
                {getInitials(
                  (isOutgoing ? getReceiverName(call) : getCallerName(call))?.split(" ")[0],
                  (isOutgoing ? getReceiverName(call) : getCallerName(call))?.split(" ")[1]
                )}
              </div>
              <div>
                <p className="font-semibold text-[#0F172A]">{(isOutgoing ? getReceiverName(call) : getCallerName(call)) || "Unknown"}</p>
                <p className="text-sm text-[#64748B]">{isOutgoing ? "Outgoing" : "Incoming"} {call.type} call</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">Status</p>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border capitalize ${statusColors[call.status] || ""}`}>
                  {call.status}
                </span>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">Duration</p>
                <p className="text-sm font-medium text-[#0F172A]">{call.duration ? formatDuration(call.duration) : "--"}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">Type</p>
                <p className="text-sm font-medium text-[#0F172A] capitalize">{call.type}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">Time</p>
                <p className="text-sm font-medium text-[#0F172A]">{(() => {
                  const t = call.startTime || (call as any).createdAt;
                  if (!t) return "--";
                  const d = new Date(t);
                  return isNaN(d.getTime()) ? "--" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                })()}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">Date</p>
                <p className="text-sm font-medium text-[#0F172A]">{(() => {
                  const t = call.startTime || (call as any).createdAt;
                  if (!t) return "--";
                  const d = new Date(t);
                  return isNaN(d.getTime()) ? "--" : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
                })()}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">Direction</p>
                <p className="text-sm font-medium text-[#0F172A]">{isOutgoing ? "Outgoing" : "Incoming"}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#334155] mb-2 block">Call Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this call..."
                className="w-full h-24 px-3 py-2 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] resize-none"
              />
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-3 flex items-center gap-2 text-[#94A3B8]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-xs">Call recording will be available with WebRTC integration</span>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
              Close
            </button>
            <button onClick={saveNotes} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E86C1] text-white rounded-xl text-sm font-medium hover:bg-[#2574A9] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Active Call Screen ──

function ActiveCallScreen({
  call,
  otherName,
  onEndCall,
}: {
  call: CallLog;
  otherName: string;
  onEndCall: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    const start = new Date(call.startTime || call.createdAt).getTime();
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [call.startTime]);

  const initials = getInitials(otherName.split(" ")[0], otherName.split(" ")[1]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-[#0F172A] to-[#1E293B] rounded-2xl p-8 min-h-[500px]">
      {/* Pulse ring animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 w-28 h-28 rounded-full bg-[#2E86C1]/20 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="relative w-28 h-28 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-[#2E86C1]/30">
          {initials}
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white mb-1">{otherName}</h3>
      <p className="text-[#94A3B8] text-sm mb-2 capitalize">{call.type} Call</p>

      <div className="flex items-center gap-2 mb-8">
        <span className={`inline-block w-2 h-2 rounded-full ${call.status === "answered" ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
        <span className="text-white/80 text-lg font-mono tracking-wider">
          {call.status === "answered" ? formatDuration(elapsed) : call.status === "ringing" ? "Ringing..." : "Connecting..."}
        </span>
      </div>

      {/* Call controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setMuted(!muted)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
          title={muted ? "Unmute" : "Mute"}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {muted ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        <button
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-red-500/30"
          title="End call"
        >
          <svg className="w-7 h-7 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>

        <button
          onClick={() => setSpeaker(!speaker)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speaker ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
          title={speaker ? "Speaker off" : "Speaker on"}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
      </div>

      <p className="text-white/40 text-xs mt-8">WebRTC audio/video coming soon -- this is a call log placeholder</p>
    </div>
  );
}

// ── Page ──

export default function CallsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { onlineUsers: onlineUserIds } = useGlobalSocket();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [stats, setStats] = useState<{ totalToday: number; missedToday: number; avgDuration: number; completedToday: number } | null>(null);
  const [activeCall, setActiveCall] = useState<CallLog | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingCalls, setLoadingCalls] = useState(true);

  // Load data — each API call is independent so one failure doesn't block others
  const loadData = useCallback(async () => {
    const [empRes, callRes, statsRes] = await Promise.allSettled([
      hrApi.getEmployees({ limit: "100" }),
      callApi.getRecent(),
      callApi.getStats(),
    ]);

    // Build employee list for name lookup
    const emps: Employee[] = empRes.status === "fulfilled" ? empRes.value.data || [] : [];
    setEmployees(emps);

    // Load call data
    if (callRes.status === "fulfilled") {
      const rawCalls: CallLog[] = callRes.value.data || [];
      setRecentCalls(rawCalls);
    }

    if (statsRes.status === "fulfilled") setStats(statsRes.value.data || null);
    setLoadingContacts(false);
    setLoadingCalls(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (user) loadData();
  }, [user, authLoading, router, loadData]);

  // Initiate call
  async function initiateCall(emp: Employee, type: "audio" | "video") {
    try {
      const res = await callApi.create({
        recipientId: emp.userId || emp._id,
        type,
      });
      const newCall = res.data!;
      setActiveCall(newCall);
      toast.success(`${type === "video" ? "Video" : "Audio"} call initiated with ${emp.firstName}`);

      // Simulate: auto-answer after 3s (note: update endpoint removed; optimistic update only)
      setTimeout(() => {
        setActiveCall((prev) => prev ? { ...prev, status: "answered" } : prev);
      }, 3000);
    } catch {
      toast.error("Failed to initiate call");
    }
  }

  // End call
  async function endCall() {
    if (!activeCall) return;
    toast.success("Call ended");
    setActiveCall(null);
    loadData(); // refresh
  }

  // Handle notes update from modal
  function handleNotesUpdate(id: string, notes: string) {
    setRecentCalls((prev) => prev.map((c) => (c._id === id ? { ...c, notes } : c)));
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredEmployees = employees.filter((emp) => {
    // Hide the logged-in user from team members list
    if (emp.userId === user._id || emp._id === user._id) return false;
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(q) ||
      emp.lastName.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q)
    );
  });

  const activeCallOtherName = activeCall
    ? activeCall.initiatorId === user._id
      ? (activeCall.participantIds?.find(id => id !== activeCall.initiatorId) || "Unknown")
      : activeCall.initiatorId?.slice(-6) || "Unknown"
    : "";

  return (
    <RouteGuard minOrgRole="member">
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="ml-[260px] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Calls</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Manage team calls and view call history</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total Today", value: stats?.totalToday ?? 0, icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", color: "#2E86C1" },
            { label: "Completed", value: stats?.completedToday ?? 0, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "#10B981" },
            { label: "Missed", value: stats?.missedToday ?? 0, icon: "M15.536 8.464a5 5 0 010 7.072M12 9.5l0 0m0 5l0 0M5.636 15.364a9 9 0 1112.728-12.728 9 9 0 01-12.728 12.728z", color: "#EF4444" },
            { label: "Avg Duration", value: formatDuration(stats?.avgDuration ?? 0), icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "#8B5CF6" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}12` }}>
                <svg className="w-5 h-5" style={{ color: s.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold text-[#0F172A] mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-5" style={{ height: "calc(100vh - 240px)" }}>
          {/* Left: Contacts */}
          <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#F1F5F9] bg-gradient-to-b from-white to-[#FAFBFC]">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Team Members</h2>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingContacts ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#94A3B8]">No contacts found</div>
              ) : (
                filteredEmployees.map((emp) => {
                  const initials = getInitials(emp.firstName, emp.lastName);
                  return (
                    <div key={emp._id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-all group cursor-pointer">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm ${onlineUserIds.has(emp.userId) ? "bg-[#2E86C1]" : "bg-[#94A3B8]"}`}>
                          {initials}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors ${onlineUserIds.has(emp.userId) ? "bg-emerald-400" : "bg-gray-300"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                        <p className={`text-[11px] truncate ${onlineUserIds.has(emp.userId) ? "text-emerald-500" : "text-[#94A3B8]"}`}>{onlineUserIds.has(emp.userId) ? "Online" : emp.email}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => initiateCall(emp, "audio")}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2E86C1]/10 text-[#2E86C1] hover:bg-[#2E86C1] hover:text-white transition-all"
                          title="Audio call"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => initiateCall(emp, "video")}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-all"
                          title="Video call"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active call or call log */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeCall ? (
              <ActiveCallScreen call={activeCall} otherName={activeCallOtherName} onEndCall={endCall} />
            ) : (
              <div className="flex-1 bg-white rounded-2xl border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#F1F5F9] bg-gradient-to-b from-white to-[#FAFBFC]">
                  <h2 className="text-sm font-semibold text-[#0F172A]">Recent Calls</h2>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{recentCalls.length} call{recentCalls.length !== 1 ? "s" : ""} in history</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {loadingCalls ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-6 h-6 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : recentCalls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <p className="text-[#64748B] font-medium">No calls yet</p>
                      <p className="text-sm text-[#94A3B8] mt-1">Select a team member to start a call</p>
                    </div>
                  ) : (
                    recentCalls.map((call) => {
                      const isOutgoing = call.initiatorId === user._id;
                      const otherEmpId = isOutgoing
                        ? call.participantIds?.find(id => id !== call.initiatorId)
                        : call.initiatorId;
                      const otherEmp = employees.find(e => e.userId === otherEmpId || e._id === otherEmpId);
                      const otherName = otherEmp
                        ? `${otherEmp.firstName} ${otherEmp.lastName}`
                        : otherEmpId?.slice(-6) || 'Unknown';
                      const initials = getInitials(
                        otherName?.split(" ")[0],
                        otherName?.split(" ")[1]
                      );
                      const isMissed = call.status === "missed";

                      return (
                        <div
                          key={call._id}
                          onClick={() => setSelectedCall(call)}
                          className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#F8FAFC] transition-all cursor-pointer border-b border-[#F1F5F9] last:border-0"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-sm ${isMissed ? "bg-red-400" : isOutgoing ? "bg-[#2E86C1]" : "bg-emerald-500"}`}>
                            {initials}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium truncate ${isMissed ? "text-red-600" : "text-[#0F172A]"}`}>
                                {otherName || "Unknown"}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize shrink-0 ${statusColors[call.status] || ""}`}>
                                {call.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {/* Direction arrow */}
                              <svg className={`w-3 h-3 shrink-0 ${isMissed ? "text-red-400" : isOutgoing ? "text-[#2E86C1]" : "text-emerald-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={isOutgoing ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                              </svg>
                              {/* Type icon */}
                              <svg className="w-3 h-3 text-[#94A3B8] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={call.type === "video" ? "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" : "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"} />
                              </svg>
                              <span className="text-xs text-[#94A3B8]">
                                {call.duration ? formatDuration(call.duration) : "--:--"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs text-[#94A3B8]">{timeAgo(call.startTime || call.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onNotesUpdate={handleNotesUpdate}
          currentUserId={user._id}
        />
      )}
    </div>
    </RouteGuard>
  );
}
