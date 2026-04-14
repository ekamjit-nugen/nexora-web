"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PayrollEntry {
  _id: string;
  employeeId: string;
  employeeName?: string;
  status: string;
  grossPay: number;
  totalDeductions: number;
  statutoryDeductions?: number;
  netPay: number;
  earnings?: Array<{ name: string; amount: number }>;
  deductions?: Array<{ name: string; amount: number }>;
  statutory?: Array<{ name: string; amount: number }>;
}

interface AuditEntry {
  action: string;
  performedBy?: string;
  timestamp?: string;
  notes?: string;
}

interface PayrollRun {
  _id: string;
  runNumber?: string;
  month: number;
  year: number;
  status: string;
  employeeCount?: number;
  processedCount?: number;
  skippedCount?: number;
  totalGrossPay?: number;
  totalNetPay?: number;
  totalDeductions?: number;
  grossPay?: number;
  netPay?: number;
  auditTrail?: AuditEntry[];
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Status configs
// ---------------------------------------------------------------------------
const runStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  processing: { label: "Processing", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  review: { label: "In Review", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  finalized: { label: "Finalized", color: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

const entryStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  computed: { label: "Computed", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  reviewed: { label: "Reviewed", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  on_hold: { label: "On Hold", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

const txStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600 border-gray-200" },
  processing: { label: "Processing", color: "bg-blue-50 text-blue-700 border-blue-200" },
  processed: { label: "Processed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", color: "bg-red-50 text-red-700 border-red-200" },
  reversed: { label: "Reversed", color: "bg-amber-50 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatCurrency = (paise: number) => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90.00";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

const getMonthLabel = (month: number, year: number) =>
  new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PayrollRunDetailPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [initiatingPayout, setInitiatingPayout] = useState(false);

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
  const paginatedEntries = entries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when entries change
  useEffect(() => { setCurrentPage(1); }, [entries.length]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchRun = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const [runRes, entriesRes] = await Promise.all([
        payrollApi.getRun(runId),
        payrollApi.getRunEntries(runId),
      ]);
      setRun(runRes.data as any);
      setEntries(Array.isArray(entriesRes.data) ? entriesRes.data as any[] : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payroll run");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (user && runId) fetchRun();
  }, [fetchRun, user, runId]);

  const fetchTransactions = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await payrollApi.getPayoutTransactions(runId);
      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silently ignore — payouts are optional
    }
  }, [runId]);

  useEffect(() => {
    if (run) fetchTransactions();
  }, [run, fetchTransactions]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------
  const handleProcess = async () => {
    if (!run || !window.confirm("Process this payroll run? This will compute salaries for all employees.")) return;
    setActionLoading("process");
    try {
      await payrollApi.processRun(run._id);
      toast.success("Payroll processing started");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to process payroll run");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!run || !window.confirm("Approve this payroll run?")) return;
    setActionLoading("approve");
    try {
      await payrollApi.updateRunStatus(run._id, { status: "approved" });
      toast.success("Payroll run approved");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve payroll run");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalize = async () => {
    if (!run || !window.confirm("Finalize this payroll run? This action cannot be undone.")) return;
    setActionLoading("finalize");
    try {
      await payrollApi.updateRunStatus(run._id, { status: "finalized" });
      toast.success("Payroll run finalized");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize payroll run");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!run || !window.confirm("Mark this payroll run as paid?")) return;
    setActionLoading("markPaid");
    try {
      await payrollApi.updateRunStatus(run._id, { status: "paid" });
      toast.success("Payroll run marked as paid");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark payroll run as paid");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGeneratePayslips = async () => {
    if (!run || !window.confirm("Generate payslips for this payroll run?")) return;
    setActionLoading("payslips");
    try {
      await payrollApi.generatePayslips(run._id);
      toast.success("Payslips generated successfully");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate payslips");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopen = async () => {
    if (!run || !window.confirm("Re-open this payroll run for review?")) return;
    setActionLoading("reopen");
    try {
      await payrollApi.updateRunStatus(run._id, { status: "review" });
      toast.success("Payroll run re-opened for review");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to re-open payroll run");
    } finally {
      setActionLoading(null);
    }
  };

  const handleHoldEntry = async (employeeId: string) => {
    const reason = window.prompt("Reason for holding this entry:");
    if (!reason) return;
    setActionLoading(`hold-${employeeId}`);
    try {
      await payrollApi.holdEntry(runId, employeeId, reason);
      toast.success("Entry placed on hold");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to hold entry");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReleaseEntry = async (employeeId: string) => {
    if (!window.confirm("Release this entry from hold?")) return;
    setActionLoading(`release-${employeeId}`);
    try {
      await payrollApi.releaseEntry(runId, employeeId);
      toast.success("Entry released");
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to release entry");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInitiatePayout = async () => {
    if (!window.confirm(`Initiate bank payouts for ${(run as any)?.summary?.processedEmployees || 0} employees?`)) return;
    setInitiatingPayout(true);
    try {
      const res = await payrollApi.initiateBulkPayout(runId);
      const d = res.data as any;
      toast.success(`Payouts initiated: ${d.initiated || 0} succeeded, ${d.failed || 0} failed`);
      await fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payouts");
    } finally {
      setInitiatingPayout(false);
    }
  };

  const handleRetry = async (txId: string) => {
    try {
      await payrollApi.retryBankTransaction(txId);
      toast.success("Retry initiated");
      await fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Retry failed");
    }
  };

  const handleSync = async (txId: string) => {
    try {
      await payrollApi.syncBankTransaction(txId);
      toast.success("Status synced");
      await fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    }
  };

  const handleSyncAllPayouts = async () => {
    toast.info("Syncing all transactions...");
    for (const tx of transactions.filter((t) => ["pending", "processing"].includes(t.status))) {
      try { await payrollApi.syncBankTransaction(tx._id); } catch {}
    }
    await fetchTransactions();
    toast.success("Sync complete");
  };

  const handleDownloadBankFile = async () => {
    try {
      const res = await payrollApi.downloadBankFile(runId);
      const d = res.data as any;
      const content = typeof d.content === "string" ? d.content : JSON.stringify(d.content, null, 2);
      const blob = new Blob([content], { type: d.contentType || "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.filename || `bank-file-${runId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Bank file downloaded");
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / Auth gate
  // ---------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  const isManager = hasOrgRole("manager");
  const statusCfg = run ? (runStatusConfig[run.status] || runStatusConfig.draft) : runStatusConfig.draft;

  // Summary values
  const totalEmployees = run?.employeeCount ?? entries.length;
  const processedCount = run?.processedCount ?? entries.filter((e) => e.status !== "draft").length;
  const skippedCount = run?.skippedCount ?? entries.filter((e) => e.status === "on_hold").length;
  const grossPay = run?.totalGrossPay ?? run?.grossPay ?? 0;
  const netPay = run?.totalNetPay ?? run?.netPay ?? 0;
  const totalDeductions = run?.totalDeductions ?? entries.reduce((sum, e) => sum + (e.totalDeductions || 0), 0);

  // Bank payout stats
  const canInitiatePayout = !!run && ["approved", "finalized", "paid"].includes(run.status);
  const totalPayoutAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const payoutProcessedCount = transactions.filter((t) => t.status === "processed").length;
  const payoutPendingCount = transactions.filter((t) => ["pending", "processing"].includes(t.status)).length;
  const payoutFailedCount = transactions.filter((t) => t.status === "failed").length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/payroll")}
                className="flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Payroll Runs
              </button>
              <div className="h-5 w-px bg-[#E2E8F0]" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[20px] font-bold text-[#0F172A]">
                    {run?.runNumber || (run ? `PR-${run.year}-${String(run.month).padStart(2, "0")}` : "Loading...")}
                  </h1>
                  {run && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${statusCfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  )}
                </div>
                {run && (
                  <p className="text-[13px] text-[#64748B] mt-0.5">{getMonthLabel(run.month, run.year)}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
          </div>
        ) : !run ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[15px] font-medium text-[#0F172A]">Payroll run not found</p>
            <Button onClick={() => router.push("/payroll")} variant="outline" className="mt-4 h-9 text-[13px]">
              Back to Payroll Runs
            </Button>
          </div>
        ) : (
          <div className="flex-1 p-8 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-6 gap-4">
              {[
                { label: "Total Employees", value: String(totalEmployees), border: "border-l-[#2E86C1]" },
                { label: "Processed", value: String(processedCount), border: "border-l-emerald-500" },
                { label: "Skipped / On Hold", value: String(skippedCount), border: "border-l-amber-500" },
                { label: "Gross Pay", value: formatCurrency(grossPay), border: "border-l-blue-500" },
                { label: "Net Pay", value: formatCurrency(netPay), border: "border-l-green-500" },
                { label: "Total Deductions", value: formatCurrency(totalDeductions), border: "border-l-red-500" },
              ].map((card) => (
                <div key={card.label} className={`bg-white rounded-xl border border-[#E2E8F0] shadow-sm ${card.border} border-l-4 p-5`}>
                  <p className="text-[12px] text-[#64748B] uppercase tracking-wider">{card.label}</p>
                  <p className="text-[18px] font-bold text-[#0F172A] mt-1">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            {isManager && (
              <div className="flex items-center gap-2 bg-white rounded-xl border border-[#E2E8F0] p-4">
                <span className="text-[13px] font-medium text-[#64748B] mr-2">Actions:</span>

                {run.status === "draft" && (
                  <Button
                    size="sm"
                    className="h-8 text-[12px] bg-blue-600 hover:bg-blue-700"
                    disabled={actionLoading !== null}
                    onClick={handleProcess}
                  >
                    {actionLoading === "process" ? "Processing..." : "Process"}
                  </Button>
                )}

                {run.status === "review" && (
                  <Button
                    size="sm"
                    className="h-8 text-[12px] bg-emerald-600 hover:bg-emerald-700"
                    disabled={actionLoading !== null}
                    onClick={handleApprove}
                  >
                    {actionLoading === "approve" ? "Approving..." : "Approve"}
                  </Button>
                )}

                {run.status === "approved" && (
                  <>
                    <Button
                      size="sm"
                      className="h-8 text-[12px] bg-purple-600 hover:bg-purple-700"
                      disabled={actionLoading !== null}
                      onClick={handleFinalize}
                    >
                      {actionLoading === "finalize" ? "Finalizing..." : "Finalize"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px]"
                      disabled={actionLoading !== null}
                      onClick={handleReopen}
                    >
                      {actionLoading === "reopen" ? "Re-opening..." : "Re-open"}
                    </Button>
                  </>
                )}

                {run.status === "finalized" && (
                  <>
                    <Button
                      size="sm"
                      className="h-8 text-[12px] bg-green-600 hover:bg-green-700"
                      disabled={actionLoading !== null}
                      onClick={handleMarkPaid}
                    >
                      {actionLoading === "markPaid" ? "Updating..." : "Mark Paid"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px]"
                      disabled={actionLoading !== null}
                      onClick={handleGeneratePayslips}
                    >
                      {actionLoading === "payslips" ? "Generating..." : "Generate Payslips"}
                    </Button>
                  </>
                )}

                {(run.status === "paid" || run.status === "finalized") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[12px]"
                    disabled={actionLoading !== null}
                    onClick={handleGeneratePayslips}
                  >
                    {actionLoading === "payslips" ? "Generating..." : "Generate Payslips"}
                  </Button>
                )}
              </div>
            )}

            {/* Employee Entries Table */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E2E8F0]">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">Employee Entries</h3>
              </div>
              {entries.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-[13px] text-[#94A3B8]">No employee entries found for this run</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Employee</th>
                      <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Gross</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Deductions</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Statutory</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Net Pay</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry) => {
                      const eCfg = entryStatusConfig[entry.status] || entryStatusConfig.draft;
                      const isExpanded = expandedEntry === entry._id;
                      const isEntryLoading = actionLoading === `hold-${entry.employeeId}` || actionLoading === `release-${entry.employeeId}`;

                      return (
                        <tr key={entry._id} className="border-b border-[#E2E8F0] last:border-b-0">
                          <td className="px-5 py-4">
                            <div>
                              <p className="text-[13px] font-medium text-[#0F172A]">{entry.employeeName || entry.employeeId}</p>
                              {entry.employeeName && (
                                <p className="text-[11px] text-[#94A3B8]">{entry.employeeId}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${eCfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${eCfg.dot}`} />
                              {eCfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[13px] text-[#334155] text-right font-medium">
                            {formatCurrency(entry.grossPay || 0)}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-red-600 text-right font-medium">
                            {formatCurrency(entry.totalDeductions || 0)}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-[#334155] text-right font-medium">
                            {formatCurrency(entry.statutoryDeductions || 0)}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-emerald-700 text-right font-bold">
                            {formatCurrency(entry.netPay || 0)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2"
                                onClick={() => setExpandedEntry(isExpanded ? null : entry._id)}
                              >
                                {isExpanded ? "Hide" : "View"}
                              </Button>
                              {isManager && entry.status !== "on_hold" && (run.status === "review" || run.status === "processing") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                                  disabled={isEntryLoading}
                                  onClick={() => handleHoldEntry(entry.employeeId)}
                                >
                                  Hold
                                </Button>
                              )}
                              {isManager && entry.status === "on_hold" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                  disabled={isEntryLoading}
                                  onClick={() => handleReleaseEntry(entry.employeeId)}
                                >
                                  Release
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                  <p className="text-[12px] text-[#64748B]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, entries.length)} of {entries.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded entry detail */}
              {expandedEntry && (() => {
                const entry = entries.find((e) => e._id === expandedEntry);
                if (!entry) return null;
                return (
                  <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-6">
                    <h4 className="text-[14px] font-semibold text-[#0F172A] mb-4">
                      Breakdown for {entry.employeeName || entry.employeeId}
                    </h4>
                    <div className="grid grid-cols-3 gap-6">
                      {/* Earnings */}
                      <div>
                        <h5 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Earnings</h5>
                        <div className="space-y-1.5">
                          {(entry.earnings || []).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 px-3 bg-white rounded-lg">
                              <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                              <span className="text-[13px] font-medium text-[#0F172A]">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                          {(!entry.earnings || entry.earnings.length === 0) && (
                            <p className="text-[12px] text-[#94A3B8]">No earnings breakdown available</p>
                          )}
                        </div>
                      </div>

                      {/* Deductions */}
                      <div>
                        <h5 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Deductions</h5>
                        <div className="space-y-1.5">
                          {(entry.deductions || []).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 px-3 bg-white rounded-lg">
                              <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                              <span className="text-[13px] font-medium text-red-600">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                          {(!entry.deductions || entry.deductions.length === 0) && (
                            <p className="text-[12px] text-[#94A3B8]">No deductions breakdown available</p>
                          )}
                        </div>
                      </div>

                      {/* Statutory */}
                      <div>
                        <h5 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Statutory</h5>
                        <div className="space-y-1.5">
                          {(entry.statutory || []).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 px-3 bg-white rounded-lg">
                              <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                              <span className="text-[13px] font-medium text-red-600">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                          {(!entry.statutory || entry.statutory.length === 0) && (
                            <p className="text-[12px] text-[#94A3B8]">No statutory breakdown available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bank Payouts Section */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">Bank Payouts</h2>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    {transactions.length > 0
                      ? `${transactions.length} transactions initiated`
                      : "No payouts initiated yet"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadBankFile}
                    variant="outline"
                    disabled={!canInitiatePayout}
                    className="h-9 text-[13px]"
                  >
                    Download Bank File
                  </Button>
                  {transactions.length === 0 ? (
                    <Button
                      onClick={handleInitiatePayout}
                      disabled={!canInitiatePayout || initiatingPayout}
                      className="h-9 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]"
                    >
                      {initiatingPayout ? "Initiating..." : "Initiate Payout"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSyncAllPayouts}
                      variant="outline"
                      className="h-9 text-[13px]"
                    >
                      Sync Status
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats */}
              {transactions.length > 0 && (
                <div className="grid grid-cols-4 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
                  <div className="bg-white p-4">
                    <p className="text-[11px] text-[#64748B] uppercase font-medium">Total Amount</p>
                    <p className="text-[18px] font-bold text-[#0F172A] mt-1">{formatCurrency(totalPayoutAmount)}</p>
                  </div>
                  <div className="bg-white p-4">
                    <p className="text-[11px] text-[#64748B] uppercase font-medium">Processed</p>
                    <p className="text-[18px] font-bold text-emerald-600 mt-1">{payoutProcessedCount}</p>
                  </div>
                  <div className="bg-white p-4">
                    <p className="text-[11px] text-[#64748B] uppercase font-medium">Pending</p>
                    <p className="text-[18px] font-bold text-amber-600 mt-1">{payoutPendingCount}</p>
                  </div>
                  <div className="bg-white p-4">
                    <p className="text-[11px] text-[#64748B] uppercase font-medium">Failed</p>
                    <p className="text-[18px] font-bold text-red-600 mt-1">{payoutFailedCount}</p>
                  </div>
                </div>
              )}

              {/* Transactions Table */}
              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <th className="text-left px-5 py-3 font-semibold text-[#475569]">Employee</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#475569]">Amount</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#475569]">Mode</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#475569]">Account</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#475569]">Status</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#475569]">Initiated</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#475569]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {transactions.map((tx) => (
                        <tr key={tx._id} className="hover:bg-[#F8FAFC]">
                          <td className="px-5 py-3 text-[#0F172A]">{tx.employeeId}</td>
                          <td className="px-5 py-3 text-[#0F172A] font-medium">{formatCurrency(tx.amount)}</td>
                          <td className="px-5 py-3 text-[#64748B]">{tx.mode}</td>
                          <td className="px-5 py-3 text-[#64748B] font-mono">****{tx.bankDetails?.accountNumber}</td>
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${txStatusConfig[tx.status]?.color || ''}`}>
                              {txStatusConfig[tx.status]?.label || tx.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[#64748B]">
                            {tx.initiatedAt ? new Date(tx.initiatedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {tx.status === "failed" && (
                              <button
                                onClick={() => handleRetry(tx._id)}
                                className="text-[11px] text-[#2E86C1] hover:underline font-medium mr-3"
                              >
                                Retry
                              </button>
                            )}
                            {(tx.status === "pending" || tx.status === "processing") && (
                              <button
                                onClick={() => handleSync(tx._id)}
                                className="text-[11px] text-[#64748B] hover:text-[#0F172A] hover:underline"
                              >
                                Sync
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-[#E2E8F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <p className="text-[13px] text-[#64748B] mt-3">Payouts haven't been initiated for this run</p>
                  {canInitiatePayout ? (
                    <p className="text-[11px] text-[#94A3B8] mt-1">Once approved or finalized, you can initiate bulk bank transfers</p>
                  ) : (
                    <p className="text-[11px] text-[#94A3B8] mt-1">Approve or finalize the run first, then initiate payouts</p>
                  )}
                </div>
              )}
            </div>

            {/* Audit Trail */}
            {run.auditTrail && run.auditTrail.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowAuditTrail(!showAuditTrail)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F8FAFC] transition-colors"
                >
                  <h3 className="text-[15px] font-semibold text-[#0F172A]">
                    Audit Trail ({run.auditTrail.length})
                  </h3>
                  <svg
                    className={`w-5 h-5 text-[#64748B] transition-transform ${showAuditTrail ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {showAuditTrail && (
                  <div className="border-t border-[#E2E8F0]">
                    <div className="p-6 space-y-3">
                      {run.auditTrail.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-3 py-2 px-4 bg-[#F8FAFC] rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-[#2E86C1] mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#0F172A]">{entry.action}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {entry.performedBy && (
                                <span className="text-[11px] text-[#64748B]">by {entry.performedBy}</span>
                              )}
                              {entry.timestamp && (
                                <span className="text-[11px] text-[#94A3B8]">
                                  {new Date(entry.timestamp).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            {entry.notes && (
                              <p className="text-[12px] text-[#64748B] mt-1">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
