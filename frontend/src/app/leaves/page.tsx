"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { leaveApi, hrApi, policyApi, Leave, Employee, Policy } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface LeaveBalanceEntry {
  leaveType: string;
  opening: number;
  accrued: number;
  used: number;
  adjusted: number;
  carriedForward: number;
  available: number;
}

interface LeaveBalance {
  balances?: LeaveBalanceEntry[];
  // Legacy flat format fallback
  casual?: { total: number; used: number; available: number };
  sick?: { total: number; used: number; available: number };
  earned?: { total: number; used: number; available: number };
  wfh?: { total: number; used: number; available: number };
}

const leaveTypeLabels: Record<string, string> = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  earned: "Earned Leave",
  wfh: "Work From Home",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  bereavement: "Bereavement Leave",
  comp_off: "Comp Off",
  lop: "Loss of Pay",
};

const leaveTypeOptions = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "wfh", label: "Work From Home" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "bereavement", label: "Bereavement Leave" },
  { value: "comp_off", label: "Comp Off" },
  { value: "lop", label: "Loss of Pay" },
];

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};

const balanceCardMeta: Record<string, { color: string; icon: string }> = {
  casual: {
    color: "text-blue-600 bg-blue-50",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  sick: {
    color: "text-red-600 bg-red-50",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  earned: {
    color: "text-emerald-600 bg-emerald-50",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  wfh: {
    color: "text-violet-600 bg-violet-50",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const current = new Date(s);
  while (current <= e) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function LeavesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [myLeaves, setMyLeaves] = useState<Leave[]>([]);
  const [allLeaves, setAllLeaves] = useState<Leave[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leavePolicy, setLeavePolicy] = useState<Policy | null>(null);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "all" | "approvals">("my");
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [applyForm, setApplyForm] = useState({
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const isAdmin = user?.roles?.some((r) => ["admin", "super_admin"].includes(r));
  const isHR = user?.roles?.some((r) => ["hr"].includes(r));
  const canManage = isAdmin || isHR;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const promises: Promise<unknown>[] = [
        leaveApi.getMy(),
        leaveApi.getBalance(),
        policyApi.getAll({ type: "leave", isActive: "true" }),
      ];

      if (canManage) {
        promises.push(leaveApi.getAll());
        promises.push(leaveApi.getAll({ status: "pending" }));
        promises.push(hrApi.getEmployees({ limit: "100" }));
      }

      const results = await Promise.all(promises);

      setMyLeaves(((results[0] as { data: Leave[] }).data) || []);

      const balanceData = (results[1] as { data: LeaveBalance }).data;
      if (balanceData) setBalance(balanceData);

      // Active leave policy
      const leavePolicies = ((results[2] as { data: Policy[] }).data) || [];
      const activeLp = leavePolicies.find((p) => p.leavePolicy && p.isActive && !p.isDeleted);
      setLeavePolicy(activeLp || null);

      if (canManage && results[3]) {
        setAllLeaves(((results[3] as { data: Leave[] }).data) || []);
      }
      if (canManage && results[4]) {
        setPendingLeaves(((results[4] as { data: Leave[] }).data) || []);
      }
      if (canManage && results[5]) {
        const employees = ((results[5] as { data: Employee[] }).data) || [];
        const map: Record<string, string> = {};
        for (const emp of employees) {
          map[emp.userId] = `${emp.firstName} ${emp.lastName}`;
          map[emp._id] = `${emp.firstName} ${emp.lastName}`;
        }
        setEmployeeMap(map);
      }
    } catch {
      toast.error("Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleApply = async () => {
    if (!applyForm.leaveType || !applyForm.startDate || !applyForm.endDate || !applyForm.reason) {
      toast.error("Please fill in all fields");
      return;
    }
    const days = calculateDays(applyForm.startDate, applyForm.endDate);
    if (days <= 0) {
      toast.error("End date must be after start date with at least 1 business day");
      return;
    }
    try {
      setActionLoading(true);
      await leaveApi.apply({
        leaveType: applyForm.leaveType,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        reason: applyForm.reason,
      });
      toast.success("Leave applied successfully!");
      setShowApplyForm(false);
      setApplyForm({ leaveType: "casual", startDate: "", endDate: "", reason: "" });
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to apply leave");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await leaveApi.approve(id, { status: "approved" });
      toast.success("Leave approved");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      setActionLoading(true);
      await leaveApi.approve(id, { status: "rejected", rejectionReason: rejectReason });
      toast.success("Leave rejected");
      setRejectingId(null);
      setRejectReason("");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    const reason = cancelReason.trim() || "Cancelled by employee";
    try {
      setActionLoading(true);
      await leaveApi.cancel(id, { reason });
      toast.success("Leave cancelled");
      setCancellingId(null);
      setCancelReason("");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Build balance cards from either format
  const balanceCards = (() => {
    if (!balance) return [];
    // New array-based format from backend
    if (balance.balances && Array.isArray(balance.balances)) {
      return ["casual", "sick", "earned", "wfh"]
        .map((type) => {
          const entry = balance.balances!.find((b) => b.leaveType === type);
          if (!entry) return null;
          const meta = balanceCardMeta[type] || { color: "text-gray-600 bg-gray-50", icon: "" };
          // Use policy allocation as the source of truth if available
          const policyType = leavePolicy?.leavePolicy?.leaveTypes?.find((lt: { type: string }) => lt.type === type);
          const annualTotal = policyType ? policyType.annualAllocation : (entry.opening + entry.accrued + entry.adjusted + entry.carriedForward);
          const used = entry.used || 0;
          const available = Math.max(annualTotal - used, 0);
          return {
            key: type,
            label: policyType?.label || leaveTypeLabels[type] || type,
            used,
            available,
            total: annualTotal,
            color: meta.color,
            icon: meta.icon,
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        label: string;
        used: number;
        available: number;
        total: number;
        color: string;
        icon: string;
      }>;
    }
    // Legacy flat format fallback
    const def = { total: 0, used: 0, available: 0 };
    return [
      { key: "casual", label: "Casual Leave", ...(balance.casual ?? def), ...balanceCardMeta.casual },
      { key: "sick", label: "Sick Leave", ...(balance.sick ?? def), ...balanceCardMeta.sick },
      { key: "earned", label: "Earned Leave", ...(balance.earned ?? def), ...balanceCardMeta.earned },
      { key: "wfh", label: "Work From Home", ...(balance.wfh ?? def), ...balanceCardMeta.wfh },
    ];
  })();

  const applyDaysPreview = calculateDays(applyForm.startDate, applyForm.endDate);

  const tabs = [
    { key: "my" as const, label: "My Leaves" },
    ...(canManage
      ? [
          { key: "all" as const, label: "All Leaves" },
          {
            key: "approvals" as const,
            label: `Pending Approvals${pendingLeaves.length > 0 ? ` (${pendingLeaves.length})` : ""}`,
          },
        ]
      : []),
  ];

  const currentRecords =
    activeTab === "all" ? allLeaves : activeTab === "approvals" ? pendingLeaves : myLeaves;
  const showEmployeeCol = activeTab === "all" || activeTab === "approvals";

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Leave Management</h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              {canManage
                ? "Manage team leaves and approve requests"
                : "Track your leave balances and apply for time off"}
            </p>
          </div>
          <Button
            onClick={() => setShowApplyForm(!showApplyForm)}
            className="h-11 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium px-5 rounded-xl text-[15px]"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Apply Leave
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Apply Leave Form */}
            {showApplyForm && (
              <Card className="border-0 shadow-sm mb-6 border-l-4 border-l-[#2E86C1]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A]">Apply for Leave</h3>
                      <p className="text-xs text-[#94A3B8]">Fill in the details below</p>
                    </div>
                    <button
                      onClick={() => setShowApplyForm(false)}
                      className="text-[#94A3B8] hover:text-[#64748B]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">Leave Type</Label>
                      <select
                        value={applyForm.leaveType}
                        onChange={(e) => setApplyForm((f) => ({ ...f, leaveType: e.target.value }))}
                        className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
                      >
                        {leaveTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">Start Date</Label>
                      <Input
                        type="date"
                        value={applyForm.startDate}
                        onChange={(e) => setApplyForm((f) => ({ ...f, startDate: e.target.value }))}
                        className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">End Date</Label>
                      <Input
                        type="date"
                        value={applyForm.endDate}
                        min={applyForm.startDate || undefined}
                        onChange={(e) => setApplyForm((f) => ({ ...f, endDate: e.target.value }))}
                        className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">Reason</Label>
                      <Input
                        placeholder="Reason for leave"
                        value={applyForm.reason}
                        onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
                        className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0]"
                      />
                    </div>
                  </div>
                  {applyDaysPreview > 0 && (
                    <div className="bg-[#F1F5F9] rounded-lg px-3 py-2 mb-4 text-sm text-[#334155]">
                      Total:{" "}
                      <span className="font-semibold">
                        {applyDaysPreview} business day{applyDaysPreview !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[#94A3B8] ml-2">
                        ({applyForm.startDate} to {applyForm.endDate})
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={handleApply}
                    disabled={actionLoading}
                    className="h-9 bg-[#2E86C1] hover:bg-[#2471A3] text-white text-sm rounded-lg px-5"
                  >
                    {actionLoading ? "Submitting..." : "Submit Leave Request"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Leave Balance Cards */}
            {balanceCards.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                  {balanceCards.map((card) => {
                    const policyType = leavePolicy?.leavePolicy?.leaveTypes.find((lt: { type: string }) => lt.type === card.key);
                    const colorName = card.color.includes("blue") ? "blue" : card.color.includes("red") ? "red" : card.color.includes("emerald") ? "emerald" : card.color.includes("violet") ? "violet" : "gray";
                    return (
                      <Card key={card.key} className="border-0 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-${colorName}-50 rounded-bl-[60px] -mr-2 -mt-2`} />
                        <CardContent className="p-5 relative">
                          <div className={`w-8 h-8 rounded-lg bg-${colorName}-100 flex items-center justify-center mb-3`}>
                            <svg className={`w-4 h-4 text-${colorName}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                            </svg>
                          </div>
                          <p className="text-2xl font-bold text-[#0F172A]">
                            {card.available}
                            <span className="text-[13px] font-normal text-[#94A3B8]">
                              /{card.total} annual
                            </span>
                          </p>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">{card.label}</p>
                          <p className="text-xs text-[#94A3B8] mt-0.5">{card.used} used</p>
                          {policyType && leavePolicy && (
                            <p className="text-[10px] text-[#2E86C1] mt-0.5">
                              Policy: {leavePolicy.policyName}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#94A3B8] mb-6">
                  Leave allocations are defined by your organization&apos;s leave policy.
                </p>
              </>
            )}

            {/* Tabs */}
            {tabs.length > 1 && (
              <div className="flex gap-1 mb-4 bg-[#F1F5F9] rounded-lg p-1 w-fit">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "bg-white text-[#0F172A] shadow-sm"
                        : "text-[#64748B] hover:text-[#334155]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Leaves Table */}
            {currentRecords.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-[#94A3B8]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#334155]">
                    {activeTab === "approvals"
                      ? "No pending approvals"
                      : activeTab === "all"
                        ? "No leave records"
                        : "No leaves found"}
                  </p>
                  <p className="text-[13px] text-[#94A3B8] mt-1">
                    {activeTab === "my"
                      ? "Apply for your first leave to get started"
                      : "Nothing to show here yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#F1F5F9] bg-[#FAFBFC]">
                        {showEmployeeCol && <TH>Employee</TH>}
                        <TH>Type</TH>
                        <TH>Start Date</TH>
                        <TH>End Date</TH>
                        <TH>Days</TH>
                        <TH>Reason</TH>
                        <TH>Status</TH>
                        {activeTab === "approvals" ? <TH>Actions</TH> : <TH>Actions</TH>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentRecords.map((leave) => {
                        const canCancel =
                          activeTab === "my" &&
                          (leave.status === "pending" || leave.status === "approved") &&
                          new Date(leave.endDate) >= new Date();

                        return (
                          <tr
                            key={leave._id}
                            className="border-b border-[#F8FAFC] hover:bg-[#FAFBFC] transition-colors"
                          >
                            {showEmployeeCol && (
                              <td className="px-4 py-3 text-[13px] text-[#334155] font-medium">
                                {employeeMap[leave.employeeId] ||
                                  leave.employeeId?.slice(-6) ||
                                  "--"}
                              </td>
                            )}
                            <td className="px-4 py-3 text-[13px] font-medium text-[#0F172A]">
                              {leaveTypeLabels[leave.leaveType] || leave.leaveType}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#64748B]">
                              {leave.startDate ? formatDate(leave.startDate) : "--"}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#64748B]">
                              {leave.endDate ? formatDate(leave.endDate) : "--"}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#334155] font-medium">
                              {leave.totalDays ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#64748B] max-w-[200px] truncate">
                              {leave.reason || "--"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
                                  statusColors[leave.status] ||
                                  "bg-gray-50 text-gray-600 border-gray-200"
                                }`}
                              >
                                {leave.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {activeTab === "approvals" ? (
                                <div className="flex gap-2">
                                  {rejectingId === leave._id ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        placeholder="Rejection reason"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="h-7 text-xs rounded-md w-40 bg-[#F8FAFC] border-[#E2E8F0]"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleReject(leave._id)}
                                        disabled={actionLoading}
                                        className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md"
                                      >
                                        Confirm
                                      </Button>
                                      <button
                                        onClick={() => {
                                          setRejectingId(null);
                                          setRejectReason("");
                                        }}
                                        className="text-[#94A3B8] hover:text-[#64748B]"
                                      >
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleApprove(leave._id)}
                                        disabled={actionLoading}
                                        className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRejectingId(leave._id)}
                                        disabled={actionLoading}
                                        className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              ) : canCancel ? (
                                cancellingId === leave._id ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      placeholder="Reason (optional)"
                                      value={cancelReason}
                                      onChange={(e) => setCancelReason(e.target.value)}
                                      className="h-7 text-xs rounded-md w-32 bg-[#F8FAFC] border-[#E2E8F0]"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleCancel(leave._id)}
                                      disabled={actionLoading}
                                      className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md"
                                    >
                                      Confirm
                                    </Button>
                                    <button
                                      onClick={() => {
                                        setCancellingId(null);
                                        setCancelReason("");
                                      }}
                                      className="text-[#94A3B8] hover:text-[#64748B]"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCancellingId(leave._id)}
                                    disabled={actionLoading}
                                    className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                                  >
                                    Cancel
                                  </Button>
                                )
                              ) : (
                                <span className="text-xs text-[#CBD5E1]">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-4 py-3">
      {children}
    </th>
  );
}

function Spinner({ size = "md" }: { size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-8 w-8" : "h-5 w-5";
  return (
    <svg className={`animate-spin ${cls} text-[#2E86C1]`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
