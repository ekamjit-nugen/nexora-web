"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { helpdeskApi, Ticket } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = { critical: "bg-[#FEE2E2] text-[#991B1B]", high: "bg-[#FEF3C7] text-[#92400E]", medium: "bg-[#DBEAFE] text-[#1E40AF]", low: "bg-[#F3F4F6] text-[#374151]" };
const STATUS_COLORS: Record<string, string> = { open: "bg-[#DBEAFE] text-[#1E40AF]", assigned: "bg-[#E0E7FF] text-[#3730A3]", in_progress: "bg-[#FEF3C7] text-[#92400E]", waiting_on_requester: "bg-[#FFF7ED] text-[#9A3412]", resolved: "bg-[#D1FAE5] text-[#065F46]", closed: "bg-[#F3F4F6] text-[#374151]" };
const CATEGORY_LABELS: Record<string, string> = { it_support: "IT Support", hr: "HR", finance: "Finance", facilities: "Facilities", admin: "Admin", other: "Other" };

export default function AllTicketsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [slaFilter, setSlaFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(pagination.page), limit: "20" };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (slaFilter) params.slaBreached = slaFilter;
      if (search) params.search = search;
      const res = await helpdeskApi.getTickets(params);
      setTickets((res as any).data || []);
      setPagination(prev => ({ ...prev, total: (res as any).pagination?.total || 0, pages: (res as any).pagination?.pages || 0 }));
    } catch { toast.error("Failed"); }
    finally { setLoading(false); }
  }, [statusFilter, categoryFilter, priorityFilter, slaFilter, search, pagination.page]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasOrgRole("manager")) { router.push("/helpdesk"); return; }
    fetchTickets();
  }, [authLoading, user, fetchTickets]);

  if (authLoading || !user) return null;

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">All Tickets</h1>
        <p className="text-sm text-[#64748B] mb-6">{pagination.total} total tickets across all teams</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-48 text-sm" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
            <option value="">All Status</option>
            {["open", "assigned", "in_progress", "waiting_on_requester", "resolved", "closed"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
            <option value="">All Priorities</option>
            {["critical", "high", "medium", "low"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={slaFilter} onChange={e => { setSlaFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
            <option value="">All SLA</option>
            <option value="true">SLA Breached</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0]">
          {loading ? (
            <div className="p-12 text-center text-[#94A3B8]">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">#</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Priority</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Requester</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Assignee</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">SLA</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => {
                    const breached = t.slaResponseBreached || t.slaResolutionBreached;
                    return (
                      <tr key={t._id} onClick={() => router.push(`/helpdesk/${t._id}`)} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer">
                        <td className="px-4 py-3 font-mono text-[10px] text-[#94A3B8]">{t.ticketNumber}</td>
                        <td className="px-4 py-3 font-medium text-[#0F172A] max-w-[200px] truncate">{t.title}</td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{CATEGORY_LABELS[t.category] || t.category}</td>
                        <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span></td>
                        <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[t.status]}`}>{t.status.replace(/_/g, " ")}</span></td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{t.requesterName || "-"}</td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{t.assigneeName || <span className="text-[#F59E0B]">Unassigned</span>}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold ${breached ? "text-[#EF4444]" : "text-[#10B981]"}`}>{breached ? "BREACH" : "OK"}</span></td>
                        <td className="px-4 py-3 text-right text-[10px] text-[#94A3B8]">{timeAgo(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {tickets.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-[#94A3B8]">No tickets found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-[#64748B]">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page <= 1} className="px-3 py-1 rounded border border-[#E2E8F0] disabled:opacity-40">Prev</button>
              <button onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))} disabled={pagination.page >= pagination.pages} className="px-3 py-1 rounded border border-[#E2E8F0] disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
