"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi, Employee, API_BASE_URL } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeePicker } from "@/components/EmployeePicker";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { label: string; color: string }> = {
  initiated: { label: "Initiated", color: "bg-blue-50 text-blue-700 border-blue-200" },
  notice_period: { label: "Notice Period", color: "bg-amber-50 text-amber-700 border-amber-200" },
  clearance: { label: "Clearance", color: "bg-purple-50 text-purple-700 border-purple-200" },
  fnf_processing: { label: "F&F Processing", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  fnf_approved: { label: "F&F Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", color: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
};

const exitTypeConfig: Record<string, { label: string; color: string }> = {
  resignation: { label: "Resignation", color: "bg-blue-50 text-blue-700" },
  termination: { label: "Termination", color: "bg-red-50 text-red-700" },
  retirement: { label: "Retirement", color: "bg-amber-50 text-amber-700" },
  contract_end: { label: "Contract End", color: "bg-gray-100 text-gray-700" },
  mutual_separation: { label: "Mutual", color: "bg-purple-50 text-purple-700" },
};

const clearanceStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  cleared: { label: "Cleared", color: "bg-emerald-50 text-emerald-700" },
  issues_found: { label: "Issues", color: "bg-red-50 text-red-700" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ClearanceItem {
  department: string;
  status: string;
  clearedBy?: string;
  date?: string;
  remarks?: string;
}

interface ExitInterview {
  rating: number;
  feedback: string;
  reason: string;
  wouldRecommend: boolean;
  conductedAt?: string;
}

/**
 * F&F detail blocks — computed + persisted by payroll-service so HR can
 * explain the gratuity + encashment math to a departing employee. The
 * totals above surface on the summary card; these surface in expandable
 * "Why this number?" sections so an auditor doesn't need the raw doc.
 */
interface GratuityDetail {
  eligible: boolean;
  eligibleReason?: string | null;
  ineligibleReason?: string | null;
  yearsOfService: number;
  rawMonthsOfService: number;
  monthlyWage: number;       // basic + DA
  computed: number;          // before cap
  amount: number;             // final (capped at ₹20L if applicable)
  capped: boolean;
  cap: number;                // typically 2,000,000
}

interface LeaveEncashmentBucket {
  leaveType: string;
  availableDays: number;
  encashable: boolean;
  includedDays: number;
  amount: number;
}

interface LeaveEncashmentDetail {
  source: "leave_service" | "fallback";
  perDayRate: number;
  monthlyWage: number;
  totalEncashableDays: number;
  totalAmount: number;
  buckets: LeaveEncashmentBucket[];
  note?: string | null;
}

interface FnFBreakdown {
  basicDue: number;
  leaveEncashment: number;
  leaveEncashmentDetail?: LeaveEncashmentDetail;
  // Backend schema field is `bonusDue` (matches the `basicDue` /
  // `bonusDue` naming pattern); old UI read `bonus` and always
  // rendered ₹0. Keep the legacy alias for safety.
  bonusDue?: number;
  bonus?: number;
  gratuity: number;
  gratuityDetail?: GratuityDetail;
  pendingReimbursements: number;
  noticeRecovery: number;
  otherDeductions: number;
  totalPayable: number;
  status: string;
}

// Backend schema uses `type` and `lastWorkingDate`; the frontend form
// historically used `exitType` and `lastWorkingDay`. Accept both so list
// reads don't drop fields, and helpers below always resolve the right one.
interface OffboardingRecord {
  _id: string;
  employeeId: string;
  employeeName?: string;
  type?: string;
  exitType?: string;
  status: string;
  resignationDate: string;
  lastWorkingDate?: string;
  lastWorkingDay?: string;
  noticePeriodDays: number;
  noticePeriodWaived?: boolean;
  clearance: ClearanceItem[];
  exitInterview?: ExitInterview;
  fnfSettlement?: FnFBreakdown;
  lettersGenerated?: boolean;
  experienceLetterUrl?: string;
  relievingLetterUrl?: string;
  createdAt?: string;
}

const getExitType = (r: OffboardingRecord): string => r.type || r.exitType || "resignation";
const getLastWorkingDay = (r: OffboardingRecord): string => r.lastWorkingDate || r.lastWorkingDay || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// F&F amounts are stored in rupees on the backend (same convention as
// payroll entries and claims). Dividing by 100 showed a ₹1L payout as
// ₹1,000. Match the other payroll pages.
const formatCurrency = (rupees: number) => {
  if (typeof rupees !== "number" || isNaN(rupees)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function OffboardingPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState<OffboardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Initiate modal
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [initiateForm, setInitiateForm] = useState({
    employeeId: "",
    exitType: "resignation",
    resignationDate: "",
    lastWorkingDay: "",
    noticePeriodDays: 30,
    noticePeriodWaived: false,
  });
  const [initiating, setInitiating] = useState(false);

  // Detail modal
  const [selectedRecord, setSelectedRecord] = useState<OffboardingRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "clearance" | "interview" | "fnf" | "letters">("overview");

  // Exit interview form
  const [interviewForm, setInterviewForm] = useState({
    rating: 3,
    feedback: "",
    reason: "",
    wouldRecommend: false,
  });

  // Reset interview form when selected record changes
  useEffect(() => {
    setInterviewForm({ rating: 0, feedback: "", reason: "", wouldRecommend: false });
  }, [selectedRecord]);

  // Redirect unauthenticated or unauthorized users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !hasOrgRole("manager") && !hasOrgRole("hr") && !hasOrgRole("admin")) router.push("/dashboard");
  }, [user, authLoading, router, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res: any = await payrollApi.getAllOffboardings();
      // `GET /offboarding` returns `{success, data: {records: [...], total, page, ...}}`.
      // Earlier code read the wrong key (`offboardings`) and the list
      // always rendered empty even when records existed.
      const raw = res?.data;
      const data: OffboardingRecord[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.records)
          ? raw.records
          : Array.isArray(raw?.offboardings)
            ? raw.offboardings
            : Array.isArray(raw?.data)
              ? raw.data
              : [];
      setRecords(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load offboarding records");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchRecords();
  }, [fetchRecords, user]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const stats = {
    activeExits: records.filter((r) =>
      ["initiated", "notice_period", "clearance"].includes(r.status)
    ).length,
    fnfProcessing: records.filter((r) => r.status === "fnf_processing").length,
    completed: records.filter((r) => r.status === "completed").length,
    total: records.length,
  };

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
  const paginatedRecords = records.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when records change
  useEffect(() => { setCurrentPage(1); }, [records.length]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleInitiate = async () => {
    setInitiating(true);
    try {
      // Backend DTO uses `type` (not `exitType`) and `lastWorkingDate`
      // (not `lastWorkingDay`). Earlier code shipped the frontend field
      // names, which the server rejected with a 400 validation error.
      // Remap at submit time so the rest of the component can keep its
      // `exitType`/`lastWorkingDay` naming.
      const { exitType, lastWorkingDay, ...rest } = initiateForm;
      await payrollApi.initiateOffboarding({
        ...rest,
        type: exitType,
        lastWorkingDate: lastWorkingDay,
      });
      toast.success("Offboarding initiated successfully");
      setShowInitiateModal(false);
      setInitiateForm({
        employeeId: "",
        exitType: "resignation",
        resignationDate: "",
        lastWorkingDay: "",
        noticePeriodDays: 30,
        noticePeriodWaived: false,
      });
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate offboarding");
    } finally {
      setInitiating(false);
    }
  };

  const handleClearDepartment = async (empId: string, dept: string) => {
    setActionLoading(`clear-${empId}-${dept}`);
    try {
      await payrollApi.updateClearance(empId, { department: dept, status: "cleared" });
      toast.success(`${dept} department cleared`);
      await fetchRecords();
      // Refetch the individual record to get fresh data
      if (selectedRecord) {
        try {
          const freshRes = await payrollApi.getOffboarding(selectedRecord.employeeId);
          if (freshRes.data) setSelectedRecord(freshRes.data as any);
        } catch { /* ignore, list already refreshed */ }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update clearance");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExitInterview = async (empId: string) => {
    setActionLoading(`interview-${empId}`);
    try {
      await payrollApi.submitExitInterview(empId, interviewForm);
      toast.success("Exit interview submitted");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit exit interview");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCalculateFnF = async (empId: string) => {
    setActionLoading(`fnf-${empId}`);
    try {
      await payrollApi.calculateFnF(empId);
      toast.success("F&F calculated successfully");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to calculate F&F");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveFnF = async (empId: string) => {
    if (!window.confirm("Are you sure you want to approve this F&F settlement?")) return;
    setActionLoading(`approve-${empId}`);
    try {
      await payrollApi.approveFnF(empId);
      toast.success("F&F approved successfully");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve F&F");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateLetters = async (empId: string) => {
    setActionLoading(`letters-${empId}`);
    try {
      await payrollApi.generateLetters(empId);
      toast.success("Letters generated successfully");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate letters");
    } finally {
      setActionLoading(null);
    }
  };

  // Download a letter PDF via the authorised endpoint. Plain <a href>
  // won't work because the endpoint needs the Authorization header
  // (the service enforces self-or-privileged access), so we go via
  // fetch + blob + programmatic anchor click — same pattern as payslips.
  const handleDownloadLetter = async (empId: string, kind: "experience" | "relieving") => {
    const key = `letter-${empId}-${kind}`;
    setActionLoading(key);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch(`${API_BASE_URL}/api/v1/offboarding/${encodeURIComponent(empId)}/letters/${kind}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try { const body = await res.json(); msg = body?.message || msg; } catch { /* non-JSON */ }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const m = disposition.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `${kind === "experience" ? "Experience" : "Relieving"}_Letter_${empId}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${kind === "experience" ? "Experience" : "Relieving"} letter downloaded`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to download letter");
    } finally {
      setActionLoading(null);
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Employee Offboarding</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Manage exits, clearance, and full &amp; final settlement
            </p>
          </div>
          {(hasOrgRole("admin") || hasOrgRole("hr")) && (
            <Button
              onClick={() => setShowInitiateModal(true)}
              className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Initiate Offboarding
            </Button>
          )}
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* --------------------------------------------------------------- */}
          {/* Stats Row                                                       */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Active Exits", value: stats.activeExits, borderColor: "border-l-amber-500" },
              { label: "F&F Processing", value: stats.fnfProcessing, borderColor: "border-l-indigo-500" },
              { label: "Completed", value: stats.completed, borderColor: "border-l-green-500" },
              { label: "Total Exits", value: stats.total, borderColor: "border-l-[#2E86C1]" },
            ].map((stat) => (
              <Card key={stat.label} className={`rounded-xl border shadow-sm ${stat.borderColor} border-l-4`}>
                <CardContent className="p-5">
                  <p className="text-[13px] text-[#64748B]">{stat.label}</p>
                  <p className="text-2xl font-bold text-[#0F172A] mt-1">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Offboarding Cards                                               */}
          {/* --------------------------------------------------------------- */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
                  <div className="flex items-center gap-6">
                    <div className="h-4 bg-gray-200 rounded w-28" />
                    <div className="h-5 bg-gray-200 rounded-full w-20" />
                    <div className="h-4 bg-gray-200 rounded w-40" />
                    <div className="flex-1" />
                    <div className="h-8 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[#0F172A]">No offboarding records</h3>
              <p className="text-[13px] text-[#64748B] mt-1">Initiate an offboarding process to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedRecords.map((record) => {
                const sCfg = statusConfig[record.status] || statusConfig.initiated;
                const eCfg = exitTypeConfig[getExitType(record)] || exitTypeConfig.resignation;
                const clearedCount = record.clearance?.filter((c) => c.status === "cleared").length ?? 0;
                const totalDepts = record.clearance?.length ?? 0;
                const clearancePercent = totalDepts > 0 ? Math.round((clearedCount / totalDepts) * 100) : 0;

                return (
                  <Card key={record._id} className="rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          {/* Row 1: Employee ID + badges */}
                          <div className="flex items-center gap-3">
                            <span className="text-[14px] font-semibold text-[#0F172A]">
                              {record.employeeId}
                            </span>
                            {record.employeeName && (
                              <span className="text-[13px] text-[#64748B]">{record.employeeName}</span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${eCfg.color}`}>
                              {eCfg.label}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sCfg.color}`}>
                              {sCfg.label}
                            </span>
                          </div>

                          {/* Row 2: Dates + Notice period */}
                          <div className="flex items-center gap-6 text-[13px] text-[#64748B]">
                            <span>
                              {formatDate(record.resignationDate)} → {formatDate(getLastWorkingDay(record))}
                            </span>
                            <span>
                              Notice: {record.noticePeriodDays} days
                              {record.noticePeriodWaived && (
                                <span className="ml-1 text-amber-600 font-medium">(Waived)</span>
                              )}
                            </span>
                          </div>

                          {/* Row 3: Clearance progress */}
                          {totalDepts > 0 && (
                            <div className="flex items-center gap-3">
                              <span className="text-[12px] text-[#64748B]">
                                Clearance: {clearedCount} of {totalDepts} departments cleared
                              </span>
                              <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${clearancePercent}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Row 4: F&F amount if calculated */}
                          {record.fnfSettlement && record.fnfSettlement.totalPayable > 0 && (
                            <div className="text-[13px]">
                              <span className="text-[#64748B]">F&F Payable: </span>
                              <span className="font-semibold text-[#0F172A]">
                                {formatCurrency(record.fnfSettlement.totalPayable)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* View Details button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[12px] h-8"
                          onClick={() => {
                            setSelectedRecord(record);
                            setActiveTab("overview");
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#E2E8F0]">
                  <p className="text-[12px] text-[#64748B]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, records.length)} of {records.length}
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
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Initiate Offboarding Modal                                        */}
        {/* ----------------------------------------------------------------- */}
        {showInitiateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => {
            setShowInitiateModal(false);
            setInitiateForm({ employeeId: "", exitType: "resignation", resignationDate: "", lastWorkingDay: "", noticePeriodDays: 30, noticePeriodWaived: false });
          }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-[17px] font-bold text-[#0F172A] mb-4">Initiate Offboarding</h2>

              <div className="space-y-4">
                {/* Employee — autocomplete picker (was free-text).
                    Offboarding keys off the business `employeeId`
                    (backend stores it that way; F&F flow then
                    resolves to HR _id internally for cross-service
                    lookups). */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1">Employee</label>
                  <EmployeePicker
                    value={initiateForm.employeeId}
                    onChange={(next) => setInitiateForm((f) => ({ ...f, employeeId: next }))}
                    valueKind="businessId"
                    placeholder="Search employees by name, ID, or email…"
                    required
                  />
                </div>

                {/* Exit Type */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1">Exit Type</label>
                  <select
                    value={initiateForm.exitType}
                    onChange={(e) => setInitiateForm((f) => ({ ...f, exitType: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    {Object.entries(exitTypeConfig).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>

                {/* Resignation Date */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1">Resignation Date</label>
                  <input
                    type="date"
                    value={initiateForm.resignationDate}
                    onChange={(e) => setInitiateForm((f) => ({ ...f, resignationDate: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  />
                </div>

                {/* Last Working Day */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1">Last Working Day</label>
                  <input
                    type="date"
                    value={initiateForm.lastWorkingDay}
                    onChange={(e) => setInitiateForm((f) => ({ ...f, lastWorkingDay: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  />
                </div>

                {/* Notice Period Days */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1">Notice Period (days)</label>
                  <input
                    type="number"
                    value={initiateForm.noticePeriodDays}
                    onChange={(e) => setInitiateForm((f) => ({ ...f, noticePeriodDays: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    min={0}
                  />
                </div>

                {/* Waive Notice */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={initiateForm.noticePeriodWaived}
                    onChange={(e) => setInitiateForm((f) => ({ ...f, noticePeriodWaived: e.target.checked }))}
                    className="rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]"
                  />
                  <span className="text-[13px] text-[#334155]">Waive notice period</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInitiateModal(false);
                    setInitiateForm({ employeeId: "", exitType: "resignation", resignationDate: "", lastWorkingDay: "", noticePeriodDays: 30, noticePeriodWaived: false });
                  }}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInitiate}
                  disabled={initiating || !initiateForm.employeeId || !initiateForm.resignationDate || !initiateForm.lastWorkingDay}
                  className="bg-[#2E86C1] hover:bg-[#2574A9] h-9"
                >
                  {initiating ? "Initiating..." : "Initiate"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Detail Modal                                                      */}
        {/* ----------------------------------------------------------------- */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <h2 className="text-[17px] font-bold text-[#0F172A]">
                    {selectedRecord.employeeId}
                  </h2>
                  {selectedRecord.employeeName && (
                    <span className="text-[13px] text-[#64748B]">{selectedRecord.employeeName}</span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusConfig[selectedRecord.status]?.color || ""}`}>
                    {statusConfig[selectedRecord.status]?.label || selectedRecord.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-3 border-b border-[#E2E8F0]">
                <div className="flex gap-1">
                  {(["overview", "clearance", "interview", "fnf", "letters"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-[13px] font-medium rounded-t-lg transition-colors capitalize ${
                        activeTab === tab
                          ? "bg-white text-[#0F172A] border border-[#E2E8F0] border-b-white -mb-px"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      {tab === "fnf" ? "F&F Settlement" : tab === "interview" ? "Exit Interview" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* ---- Overview Tab ---- */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Employee ID", value: selectedRecord.employeeId },
                        { label: "Employee Name", value: selectedRecord.employeeName || "—" },
                        { label: "Exit Type", value: exitTypeConfig[selectedRecord.exitType]?.label || selectedRecord.exitType },
                        { label: "Status", value: statusConfig[selectedRecord.status]?.label || selectedRecord.status },
                        { label: "Resignation Date", value: formatDate(selectedRecord.resignationDate) },
                        { label: "Last Working Day", value: formatDate(selectedRecord.lastWorkingDay) },
                        { label: "Notice Period", value: `${selectedRecord.noticePeriodDays} days` },
                        { label: "Notice Waived", value: selectedRecord.noticePeriodWaived ? "Yes" : "No" },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[12px] text-[#64748B] uppercase tracking-wider">{item.label}</p>
                          <p className="text-[14px] font-medium text-[#0F172A] mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ---- Clearance Tab ---- */}
                {activeTab === "clearance" && (
                  <div>
                    {(!selectedRecord.clearance || selectedRecord.clearance.length === 0) ? (
                      <p className="text-[13px] text-[#64748B]">No clearance departments configured.</p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5">Department</th>
                            <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5">Status</th>
                            <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5">Cleared By</th>
                            <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5">Date</th>
                            <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5">Remarks</th>
                            <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecord.clearance.map((item) => {
                            const cCfg = clearanceStatusConfig[item.status] || clearanceStatusConfig.pending;
                            return (
                              <tr key={item.department} className="border-b border-[#E2E8F0] last:border-b-0">
                                <td className="px-4 py-3 text-[13px] font-medium text-[#0F172A]">{item.department}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cCfg.color}`}>
                                    {cCfg.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[13px] text-[#64748B]">{item.clearedBy || "—"}</td>
                                <td className="px-4 py-3 text-[13px] text-[#64748B]">{item.date ? formatDate(item.date) : "—"}</td>
                                <td className="px-4 py-3 text-[13px] text-[#64748B]">{item.remarks || "—"}</td>
                                <td className="px-4 py-3 text-right">
                                  {item.status === "pending" && hasOrgRole("manager") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-[11px] h-7"
                                      disabled={actionLoading === `clear-${selectedRecord.employeeId}-${item.department}`}
                                      onClick={() => handleClearDepartment(selectedRecord.employeeId, item.department)}
                                    >
                                      {actionLoading === `clear-${selectedRecord.employeeId}-${item.department}` ? "Clearing..." : "Clear"}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ---- Exit Interview Tab ---- */}
                {activeTab === "interview" && (
                  <div>
                    {selectedRecord.exitInterview ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[12px] text-[#64748B] uppercase tracking-wider">Rating</p>
                            <p className="text-[14px] font-medium text-[#0F172A] mt-0.5">
                              {selectedRecord.exitInterview.rating} / 5
                            </p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#64748B] uppercase tracking-wider">Would Recommend</p>
                            <p className="text-[14px] font-medium text-[#0F172A] mt-0.5">
                              {selectedRecord.exitInterview.wouldRecommend ? "Yes" : "No"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748B] uppercase tracking-wider">Reason for Leaving</p>
                          <p className="text-[13px] text-[#0F172A] mt-1">{selectedRecord.exitInterview.reason || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748B] uppercase tracking-wider">Feedback</p>
                          <p className="text-[13px] text-[#0F172A] mt-1">{selectedRecord.exitInterview.feedback || "—"}</p>
                        </div>
                        {selectedRecord.exitInterview.conductedAt && (
                          <p className="text-[12px] text-[#94A3B8]">
                            Conducted on {formatDate(selectedRecord.exitInterview.conductedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[13px] text-[#64748B] mb-2">Exit interview has not been conducted yet.</p>

                        {/* Rating */}
                        <div>
                          <label className="block text-[13px] font-medium text-[#334155] mb-1">
                            Overall Experience Rating (1-5)
                          </label>
                          <select
                            value={interviewForm.rating}
                            onChange={(e) => setInterviewForm((f) => ({ ...f, rating: parseInt(e.target.value) }))}
                            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>

                        {/* Reason */}
                        <div>
                          <label className="block text-[13px] font-medium text-[#334155] mb-1">Reason for Leaving</label>
                          <input
                            type="text"
                            value={interviewForm.reason}
                            onChange={(e) => setInterviewForm((f) => ({ ...f, reason: e.target.value }))}
                            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                            placeholder="e.g. Better opportunity, relocation..."
                          />
                        </div>

                        {/* Feedback */}
                        <div>
                          <label className="block text-[13px] font-medium text-[#334155] mb-1">Feedback</label>
                          <textarea
                            value={interviewForm.feedback}
                            onChange={(e) => setInterviewForm((f) => ({ ...f, feedback: e.target.value }))}
                            rows={3}
                            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1] resize-none"
                            placeholder="Employee feedback about the organization..."
                          />
                        </div>

                        {/* Would Recommend */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={interviewForm.wouldRecommend}
                            onChange={(e) => setInterviewForm((f) => ({ ...f, wouldRecommend: e.target.checked }))}
                            className="rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]"
                          />
                          <span className="text-[13px] text-[#334155]">Would recommend the company to others</span>
                        </label>

                        <Button
                          onClick={() => handleExitInterview(selectedRecord.employeeId)}
                          disabled={actionLoading === `interview-${selectedRecord.employeeId}` || !interviewForm.reason}
                          className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
                        >
                          {actionLoading === `interview-${selectedRecord.employeeId}` ? "Submitting..." : "Conduct Interview"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ---- F&F Settlement Tab ---- */}
                {activeTab === "fnf" && (
                  <div className="space-y-4">
                    {selectedRecord.fnfSettlement ? (
                      <>
                        {/* F&F Status badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[13px] text-[#64748B]">F&F Status:</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            selectedRecord.fnfSettlement.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : selectedRecord.fnfSettlement.status === "paid"
                              ? "bg-green-50 text-green-700"
                              : selectedRecord.fnfSettlement.status === "calculated"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {selectedRecord.fnfSettlement.status
                              ? selectedRecord.fnfSettlement.status.charAt(0).toUpperCase() + selectedRecord.fnfSettlement.status.slice(1)
                              : "Pending"}
                          </span>
                        </div>

                        {/* Breakdown card */}
                        <Card className="rounded-xl border border-[#E2E8F0]">
                          <CardContent className="p-5 space-y-3">
                            {[
                              { label: "Basic Due", value: selectedRecord.fnfSettlement.basicDue, negative: false },
                              { label: "Leave Encashment", value: selectedRecord.fnfSettlement.leaveEncashment, negative: false },
                              { label: "Bonus", value: selectedRecord.fnfSettlement.bonusDue ?? selectedRecord.fnfSettlement.bonus, negative: false },
                              { label: "Gratuity", value: selectedRecord.fnfSettlement.gratuity, negative: false },
                              { label: "Pending Reimbursements", value: selectedRecord.fnfSettlement.pendingReimbursements, negative: false },
                              { label: "Notice Recovery", value: selectedRecord.fnfSettlement.noticeRecovery, negative: true },
                              { label: "Other Deductions", value: selectedRecord.fnfSettlement.otherDeductions, negative: true },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between">
                                <span className="text-[13px] text-[#64748B]">{item.label}</span>
                                <span className={`text-[13px] font-medium ${item.negative ? "text-red-600" : "text-[#0F172A]"}`}>
                                  {item.negative && (item.value ?? 0) > 0 ? "- " : ""}
                                  {formatCurrency(item.value ?? 0)}
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-[#E2E8F0] pt-3 flex items-center justify-between">
                              <span className="text-[14px] font-bold text-[#0F172A]">Total Payable</span>
                              <span className="text-[14px] font-bold text-[#0F172A]">
                                {formatCurrency(selectedRecord.fnfSettlement.totalPayable)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Gratuity detail (#12). Shown whenever the
                            backend ran a gratuity calc — eligible OR
                            not — so HR can explain "why ₹0" to a
                            <5-year departee as easily as "why this
                            amount" to a long-service one. `capped`
                            flags the ₹20L statutory ceiling so HR
                            doesn't have to apologise to a veteran. */}
                        {selectedRecord.fnfSettlement.gratuityDetail && (
                          <Card className="rounded-xl border border-[#E2E8F0]">
                            <CardContent className="p-5 space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-[13px] font-semibold text-[#0F172A]">
                                  Gratuity detail
                                </h4>
                                <span
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                    selectedRecord.fnfSettlement.gratuityDetail.eligible
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {selectedRecord.fnfSettlement.gratuityDetail.eligible
                                    ? "Eligible"
                                    : "Not eligible"}
                                </span>
                              </div>
                              {(() => {
                                const g = selectedRecord.fnfSettlement.gratuityDetail!;
                                const reason = g.eligible ? g.eligibleReason : g.ineligibleReason;
                                return (
                                  <>
                                    {reason && (
                                      <p className="text-[12px] text-[#64748B] italic">
                                        {reason}
                                      </p>
                                    )}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mt-2">
                                      <div className="text-[#64748B]">Years of service</div>
                                      <div className="text-right text-[#0F172A]">
                                        {g.yearsOfService} yr ({g.rawMonthsOfService} months raw)
                                      </div>
                                      <div className="text-[#64748B]">Monthly wage (basic + DA)</div>
                                      <div className="text-right text-[#0F172A]">
                                        {formatCurrency(g.monthlyWage)}
                                      </div>
                                      <div className="text-[#64748B]">Computed</div>
                                      <div className="text-right text-[#0F172A]">
                                        {formatCurrency(g.computed)}
                                      </div>
                                      {g.capped && (
                                        <>
                                          <div className="text-amber-700">Capped at statutory ceiling</div>
                                          <div className="text-right text-amber-700">
                                            {formatCurrency(g.cap)}
                                          </div>
                                        </>
                                      )}
                                      <div className="text-[#0F172A] font-semibold">Paid</div>
                                      <div className="text-right text-[#0F172A] font-semibold">
                                        {formatCurrency(g.amount)}
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        )}

                        {/* Leave encashment detail (#13). Per-bucket
                            breakdown with encashable flag so HR can
                            explain "your casual leave exists but
                            isn't cashable at exit". `source: fallback`
                            tells HR leave-service was unreachable and
                            they should verify manually. */}
                        {selectedRecord.fnfSettlement.leaveEncashmentDetail && (
                          <Card className="rounded-xl border border-[#E2E8F0]">
                            <CardContent className="p-5 space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-[13px] font-semibold text-[#0F172A]">
                                  Leave encashment detail
                                </h4>
                                <span
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                    selectedRecord.fnfSettlement.leaveEncashmentDetail.source === "leave_service"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {selectedRecord.fnfSettlement.leaveEncashmentDetail.source === "leave_service"
                                    ? "Live balance"
                                    : "Fallback (verify manually)"}
                                </span>
                              </div>
                              {selectedRecord.fnfSettlement.leaveEncashmentDetail.note && (
                                <p className="text-[12px] text-[#64748B] italic">
                                  {selectedRecord.fnfSettlement.leaveEncashmentDetail.note}
                                </p>
                              )}
                              <div className="text-[12px] text-[#64748B] mb-2">
                                Per-day rate:{" "}
                                <span className="text-[#0F172A] font-medium">
                                  {formatCurrency(
                                    selectedRecord.fnfSettlement.leaveEncashmentDetail.perDayRate,
                                  )}
                                </span>{" "}
                                = (basic + DA) / 30
                              </div>
                              {selectedRecord.fnfSettlement.leaveEncashmentDetail.buckets.length > 0 ? (
                                <table className="w-full text-[12px]">
                                  <thead>
                                    <tr className="text-[#64748B] border-b border-[#F1F5F9]">
                                      <th className="text-left py-1">Leave type</th>
                                      <th className="text-right py-1">Available</th>
                                      <th className="text-right py-1">Encashable?</th>
                                      <th className="text-right py-1">Included</th>
                                      <th className="text-right py-1">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedRecord.fnfSettlement.leaveEncashmentDetail.buckets.map((b) => (
                                      <tr
                                        key={b.leaveType}
                                        className="border-b border-[#F8FAFC]"
                                      >
                                        <td className="py-1 text-[#0F172A]">{b.leaveType}</td>
                                        <td className="py-1 text-right text-[#0F172A]">{b.availableDays}</td>
                                        <td className="py-1 text-right">
                                          {b.encashable ? (
                                            <span className="text-emerald-700">yes</span>
                                          ) : (
                                            <span className="text-[#94A3B8]">no</span>
                                          )}
                                        </td>
                                        <td className="py-1 text-right text-[#0F172A]">{b.includedDays}</td>
                                        <td className="py-1 text-right text-[#0F172A]">
                                          {formatCurrency(b.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="font-semibold">
                                      <td className="pt-2 text-[#0F172A]" colSpan={3}>
                                        Total
                                      </td>
                                      <td className="pt-2 text-right text-[#0F172A]">
                                        {selectedRecord.fnfSettlement.leaveEncashmentDetail.totalEncashableDays}
                                      </td>
                                      <td className="pt-2 text-right text-[#0F172A]">
                                        {formatCurrency(
                                          selectedRecord.fnfSettlement.leaveEncashmentDetail.totalAmount,
                                        )}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              ) : (
                                <p className="text-[12px] text-[#94A3B8]">No buckets returned.</p>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Approve button (admin only, if calculated but not approved) */}
                        {hasOrgRole("admin") && selectedRecord.fnfSettlement.status === "calculated" && (
                          <Button
                            onClick={() => handleApproveFnF(selectedRecord.employeeId)}
                            disabled={actionLoading === `approve-${selectedRecord.employeeId}`}
                            className="bg-emerald-600 hover:bg-emerald-700 h-9 text-[13px]"
                          >
                            {actionLoading === `approve-${selectedRecord.employeeId}` ? "Approving..." : "Approve F&F"}
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[13px] text-[#64748B]">
                          Full & Final settlement has not been calculated yet.
                        </p>
                        <Button
                          onClick={() => handleCalculateFnF(selectedRecord.employeeId)}
                          disabled={actionLoading === `fnf-${selectedRecord.employeeId}`}
                          className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
                        >
                          {actionLoading === `fnf-${selectedRecord.employeeId}` ? "Calculating..." : "Calculate F&F"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ---- Letters Tab ---- */}
                {activeTab === "letters" && (
                  <div className="space-y-4">
                    {selectedRecord.lettersGenerated ? (
                      <div className="space-y-3">
                        <p className="text-[13px] text-emerald-700 font-medium">Letters have been generated.</p>
                        <div className="flex gap-3">
                          {selectedRecord.experienceLetterUrl && (
                            <button
                              type="button"
                              onClick={() => handleDownloadLetter(selectedRecord.employeeId, "experience")}
                              disabled={actionLoading === `letter-${selectedRecord.employeeId}-experience`}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors disabled:opacity-60"
                            >
                              {actionLoading === `letter-${selectedRecord.employeeId}-experience` ? (
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-[#64748B] border-t-transparent rounded-full" />
                              ) : (
                                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              Experience Letter
                            </button>
                          )}
                          {selectedRecord.relievingLetterUrl && (
                            <button
                              type="button"
                              onClick={() => handleDownloadLetter(selectedRecord.employeeId, "relieving")}
                              disabled={actionLoading === `letter-${selectedRecord.employeeId}-relieving`}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors disabled:opacity-60"
                            >
                              {actionLoading === `letter-${selectedRecord.employeeId}-relieving` ? (
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-[#64748B] border-t-transparent rounded-full" />
                              ) : (
                                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              Relieving Letter
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[13px] text-[#64748B]">
                          Experience and relieving letters have not been generated yet.
                        </p>
                        <Button
                          onClick={() => handleGenerateLetters(selectedRecord.employeeId)}
                          disabled={actionLoading === `letters-${selectedRecord.employeeId}`}
                          className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
                        >
                          {actionLoading === `letters-${selectedRecord.employeeId}` ? "Generating..." : "Generate Letters"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
