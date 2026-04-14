"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { meetingApi, hrApi, Meeting, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", label: "SCHEDULED" },
  active: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", label: "LIVE" },
  ended: { bg: "bg-[#F3F4F6]", text: "text-[#374151]", label: "ENDED" },
  cancelled: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "CANCELLED" },
};

type Tab = "upcoming" | "past";

export default function MeetingsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", date: "", startTime: "", durationMinutes: 30,
    participantIds: [] as string[], recordingEnabled: false,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [meetingsRes, empRes] = await Promise.allSettled([
        meetingApi.list(),
        hrApi.getEmployees({ limit: "100" }),
      ]);
      if (meetingsRes.status === "fulfilled") {
        setMeetings(Array.isArray(meetingsRes.value.data) ? meetingsRes.value.data : []);
      }
      if (empRes.status === "fulfilled") {
        const empData = empRes.value.data;
        setEmployees(Array.isArray(empData) ? empData : (empData as any)?.data || []);
      }
    } catch { toast.error("Failed to load meetings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) return null;

  const now = new Date();
  const upcoming = meetings.filter(m => m.status === "scheduled" || m.status === "active" || new Date(m.scheduledAt) >= now);
  const past = meetings.filter(m => m.status === "ended" || m.status === "cancelled" || (m.status !== "active" && new Date(m.scheduledAt) < now));
  const displayed = activeTab === "upcoming" ? upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()) : past.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const handleCreate = async () => {
    if (!form.title || !form.date || !form.startTime) {
      toast.error("Title, date, and start time are required");
      return;
    }
    try {
      const scheduledAt = new Date(`${form.date}T${form.startTime}`);
      await meetingApi.schedule({
        title: form.title,
        description: form.description || undefined,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: form.durationMinutes,
        participantIds: form.participantIds.length > 0 ? form.participantIds : undefined,
        recordingEnabled: form.recordingEnabled,
      });
      toast.success("Meeting scheduled");
      setShowCreate(false);
      setForm({ title: "", description: "", date: "", startTime: "", durationMinutes: 30, participantIds: [], recordingEnabled: false });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule meeting");
    }
  };

  const handleJoin = (meetingId: string) => {
    router.push(`/meeting/${meetingId}`);
  };

  const handleCancel = async (meetingId: string) => {
    if (!confirm("Cancel this meeting?")) return;
    try {
      await meetingApi.cancel(meetingId);
      toast.success("Meeting cancelled");
      fetchData();
    } catch { toast.error("Failed to cancel"); }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) + " at " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toDateString() === now.toDateString();
  };

  const toggleParticipant = (userId: string) => {
    setForm(prev => ({
      ...prev,
      participantIds: prev.participantIds.includes(userId)
        ? prev.participantIds.filter(id => id !== userId)
        : [...prev.participantIds, userId],
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Meetings</h1>
            <p className="text-sm text-[#64748B] mt-1">
              {upcoming.length} upcoming, {past.length} past
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
            {showCreate ? "Cancel" : "Schedule Meeting"}
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Schedule a Meeting</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Title *</label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sprint Review" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Date *</label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Start Time *</label>
                <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Duration (minutes)</label>
                <select value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Description</label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Agenda for the meeting..." className="text-sm" />
              </div>
            </div>

            {/* Participant Selection */}
            <div className="mt-4">
              <label className="text-xs font-medium text-[#64748B] mb-2 block">Participants ({form.participantIds.length} selected)</label>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border border-[#E2E8F0] rounded-lg">
                {employees.slice(0, 50).map(emp => {
                  const empId = (emp as any).userId || emp._id;
                  const selected = form.participantIds.includes(empId);
                  return (
                    <button key={empId} onClick={() => toggleParticipant(empId)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        selected ? "bg-[#2E86C1] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                      }`}>
                      {emp.firstName} {emp.lastName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-[#64748B]">
                <input type="checkbox" checked={form.recordingEnabled} onChange={e => setForm({ ...form, recordingEnabled: e.target.checked })} className="rounded" />
                Enable recording
              </label>
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Schedule</Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-[#E2E8F0] w-fit">
          <button onClick={() => setActiveTab("upcoming")} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "upcoming" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
            Upcoming ({upcoming.length})
          </button>
          <button onClick={() => setActiveTab("past")} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "past" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
            Past ({past.length})
          </button>
        </div>

        {/* Meeting List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse">
                <div className="h-4 bg-[#E2E8F0] rounded w-48 mb-2" />
                <div className="h-3 bg-[#E2E8F0] rounded w-32" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center text-[#94A3B8] text-sm">
            {activeTab === "upcoming" ? "No upcoming meetings. Schedule one to get started." : "No past meetings."}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(meeting => {
              const status = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
              const meetingIsToday = isToday(meeting.scheduledAt);
              return (
                <div key={meeting._id} className={`bg-white rounded-xl shadow-sm border ${meetingIsToday ? "border-[#2E86C1]" : "border-[#E2E8F0]"} p-5 hover:shadow-md transition-shadow`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {/* Time block */}
                      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${meetingIsToday ? "bg-[#2E86C1] text-white" : "bg-[#F1F5F9] text-[#334155]"}`}>
                        <span className="text-[10px] font-medium uppercase">{new Date(meeting.scheduledAt).toLocaleDateString("en-IN", { month: "short" })}</span>
                        <span className="text-lg font-bold leading-tight">{new Date(meeting.scheduledAt).getDate()}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-[#0F172A]">{meeting.title}</h3>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${status.bg} ${status.text}`}>{status.label}</span>
                          {meeting.recordingEnabled && <span className="text-[9px] text-[#EF4444] font-medium">REC</span>}
                        </div>
                        <p className="text-xs text-[#64748B]">
                          {formatDateTime(meeting.scheduledAt)} · {meeting.durationMinutes} min
                          {meeting.hostName && ` · Host: ${meeting.hostName}`}
                        </p>
                        {meeting.description && <p className="text-xs text-[#94A3B8] mt-1">{meeting.description}</p>}
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          <span className="text-[10px] text-[#94A3B8]">{meeting.participantIds?.length || 0} participants</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {(meeting.status === "scheduled" || meeting.status === "active") && (
                        <Button onClick={() => handleJoin(meeting._id)} className={`text-xs h-8 ${meeting.status === "active" ? "bg-[#10B981] text-white" : "bg-[#2E86C1] text-white"}`}>
                          {meeting.status === "active" ? "Join Now" : "Join"}
                        </Button>
                      )}
                      {meeting.status === "scheduled" && (
                        <button onClick={() => handleCancel(meeting._id)} className="text-xs text-[#94A3B8] hover:text-[#EF4444] px-2 py-1 rounded hover:bg-[#FEE2E2]">
                          Cancel
                        </button>
                      )}
                      {meeting.status === "ended" && (
                        <button onClick={() => handleJoin(meeting._id)} className="text-xs text-[#64748B] hover:text-[#2E86C1] px-2 py-1 rounded hover:bg-[#F1F5F9]">
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
