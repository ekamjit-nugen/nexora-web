"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------
const cycleStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  goal_setting: { label: "Goal Setting", color: "bg-blue-50 text-blue-700 border-blue-200" },
  self_review: { label: "Self Review", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  peer_review: { label: "Peer Review", color: "bg-purple-50 text-purple-700 border-purple-200" },
  manager_review: { label: "Manager Review", color: "bg-amber-50 text-amber-700 border-amber-200" },
  calibration: { label: "Calibration", color: "bg-orange-50 text-orange-700 border-orange-200" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
};

const CYCLE_TYPES = ["annual", "half_yearly", "quarterly", "monthly", "continuous", "adhoc"] as const;
const APPLICABLE_OPTIONS = ["all", "department", "designation", "specific"] as const;
const STATUS_TRANSITIONS = [
  "goal_setting",
  "self_review",
  "peer_review",
  "manager_review",
  "calibration",
  "completed",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReviewCycle {
  _id: string;
  name: string;
  type: string;
  status: string;
  startDate?: string;
  endDate?: string;
  goalSettingDeadline?: string;
  selfReviewDeadline?: string;
  peerReviewDeadline?: string;
  managerReviewDeadline?: string;
  applicableTo?: string;
  employeeCount?: number;
  completedCount?: number;
  config?: {
    enableSelfReview?: boolean;
    enablePeerReview?: boolean;
    enableManagerReview?: boolean;
    enable360?: boolean;
    ratingScale?: number;
  };
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatType = (type: string): string => {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PerformanceCyclesPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail view
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);

  // New cycle modal
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("annual");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newGoalSettingDeadline, setNewGoalSettingDeadline] = useState("");
  const [newSelfReviewDeadline, setNewSelfReviewDeadline] = useState("");
  const [newPeerReviewDeadline, setNewPeerReviewDeadline] = useState("");
  const [newManagerReviewDeadline, setNewManagerReviewDeadline] = useState("");
  const [newApplicableTo, setNewApplicableTo] = useState<string>("all");
  const [newEnableSelfReview, setNewEnableSelfReview] = useState(true);
  const [newEnablePeerReview, setNewEnablePeerReview] = useState(true);
  const [newEnableManagerReview, setNewEnableManagerReview] = useState(true);
  const [newEnable360, setNewEnable360] = useState(false);
  const [newRatingScale, setNewRatingScale] = useState<string>("5");

  // ---------------------------------------------------------------------------
  // Auth gate + redirect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && !isAdmin) {
      toast.error("You do not have permission to access review cycles");
      router.push("/payroll");
    }
  }, [user, authLoading, router, isAdmin]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchCycles = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const res = await payrollApi.listReviewCycles();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.cycles ?? [];
      setCycles(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load review cycles");
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) fetchCycles();
  }, [fetchCycles, user, isAdmin]);

  // ---------------------------------------------------------------------------
  // Reset modal
  // ---------------------------------------------------------------------------
  const resetNewCycleModal = () => {
    setShowNewCycleModal(false);
    setNewName("");
    setNewType("annual");
    setNewStartDate("");
    setNewEndDate("");
    setNewGoalSettingDeadline("");
    setNewSelfReviewDeadline("");
    setNewPeerReviewDeadline("");
    setNewManagerReviewDeadline("");
    setNewApplicableTo("all");
    setNewEnableSelfReview(true);
    setNewEnablePeerReview(true);
    setNewEnableManagerReview(true);
    setNewEnable360(false);
    setNewRatingScale("5");
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCreateCycle = async () => {
    if (!newName.trim()) {
      toast.error("Please provide a cycle name");
      return;
    }
    if (!newStartDate || !newEndDate) {
      toast.error("Please provide start and end dates");
      return;
    }
    if (new Date(newEndDate) <= new Date(newStartDate)) {
      toast.error("End date must be after start date");
      return;
    }
    const ratingScale = parseInt(newRatingScale, 10);
    if (isNaN(ratingScale) || ratingScale < 3 || ratingScale > 10) {
      toast.error("Rating scale must be between 3 and 10");
      return;
    }

    setSaving(true);
    try {
      await payrollApi.createReviewCycle({
        name: newName.trim(),
        type: newType,
        startDate: new Date(newStartDate).toISOString(),
        endDate: new Date(newEndDate).toISOString(),
        goalSettingDeadline: newGoalSettingDeadline
          ? new Date(newGoalSettingDeadline).toISOString()
          : undefined,
        selfReviewDeadline: newSelfReviewDeadline
          ? new Date(newSelfReviewDeadline).toISOString()
          : undefined,
        peerReviewDeadline: newPeerReviewDeadline
          ? new Date(newPeerReviewDeadline).toISOString()
          : undefined,
        managerReviewDeadline: newManagerReviewDeadline
          ? new Date(newManagerReviewDeadline).toISOString()
          : undefined,
        applicableTo: newApplicableTo,
        config: {
          enableSelfReview: newEnableSelfReview,
          enablePeerReview: newEnablePeerReview,
          enableManagerReview: newEnableManagerReview,
          enable360: newEnable360,
          ratingScale,
        },
      });
      toast.success("Review cycle created successfully");
      resetNewCycleModal();
      await fetchCycles();
    } catch (err: any) {
      toast.error(err.message || "Failed to create review cycle");
    } finally {
      setSaving(false);
    }
  };

  const handleStartCycle = async (cycleId: string) => {
    setActionLoading(cycleId);
    try {
      await payrollApi.startReviewCycle(cycleId);
      toast.success("Review cycle started");
      await fetchCycles();
    } catch (err: any) {
      toast.error(err.message || "Failed to start cycle");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (cycleId: string, status: string) => {
    setActionLoading(cycleId);
    try {
      await payrollApi.updateCycleStatus(cycleId, status);
      toast.success("Cycle status updated");
      await fetchCycles();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderBadge = (value: string, config: Record<string, { label: string; color: string }>) => {
    const cfg = config[value] || { label: value.replace(/_/g, " "), color: "bg-gray-100 text-gray-600 border-gray-200" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
        {cfg.label}
      </span>
    );
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

  if (!isAdmin) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Performance Cycles</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Manage review cycles and their lifecycle</p>
          </div>
          <Button
            onClick={() => setShowNewCycleModal(true)}
            className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Cycle
          </Button>
        </div>

        <div className="flex-1 p-8">
          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
                  <div className="flex items-center gap-6">
                    <div className="h-4 bg-gray-200 rounded w-40" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-5 bg-gray-200 rounded-full w-24" />
                    <div className="flex-1" />
                    <div className="h-8 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : cycles.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[#64748B] mt-3 text-[14px]">
                No review cycles yet. Create your first cycle to get started.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Period</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Employees</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Progress</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {cycles.map((cycle) => {
                      const progress =
                        cycle.employeeCount && cycle.employeeCount > 0
                          ? Math.round(((cycle.completedCount || 0) / cycle.employeeCount) * 100)
                          : 0;
                      const isActive = !["draft", "completed", "cancelled"].includes(cycle.status);

                      return (
                        <tr key={cycle._id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-5 py-4">
                            <p className="text-[13px] font-semibold text-[#0F172A]">{cycle.name}</p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">Created {formatDate(cycle.createdAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-[12px] text-[#334155]">{formatType(cycle.type)}</span>
                          </td>
                          <td className="px-5 py-4">{renderBadge(cycle.status, cycleStatusConfig)}</td>
                          <td className="px-5 py-4">
                            <p className="text-[12px] text-[#334155]">{formatDate(cycle.startDate)}</p>
                            <p className="text-[11px] text-[#64748B]">to {formatDate(cycle.endDate)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-[13px] font-semibold text-[#0F172A]">{cycle.employeeCount || 0}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 w-36">
                              <div className="flex-1 bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-[#2E86C1] transition-all"
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-medium text-[#64748B]">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedCycle(cycle)}
                                className="h-7 text-[11px] px-2"
                              >
                                View
                              </Button>
                              {cycle.status === "draft" && (
                                <Button
                                  onClick={() => handleStartCycle(cycle._id)}
                                  disabled={actionLoading === cycle._id}
                                  className="bg-[#2E86C1] hover:bg-[#2574A9] h-7 text-[11px] px-2"
                                >
                                  Start
                                </Button>
                              )}
                              {isActive && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) handleUpdateStatus(cycle._id, e.target.value);
                                  }}
                                  disabled={actionLoading === cycle._id}
                                  className="h-7 text-[11px] px-2 rounded-md border border-[#E2E8F0] bg-white text-[#334155]"
                                >
                                  <option value="">Move to...</option>
                                  {STATUS_TRANSITIONS.filter((s) => s !== cycle.status).map((s) => (
                                    <option key={s} value={s}>
                                      {cycleStatusConfig[s]?.label || s}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Cycle Modal */}
      {showNewCycleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-[18px] font-bold text-[#0F172A]">Create Review Cycle</h2>
              <button
                onClick={resetNewCycleModal}
                className="p-1.5 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">Cycle Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Annual Performance Review 2026"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  >
                    {CYCLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {formatType(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Applicable To</label>
                  <select
                    value={newApplicableTo}
                    onChange={(e) => setNewApplicableTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  >
                    {APPLICABLE_OPTIONS.map((a) => (
                      <option key={a} value={a} className="capitalize">
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">End Date *</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-[12px] font-semibold text-[#334155] mb-2 uppercase tracking-wider">Deadlines</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#64748B] mb-1">Goal Setting</label>
                    <input
                      type="date"
                      value={newGoalSettingDeadline}
                      onChange={(e) => setNewGoalSettingDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#64748B] mb-1">Self Review</label>
                    <input
                      type="date"
                      value={newSelfReviewDeadline}
                      onChange={(e) => setNewSelfReviewDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#64748B] mb-1">Peer Review</label>
                    <input
                      type="date"
                      value={newPeerReviewDeadline}
                      onChange={(e) => setNewPeerReviewDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#64748B] mb-1">Manager Review</label>
                    <input
                      type="date"
                      value={newManagerReviewDeadline}
                      onChange={(e) => setNewManagerReviewDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[12px] font-semibold text-[#334155] mb-2 uppercase tracking-wider">Configuration</h3>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnableSelfReview}
                      onChange={(e) => setNewEnableSelfReview(e.target.checked)}
                      className="w-4 h-4 accent-[#2E86C1]"
                    />
                    <span className="text-[13px] text-[#334155]">Enable Self Review</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnablePeerReview}
                      onChange={(e) => setNewEnablePeerReview(e.target.checked)}
                      className="w-4 h-4 accent-[#2E86C1]"
                    />
                    <span className="text-[13px] text-[#334155]">Enable Peer Review</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnableManagerReview}
                      onChange={(e) => setNewEnableManagerReview(e.target.checked)}
                      className="w-4 h-4 accent-[#2E86C1]"
                    />
                    <span className="text-[13px] text-[#334155]">Enable Manager Review</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnable360}
                      onChange={(e) => setNewEnable360(e.target.checked)}
                      className="w-4 h-4 accent-[#2E86C1]"
                    />
                    <span className="text-[13px] text-[#334155]">Enable 360 Review</span>
                  </label>
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <label className="block text-[12px] font-medium text-[#334155] mb-1">Rating Scale</label>
                    <input
                      type="number"
                      min="3"
                      max="10"
                      value={newRatingScale}
                      onChange={(e) => setNewRatingScale(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E2E8F0] flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={resetNewCycleModal} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateCycle}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9]"
              >
                {saving ? "Creating..." : "Create Cycle"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Detail Modal */}
      {selectedCycle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-[18px] font-bold text-[#0F172A]">{selectedCycle.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {renderBadge(selectedCycle.status, cycleStatusConfig)}
                  <span className="text-[12px] text-[#64748B]">{formatType(selectedCycle.type)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCycle(null)}
                className="p-1.5 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">Start Date</p>
                  <p className="text-[14px] font-semibold text-[#0F172A] mt-1">{formatDate(selectedCycle.startDate)}</p>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">End Date</p>
                  <p className="text-[14px] font-semibold text-[#0F172A] mt-1">{formatDate(selectedCycle.endDate)}</p>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">Total Employees</p>
                  <p className="text-[14px] font-semibold text-[#0F172A] mt-1">{selectedCycle.employeeCount || 0}</p>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">Completed</p>
                  <p className="text-[14px] font-semibold text-[#0F172A] mt-1">{selectedCycle.completedCount || 0}</p>
                </div>
              </div>

              <div>
                <h3 className="text-[12px] font-semibold text-[#334155] mb-2 uppercase tracking-wider">Deadlines</h3>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#64748B]">Goal Setting</span>
                    <span className="font-medium text-[#0F172A]">{formatDate(selectedCycle.goalSettingDeadline)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#64748B]">Self Review</span>
                    <span className="font-medium text-[#0F172A]">{formatDate(selectedCycle.selfReviewDeadline)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#64748B]">Peer Review</span>
                    <span className="font-medium text-[#0F172A]">{formatDate(selectedCycle.peerReviewDeadline)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#64748B]">Manager Review</span>
                    <span className="font-medium text-[#0F172A]">{formatDate(selectedCycle.managerReviewDeadline)}</span>
                  </div>
                </div>
              </div>

              {selectedCycle.config && (
                <div>
                  <h3 className="text-[12px] font-semibold text-[#334155] mb-2 uppercase tracking-wider">Configuration</h3>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748B]">Self Review</span>
                      <span className="font-medium text-[#0F172A]">{selectedCycle.config.enableSelfReview ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748B]">Peer Review</span>
                      <span className="font-medium text-[#0F172A]">{selectedCycle.config.enablePeerReview ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748B]">Manager Review</span>
                      <span className="font-medium text-[#0F172A]">{selectedCycle.config.enableManagerReview ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748B]">360 Review</span>
                      <span className="font-medium text-[#0F172A]">{selectedCycle.config.enable360 ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748B]">Rating Scale</span>
                      <span className="font-medium text-[#0F172A]">{selectedCycle.config.ratingScale || 5}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#E2E8F0] flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setSelectedCycle(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
