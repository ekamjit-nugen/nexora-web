"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi, Employee } from "@/lib/api";
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
  // Live API nests amounts under `totals` and uses different keys
  // (grossEarnings / netPayable / totalStatutory). Expose both shapes so
  // legacy flat fields still render when seen, but prefer the nested ones
  // for new data.
  totals?: {
    grossEarnings?: number;
    totalDeductions?: number;
    totalStatutory?: number;
    netPayable?: number;
    totalReimbursements?: number;
    totalBonuses?: number;
    totalArrears?: number;
    overtimePay?: number;
    lopDeduction?: number;
  };
  grossPay?: number;
  totalDeductions?: number;
  statutoryDeductions?: number;
  netPay?: number;
  earnings?: Array<{ name: string; amount?: number; actualAmount?: number; fullAmount?: number; code?: string }>;
  deductions?: Array<{ name: string; amount: number; code?: string; category?: string }>;
  statutory?: Array<{ name: string; amount: number }>;
}

interface AuditEntry {
  action: string;
  performedBy?: string;
  // Backend writes `performedAt`; older code / other collections sometimes
  // used `timestamp`. Accept both so we never silently drop the date.
  performedAt?: string;
  timestamp?: string;
  notes?: string;
  previousStatus?: string | null;
  newStatus?: string | null;
}

interface PayrollRun {
  _id: string;
  runNumber?: string;
  // The live API returns these under nested objects — the legacy flat fields
  // (month/year/totalGrossPay/...) only exist on very old records from before
  // the schema was normalised. Keep them as fallbacks so both shapes render.
  payPeriod?: { month: number; year: number; startDate?: string; endDate?: string };
  summary?: {
    totalEmployees?: number;
    processedEmployees?: number;
    skippedEmployees?: number;
    totalGross?: number;
    totalNet?: number;
    totalDeductions?: number;
    totalReimbursements?: number;
    totalBonuses?: number;
  };
  month?: number;
  year?: number;
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
// QA finding (UX-P2 class): payroll-run summary amounts are stored in
// RUPEES on the backend (not paise). Dividing by 100 turned ₹95,000 into
// ₹950. Match the listing page's behaviour — no divide.
const formatCurrency = (rupees: number) => {
  if (typeof rupees !== "number" || isNaN(rupees)) return "\u20B90.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

const getMonthLabel = (month: number, year: number) =>
  new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Human labels for audit trail actions. The backend writes snake_case
// enum values (e.g. `status_changed_to_approved`, `processing_started`)
// that aren't reader-friendly. Map the well-known ones explicitly; for
// anything else strip the `status_changed_to_` prefix and Title-Case the
// remainder so new actions still render sanely without a code change.
const AUDIT_ACTION_LABELS: Record<string, string> = {
  initiated: "Run initiated",
  processing_started: "Processing started",
  processing_completed: "Processing completed",
  processing_failed: "Processing failed",
  status_changed_to_review: "Moved to review",
  status_changed_to_approved: "Approved",
  status_changed_to_finalized: "Finalized",
  status_changed_to_paid: "Marked as paid",
  status_changed_to_cancelled: "Cancelled",
  payslips_generated: "Payslips generated",
  payout_initiated: "Payout initiated",
  payout_completed: "Payout completed",
  payout_failed: "Payout failed",
  entry_held: "Entry put on hold",
  entry_released: "Entry released from hold",
  entry_overridden: "Entry overridden",
};

const humanizeAuditAction = (action: string): string => {
  if (!action) return "Update";
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  const stripped = action.replace(/^status_changed_to_/, "").replace(/_/g, " ");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
};

// Title-case a snake_case status (for "Review → Approved" chips in audit rows)
const humanizeStatus = (s?: string | null): string => {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

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
  // HR employee lookup so the entry rows can show a human name instead of
  // a raw ObjectId. Built from `GET /employees?limit=100` once per load
  // and indexed by the HR employee `_id` (which is what PayrollEntry.employeeId
  // points at). Falls through to the id string when the employee isn't found
  // (e.g. terminated user who was still in this past run).
  const [employeeLookup, setEmployeeLookup] = useState<Record<string, Employee>>({});
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
      const [runRes, entriesRes, empsRes] = await Promise.all([
        payrollApi.getRun(runId),
        payrollApi.getRunEntries(runId),
        // HR list is used to resolve employeeId → name. Fetch all statuses
        // (no `status=active`) because a finalised past run can include
        // employees who've since been terminated / gone on notice.
        hrApi.getEmployees({ limit: "100" }).catch(() => ({ data: [] as any })),
      ]);
      setRun(runRes.data as any);
      // `GET /payroll-runs/:id/entries` returns `{success, data: {data: [...], pagination}}`
      // (controller double-wraps). Unwrap both shapes so the entries list
      // populates regardless of whether the gateway fix lands.
      const rawEntries: any = entriesRes.data;
      const entriesList: any[] = Array.isArray(rawEntries)
        ? rawEntries
        : Array.isArray(rawEntries?.data)
          ? rawEntries.data
          : [];
      setEntries(entriesList);

      const empsList: any[] = Array.isArray(empsRes?.data)
        ? empsRes.data
        : Array.isArray((empsRes?.data as any)?.data)
          ? (empsRes.data as any).data
          : [];
      const map: Record<string, Employee> = {};
      for (const e of empsList) if (e?._id) map[e._id] = e;
      setEmployeeLookup(map);
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

  // Reopen paths:
  //   - approved → review: keep using /status (no money yet committed)
  //   - finalized → review: use /reopen (maker-checker + reason required)
  // The /reopen endpoint rejects paid runs with a clear error pointing
  // to the supplementary-run path, so we don't need a separate client gate.
  const handleReopenApproved = async () => {
    if (!run || !window.confirm("Re-open this approved run for review? This resets the approval stamp.")) return;
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

  const handleReopenFinalized = async () => {
    if (!run) return;
    const reason = window.prompt(
      "Reason for reopening this finalized run (required — stored on the audit trail):",
    );
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("A reason is required to reopen a finalized run.");
      return;
    }
    setActionLoading("reopen");
    try {
      await payrollApi.reopenRun(run._id, { reason: reason.trim() });
      toast.success("Payroll run re-opened for review");
      fetchRun();
    } catch (err: any) {
      // Backend surfaces maker-checker + paid-run rejections with
      // specific messages — pass them through verbatim so admins see
      // exactly why the reopen was blocked.
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

  // P2.2 Arrears modal state. Adjust modal lets finance/HR inject
  // retroactive pay onto an entry while it's still in review — e.g.
  // "pay Sam ₹20k of BASIC arrears for July that we missed". Rolls
  // into the component's arrearAmount so the payslip + 24Q classify
  // correctly and the gross total stays reconcilable.
  const [adjustEmployeeId, setAdjustEmployeeId] = useState<string | null>(null);
  const [adjustArrears, setAdjustArrears] = useState<
    Array<{
      componentCode: string;
      amount: string;
      pertainsToMonth: string;
      pertainsToYear: string;
      reason: string;
    }>
  >([]);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const openAdjust = (employeeId: string) => {
    setAdjustEmployeeId(employeeId);
    setAdjustArrears([
      { componentCode: "BASIC", amount: "", pertainsToMonth: "", pertainsToYear: "", reason: "" },
    ]);
    setAdjustNotes("");
  };

  const closeAdjust = () => {
    setAdjustEmployeeId(null);
    setAdjustArrears([]);
    setAdjustNotes("");
  };

  const submitAdjust = async () => {
    if (!adjustEmployeeId) return;
    const arrears = adjustArrears
      .filter((r) => r.componentCode.trim() && Number(r.amount) > 0)
      .map((r) => ({
        componentCode: r.componentCode.trim().toUpperCase(),
        amount: Number(r.amount),
        ...(r.pertainsToMonth ? { pertainsToMonth: Number(r.pertainsToMonth) } : {}),
        ...(r.pertainsToYear ? { pertainsToYear: Number(r.pertainsToYear) } : {}),
        ...(r.reason.trim() ? { reason: r.reason.trim() } : {}),
      }));
    if (arrears.length === 0) {
      toast.error("Enter at least one arrear with a component and amount");
      return;
    }
    setSavingAdjust(true);
    try {
      await payrollApi.overrideEntry(runId, adjustEmployeeId, {
        arrears,
        notes: adjustNotes.trim() || undefined,
      });
      toast.success("Entry adjusted");
      closeAdjust();
      fetchRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust entry");
    } finally {
      setSavingAdjust(false);
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

  // Summary values — prefer the real nested shape (summary.total*,
  // payPeriod.month/year), fall back to legacy flat fields for any old
  // records still in the DB.
  const runMonth = run?.payPeriod?.month ?? run?.month;
  const runYear = run?.payPeriod?.year ?? run?.year;
  const totalEmployees = run?.summary?.totalEmployees ?? run?.employeeCount ?? entries.length;
  const processedCount = run?.summary?.processedEmployees ?? run?.processedCount ?? entries.filter((e) => e.status !== "draft").length;
  const skippedCount = run?.summary?.skippedEmployees ?? run?.skippedCount ?? entries.filter((e) => e.status === "on_hold").length;
  const grossPay = run?.summary?.totalGross ?? run?.totalGrossPay ?? run?.grossPay ?? 0;
  const netPay = run?.summary?.totalNet ?? run?.totalNetPay ?? run?.netPay ?? 0;
  const totalDeductions = run?.summary?.totalDeductions ?? run?.totalDeductions ?? entries.reduce((sum, e) => sum + (e.totalDeductions || 0), 0);

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
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 md:px-8 py-5 sticky top-0 z-20">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => router.push("/payroll")}
                className="flex items-center gap-1 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                <span className="hidden sm:inline">Payroll Runs</span>
                <span className="sm:hidden">Back</span>
              </button>
              <div className="h-5 w-px bg-[#E2E8F0] shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h1 className="text-[17px] sm:text-[20px] font-bold text-[#0F172A] truncate">
                    {run?.runNumber || (run && runYear && runMonth ? `PR-${runYear}-${String(runMonth).padStart(2, "0")}` : "Loading...")}
                  </h1>
                  {run && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-[12px] font-medium border shrink-0 ${statusCfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  )}
                </div>
                {run && runMonth && runYear && (
                  <p className="text-[13px] text-[#64748B] mt-0.5">{getMonthLabel(runMonth, runYear)}</p>
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
          <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            {/* Summary Cards — 2 cols on mobile, 3 on sm, 6 on lg so the
                run summary fits every viewport without horizontal scroll. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
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
                      onClick={handleReopenApproved}
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
                    {/* P1.5 — correct-after-finalize. Lets admin rewind
                        to review for entry edits before disbursement,
                        with mandatory reason + maker-checker enforced
                        server-side. Separate from the approved→review
                        path because money's closer to moving here. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px] text-amber-700 border-amber-300 hover:bg-amber-50"
                      disabled={actionLoading !== null}
                      onClick={handleReopenFinalized}
                      title="Rewind this run to review for correction. Requires a reason. Reopener must differ from the finalizer (owner can bypass)."
                    >
                      {actionLoading === "reopen" ? "Re-opening..." : "Re-open for Correction"}
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

            {/* Employee Entries Table — nested `totals.*` shape from the
                live API is the source of truth; the old flat fields
                (grossPay/netPay) remain as fallbacks only. */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-[#E2E8F0]">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">Employee Entries</h3>
              </div>
              {entries.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-[13px] text-[#94A3B8]">No employee entries found for this run</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Employee</th>
                      <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Status</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Gross</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Deductions</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Statutory</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Net Pay</th>
                      <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 sm:px-5 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry) => {
                      const eCfg = entryStatusConfig[entry.status] || entryStatusConfig.draft;
                      const isExpanded = expandedEntry === entry._id;
                      const isEntryLoading = actionLoading === `hold-${entry.employeeId}` || actionLoading === `release-${entry.employeeId}`;
                      const entryGross = entry.totals?.grossEarnings ?? entry.grossPay ?? 0;
                      const entryDeductions = entry.totals?.totalDeductions ?? entry.totalDeductions ?? 0;
                      const entryStatutory = entry.totals?.totalStatutory ?? entry.statutoryDeductions ?? 0;
                      const entryNet = entry.totals?.netPayable ?? entry.netPay ?? 0;

                      // Prefer an explicit `employeeName` from the API
                      // (future enhancement) → then resolve via the HR
                      // employee lookup → fall back to the raw id. Show the
                      // business-visible employeeId (e.g. NXR-0002) under
                      // the name when available, not the ObjectId.
                      const emp = employeeLookup[entry.employeeId];
                      const resolvedName = entry.employeeName
                        || (emp ? [emp.firstName, emp.lastName].filter(Boolean).join(" ") || emp.email : null);
                      const displayName = resolvedName || entry.employeeId;
                      const subtitle = emp?.employeeId || (resolvedName ? entry.employeeId : null);
                      return (
                        <tr key={entry._id} className="border-b border-[#E2E8F0] last:border-b-0">
                          <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-[13px] font-medium text-[#0F172A]">{displayName}</p>
                              {subtitle && (
                                <p className="text-[11px] text-[#94A3B8]">{subtitle}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${eCfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${eCfg.dot}`} />
                              {eCfg.label}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-4 text-[13px] text-[#334155] text-right font-medium whitespace-nowrap">
                            {formatCurrency(entryGross)}
                          </td>
                          <td className="px-4 sm:px-5 py-4 text-[13px] text-red-600 text-right font-medium whitespace-nowrap">
                            {formatCurrency(entryDeductions)}
                          </td>
                          <td className="px-4 sm:px-5 py-4 text-[13px] text-[#334155] text-right font-medium whitespace-nowrap">
                            {formatCurrency(entryStatutory)}
                          </td>
                          <td className="px-4 sm:px-5 py-4 text-[13px] text-emerald-700 text-right font-bold whitespace-nowrap">
                            {formatCurrency(entryNet)}
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
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px] px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                    disabled={isEntryLoading}
                                    onClick={() => openAdjust(entry.employeeId)}
                                    title="Add arrears (retroactive pay) to this entry"
                                  >
                                    Adjust
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px] px-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                                    disabled={isEntryLoading}
                                    onClick={() => handleHoldEntry(entry.employeeId)}
                                  >
                                    Hold
                                  </Button>
                                </>
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
                </div>
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
                      {/* Earnings — with per-component arrears callouts.
                          When the admin applied an arrear via Adjust,
                          the component's `arrearAmount` rolls up here
                          as a trailing "+ ₹X arrears" chip so auditors
                          can tell the regular monthly from back-pay. */}
                      <div>
                        <h5 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Earnings</h5>
                        <div className="space-y-1.5">
                          {(entry.earnings || []).map((item: any, idx) => {
                            const arrear = Number(item.arrearAmount || 0);
                            return (
                              <div key={idx} className="flex items-center justify-between py-1 px-3 bg-white rounded-lg">
                                <span className="text-[13px] text-[#0F172A]">
                                  {item.name}
                                  {arrear > 0 && (
                                    <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      incl. {formatCurrency(arrear)} arrears
                                    </span>
                                  )}
                                </span>
                                <span className="text-[13px] font-medium text-[#0F172A]">{formatCurrency(item.actualAmount ?? item.amount)}</span>
                              </div>
                            );
                          })}
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

                    {/* OT breakdown (#8 / #9). Shown when the engine
                        recorded any overtime pay on this entry. Each
                        bucket carries hours + pay so finance can
                        reconcile "why was weekend OT paid at 2.5x?"
                        without rerunning the calculation. `capped:true`
                        flags the monthly-cap clip so employees can see
                        if hours were trimmed against their policy. */}
                    {(() => {
                      const ot: any = (entry as any).overtime;
                      const hasOt = ot && (
                        (ot.weekdayPay || 0) + (ot.weekendPay || 0) +
                        (ot.holidayPay || 0) + (ot.nightShiftPay || 0)
                      ) > 0;
                      if (!hasOt) return null;
                      return (
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">
                              Overtime breakdown
                            </h5>
                            {ot.capped && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Monthly cap applied — hours trimmed
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            {[
                              { label: "Weekday", hours: ot.weekdayHours, pay: ot.weekdayPay, tone: "indigo" },
                              { label: "Weekend", hours: ot.weekendHours, pay: ot.weekendPay, tone: "violet" },
                              { label: "Holiday", hours: ot.holidayHours, pay: ot.holidayPay, tone: "amber" },
                              { label: "Night shift", hours: ot.nightShiftHours, pay: ot.nightShiftPay, tone: "slate" },
                            ].filter((b) => (b.pay || 0) > 0).map((b) => (
                              <div key={b.label} className="bg-white rounded-lg p-3 border border-[#E2E8F0]">
                                <div className="text-[11px] text-[#64748B]">{b.label}</div>
                                <div className="text-[14px] font-semibold text-[#0F172A] mt-0.5">
                                  {formatCurrency(b.pay || 0)}
                                </div>
                                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                                  {b.hours || 0}h @ ₹{ot.hourlyRate || 0}/hr
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
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
                    <div className="p-4 sm:p-6 space-y-3">
                      {run.auditTrail.map((entry, idx) => {
                        // Resolve performer. Order: (a) self → "You",
                        // (b) HR employee whose `userId` (auth id) matches,
                        // (c) shortened id fragment. Keeps things readable
                        // until backend ever returns a name directly.
                        const performerName = (() => {
                          if (!entry.performedBy) return null;
                          if (user && entry.performedBy === (user as any)._id) return "You";
                          const hrMatch = Object.values(employeeLookup).find(
                            (e: any) => e?.userId === entry.performedBy,
                          ) as Employee | undefined;
                          if (hrMatch) {
                            const full = [hrMatch.firstName, hrMatch.lastName].filter(Boolean).join(" ");
                            return full || hrMatch.email || null;
                          }
                          // Last resort — show the last 6 chars so at least
                          // different performers look different.
                          const id = String(entry.performedBy);
                          return id.length > 8 ? `…${id.slice(-6)}` : id;
                        })();
                        const ts = entry.performedAt || entry.timestamp;
                        const label = humanizeAuditAction(entry.action);
                        // Show "Draft → Review" style transition when the
                        // action is a state change (carries newStatus).
                        const showTransition = entry.previousStatus && entry.newStatus
                          && entry.previousStatus !== entry.newStatus;
                        return (
                        <div key={idx} className="flex items-start gap-3 py-2 px-4 bg-[#F8FAFC] rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-[#2E86C1] mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13px] font-medium text-[#0F172A]">{label}</p>
                              {showTransition && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] bg-white border border-[#E2E8F0] rounded px-1.5 py-0.5">
                                  {humanizeStatus(entry.previousStatus)}
                                  <span className="text-[#94A3B8]">→</span>
                                  {humanizeStatus(entry.newStatus)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              {performerName && (
                                <span className="text-[11px] text-[#64748B]">by <span className="font-medium text-[#334155]">{performerName}</span></span>
                              )}
                              {ts && (
                                <span className="text-[11px] text-[#94A3B8]">
                                  {new Date(ts).toLocaleString("en-IN", {
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
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* P2.2 — Adjust (Arrears) modal */}
        {adjustEmployeeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-[#0F172A]">
                  Adjust Entry — Add Arrears
                </h2>
                <p className="text-[12px] text-[#64748B] mt-0.5">
                  Retroactive pay for a prior period. Amount rolls into the
                  matching component's arrears and is included in gross + TDS
                  for this run. The payslip will label the component "(incl. ₹X arrears)".
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-[#0F172A]">Arrear lines</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setAdjustArrears((prev) => [
                        ...prev,
                        { componentCode: "BASIC", amount: "", pertainsToMonth: "", pertainsToYear: "", reason: "" },
                      ])
                    }
                    className="text-[12px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add line
                  </button>
                </div>

                {adjustArrears.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-start p-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]"
                  >
                    <div className="col-span-3">
                      <label className="block text-[11px] text-[#64748B] mb-1">Component</label>
                      <input
                        type="text"
                        value={row.componentCode}
                        onChange={(e) =>
                          setAdjustArrears((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, componentCode: e.target.value.toUpperCase() } : r)),
                          )
                        }
                        placeholder="BASIC"
                        className="w-full h-8 px-2 text-[12px] border border-[#E2E8F0] rounded bg-white font-mono"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[11px] text-[#64748B] mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={row.amount}
                        onChange={(e) =>
                          setAdjustArrears((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)),
                          )
                        }
                        placeholder="20000"
                        className="w-full h-8 px-2 text-[12px] border border-[#E2E8F0] rounded bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] text-[#64748B] mb-1">For Month</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={row.pertainsToMonth}
                        onChange={(e) =>
                          setAdjustArrears((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, pertainsToMonth: e.target.value } : r)),
                          )
                        }
                        placeholder="7"
                        className="w-full h-8 px-2 text-[12px] border border-[#E2E8F0] rounded bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] text-[#64748B] mb-1">Year</label>
                      <input
                        type="number"
                        min={2020}
                        value={row.pertainsToYear}
                        onChange={(e) =>
                          setAdjustArrears((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, pertainsToYear: e.target.value } : r)),
                          )
                        }
                        placeholder="2026"
                        className="w-full h-8 px-2 text-[12px] border border-[#E2E8F0] rounded bg-white"
                      />
                    </div>
                    <div className="col-span-2 flex items-end">
                      {adjustArrears.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAdjustArrears((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-[11px] text-red-600 hover:text-red-700 font-medium h-8 px-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="col-span-12 mt-1">
                      <label className="block text-[11px] text-[#64748B] mb-1">
                        Reason (shows in audit trail)
                      </label>
                      <input
                        type="text"
                        value={row.reason}
                        onChange={(e) =>
                          setAdjustArrears((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, reason: e.target.value } : r)),
                          )
                        }
                        placeholder="e.g. Backdated raise effective July missed in July run"
                        className="w-full h-8 px-2 text-[12px] border border-[#E2E8F0] rounded bg-white"
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label className="block text-[12px] font-medium text-[#334155] mb-1">
                    Entry notes (optional)
                  </label>
                  <textarea
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] bg-white"
                    placeholder="Context for this adjustment"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="outline" onClick={closeAdjust} disabled={savingAdjust}>
                  Cancel
                </Button>
                <Button onClick={submitAdjust} disabled={savingAdjust}>
                  {savingAdjust ? "Saving…" : "Apply Arrears"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
