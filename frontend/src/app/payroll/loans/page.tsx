"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
const statusConfig: Record<string, { label: string; color: string }> = {
  applied: { label: "Applied", color: "bg-blue-50 text-blue-700 border-blue-200" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  disbursed: { label: "Disbursed", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  active: { label: "Active", color: "bg-green-50 text-green-700 border-green-200" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 border-gray-200" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

// ---------------------------------------------------------------------------
// Type configuration
// ---------------------------------------------------------------------------
const typeConfig: Record<string, { label: string; color: string }> = {
  salary_advance: { label: "Salary Advance", color: "bg-blue-50 text-blue-700 border-blue-200" },
  personal_loan: { label: "Personal Loan", color: "bg-purple-50 text-purple-700 border-purple-200" },
  emergency_loan: { label: "Emergency", color: "bg-red-50 text-red-700 border-red-200" },
  festival_advance: { label: "Festival Advance", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const LOAN_TYPE_OPTIONS = ["salary_advance", "personal_loan", "emergency_loan", "festival_advance"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EmiInstallment {
  installmentNumber: number;
  dueMonth: string;
  principal: number;
  interest: number;
  emiAmount: number;
  status: string;
}

interface Loan {
  _id: string;
  loanNumber?: string;
  loanType: string;
  amount: number;
  tenure: number;
  interestRate: number;
  emiAmount: number;
  outstandingBalance: number;
  status: string;
  reason?: string;
  createdAt?: string;
  emiSchedule?: EmiInstallment[];
  employeeName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatCurrency = (paise: number | undefined | null) => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90.00";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const calculateEmi = (amount: number, tenure: number, rate: number): number => {
  if (tenure <= 0 || amount <= 0) return 0;
  if (rate === 0) return amount / tenure;
  const monthlyRate = rate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenure);
  return (amount * monthlyRate * factor) / (factor - 1);
};

type TabKey = "my" | "all";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EmployeeLoansPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isManager = hasOrgRole("manager");
  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail / expanded row
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [newType, setNewType] = useState<string>("salary_advance");
  const [newAmount, setNewAmount] = useState("");
  const [newTenure, setNewTenure] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Default interest rate for salary advance
  useEffect(() => {
    if (newType === "salary_advance") setNewRate("0");
  }, [newType]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchMyLoans = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getMyLoans();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.loans ?? [];
      setMyLoans(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load your loans");
    }
  }, [user]);

  const fetchAllLoans = useCallback(async () => {
    if (!user || !isManager) return;
    try {
      const res = await payrollApi.getLoans();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.loans ?? [];
      setAllLoans(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load all loans");
    }
  }, [user, isManager]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMyLoans(), fetchAllLoans()]);
    setLoading(false);
  }, [fetchMyLoans, fetchAllLoans]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // ---------------------------------------------------------------------------
  // Stats (computed from my loans)
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const activeLoans = myLoans.filter((l) => l.status === "active");
    return {
      activeCount: activeLoans.length,
      totalBorrowed: myLoans.reduce((sum, l) => sum + (l.amount || 0), 0),
      outstandingBalance: myLoans
        .filter((l) => ["active", "disbursed"].includes(l.status))
        .reduce((sum, l) => sum + (l.outstandingBalance || 0), 0),
      monthlyEmi: activeLoans.reduce((sum, l) => sum + (l.emiAmount || 0), 0),
    };
  }, [myLoans]);

  // ---------------------------------------------------------------------------
  // Active data for current tab
  // ---------------------------------------------------------------------------
  const activeLoans = activeTab === "my" ? myLoans : allLoans;

  // ---------------------------------------------------------------------------
  // Expand / Detail
  // ---------------------------------------------------------------------------
  const handleToggleExpand = useCallback(
    async (loanId: string) => {
      if (expandedLoanId === loanId) {
        setExpandedLoanId(null);
        setDetailLoan(null);
        return;
      }
      setExpandedLoanId(loanId);
      setDetailLoading(true);
      try {
        const res = await payrollApi.getLoan(loanId);
        setDetailLoan(res.data as Loan);
      } catch (err: any) {
        toast.error(err.message || "Failed to load loan details");
        setExpandedLoanId(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedLoanId],
  );

  // ---------------------------------------------------------------------------
  // EMI Preview (apply modal)
  // ---------------------------------------------------------------------------
  const emiPreview = useMemo(() => {
    const amt = parseFloat(newAmount);
    const ten = parseInt(newTenure, 10);
    const rate = parseFloat(newRate || "0");
    if (isNaN(amt) || isNaN(ten) || amt <= 0 || ten <= 0) return null;
    const emi = calculateEmi(amt, ten, rate);
    const totalPayable = emi * ten;
    const totalInterest = totalPayable - amt;
    return { emi, totalPayable, totalInterest };
  }, [newAmount, newTenure, newRate]);

  // ---------------------------------------------------------------------------
  // Reset modal
  // ---------------------------------------------------------------------------
  const resetModal = () => {
    setNewType("salary_advance");
    setNewAmount("");
    setNewTenure("");
    setNewRate("0");
    setNewReason("");
    setShowApplyModal(false);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleApplyLoan = async () => {
    const amount = parseFloat(newAmount);
    const tenure = parseInt(newTenure, 10);
    const interestRate = parseFloat(newRate || "0");

    if (!newType) {
      toast.error("Please select a loan type");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }
    if (isNaN(tenure) || tenure < 1 || tenure > 60) {
      toast.error("Tenure must be between 1 and 60 months");
      return;
    }
    if (isNaN(interestRate) || interestRate < 0) {
      toast.error("Interest rate must be 0 or positive");
      return;
    }
    if (!newReason.trim()) {
      toast.error("Please provide a reason for the loan");
      return;
    }

    setSaving(true);
    try {
      await payrollApi.applyLoan({
        loanType: newType,
        amount: Math.round(amount * 100),
        tenure,
        interestRate,
        reason: newReason.trim(),
      });
      toast.success("Loan application submitted successfully");
      resetModal();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit loan application");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelLoan = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      await payrollApi.approveLoan(loanId, { status: "cancelled" });
      toast.success("Loan application cancelled");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel loan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveLoan = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      await payrollApi.approveLoan(loanId, { status: "approved" });
      toast.success("Loan approved");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve loan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectLoan = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      await payrollApi.approveLoan(loanId, { status: "rejected" });
      toast.success("Loan rejected");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject loan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisburseLoan = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      await payrollApi.disburseLoan(loanId);
      toast.success("Loan disbursed successfully");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to disburse loan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseLoan = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      await payrollApi.closeLoan(loanId);
      toast.success("Loan closed");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to close loan");
    } finally {
      setActionLoading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderBadge = (value: string, config: Record<string, { label: string; color: string }>) => {
    const cfg = config[value] || { label: value, color: "bg-gray-100 text-gray-600 border-gray-200" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  const emiInstallmentStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-gray-100 text-gray-600 border-gray-200" },
    deducted: { label: "Deducted", color: "bg-green-50 text-green-700 border-green-200" },
    skipped: { label: "Skipped", color: "bg-amber-50 text-amber-700 border-amber-200" },
  };

  // ---------------------------------------------------------------------------
  // Auth gate
  // ---------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E86C1]" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // JSX
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
            <h1 className="text-[20px] font-bold text-[#0F172A]">Employee Loans</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Apply for loans and track repayments</p>
          </div>
          <Button
            onClick={() => setShowApplyModal(true)}
            className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Apply for Loan
          </Button>
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* --------------------------------------------------------------- */}
          {/* Tabs                                                            */}
          {/* --------------------------------------------------------------- */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeTab === "my"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              My Loans
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === "all"
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                All Loans
              </button>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Stats Row (only on "my" tab)                                    */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "my" && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Active Loans", value: stats.activeCount, borderColor: "border-l-[#2E86C1]" },
                { label: "Total Borrowed", value: formatCurrency(stats.totalBorrowed), borderColor: "border-l-purple-500" },
                { label: "Outstanding Balance", value: formatCurrency(stats.outstandingBalance), borderColor: "border-l-amber-500" },
                { label: "Monthly EMI", value: formatCurrency(stats.monthlyEmi), borderColor: "border-l-green-500" },
              ].map((stat) => (
                <Card key={stat.label} className={`rounded-xl border shadow-sm ${stat.borderColor} border-l-4`}>
                  <CardContent className="p-5">
                    <p className="text-[13px] text-[#64748B]">{stat.label}</p>
                    <p className="text-2xl font-bold text-[#0F172A] mt-1">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* Loans Table                                                     */}
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
                    <div className="flex-1" />
                    <div className="h-8 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeLoans.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <p className="text-[#64748B] mt-3 text-[14px]">
                {activeTab === "my" ? "You have no loan applications yet." : "No loan records found."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Loan #</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Type</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Amount</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">EMI</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Tenure</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Outstanding</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLoans.map((loan) => (
                      <>
                        <tr
                          key={loan._id}
                          onClick={() => handleToggleExpand(loan._id)}
                          className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer transition-colors ${
                            expandedLoanId === loan._id ? "bg-[#F8FAFC]" : ""
                          }`}
                        >
                          <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A]">
                            {loan.loanNumber || loan._id.slice(-8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3.5">{renderBadge(loan.loanType, typeConfig)}</td>
                          <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A]">{formatCurrency(loan.amount)}</td>
                          <td className="px-5 py-3.5 text-[13px] text-[#475569]">{formatCurrency(loan.emiAmount)}</td>
                          <td className="px-5 py-3.5 text-[13px] text-[#475569]">{loan.tenure} mo</td>
                          <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A]">{formatCurrency(loan.outstandingBalance)}</td>
                          <td className="px-5 py-3.5">{renderBadge(loan.status, statusConfig)}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {/* Employee: cancel applied loan */}
                              {loan.status === "applied" && activeTab === "my" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[12px] text-red-600 border-red-200 hover:bg-red-50"
                                  disabled={actionLoading === loan._id}
                                  onClick={() => handleCancelLoan(loan._id)}
                                >
                                  {actionLoading === loan._id ? "..." : "Cancel"}
                                </Button>
                              )}
                              {/* Manager: approve / reject applied loans */}
                              {loan.status === "applied" && activeTab === "all" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 text-[12px] bg-green-600 hover:bg-green-700 text-white"
                                    disabled={actionLoading === loan._id}
                                    onClick={() => handleApproveLoan(loan._id)}
                                  >
                                    {actionLoading === loan._id ? "..." : "Approve"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[12px] text-red-600 border-red-200 hover:bg-red-50"
                                    disabled={actionLoading === loan._id}
                                    onClick={() => handleRejectLoan(loan._id)}
                                  >
                                    {actionLoading === loan._id ? "..." : "Reject"}
                                  </Button>
                                </>
                              )}
                              {/* Admin: disburse approved loan */}
                              {loan.status === "approved" && isAdmin && (
                                <Button
                                  size="sm"
                                  className="h-7 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white"
                                  disabled={actionLoading === loan._id}
                                  onClick={() => handleDisburseLoan(loan._id)}
                                >
                                  {actionLoading === loan._id ? "..." : "Disburse"}
                                </Button>
                              )}
                              {/* Admin: close active loan */}
                              {loan.status === "active" && isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[12px] text-gray-600 border-gray-300 hover:bg-gray-50"
                                  disabled={actionLoading === loan._id}
                                  onClick={() => handleCloseLoan(loan._id)}
                                >
                                  {actionLoading === loan._id ? "..." : "Close"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded EMI Schedule Row */}
                        {expandedLoanId === loan._id && (
                          <tr key={`${loan._id}-detail`} className="bg-[#FAFBFC]">
                            <td colSpan={8} className="px-5 py-4">
                              {detailLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2E86C1]" />
                                </div>
                              ) : detailLoan?.emiSchedule && detailLoan.emiSchedule.length > 0 ? (
                                <div className="space-y-4">
                                  <h4 className="text-[14px] font-semibold text-[#0F172A]">EMI Schedule</h4>
                                  <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                                          <th className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">#</th>
                                          <th className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Due Month</th>
                                          <th className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Principal</th>
                                          <th className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Interest</th>
                                          <th className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">EMI</th>
                                          <th className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detailLoan.emiSchedule.map((inst) => (
                                          <tr key={inst.installmentNumber} className="border-b border-[#F1F5F9]">
                                            <td className="px-4 py-2.5 text-[12px] text-[#475569]">{inst.installmentNumber}</td>
                                            <td className="px-4 py-2.5 text-[12px] text-[#0F172A]">{inst.dueMonth || "\u2014"}</td>
                                            <td className="px-4 py-2.5 text-[12px] text-[#0F172A]">{formatCurrency(inst.principal)}</td>
                                            <td className="px-4 py-2.5 text-[12px] text-[#475569]">{formatCurrency(inst.interest)}</td>
                                            <td className="px-4 py-2.5 text-[12px] font-medium text-[#0F172A]">{formatCurrency(inst.emiAmount)}</td>
                                            <td className="px-4 py-2.5">{renderBadge(inst.status, emiInstallmentStatusConfig)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {/* Summary */}
                                  <div className="flex items-center gap-6 text-[13px]">
                                    <span className="text-[#64748B]">
                                      Total Paid:{" "}
                                      <span className="font-semibold text-green-700">
                                        {formatCurrency(
                                          detailLoan.emiSchedule
                                            .filter((i) => i.status === "deducted")
                                            .reduce((s, i) => s + (i.emiAmount || 0), 0),
                                        )}
                                      </span>
                                    </span>
                                    <span className="text-[#64748B]">
                                      Remaining:{" "}
                                      <span className="font-semibold text-amber-700">
                                        {formatCurrency(
                                          detailLoan.emiSchedule
                                            .filter((i) => i.status !== "deducted")
                                            .reduce((s, i) => s + (i.emiAmount || 0), 0),
                                        )}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-6 text-[13px] text-[#94A3B8]">
                                  {detailLoan?.reason && (
                                    <p className="mb-2">
                                      <span className="font-medium text-[#64748B]">Reason:</span> {detailLoan.reason}
                                    </p>
                                  )}
                                  <p>No EMI schedule available for this loan.</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* Apply for Loan Modal                                                */}
      {/* ------------------------------------------------------------------- */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={resetModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[18px] font-bold text-[#0F172A]">Apply for Loan</h2>
              <button onClick={resetModal} className="text-[#94A3B8] hover:text-[#64748B] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Loan Type */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Loan Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                >
                  {LOAN_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {typeConfig[opt]?.label || opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Amount (INR)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 50000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>

              {/* Tenure */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Tenure (months)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  placeholder="e.g. 12"
                  value={newTenure}
                  onChange={(e) => setNewTenure(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>

              {/* Interest Rate */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Interest Rate (% per annum)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 8.5"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
                {newType === "salary_advance" && (
                  <p className="text-[11px] text-[#94A3B8] mt-1">Salary advances typically have 0% interest.</p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Reason</label>
                <textarea
                  rows={3}
                  placeholder="Describe why you need this loan..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>

              {/* EMI Preview */}
              {emiPreview && (
                <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-4 space-y-2">
                  <h4 className="text-[13px] font-semibold text-[#0369A1]">EMI Preview</h4>
                  <div className="grid grid-cols-3 gap-3 text-[12px]">
                    <div>
                      <p className="text-[#64748B]">Monthly EMI</p>
                      <p className="font-bold text-[#0F172A] text-[15px]">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 2,
                        }).format(emiPreview.emi)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Total Payable</p>
                      <p className="font-semibold text-[#0F172A]">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 2,
                        }).format(emiPreview.totalPayable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Total Interest</p>
                      <p className="font-semibold text-[#475569]">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 2,
                        }).format(emiPreview.totalInterest)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
              <Button variant="outline" onClick={resetModal} className="h-9 text-[13px]">
                Cancel
              </Button>
              <Button
                onClick={handleApplyLoan}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
              >
                {saving ? "Submitting..." : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
