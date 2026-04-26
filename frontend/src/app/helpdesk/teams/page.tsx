"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { helpdeskApi, hrApi, HelpdeskTeam, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = { it_support: "IT Support", hr: "HR", finance: "Finance", facilities: "Facilities", admin: "Admin", other: "Other" };

export default function HelpdeskTeamsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<HelpdeskTeam[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", category: "it_support",
    memberIds: [] as string[], autoAssign: true,
    slaResponse: 60, slaResolution: 480,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [teamsRes, empRes] = await Promise.all([
        helpdeskApi.getTeams(),
        hrApi.getEmployees({ limit: "100" }).catch(() => ({ data: [] })),
      ]);
      setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : []);
      const empData = empRes.data;
      setEmployees(Array.isArray(empData) ? empData : (empData as any)?.data || []);
    } catch { toast.error("Failed to load teams"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasOrgRole("manager")) { router.push("/helpdesk"); return; }
    fetchData();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const toggleMember = (userId: string) => {
    setForm(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId) ? prev.memberIds.filter(id => id !== userId) : [...prev.memberIds, userId],
    }));
  };

  const handleCreate = async () => {
    if (!form.name) { toast.error("Team name is required"); return; }
    try {
      const members = form.memberIds.map(uid => {
        const emp = employees.find(e => ((e as any).userId || e._id) === uid);
        return { userId: uid, name: emp ? `${emp.firstName} ${emp.lastName}` : "", role: "agent" };
      });
      await helpdeskApi.createTeam({
        name: form.name, description: form.description, category: form.category,
        members, autoAssign: form.autoAssign,
        slaPolicy: {
          critical: { responseMinutes: 15, resolutionMinutes: 120 },
          high: { responseMinutes: form.slaResponse, resolutionMinutes: form.slaResolution },
          medium: { responseMinutes: form.slaResponse * 4, resolutionMinutes: form.slaResolution * 3 },
          low: { responseMinutes: form.slaResponse * 8, resolutionMinutes: form.slaResolution * 6 },
        },
      });
      toast.success("Team created");
      setShowCreate(false);
      setForm({ name: "", description: "", category: "it_support", memberIds: [], autoAssign: true, slaResponse: 60, slaResolution: 480 });
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete team "${name}"?`)) return;
    try { await helpdeskApi.deleteTeam(id); toast.success("Team deleted"); fetchData(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Helpdesk Teams</h1>
            <p className="text-sm text-[#64748B] mt-1">Manage support teams, agents, and SLA policies</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
            {showCreate ? "Cancel" : "Create Team"}
          </Button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">New Helpdesk Team</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Team Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="IT Support Team" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Category (auto-route tickets)</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Description</label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Handles IT hardware & software issues" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">SLA Response (high priority, minutes)</label>
                <Input type="number" value={form.slaResponse} onChange={e => setForm({ ...form, slaResponse: Number(e.target.value) })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">SLA Resolution (high priority, minutes)</label>
                <Input type="number" value={form.slaResolution} onChange={e => setForm({ ...form, slaResolution: Number(e.target.value) })} className="text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-[#64748B] pb-2">
                  <input type="checkbox" checked={form.autoAssign} onChange={e => setForm({ ...form, autoAssign: e.target.checked })} className="rounded" />
                  Auto-assign tickets (round-robin)
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-[#64748B] mb-2 block">Team Members ({form.memberIds.length} selected)</label>
              <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-2 border border-[#E2E8F0] rounded-lg">
                {employees.slice(0, 50).map(emp => {
                  const empId = (emp as any).userId || emp._id;
                  const selected = form.memberIds.includes(empId);
                  return (
                    <button key={empId} onClick={() => toggleMember(empId)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${selected ? "bg-[#2E86C1] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}>
                      {emp.firstName} {emp.lastName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Create Team</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse"><div className="h-5 bg-[#E2E8F0] rounded w-32 mb-2" /><div className="h-3 bg-[#E2E8F0] rounded w-48" /></div>)}
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center text-[#94A3B8] text-sm">No teams yet. Create your first support team above.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map(team => {
              const isExpanded = expandedTeam === team._id;
              return (
                <Card key={team._id} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="cursor-pointer flex-1" onClick={() => setExpandedTeam(isExpanded ? null : team._id)}>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{team.name}</h3>
                        {team.description && <p className="text-xs text-[#64748B] mt-0.5">{team.description}</p>}
                      </div>
                      <button onClick={() => handleDelete(team._id, team.name)} className="text-[#94A3B8] hover:text-[#EF4444] p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#64748B]">
                      <span className="px-2 py-0.5 bg-[#F1F5F9] rounded text-[10px] font-medium">{CATEGORY_LABELS[team.category] || team.category}</span>
                      <span>{team.members?.length || 0} agents</span>
                      <span>{team.autoAssign ? "Auto-assign ON" : "Manual assign"}</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
                        <p className="text-xs font-medium text-[#64748B] mb-2">Members</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {team.members?.map((m, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#F8FAFC] rounded-lg">
                              <div className="w-5 h-5 rounded-full bg-[#2E86C1] text-white flex items-center justify-center text-[8px] font-bold">
                                {m.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                              </div>
                              <span className="text-[11px] text-[#334155]">{m.name}</span>
                              <span className="text-[9px] text-[#94A3B8]">({m.role})</span>
                            </div>
                          ))}
                          {(!team.members || team.members.length === 0) && <p className="text-xs text-[#94A3B8]">No members</p>}
                        </div>
                        <p className="text-xs font-medium text-[#64748B] mb-1">SLA Policy (High Priority)</p>
                        <div className="flex gap-4 text-[11px] text-[#475569]">
                          <span>Response: {team.slaPolicy?.high?.responseMinutes || 60} min</span>
                          <span>Resolution: {team.slaPolicy?.high?.resolutionMinutes || 480} min</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
