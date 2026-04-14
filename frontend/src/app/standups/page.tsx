"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { standupApi, hrApi, StandupConfig, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function StandupsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [standups, setStandups] = useState<StandupConfig[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", frequency: "weekdays", time: "09:00", participants: [] as string[],
    questions: ["What did you do yesterday?", "What will you do today?", "Any blockers?"],
  });

  const isManager = hasOrgRole("manager");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [standupRes, empRes] = await Promise.allSettled([
        standupApi.getAll(),
        hrApi.getEmployees({ limit: "100" }),
      ]);

      const standupList = standupRes.status === "fulfilled" && Array.isArray(standupRes.value.data) ? standupRes.value.data : [];
      setStandups(standupList);

      if (empRes.status === "fulfilled") {
        const empData = empRes.value.data;
        setEmployees(Array.isArray(empData) ? empData : (empData as any)?.data || []);
      }

      // Check today's status for each standup
      const statuses = new Map<string, boolean>();
      await Promise.allSettled(
        standupList.map(async (s) => {
          try {
            const res = await standupApi.getMyStatus(s._id);
            statuses.set(s._id, (res.data as any)?.submitted || false);
          } catch { statuses.set(s._id, false); }
        }),
      );
      setStatusMap(statuses);
    } catch { toast.error("Failed to load standups"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) return null;

  const handleCreate = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    try {
      await standupApi.create(form);
      toast.success("Standup created");
      setShowCreate(false);
      setForm({ name: "", frequency: "weekdays", time: "09:00", participants: [], questions: ["What did you do yesterday?", "What will you do today?", "Any blockers?"] });
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const toggleParticipant = (userId: string) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.includes(userId)
        ? prev.participants.filter(id => id !== userId)
        : [...prev.participants, userId],
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Async Standups</h1>
            <p className="text-sm text-[#64748B] mt-1">Daily check-ins without the meetings</p>
          </div>
          {isManager && (
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
              {showCreate ? "Cancel" : "Create Standup"}
            </Button>
          )}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">New Standup</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Engineering Daily Standup" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Frequency</label>
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  <option value="daily">Daily (every day)</option>
                  <option value="weekdays">Weekdays (Mon-Fri)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Time</label>
                <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="text-sm" />
              </div>
            </div>

            {/* Questions */}
            <div className="mt-4">
              <label className="text-xs font-medium text-[#64748B] mb-2 block">Questions</label>
              {form.questions.map((q, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={q} onChange={e => {
                    const qs = [...form.questions];
                    qs[i] = e.target.value;
                    setForm({ ...form, questions: qs });
                  }} className="text-sm" />
                  {form.questions.length > 1 && (
                    <button onClick={() => setForm({ ...form, questions: form.questions.filter((_, j) => j !== i) })}
                      className="text-[#94A3B8] hover:text-[#EF4444] px-2">x</button>
                  )}
                </div>
              ))}
              <button onClick={() => setForm({ ...form, questions: [...form.questions, ""] })}
                className="text-xs text-[#2E86C1] hover:underline">+ Add question</button>
            </div>

            {/* Participants */}
            <div className="mt-4">
              <label className="text-xs font-medium text-[#64748B] mb-2 block">Participants ({form.participants.length})</label>
              <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-2 border border-[#E2E8F0] rounded-lg">
                {employees.slice(0, 50).map(emp => {
                  const empId = (emp as any).userId || emp._id;
                  const selected = form.participants.includes(empId);
                  return (
                    <button key={empId} onClick={() => toggleParticipant(empId)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${selected ? "bg-[#2E86C1] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}>
                      {emp.firstName} {emp.lastName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Create Standup</Button>
            </div>
          </div>
        )}

        {/* Standup List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse">
                <div className="h-5 bg-[#E2E8F0] rounded w-48 mb-2" />
                <div className="h-3 bg-[#E2E8F0] rounded w-32" />
              </div>
            ))}
          </div>
        ) : standups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center text-[#94A3B8] text-sm">
            No standups yet. {isManager ? "Create your first async standup above." : "Ask your manager to create a standup."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standups.map(standup => {
              const submitted = statusMap.get(standup._id) || false;
              return (
                <div
                  key={standup._id}
                  onClick={() => router.push(`/standups/${standup._id}`)}
                  className={`bg-white rounded-xl shadow-sm border ${submitted ? "border-[#10B981]" : "border-[#E2E8F0]"} p-5 hover:shadow-md cursor-pointer transition-all`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2E86C1] text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${submitted ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                      {submitted ? "DONE" : "PENDING"}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">{standup.name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#64748B]">
                    <span>{standup.schedule?.frequency} at {standup.schedule?.time}</span>
                    <span>{standup.participants?.length || 0} members</span>
                  </div>
                  <div className="mt-2 text-[10px] text-[#94A3B8]">
                    {standup.questions?.length || 3} questions
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
