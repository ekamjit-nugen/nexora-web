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
// Category configuration
// ---------------------------------------------------------------------------
const categoryConfig: Record<string, { label: string; color: string }> = {
  travel: { label: "Travel", color: "bg-blue-50 text-blue-700 border-blue-200" },
  food: { label: "Food", color: "bg-amber-50 text-amber-700 border-amber-200" },
  medical: { label: "Medical", color: "bg-red-50 text-red-700 border-red-200" },
  internet: { label: "Internet", color: "bg-purple-50 text-purple-700 border-purple-200" },
  phone: { label: "Phone", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  office_supplies: { label: "Office", color: "bg-gray-50 text-gray-700 border-gray-200" },
  training: { label: "Training", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  client_entertainment: { label: "Client", color: "bg-pink-50 text-pink-700 border-pink-200" },
  other: { label: "Other", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200" },
  manager_approved: { label: "Manager Approved", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  hr_approved: { label: "HR Approved", color: "bg-violet-50 text-violet-700 border-violet-200" },
  finance_approved: { label: "Finance Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

const CATEGORY_OPTIONS = [
  "travel", "food", "medical", "internet", "phone",
  "office_supplies", "training", "client_entertainment", "other",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ExpenseItem {
  description: string;
  amount: number;
  date: string;
}

interface ApprovalChainEntry {
  level: "manager" | "hr" | "finance";
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
}

interface ExpenseClaim {
  _id: string;
  claimNumber?: string;
  title: string;
  category: string;
  items: ExpenseItem[];
  totalAmount: number;
  status: string;
  createdAt?: string;
  remarks?: string;
  approvalChain?: ApprovalChainEntry[];
}

/**
 * Next pending tier on the claim's approval chain. Used to build a
 * "Needs finance approval" badge and a context-aware button label so
 * approvers see exactly which tier they're acting at (#16).
 */
const nextApprovalTier = (
  claim: ExpenseClaim,
): "manager" | "hr" | "finance" | null => {
  const chain = claim.approvalChain || [];
  const next = chain.find((e) => e.status === "pending");
  return next?.level ?? null;
};

const tierConfig: Record<
  "manager" | "hr" | "finance",
  { label: string; chip: string; buttonLabel: string }
> = {
  manager: {
    label: "Needs Manager approval",
    chip: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    buttonLabel: "Approve as Manager",
  },
  hr: {
    label: "Needs HR approval",
    chip: "bg-violet-50 text-violet-700 border border-violet-200",
    buttonLabel: "Approve as HR",
  },
  finance: {
    label: "Needs Finance approval",
    chip: "bg-amber-50 text-amber-800 border border-amber-200",
    buttonLabel: "Approve as Finance",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Expense amounts are stored in rupees on the backend (same convention
// as payroll entries / payslips). Dividing by 100 made ₹12,500 show as
// ₹125.00.
const formatCurrency = (rupees: number | undefined | null) => {
  if (typeof rupees !== "number" || isNaN(rupees)) return "\u20B90.00";
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

type TabKey = "my" | "pending" | "all";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExpenseClaimsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isManager = hasOrgRole("manager");

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [pendingClaims, setPendingClaims] = useState<ExpenseClaim[]>([]);
  const [allClaims, setAllClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New Claim modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("travel");
  const [newItems, setNewItems] = useState<{ description: string; amount: string; date: string }[]>([
    { description: "", amount: "", date: "" },
  ]);
  const [saving, setSaving] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchMyClaims = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getMyExpenseClaims();
      const raw: any = res.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : raw?.claims ?? [];
      setClaims(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load expense claims");
    }
  }, [user]);

  const fetchPendingClaims = useCallback(async () => {
    if (!user || !isManager) return;
    try {
      const res = await payrollApi.getPendingExpenses();
      const raw: any = res.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : raw?.claims ?? [];
      setPendingClaims(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load pending claims");
    }
  }, [user, isManager]);

  const fetchAllClaims = useCallback(async () => {
    if (!user || !isManager) return;
    try {
      const res = await payrollApi.getAllExpenseClaims();
      const raw: any = res.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : raw?.claims ?? [];
      setAllClaims(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load all claims");
    }
  }, [user, isManager]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMyClaims(), fetchPendingClaims(), fetchAllClaims()]);
    setLoading(false);
  }, [fetchMyClaims, fetchPendingClaims, fetchAllClaims]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // ---------------------------------------------------------------------------
  // Stats (computed from "my" claims)
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const pendingStatuses = ["draft", "submitted", "manager_approved", "hr_approved"];
    const approvedStatuses = ["finance_approved", "paid"];
    return {
      total: claims.length,
      pending: claims.filter((c) => pendingStatuses.includes(c.status)).length,
      approved: claims.filter((c) => approvedStatuses.includes(c.status)).length,
      totalAmount: claims.reduce((sum, c) => sum + (c.totalAmount || 0), 0),
    };
  }, [claims]);

  // ---------------------------------------------------------------------------
  // Active data for current tab
  // ---------------------------------------------------------------------------
  const activeClaims = activeTab === "my" ? claims : activeTab === "pending" ? pendingClaims : allClaims;

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(activeClaims.length / ITEMS_PER_PAGE);
  const paginatedClaims = activeClaims.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when tab changes
  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  // ---------------------------------------------------------------------------
  // New item helpers
  // ---------------------------------------------------------------------------
  const addItem = () => {
    setNewItems((prev) => [...prev, { description: "", amount: "", date: "" }]);
  };

  const removeItem = (index: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    setNewItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const newTotal = useMemo(() => {
    return newItems.reduce((sum, item) => {
      const val = parseFloat(item.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [newItems]);

  const resetModal = () => {
    setNewTitle("");
    setNewCategory("travel");
    setNewItems([{ description: "", amount: "", date: "" }]);
    setShowNewModal(false);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCreateClaim = async (submitAfter: boolean) => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (newItems.length === 0 || newItems.every((i) => !i.description.trim())) {
      toast.error("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      const validItems = newItems.filter((i) => i.description.trim());

      // Validate amounts are positive
      const invalidItem = validItems.find(i => parseFloat(i.amount || "0") <= 0);
      if (invalidItem) {
        toast.error("All expense amounts must be greater than zero");
        setSaving(false);
        return;
      }

      // Backend stores amounts in rupees and computes `totalAmount` via a
      // pre-save hook, so (a) don't ×100 here and (b) don't ship the
      // total up — the DTO whitelists items only and rejects unknown
      // keys with a 400 ("property totalAmount should not exist").
      const items = validItems
        .map((i) => ({
          description: i.description.trim(),
          amount: Math.round(parseFloat(i.amount || "0")),
          date: i.date || new Date().toISOString().split("T")[0],
        }));

      const res = await payrollApi.createExpenseClaim({
        title: newTitle.trim(),
        category: newCategory,
        items,
      });

      if (submitAfter && res.data) {
        const claimId = (res.data as any)._id;
        if (claimId) {
          await payrollApi.submitExpenseClaim(claimId);
          toast.success("Expense claim submitted successfully");
        }
      } else {
        toast.success("Expense claim saved as draft");
      }

      resetModal();
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to create expense claim");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.submitExpenseClaim(id);
      toast.success("Claim submitted for approval");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit claim");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.approveExpenseClaim(id, { status: "approved" });
      toast.success("Claim approved successfully");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve claim");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const remarks = window.prompt("Enter rejection remarks:");
    if (remarks === null) return;
    if (!remarks.trim()) {
      toast.error("Remarks are required for rejection");
      return;
    }

    setActionLoading(id);
    try {
      await payrollApi.approveExpenseClaim(id, { status: "rejected", remarks: remarks.trim() });
      toast.success("Claim rejected");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject claim");
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
            <h1 className="text-[20px] font-bold text-[#0F172A]">Expense Claims</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Submit and track reimbursement claims</p>
          </div>
          <Button
            onClick={() => setShowNewModal(true)}
            className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Claim
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
              My Claims
            </button>
            {isManager && (
              <>
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeTab === "pending"
                      ? "bg-white text-[#0F172A] shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  Pending Approval
                  {pendingClaims.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                      {pendingClaims.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeTab === "all"
                      ? "bg-white text-[#0F172A] shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  All Claims
                </button>
              </>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Stats Row (only on "my" tab)                                    */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "my" && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Claims", value: stats.total, borderColor: "border-l-[#2E86C1]" },
                { label: "Pending", value: stats.pending, borderColor: "border-l-amber-500" },
                { label: "Approved", value: stats.approved, borderColor: "border-l-green-500" },
                { label: "Total Amount", value: formatCurrency(stats.totalAmount), borderColor: "border-l-purple-500" },
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
          {/* Claims Table                                                    */}
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
          ) : activeClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[#0F172A]">
                {activeTab === "my" ? "No expense claims yet" : activeTab === "pending" ? "No claims pending approval" : "No claims found"}
              </h3>
              <p className="text-[13px] text-[#64748B] mt-1">
                {activeTab === "my" ? "Submit your first expense claim to get started" : "All caught up!"}
              </p>
              {activeTab === "my" && (
                <Button
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 bg-[#2E86C1] hover:bg-[#2574A9] h-9"
                >
                  New Claim
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Claim #
                    </th>
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Title
                    </th>
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Category
                    </th>
                    <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Amount
                    </th>
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Status
                    </th>
                    <th className="text-left text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Date
                    </th>
                    <th className="text-right text-[12px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClaims.map((claim) => {
                    const catCfg = categoryConfig[claim.category] || categoryConfig.other;
                    const stsCfg = statusConfig[claim.status] || statusConfig.draft;
                    const isLoading = actionLoading === claim._id;

                    return (
                      <tr
                        key={claim._id}
                        className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                      >
                        {/* Claim # */}
                        <td className="px-5 py-4 text-[13px] font-medium text-[#0F172A]">
                          {claim.claimNumber || `EXP-${new Date(claim.createdAt || "").getFullYear()}-${String(new Date(claim.createdAt || "").getMonth() + 1).padStart(2, "0")}-${String(claims.indexOf(claim) + 1).padStart(3, "0")}`}
                        </td>

                        {/* Title */}
                        <td className="px-5 py-4 text-[13px] text-[#334155]">
                          {claim.title}
                        </td>

                        {/* Category Badge */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${catCfg.color}`}>
                            {catCfg.label}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 text-[13px] text-[#334155] text-right font-medium">
                          {formatCurrency(claim.totalAmount)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${stsCfg.color}`}>
                            {stsCfg.label}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4 text-[13px] text-[#64748B]">
                          {formatDate(claim.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Pending Approval tab: tier-aware Approve/Reject (#16) */}
                            {activeTab === "pending" && (() => {
                              const tier = nextApprovalTier(claim);
                              const cfg = tier ? tierConfig[tier] : null;
                              return (
                                <>
                                  {cfg && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${cfg.chip} whitespace-nowrap`}
                                      title="Which approval tier this claim is waiting on"
                                    >
                                      {cfg.label}
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    className="h-7 text-[12px] bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                                    disabled={isLoading}
                                    onClick={() => handleApprove(claim._id)}
                                  >
                                    {isLoading ? "..." : cfg ? cfg.buttonLabel : "Approve"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-[12px] bg-red-600 hover:bg-red-700"
                                    disabled={isLoading}
                                    onClick={() => handleReject(claim._id)}
                                  >
                                    {isLoading ? "..." : "Reject"}
                                  </Button>
                                </>
                              );
                            })()}

                            {/* My Claims / All Claims tab actions */}
                            {activeTab !== "pending" && (
                              <>
                                {claim.status === "draft" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[12px]"
                                      disabled={isLoading}
                                      onClick={() => router.push(`/payroll/expenses/${claim._id}`)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-[12px] bg-[#2E86C1] hover:bg-[#2574A9]"
                                      disabled={isLoading}
                                      onClick={() => handleSubmit(claim._id)}
                                    >
                                      {isLoading ? "Submitting..." : "Submit"}
                                    </Button>
                                  </>
                                )}

                                {(claim.status === "submitted" ||
                                  claim.status === "manager_approved" ||
                                  claim.status === "hr_approved" ||
                                  claim.status === "finance_approved" ||
                                  claim.status === "paid") && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[12px]"
                                    onClick={() => router.push(`/payroll/expenses/${claim._id}`)}
                                  >
                                    View
                                  </Button>
                                )}

                                {claim.status === "rejected" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[12px]"
                                      disabled={isLoading}
                                      onClick={() => router.push(`/payroll/expenses/${claim._id}`)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-[12px] bg-amber-600 hover:bg-amber-700"
                                      disabled={isLoading}
                                      onClick={() => handleSubmit(claim._id)}
                                    >
                                      {isLoading ? "Resubmitting..." : "Resubmit"}
                                    </Button>
                                  </>
                                )}
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                  <p className="text-[12px] text-[#64748B]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, activeClaims.length)} of {activeClaims.length}
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
        {/* New Claim Modal                                                   */}
        {/* ----------------------------------------------------------------- */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !saving && resetModal()}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-[17px] font-bold text-[#0F172A]">New Expense Claim</h2>
              <p className="text-[13px] text-[#64748B] mt-1">
                Add your expense details and submit for reimbursement.
              </p>

              <div className="mt-5 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Client visit to Mumbai"
                    className="w-full h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1.5">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryConfig[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Items */}
                <div>
                  <label className="block text-[13px] font-medium text-[#334155] mb-1.5">
                    Items
                  </label>
                  <div className="space-y-3">
                    {newItems.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            placeholder="Description"
                            className="w-full h-8 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                          />
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748B]">{"\u20B9"}</span>
                              <input
                                type="number"
                                value={item.amount}
                                onChange={(e) => updateItem(index, "amount", e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-8 rounded-md border border-[#E2E8F0] bg-white pl-6 pr-2.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                              />
                            </div>
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(index, "date", e.target.value)}
                              className="w-36 h-8 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                            />
                          </div>
                        </div>
                        {newItems.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="mt-1 p-1 text-[#94A3B8] hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addItem}
                    className="mt-2 text-[12px] font-medium text-[#2E86C1] hover:text-[#2574A9] transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Item
                  </button>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
                  <span className="text-[13px] font-medium text-[#334155]">Total Amount</span>
                  <span className="text-[16px] font-bold text-[#0F172A]">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 2,
                    }).format(newTotal)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  className="h-9 text-[13px]"
                  disabled={saving}
                  onClick={resetModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="h-9 text-[13px]"
                  disabled={saving}
                  onClick={() => handleCreateClaim(false)}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent" />
                      Saving...
                    </span>
                  ) : (
                    "Save as Draft"
                  )}
                </Button>
                <Button
                  className="h-9 text-[13px] bg-[#2E86C1] hover:bg-[#2574A9]"
                  disabled={saving}
                  onClick={() => handleCreateClaim(true)}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit"
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
