"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { helpdeskApi, Ticket } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  high: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  medium: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  low: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  assigned: { bg: "bg-[#E0E7FF]", text: "text-[#3730A3]" },
  in_progress: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  waiting_on_requester: { bg: "bg-[#FFF7ED]", text: "text-[#9A3412]" },
  resolved: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  closed: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
  cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]" },
};

const CATEGORY_LABELS: Record<string, string> = {
  it_support: "IT Support", hr: "HR", finance: "Finance",
  facilities: "Facilities", admin: "Admin", other: "Other",
};

type StatusTab = "all" | "open" | "in_progress" | "resolved" | "closed";

export default function MyTicketsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "it_support", priority: "medium" });

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(pagination.page), limit: "20" };
      if (statusTab !== "all") {
        if (statusTab === "open") params.status = "open";
        else if (statusTab === "in_progress") params.status = "in_progress";
        else params.status = statusTab;
      }
      if (search) params.search = search;
      const res = await helpdeskApi.getTickets(params);
      setTickets((res as any).data || []);
      setPagination(prev => ({ ...prev, total: (res as any).pagination?.total || 0, pages: (res as any).pagination?.pages || 0 }));
    } catch { toast.error("Failed to load tickets"); }
    finally { setLoading(false); }
  }, [statusTab, search, pagination.page]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchTickets();
  }, [authLoading, user, fetchTickets]);

  if (authLoading || !user) return null;

  const handleCreate = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    try {
      await helpdeskApi.createTicket(form);
      toast.success("Ticket created");
      setShowCreate(false);
      setForm({ title: "", description: "", category: "it_support", priority: "medium" });
      fetchTickets();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" }, { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" }, { key: "resolved", label: "Resolved" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">My Tickets</h1>
            <p className="text-sm text-[#64748B] mt-1">Create and track your support requests</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
            {showCreate ? "Cancel" : "New Ticket"}
          </Button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Create Support Ticket</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Title *</label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Brief description of your issue" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Category *</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  <option value="it_support">IT Support</option>
                  <option value="hr">HR</option>
                  <option value="finance">Finance</option>
                  <option value="facilities">Facilities</option>
                  <option value="admin">Admin</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe your issue in detail..." rows={4}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Submit Ticket</Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1 bg-white rounded-lg p-1 border border-[#E2E8F0]">
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setStatusTab(t.key); setPagination(p => ({ ...p, page: 1 })); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${statusTab === t.key ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <Input placeholder="Search tickets..." value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-56 text-sm" />
        </div>

        {/* Ticket List */}
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse"><div className="h-4 bg-[#E2E8F0] rounded w-48 mb-2" /><div className="h-3 bg-[#E2E8F0] rounded w-32" /></div>)}</div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center text-[#94A3B8] text-sm">
            {statusTab === "all" ? "No tickets yet. Create one to get started." : `No ${statusTab.replace("_", " ")} tickets.`}
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => {
              const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium;
              const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
              const now = new Date();
              const slaBreached = ticket.slaResponseBreached || ticket.slaResolutionBreached ||
                (ticket.slaResolutionDue && new Date(ticket.slaResolutionDue) < now && !ticket.resolvedAt);
              return (
                <div key={ticket._id} onClick={() => router.push(`/helpdesk/${ticket._id}`)}
                  className={`bg-white rounded-xl shadow-sm border ${slaBreached ? "border-[#EF4444]" : "border-[#E2E8F0]"} p-5 hover:shadow-md cursor-pointer transition-all`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-[#94A3B8]">{ticket.ticketNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${pc.bg} ${pc.text}`}>{ticket.priority.toUpperCase()}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sc.bg} ${sc.text}`}>{ticket.status.replace(/_/g, " ").toUpperCase()}</span>
                        <span className="px-1.5 py-0.5 bg-[#F1F5F9] text-[#475569] rounded text-[9px] font-medium">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                        {slaBreached && <span className="px-1.5 py-0.5 bg-[#FEE2E2] text-[#991B1B] rounded text-[9px] font-bold">SLA BREACH</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F172A]">{ticket.title}</h3>
                      {ticket.description && <p className="text-xs text-[#64748B] mt-1 line-clamp-1">{ticket.description}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[10px] text-[#94A3B8]">{timeAgo(ticket.createdAt)}</p>
                      {ticket.assigneeName && <p className="text-[10px] text-[#64748B] mt-1">{ticket.assigneeName}</p>}
                      {ticket.rating && <p className="text-xs text-[#F59E0B] mt-1">{"★".repeat(ticket.rating)}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
