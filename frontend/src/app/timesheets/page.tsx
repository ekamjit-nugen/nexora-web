"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { timesheetApi, billingApi, clientApi, Timesheet, InvoicePreview, Client, ApprovalDelegation } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  revision_requested: { label: "Revision Needed", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

const categoryColors: Record<string, string> = {
  development: "bg-blue-50 text-blue-700",
  design: "bg-purple-50 text-purple-700",
  meeting: "bg-amber-50 text-amber-700",
  review: "bg-teal-50 text-teal-700",
  testing: "bg-green-50 text-green-700",
  documentation: "bg-gray-100 text-gray-700",
  admin: "bg-orange-50 text-orange-700",
  training: "bg-indigo-50 text-indigo-700",
  other: "bg-gray-50 text-gray-600",
};

function getWeekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function TimesheetsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"my" | "pending" | "all">("my");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createStart, setCreateStart] = useState(getWeekBounds(new Date()).start);
  const [createEnd, setCreateEnd] = useState(getWeekBounds(new Date()).end);
  const [creating, setCreating] = useState(false);
  const [populating, setPopulating] = useState<string | null>(null);

  // Review form
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Invoice generation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string | null>(null);

  // Delegation state
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [myDelegations, setMyDelegations] = useState<ApprovalDelegation[]>([]);
  const [delegatedToMe, setDelegatedToMe] = useState<ApprovalDelegation[]>([]);
  const [delegateId, setDelegateId] = useState("");
  const [delegationType, setDelegationType] = useState<string>("temporary");
  const [delegationProjectId, setDelegationProjectId] = useState("");
  const [delegationReason, setDelegationReason] = useState("");
  const [delegationStartDate, setDelegationStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [delegationEndDate, setDelegationEndDate] = useState("");
  const [creatingDelegation, setCreatingDelegation] = useState(false);
  const [showDelegationPanel, setShowDelegationPanel] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const isManager = user?.roles?.some((r: string) => ["admin", "super_admin", "manager", "hr"].includes(r)) || false;

  const fetchTimesheets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tsRes, statsRes] = await Promise.all([
        activeTab === "my"
          ? timesheetApi.getMyTimesheets()
          : activeTab === "pending"
          ? timesheetApi.getPendingTimesheets()
          : timesheetApi.getAll(),
        timesheetApi.getStats(),
      ]);
      setTimesheets(Array.isArray(tsRes.data) ? tsRes.data : []);
      setStats(statsRes.data || null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user) fetchTimesheets();
  }, [fetchTimesheets, user]);

  const fetchDelegations = useCallback(async () => {
    if (!user) return;
    try {
      const [myRes, toMeRes] = await Promise.all([
        isManager ? timesheetApi.getMyDelegations() : Promise.resolve({ data: [] }),
        timesheetApi.getDelegatedToMe(),
      ]);
      setMyDelegations(Array.isArray(myRes.data) ? myRes.data : []);
      setDelegatedToMe(Array.isArray(toMeRes.data) ? toMeRes.data : []);
    } catch {
      // Silently fail — delegations are supplementary
    }
  }, [user, isManager]);

  useEffect(() => {
    if (user) fetchDelegations();
  }, [fetchDelegations, user]);

  const isDelegate = delegatedToMe.length > 0;

  const handleCreateDelegation = async () => {
    if (!delegateId) { toast.error("Select a delegate"); return; }
    if (delegationType === "temporary" && !delegationEndDate) { toast.error("Select an end date for temporary delegation"); return; }
    if (delegationType === "project_specific" && !delegationProjectId) { toast.error("Enter a project ID for project-specific delegation"); return; }
    setCreatingDelegation(true);
    try {
      await timesheetApi.createDelegation({
        delegateId,
        type: delegationType,
        projectId: delegationType === "project_specific" ? delegationProjectId : undefined,
        reason: delegationReason || undefined,
        startDate: delegationStartDate,
        endDate: delegationType === "temporary" ? delegationEndDate : undefined,
        autoExpire: delegationType === "temporary",
      });
      toast.success("Delegation created successfully");
      setShowDelegationModal(false);
      setDelegateId("");
      setDelegationType("temporary");
      setDelegationProjectId("");
      setDelegationReason("");
      setDelegationEndDate("");
      fetchDelegations();
    } catch (err: any) {
      toast.error(err.message || "Failed to create delegation");
    } finally {
      setCreatingDelegation(false);
    }
  };

  const handleRevokeDelegation = async (id: string) => {
    try {
      await timesheetApi.revokeDelegation(id);
      toast.success("Delegation revoked");
      fetchDelegations();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke delegation");
    }
  };

  const handleCreate = async () => {
    if (!createStart || !createEnd) { toast.error("Select period dates"); return; }
    setCreating(true);
    try {
      await timesheetApi.create({ period: { startDate: createStart, endDate: createEnd, type: "weekly" } });
      toast.success("Timesheet created");
      setShowCreate(false);
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to create timesheet");
    } finally {
      setCreating(false);
    }
  };

  const handleAutoPopulate = async (ts: Timesheet) => {
    setPopulating(ts._id);
    try {
      const res = await timesheetApi.autoPopulate({ startDate: ts.period.startDate, endDate: ts.period.endDate });
      const entries = Array.isArray(res.data) ? res.data : [];
      await timesheetApi.update(ts._id, { entries: [...(ts.entries || []), ...entries] } as any);
      toast.success(`${entries.length} entries added`);
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-populate");
    } finally {
      setPopulating(null);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await timesheetApi.submit(id);
      toast.success("Timesheet submitted for review");
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    }
  };

  const handleReview = async (id: string, status: string) => {
    setSubmittingReview(true);
    try {
      await timesheetApi.review(id, { status, reviewComment: reviewComment || undefined });
      toast.success(`Timesheet ${status}`);
      setReviewingId(null);
      setReviewComment("");
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const approvedTimesheets = timesheets.filter(ts => ts.status === "approved");
  const selectedApproved = Array.from(selectedIds).filter(id => approvedTimesheets.some(ts => ts._id === id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedApproved.length === approvedTimesheets.length && approvedTimesheets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvedTimesheets.map(ts => ts._id)));
    }
  };

  const handlePreviewInvoice = async () => {
    if (selectedApproved.length === 0) {
      toast.error("Select at least one approved timesheet");
      return;
    }
    setPreviewLoading(true);
    setShowInvoiceModal(true);
    setGeneratedInvoiceId(null);
    setGeneratedInvoiceNumber(null);
    try {
      const [previewRes, clientsRes] = await Promise.all([
        billingApi.previewInvoice(selectedApproved),
        clientApi.getClients(),
      ]);
      setInvoicePreview(previewRes.data || null);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      if (previewRes.data?.suggestedClientId) {
        setSelectedClientId(previewRes.data.suggestedClientId);
      }
      // Default due date: 30 days from now
      const due = new Date();
      due.setDate(due.getDate() + 30);
      setInvoiceDueDate(due.toISOString().split("T")[0]);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate preview");
      setShowInvoiceModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invoicePreview) return;
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    setGenerating(true);
    try {
      const res = await billingApi.generateInvoice({
        timesheetIds: selectedApproved,
        clientId: selectedClientId,
        dueDate: invoiceDueDate || undefined,
        notes: invoiceNotes || undefined,
      });
      const result = res.data;
      setGeneratedInvoiceId(result?.invoice?._id || null);
      setGeneratedInvoiceNumber(result?.invoice?.invoiceNumber || null);
      toast.success(`Invoice ${result?.invoice?.invoiceNumber || ""} created`);
      setSelectedIds(new Set());
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setInvoicePreview(null);
    setGeneratedInvoiceId(null);
    setGeneratedInvoiceNumber(null);
    setInvoiceNotes("");
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Timesheets</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Track and manage time entries</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedApproved.length > 0 && (
              <Button
                onClick={handlePreviewInvoice}
                className="bg-emerald-600 hover:bg-emerald-700 h-9 gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                Generate Invoice ({selectedApproved.length})
              </Button>
            )}
            {isManager && (
              <Button
                variant="outline"
                onClick={() => setShowDelegationPanel(!showDelegationPanel)}
                className="h-9 gap-2 border-[#E2E8F0]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Delegation
              </Button>
            )}
            {isDelegate && !isManager && (
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
                Acting Approver
              </span>
            )}
            <Button onClick={() => setShowCreate(true)} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Timesheet
            </Button>
          </div>
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: stats.total ?? "-", color: "text-[#0F172A]" },
                { label: "Pending Review", value: stats.pending ?? "-", color: "text-blue-600" },
                { label: "Approved", value: stats.approved ?? "-", color: "text-emerald-600" },
                { label: "Hours This Week", value: stats.hoursThisWeek != null ? `${stats.hoursThisWeek}h` : "-", color: "text-[#2E86C1]" },
              ].map((s) => (
                <Card key={s.label} className="border-[#E2E8F0]">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <Card className="border-[#E2E8F0] bg-white">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Create Timesheet</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Start Date</label>
                    <Input type="date" value={createStart} onChange={(e) => setCreateStart(e.target.value)} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">End Date</label>
                    <Input type="date" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreate(false)} className="h-9 border-[#E2E8F0]">Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9">
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delegate Banner */}
          {isDelegate && !isManager && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="text-[13px] font-semibold text-indigo-800">You are reviewing timesheets on behalf of a manager</p>
                <p className="text-[11px] text-indigo-600 mt-0.5">
                  {delegatedToMe.map((d) => `Delegated by ${d.delegatorId} (${d.type}${d.reason ? ` - ${d.reason}` : ""})`).join("; ")}
                </p>
              </div>
            </div>
          )}

          {/* Delegation Management Panel */}
          {showDelegationPanel && isManager && (
            <Card className="border-[#E2E8F0] bg-white">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">Approval Delegations</h3>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setShowDelegationModal(true)} className="bg-[#2E86C1] hover:bg-[#2471A3] h-8 text-[12px] gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Delegate Approval
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDelegationPanel(false)} className="h-8 text-[12px] border-[#E2E8F0]">Close</Button>
                  </div>
                </div>

                {myDelegations.length === 0 ? (
                  <p className="text-[12px] text-[#94A3B8] py-4 text-center">No active delegations. Click &quot;Delegate Approval&quot; to assign approval authority.</p>
                ) : (
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <th className="text-left px-4 py-3 font-semibold text-[#475569]">Delegate</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#475569]">Type</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#475569]">Reason</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#475569]">Period</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#475569]">Status</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#475569]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {myDelegations.map((d) => (
                          <tr key={d._id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-medium text-[#0F172A]">{d.delegateId}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                d.type === "permanent" ? "bg-purple-50 text-purple-700" :
                                d.type === "temporary" ? "bg-blue-50 text-blue-700" :
                                "bg-teal-50 text-teal-700"
                              }`}>
                                {d.type.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#64748B]">{d.reason || "-"}</td>
                            <td className="px-4 py-3 text-[#64748B]">
                              {new Date(d.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {d.endDate && ` - ${new Date(d.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                              {!d.endDate && d.type === "permanent" && " - No end date"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {d.isActive ? "Active" : "Revoked"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {d.isActive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRevokeDelegation(d._id)}
                                  className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  Revoke
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit">
            {[
              { key: "my", label: "My Timesheets" },
              ...((isManager || isDelegate) ? [{ key: "pending", label: "Pending Review" }] : []),
              ...(isManager ? [{ key: "all", label: "All Timesheets" }] : []),
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === t.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Select all for approved timesheets */}
          {approvedTimesheets.length > 0 && !loading && (
            <div className="flex items-center gap-3 px-1">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[#64748B] select-none">
                <input
                  type="checkbox"
                  checked={selectedApproved.length === approvedTimesheets.length && approvedTimesheets.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1] h-4 w-4"
                />
                Select all approved ({approvedTimesheets.length})
              </label>
              {selectedApproved.length > 0 && (
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {selectedApproved.length} selected for invoicing
                </span>
              )}
            </div>
          )}

          {/* Timesheet list */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-[14px] font-semibold text-[#64748B]">No timesheets yet</p>
              <p className="text-[12px] text-[#94A3B8] mt-1">Create your first timesheet to start tracking time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timesheets.map((ts) => {
                const sc = statusConfig[ts.status] || statusConfig.draft;
                const isExpanded = expandedId === ts._id;
                const isReviewing = reviewingId === ts._id;
                return (
                  <Card key={ts._id} className="border-[#E2E8F0] bg-white overflow-hidden">
                    <CardContent className="p-0">
                      {/* Row header */}
                      <div
                        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : ts._id)}
                      >
                        <div className="flex items-center gap-4">
                          {ts.status === "approved" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(ts._id)}
                              onChange={(e) => { e.stopPropagation(); toggleSelect(ts._id); }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1] h-4 w-4 flex-shrink-0"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#0F172A]">
                              {new Date(ts.period.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(ts.period.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <p className="text-[12px] text-[#64748B] mt-0.5">{ts.entries?.length || 0} entries · {ts.totalHours || 0}h logged{ts.expectedHours ? ` / ${ts.expectedHours}h expected` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ts.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-[12px] border-[#E2E8F0] gap-1"
                                onClick={(e) => { e.stopPropagation(); handleAutoPopulate(ts); }}
                                disabled={populating === ts._id}
                              >
                                {populating === ts._id ? "Populating..." : "Auto-Populate"}
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-[12px] bg-[#2E86C1] hover:bg-[#2471A3]"
                                onClick={(e) => { e.stopPropagation(); handleSubmit(ts._id); }}
                              >
                                Submit for Review
                              </Button>
                            </>
                          )}
                          {ts.status === "submitted" && activeTab !== "my" && (isManager || isDelegate) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[12px] border-[#E2E8F0]"
                              onClick={(e) => { e.stopPropagation(); setReviewingId(ts._id); setExpandedId(ts._id); }}
                            >
                              Review
                            </Button>
                          )}
                          {ts.status === "rejected" || ts.status === "revision_requested" ? (
                            <span className="text-[11px] text-[#94A3B8]">Revert to edit above</span>
                          ) : null}
                          <svg className={`w-4 h-4 text-[#94A3B8] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>

                      {/* Review comment */}
                      {ts.reviewComment && (
                        <div className="mx-5 mb-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-[11px] font-semibold text-amber-700 mb-1">Review Comment</p>
                          <p className="text-[12px] text-amber-800">{ts.reviewComment}</p>
                        </div>
                      )}

                      {/* Expanded entries */}
                      {isExpanded && (
                        <div className="px-5 pb-5">
                          {(ts.entries || []).length === 0 ? (
                            <p className="text-[13px] text-[#94A3B8] py-4 text-center">No entries yet. Use Auto-Populate or log time on tasks.</p>
                          ) : (
                            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                              <table className="w-full text-[12px]">
                                <thead>
                                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Date</th>
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Task</th>
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Category</th>
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Description</th>
                                    <th className="text-right px-4 py-3 font-semibold text-[#475569]">Hours</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F1F5F9]">
                                  {ts.entries.map((e, i) => (
                                    <tr key={i} className="hover:bg-[#F8FAFC]">
                                      <td className="px-4 py-3 text-[#64748B]">{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                                      <td className="px-4 py-3">
                                        <p className="font-medium text-[#0F172A]">{e.taskKey && <span className="text-[#94A3B8] mr-1">{e.taskKey}</span>}{e.taskTitle || "—"}</p>
                                        {e.projectName && <p className="text-[11px] text-[#94A3B8]">{e.projectName}</p>}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColors[e.category || "other"] || categoryColors.other}`}>
                                          {e.category || "other"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-[#64748B] max-w-[200px] truncate">{e.description || "—"}</td>
                                      <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">{e.hours}h</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-[#475569]">Total</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#0F172A]">{ts.totalHours || 0}h</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}

                          {/* Review form */}
                          {isReviewing && (
                            <div className="mt-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
                              <p className="text-[13px] font-semibold text-[#0F172A]">Review Timesheet</p>
                              <Input
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Optional comment..."
                                className="h-10 text-sm bg-white border-[#E2E8F0]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleReview(ts._id, "approved")}
                                  disabled={submittingReview}
                                  className="bg-emerald-600 hover:bg-emerald-700 h-9"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReview(ts._id, "revision_requested")}
                                  disabled={submittingReview}
                                  className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50"
                                >
                                  Request Revision
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReview(ts._id, "rejected")}
                                  disabled={submittingReview}
                                  className="h-9 border-red-300 text-red-600 hover:bg-red-50"
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setReviewingId(null); setReviewComment(""); }}
                                  className="h-9 border-[#E2E8F0] ml-auto"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Delegation Creation Modal */}
        {showDelegationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
              <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A]">Delegate Approval Authority</h2>
                  <p className="text-[12px] text-[#64748B] mt-0.5">Assign timesheet approval rights to another team member</p>
                </div>
                <button onClick={() => setShowDelegationModal(false)} className="text-[#94A3B8] hover:text-[#64748B] p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Delegate (User ID) *</label>
                  <Input
                    value={delegateId}
                    onChange={(e) => setDelegateId(e.target.value)}
                    placeholder="Enter delegate user ID..."
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Delegation Type *</label>
                  <select
                    value={delegationType}
                    onChange={(e) => setDelegationType(e.target.value)}
                    className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  >
                    <option value="temporary">Temporary (date range)</option>
                    <option value="permanent">Permanent</option>
                    <option value="project_specific">Project-Specific</option>
                  </select>
                </div>
                {delegationType === "project_specific" && (
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Project ID *</label>
                    <Input
                      value={delegationProjectId}
                      onChange={(e) => setDelegationProjectId(e.target.value)}
                      placeholder="Enter project ID..."
                      className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Reason</label>
                  <Input
                    value={delegationReason}
                    onChange={(e) => setDelegationReason(e.target.value)}
                    placeholder="e.g., On leave, Vacation, In meetings..."
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Start Date *</label>
                    <Input
                      type="date"
                      value={delegationStartDate}
                      onChange={(e) => setDelegationStartDate(e.target.value)}
                      className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                    />
                  </div>
                  {delegationType === "temporary" && (
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">End Date *</label>
                      <Input
                        type="date"
                        value={delegationEndDate}
                        onChange={(e) => setDelegationEndDate(e.target.value)}
                        className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setShowDelegationModal(false)} className="h-9 border-[#E2E8F0]">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateDelegation}
                    disabled={creatingDelegation}
                    className="bg-[#2E86C1] hover:bg-[#2471A3] h-9"
                  >
                    {creatingDelegation ? "Creating..." : "Create Delegation"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Preview Modal */}
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
              <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A]">
                    {generatedInvoiceId ? "Invoice Created" : "Invoice Preview"}
                  </h2>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    {generatedInvoiceId
                      ? `Invoice ${generatedInvoiceNumber} has been created as a draft`
                      : `Preview based on ${selectedApproved.length} approved timesheet(s)`}
                  </p>
                </div>
                <button onClick={closeInvoiceModal} className="text-[#94A3B8] hover:text-[#64748B] p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
                  </div>
                ) : generatedInvoiceId ? (
                  /* Success state */
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-[#0F172A]">Invoice {generatedInvoiceNumber} Created</p>
                      <p className="text-[13px] text-[#64748B] mt-1">The invoice has been saved as a draft. You can review, edit, and send it from the Invoices page.</p>
                    </div>
                    <div className="flex gap-3 justify-center mt-4">
                      <Button
                        onClick={() => router.push("/invoices")}
                        className="bg-[#2E86C1] hover:bg-[#2471A3] h-9"
                      >
                        View in Invoices
                      </Button>
                      <Button variant="outline" onClick={closeInvoiceModal} className="h-9 border-[#E2E8F0]">
                        Close
                      </Button>
                    </div>
                  </div>
                ) : invoicePreview ? (
                  <>
                    {/* Line items table */}
                    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <th className="text-left px-4 py-3 font-semibold text-[#475569]">Project</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#475569]">Person</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#475569]">Hours</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#475569]">Rate</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#475569]">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {invoicePreview.lineItems.map((li, i) => (
                            <tr key={i} className="hover:bg-[#F8FAFC]">
                              <td className="px-4 py-3 font-medium text-[#0F172A]">{li.projectName}</td>
                              <td className="px-4 py-3 text-[#64748B]">{li.personName}</td>
                              <td className="px-4 py-3 text-right text-[#0F172A]">{li.hours}h</td>
                              <td className="px-4 py-3 text-right text-[#64748B]">{formatCurrency(li.rate, li.currency)}/h</td>
                              <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">{formatCurrency(li.amount, li.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {/* Project subtotals */}
                          {invoicePreview.projectSubtotals.length > 1 && invoicePreview.projectSubtotals.map((ps, i) => (
                            <tr key={`sub-${i}`} className="bg-[#FAFBFC] border-t border-[#F1F5F9]">
                              <td colSpan={2} className="px-4 py-2 text-[11px] font-semibold text-[#64748B]">{ps.projectName} subtotal</td>
                              <td className="px-4 py-2 text-right text-[11px] text-[#64748B]">{ps.hours}h</td>
                              <td />
                              <td className="px-4 py-2 text-right text-[11px] font-semibold text-[#475569]">{formatCurrency(ps.amount, invoicePreview.currency)}</td>
                            </tr>
                          ))}
                          <tr className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                            <td colSpan={2} className="px-4 py-3 text-right font-bold text-[#0F172A]">Grand Total</td>
                            <td className="px-4 py-3 text-right font-bold text-[#0F172A]">{invoicePreview.totalHours}h</td>
                            <td />
                            <td className="px-4 py-3 text-right font-bold text-[#0F172A] text-[14px]">{formatCurrency(invoicePreview.grandTotal, invoicePreview.currency)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {invoicePreview.grandTotal === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <p className="text-[12px] text-amber-800 font-medium">No billing rates configured for these projects. Set up billing rates in project settings before generating an invoice.</p>
                      </div>
                    )}

                    {/* Invoice configuration */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Client *</label>
                        <select
                          value={selectedClientId}
                          onChange={(e) => setSelectedClientId(e.target.value)}
                          className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                        >
                          <option value="">Select client...</option>
                          {clients.map(c => (
                            <option key={c._id} value={c._id}>{c.displayName || c.companyName}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Due Date</label>
                        <Input
                          type="date"
                          value={invoiceDueDate}
                          onChange={(e) => setInvoiceDueDate(e.target.value)}
                          className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Notes (optional)</label>
                      <Input
                        value={invoiceNotes}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        placeholder="Add notes to the invoice..."
                        className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-2">
                      <Button variant="outline" onClick={closeInvoiceModal} className="h-9 border-[#E2E8F0]">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleGenerateInvoice}
                        disabled={generating || !selectedClientId || invoicePreview.grandTotal === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 h-9 gap-2"
                      >
                        {generating ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                            Create Invoice
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
