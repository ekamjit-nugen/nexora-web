"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { helpdeskApi, HelpdeskDashboard, HelpdeskStats } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const CATEGORY_COLORS: Record<string, string> = { it_support: "#3B82F6", hr: "#8B5CF6", finance: "#F59E0B", facilities: "#10B981", admin: "#EC4899", other: "#94A3B8" };
const PRIORITY_COLORS: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#94A3B8" };
const CATEGORY_LABELS: Record<string, string> = { it_support: "IT Support", hr: "HR", finance: "Finance", facilities: "Facilities", admin: "Admin", other: "Other" };

export default function HelpdeskDashboardPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<HelpdeskDashboard | null>(null);
  const [stats, setStats] = useState<HelpdeskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasOrgRole("manager")) { router.push("/helpdesk"); return; }
    (async () => {
      try {
        setLoading(true);
        const [dashRes, statsRes] = await Promise.all([helpdeskApi.getDashboard(), helpdeskApi.getStats()]);
        setDashboard(dashRes.data as any);
        setStats(statsRes.data as any);
      } catch { toast.error("Failed to load dashboard"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const categoryData = dashboard?.byCategory?.map(c => ({ name: CATEGORY_LABELS[c.category] || c.category, value: c.count, color: CATEGORY_COLORS[c.category] || "#94A3B8" })) || [];
  const priorityData = dashboard?.byPriority?.map(p => ({ name: p.priority, value: p.count, color: PRIORITY_COLORS[p.priority] || "#94A3B8" })) || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Helpdesk Dashboard</h1>
        <p className="text-sm text-[#64748B] mb-8">Support metrics and ticket overview</p>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse"><div className="h-3 bg-[#E2E8F0] rounded w-20 mb-3" /><div className="h-7 bg-[#E2E8F0] rounded w-14" /></div>)}
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Open Tickets</p>
                <p className="text-2xl font-bold text-[#EF4444] mt-1">{dashboard?.openTickets || 0}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Assigned to Me</p>
                <p className="text-2xl font-bold text-[#3B82F6] mt-1">{dashboard?.assignedToMe || 0}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">SLA Breached</p>
                <p className={`text-2xl font-bold mt-1 ${(dashboard?.slaBreached || 0) > 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>{dashboard?.slaBreached || 0}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Avg Resolution</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{dashboard?.avgResolutionHours || 0}h</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">SLA Compliance</p>
                <p className={`text-2xl font-bold mt-1 ${(stats?.slaCompliancePercent || 100) >= 90 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>{stats?.slaCompliancePercent || 100}%</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Tickets by Category</h3>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}>
                        {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No data</div>}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Tickets by Priority</h3>
                {priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={priorityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                        {priorityData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No data</div>}
              </div>
            </div>

            {/* Stats + Unassigned */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Overall Stats</h3>
                <div className="space-y-3 text-sm">
                  {[["Total Tickets", stats?.totalTickets], ["Open", stats?.openTickets], ["Resolved", stats?.resolvedTickets], ["Closed", stats?.closedTickets],
                    ["Avg Rating", stats?.avgRating ? `${stats.avgRating}/5 (${stats.ratedCount} ratings)` : "No ratings"],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between py-1 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">{label}</span>
                      <span className="font-medium text-[#0F172A]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Unassigned Tickets</h3>
                {(dashboard?.unassignedTickets?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-[#94A3B8] text-sm">All tickets are assigned</div>
                ) : (
                  <div className="space-y-2">
                    {dashboard?.unassignedTickets?.map(t => (
                      <div key={t._id} onClick={() => router.push(`/helpdesk/${t._id}`)}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] cursor-pointer hover:bg-[#FEE2E2] transition-colors">
                        <div>
                          <p className="text-xs font-medium text-[#0F172A]">{t.title}</p>
                          <p className="text-[10px] text-[#64748B]">{t.ticketNumber} · {CATEGORY_LABELS[t.category]}</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_COLORS[t.priority] ? `text-white` : ""}`} style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
