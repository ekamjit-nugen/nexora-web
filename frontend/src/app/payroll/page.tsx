"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  processing: { label: "Processing", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  review: { label: "In Review", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  finalized: { label: "Finalized", color: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

const FILTER_TABS = ["all", "draft", "review", "approved", "finalized", "paid"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PayrollRun {
  _id: string;
  runNumber?: string;
  month: number;
  year: number;
  status: string;
  employeeCount?: number;
  totalGrossPay?: number;
  totalNetPay?: number;
  grossPay?: number;
  netPay?: number;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatCurrency = (paise: number) => {
  if (typeof paise !== "number" || isNaN(paise)) return "₹0.00";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

const getMonthLabel = (month: number, year: number) => {
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PayrollPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // New run modal
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [newRunMonth, setNewRunMonth] = useState(new Date().getMonth() + 1);
  const [newRunYear, setNewRunYear] = useState(new Date().getFullYear());
  const [initiating, setInitiating] = useState(false);

  // Action loading state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Redirect unauthenticated or unauthorized users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !hasOrgRole("manager")) router.push("/dashboard");
  }, [user, authLoading, router, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchRuns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await payrollApi.getRuns();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.runs ?? [];
      setRuns(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payroll runs");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchRuns();
  }, [fetchRuns, user]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const filteredRuns =
    activeFilter === "all" ? runs : runs.filter((r) => r.status === activeFilter);

  const statCounts = {
    total: runs.length,
    draft: runs.filter((r) => r.status === "draft").length,
    processingOrReview: runs.filter((r) => r.status === "processing" || r.status === "review").length,
    completed: runs.filter((r) => r.status === "paid").length,
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleInitiateRun = async () => {
    setInitiating(true);
    try {
      await payrollApi.initiateRun(newRunMonth, newRunYear);
      toast.success("Payroll run initiated successfully");
      setShowNewRunModal(false);
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payroll run");
    } finally {
      setInitiating(false);
    }
  };

  const handleProcess = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.processRun(id);
      toast.success("Payroll processing started");
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message || "Failed to process payroll run");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await payrollApi.updateRunStatus(id, { status });
      toast.success(`Payroll run status updated to ${statusConfig[status]?.label || status}`);
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payroll run status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGeneratePayslips = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.generatePayslips(id);
      toast.success("Payslips generated successfully");
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate payslips");
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
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Payroll</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Manage monthly payroll runs</p>
          </div>
          <Button
            onClick={() => setShowNewRunModal(true)}
            className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Payroll Run
          </Button>
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* --------------------------------------------------------------- */}
          {/* Stats Row                                                       */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Runs", value: statCounts.total, borderColor: "border-l-[#2E86C1]" },
              { label: "Draft", value: statCounts.draft, borderColor: "border-l-gray-400" },
              { label: "Processing / Review", value: statCounts.processingOrReview, borderColor: "border-l-amber-500" },
              { label: "Completed", value: statCounts.completed, borderColor: "border-l-green-500" },
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
          {/* Filter Tabs                                                     */}
          {/* --------------------------------------------------------------- */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-colors ${
                  activeFilter === tab
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {tab === "all" ? "All" : statusConfig[tab]?.label || tab}
              </button>
            ))}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Content                                                         */}
          {/* --------------------------------------------------------------- */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
                  <div className="flex items-center gap-6">
                    <div className="h-4 bg-gray-200 rounded w-28" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-5 bg-gray-200 rounded-full w-20" />
                    <div className="h-4 bg-gray-200 rounded w-16" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="flex-1" />
                    <div className="h-8 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRuns.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[#0F172A]">No payroll runs yet</h3>
              <p className="text-[13px] text-[#64748B] mt-1">
                Initiate your first payroll run to get started
              </p>
              <Button
                onClick={() => setShowNewRunModal(true)}
                className="mt-4 bg-[#2E86C1] hover:bg-[#2574A9] h-9"
              >
                New Payroll Run
              </Button>
            </div>
          ) : (
            /* Payroll Runs Table */
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Run #
                    </th>
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Period
                    </th>
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Status
                    </th>
                    <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Employees
                    </th>
                    <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Gross Pay
                    </th>
                    <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Net Pay
                    </th>
                    <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => {
                    const cfg = statusConfig[run.status] || statusConfig.draft;
                    const isLoading = actionLoading === run._id;
                    const gross = run.totalGrossPay ?? run.grossPay ?? 0;
                    const net = run.totalNetPay ?? run.netPay ?? 0;

                    return (
                      <tr
                        key={run._id}
                        className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                      >
                        {/* Run # */}
                        <td className="px-5 py-4 text-[13px] font-medium text-[#0F172A]">
                          {run.runNumber || `PR-${run.year}-${String(run.month).padStart(2, "0")}`}
                        </td>

                        {/* Period */}
                        <td className="px-5 py-4 text-[13px] text-[#334155]">
                          {getMonthLabel(run.month, run.year)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${cfg.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Employees */}
                        <td className="px-5 py-4 text-[13px] text-[#334155] text-right">
                          {run.employeeCount ?? "—"}
                        </td>

                        {/* Gross Pay */}
                        <td className="px-5 py-4 text-[13px] text-[#334155] text-right font-medium">
                          {gross ? formatCurrency(gross) : "—"}
                        </td>

                        {/* Net Pay */}
                        <td className="px-5 py-4 text-[13px] text-[#334155] text-right font-medium">
                          {net ? formatCurrency(net) : "—"}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[12px]"
                              onClick={() => router.push(`/payroll/${run._id}`)}
                            >
                              View
                            </Button>

                            {run.status === "draft" && (
                              <Button
                                size="sm"
                                className="h-7 text-[12px] bg-blue-600 hover:bg-blue-700"
                                disabled={isLoading}
                                onClick={() => handleProcess(run._id)}
                              >
                                {isLoading ? "Processing..." : "Process"}
                              </Button>
                            )}

                            {run.status === "review" && (
                              <Button
                                size="sm"
                                className="h-7 text-[12px] bg-emerald-600 hover:bg-emerald-700"
                                disabled={isLoading}
                                onClick={() => handleStatusChange(run._id, "approved")}
                              >
                                {isLoading ? "Approving..." : "Approve"}
                              </Button>
                            )}

                            {run.status === "approved" && (
                              <Button
                                size="sm"
                                className="h-7 text-[12px] bg-purple-600 hover:bg-purple-700"
                                disabled={isLoading}
                                onClick={() => handleStatusChange(run._id, "finalized")}
                              >
                                {isLoading ? "Finalizing..." : "Finalize"}
                              </Button>
                            )}

                            {run.status === "finalized" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-[12px] bg-green-600 hover:bg-green-700"
                                  disabled={isLoading}
                                  onClick={() => handleStatusChange(run._id, "paid")}
                                >
                                  {isLoading ? "Updating..." : "Mark Paid"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[12px]"
                                  disabled={isLoading}
                                  onClick={() => handleGeneratePayslips(run._id)}
                                >
                                  {isLoading ? "Generating..." : "Generate Payslips"}
                                </Button>
                              </>
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
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* New Payroll Run Modal                                             */}
        {/* ----------------------------------------------------------------- */}
        {showNewRunModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !initiating && setShowNewRunModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-md mx-4 p-6">
              <h2 className="text-[17px] font-bold text-[#0F172A]">New Payroll Run</h2>
              <p className="text-[13px] text-[#64748B] mt-1">
                Select the month and year to initiate a new payroll run.
              </p>

              <div className="mt-5 space-y-4">
                {/* Month */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1.5">
                    Month
                  </label>
                  <select
                    value={newRunMonth}
                    onChange={(e) => setNewRunMonth(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1.5">
                    Year
                  </label>
                  <input
                    type="number"
                    value={newRunYear}
                    onChange={(e) => setNewRunYear(Number(e.target.value))}
                    min={2020}
                    max={2099}
                    className="w-full h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  className="h-9 text-[13px]"
                  disabled={initiating}
                  onClick={() => setShowNewRunModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="h-9 text-[13px] bg-[#2E86C1] hover:bg-[#2574A9]"
                  disabled={initiating}
                  onClick={handleInitiateRun}
                >
                  {initiating ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Initiating...
                    </span>
                  ) : (
                    "Initiate Run"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
