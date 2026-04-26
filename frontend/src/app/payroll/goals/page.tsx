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
const goalStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  active: { label: "Active", color: "bg-blue-50 text-blue-700 border-blue-200" },
  achieved: { label: "Achieved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  missed: { label: "Missed", color: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200" },
  deferred: { label: "Deferred", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-50 text-gray-600" },
  medium: { label: "Medium", color: "bg-blue-50 text-blue-700" },
  high: { label: "High", color: "bg-amber-50 text-amber-700" },
  critical: { label: "Critical", color: "bg-red-50 text-red-700" },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  individual: { label: "Individual", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  team: { label: "Team", color: "bg-purple-50 text-purple-700 border-purple-200" },
  company: { label: "Company", color: "bg-blue-50 text-blue-700 border-blue-200" },
  okr: { label: "OKR", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const GOAL_TYPES = ["individual", "team", "company", "okr"] as const;
const GOAL_CATEGORIES = ["performance", "learning", "behavior", "project", "revenue", "quality"] as const;
const GOAL_PRIORITIES = ["low", "medium", "high", "critical"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface KeyResult {
  title: string;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  // Legacy field — backend never populated it. Kept for back-compat
  // with any older records; real status lives in `status`.
  achieved?: boolean;
  // Backend enum: 'not_started' | 'in_progress' | 'achieved' | 'missed'
  status?: string;
  progress?: number;
}

interface CheckIn {
  date: string;
  progress: number;
  notes?: string;
  updatedBy?: string;
}

// Backend stores these as scalar numbers (see goal.schema.ts).
// Old frontend modelled them as `{rating, comments, ratedBy, ratedAt}`
// objects — reading `.rating.rating` crashed the page. Kept the type
// permissive so legacy server responses (if any wrap back up) still
// render; helper below normalises to a number either way.
type Rating = number | { rating?: number; comments?: string; ratedBy?: string; ratedAt?: string };

const ratingValue = (r?: Rating): number | undefined => {
  if (r === undefined || r === null) return undefined;
  if (typeof r === "number") return r;
  return typeof r.rating === "number" ? r.rating : undefined;
};

interface Goal {
  _id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  weightage?: number;
  progress?: number;
  startDate?: string;
  targetDate?: string;
  keyResults?: KeyResult[];
  checkIns?: CheckIn[];
  selfRating?: Rating;
  managerRating?: Rating;
  employeeName?: string;
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

const progressBarColor = (progress: number): string => {
  if (progress >= 80) return "bg-emerald-500";
  if (progress >= 50) return "bg-blue-500";
  if (progress >= 25) return "bg-amber-500";
  return "bg-red-500";
};

const isAtRisk = (goal: Goal): boolean => {
  if (goal.status !== "active") return false;
  if (!goal.targetDate) return false;
  const now = new Date();
  const target = new Date(goal.targetDate);
  const totalDays = Math.max(1, (target.getTime() - new Date(goal.startDate || goal.createdAt || now).getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, (now.getTime() - new Date(goal.startDate || goal.createdAt || now).getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);
  return (goal.progress || 0) < expectedProgress - 15;
};

type TabKey = "my" | "team";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GoalsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isManager = hasOrgRole("manager");

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [myGoals, setMyGoals] = useState<Goal[]>([]);
  const [teamGoals, setTeamGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // New goal modal
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<string>("individual");
  const [newCategory, setNewCategory] = useState<string>("performance");
  const [newPriority, setNewPriority] = useState<string>("medium");
  const [newWeightage, setNewWeightage] = useState<string>("10");
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newTargetDate, setNewTargetDate] = useState<string>("");
  const [newKeyResults, setNewKeyResults] = useState<KeyResult[]>([
    { title: "", metric: "", targetValue: 0, unit: "" },
  ]);
  const [newParentGoalId, setNewParentGoalId] = useState<string>("");
  const [allGoalsForParent, setAllGoalsForParent] = useState<Goal[]>([]);

  // Check-in modal
  const [checkInGoal, setCheckInGoal] = useState<Goal | null>(null);
  const [checkInProgress, setCheckInProgress] = useState<number>(0);
  const [checkInNotes, setCheckInNotes] = useState<string>("");
  const [checkInSaving, setCheckInSaving] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  // Backend `getAllGoals` returns `{ records, total, page, limit, totalPages }`
  // inside `data`. The `.goals` alias never existed — old fallbacks returned
  // `[]` silently. `getMyGoals` returns a bare array. Unwrap both shapes
  // defensively so either contract works.
  const unwrapGoalsList = (res: any): Goal[] => {
    const d = res?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.records)) return d.records;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.goals)) return d.goals; // legacy alias
    return [];
  };

  const fetchMyGoals = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getMyGoals();
      setMyGoals(unwrapGoalsList(res));
    } catch (err: any) {
      toast.error(err.message || "Failed to load your goals");
    }
  }, [user]);

  const fetchTeamGoals = useCallback(async () => {
    if (!user || !isManager) return;
    try {
      const res = await payrollApi.getAllGoals();
      setTeamGoals(unwrapGoalsList(res));
    } catch (err: any) {
      toast.error(err.message || "Failed to load team goals");
    }
  }, [user, isManager]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMyGoals(), fetchTeamGoals()]);
    // Fetch all goals for parent selector
    try {
      const allRes = await payrollApi.getAllGoals({ limit: "100" });
      setAllGoalsForParent(unwrapGoalsList(allRes));
    } catch { /* silent */ }
    setLoading(false);
  }, [fetchMyGoals, fetchTeamGoals]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const active = myGoals.filter((g) => g.status === "active");
    const achieved = myGoals.filter((g) => g.status === "achieved");
    const atRisk = active.filter((g) => isAtRisk(g));
    const onTrack = active.filter((g) => !isAtRisk(g));
    return {
      active: active.length,
      achieved: achieved.length,
      onTrack: onTrack.length,
      atRisk: atRisk.length,
    };
  }, [myGoals]);

  const activeGoals = activeTab === "my" ? myGoals : teamGoals;

  // ---------------------------------------------------------------------------
  // Modal resets
  // ---------------------------------------------------------------------------
  const resetNewGoalModal = () => {
    setShowNewGoalModal(false);
    setNewTitle("");
    setNewDescription("");
    setNewType("individual");
    setNewCategory("performance");
    setNewPriority("medium");
    setNewWeightage("10");
    setNewStartDate("");
    setNewTargetDate("");
    setNewKeyResults([{ title: "", metric: "", targetValue: 0, unit: "" }]);
    setNewParentGoalId("");
  };

  const resetCheckInModal = () => {
    setCheckInGoal(null);
    setCheckInProgress(0);
    setCheckInNotes("");
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleAddKeyResult = () => {
    setNewKeyResults([...newKeyResults, { title: "", metric: "", targetValue: 0, unit: "" }]);
  };

  const handleRemoveKeyResult = (idx: number) => {
    setNewKeyResults(newKeyResults.filter((_, i) => i !== idx));
  };

  const handleKeyResultChange = (idx: number, field: keyof KeyResult, value: string | number) => {
    const updated = [...newKeyResults];
    (updated[idx] as any)[field] = value;
    setNewKeyResults(updated);
  };

  const handleCreateGoal = async () => {
    if (!newTitle.trim()) {
      toast.error("Please provide a title");
      return;
    }
    if (!newTargetDate) {
      toast.error("Please select a target date");
      return;
    }
    const weightage = parseFloat(newWeightage);
    if (isNaN(weightage) || weightage < 0 || weightage > 100) {
      toast.error("Weightage must be between 0 and 100");
      return;
    }

    const keyResults = newKeyResults
      .filter((kr) => kr.title.trim())
      .map((kr) => ({
        title: kr.title.trim(),
        metric: kr.metric?.trim() || undefined,
        targetValue: Number(kr.targetValue) || 0,
        unit: kr.unit?.trim() || undefined,
        currentValue: 0,
        achieved: false,
        progress: 0,
      }));

    setSaving(true);
    try {
      await payrollApi.createGoal({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        type: newType,
        category: newCategory,
        priority: newPriority,
        weightage,
        startDate: newStartDate || new Date().toISOString(),
        targetDate: new Date(newTargetDate).toISOString(),
        keyResults,
        parentGoalId: newParentGoalId || undefined,
      });
      toast.success("Goal created successfully");
      resetNewGoalModal();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to create goal");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCheckIn = (goal: Goal) => {
    setCheckInGoal(goal);
    setCheckInProgress(goal.progress || 0);
    setCheckInNotes("");
  };

  const handleSubmitCheckIn = async () => {
    if (!checkInGoal) return;
    setCheckInSaving(true);
    try {
      await payrollApi.goalCheckIn(checkInGoal._id, {
        progress: checkInProgress,
        notes: checkInNotes.trim() || undefined,
      });
      toast.success("Check-in recorded");
      resetCheckInModal();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit check-in");
    } finally {
      setCheckInSaving(false);
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
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Goals & OKRs</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Track your performance goals and key results</p>
          </div>
          <Button
            onClick={() => setShowNewGoalModal(true)}
            className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Goal
          </Button>
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* Tabs */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeTab === "my" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              My Goals
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab("team")}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === "team" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Team Goals
              </button>
            )}
          </div>

          {/* Stats Row */}
          {activeTab === "my" && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Active Goals", value: stats.active, borderColor: "border-l-[#2E86C1]" },
                { label: "Completed", value: stats.achieved, borderColor: "border-l-emerald-500" },
                { label: "On Track", value: stats.onTrack, borderColor: "border-l-green-500" },
                { label: "At Risk", value: stats.atRisk, borderColor: "border-l-red-500" },
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

          {/* Goal List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                  <div className="h-2 bg-gray-200 rounded-full w-full" />
                </div>
              ))}
            </div>
          ) : activeGoals.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-[#64748B] mt-3 text-[14px]">
                {activeTab === "my" ? "You have no goals yet. Create your first goal to get started." : "No team goals found."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((goal) => {
                const progress = goal.progress || 0;
                const keyResultCount = goal.keyResults?.length || 0;
                // Backend stores KeyResult status as an enum
                // ('not_started'|'in_progress'|'achieved'|'missed'); the old
                // frontend read a non-existent `kr.achieved` boolean so
                // "N of M achieved" always rendered 0.
                const achievedKeyResults =
                  goal.keyResults?.filter((kr: any) => kr.achieved === true || kr.status === "achieved").length || 0;
                const expanded = expandedGoalId === goal._id;

                return (
                  <div key={goal._id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">{goal.title}</h3>
                            {renderBadge(goal.status, goalStatusConfig)}
                            {renderBadge(goal.type, typeConfig)}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${priorityConfig[goal.priority]?.color || "bg-gray-50 text-gray-600"}`}>
                              {priorityConfig[goal.priority]?.label || goal.priority}
                            </span>
                          </div>

                          {activeTab === "team" && goal.employeeName && (
                            <p className="text-[12px] text-[#64748B] mb-2">
                              Owner: <span className="font-medium text-[#334155]">{goal.employeeName}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-[12px] text-[#64748B] mb-3">
                            <span className="capitalize">{goal.category}</span>
                            <span>&bull;</span>
                            <span>Target: {formatDate(goal.targetDate)}</span>
                            <span>&bull;</span>
                            <span>Weightage: {goal.weightage || 0}%</span>
                            {keyResultCount > 0 && (
                              <>
                                <span>&bull;</span>
                                <span>{achievedKeyResults} of {keyResultCount} key results achieved</span>
                              </>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-[#64748B] font-medium">Progress</span>
                              <span className="text-[11px] font-semibold text-[#0F172A]">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${progressBarColor(progress)} transition-all`}
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          {activeTab === "my" && goal.status === "active" && (
                            <Button
                              onClick={() => handleOpenCheckIn(goal)}
                              className="bg-[#2E86C1] hover:bg-[#2574A9] h-8 text-[12px]"
                            >
                              Check In
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => setExpandedGoalId(expanded ? null : goal._id)}
                            className="h-8 text-[12px]"
                          >
                            {expanded ? "Hide Details" : "View Details"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-4">
                        {goal.description && (
                          <div>
                            <h4 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Description</h4>
                            <p className="text-[13px] text-[#0F172A] whitespace-pre-wrap">{goal.description}</p>
                          </div>
                        )}

                        {goal.keyResults && goal.keyResults.length > 0 && (
                          <div>
                            <h4 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Key Results</h4>
                            <div className="space-y-2">
                              {goal.keyResults.map((kr, idx) => (
                                <div key={idx} className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <p className="text-[13px] font-medium text-[#0F172A]">{kr.title}</p>
                                    {((kr as any).achieved === true || kr.status === "achieved") && (
                                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        Achieved
                                      </span>
                                    )}
                                  </div>
                                  {kr.metric && (
                                    <p className="text-[11px] text-[#64748B] mb-2">
                                      {kr.metric}: {kr.currentValue ?? 0} / {kr.targetValue ?? 0} {kr.unit || ""}
                                    </p>
                                  )}
                                  <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full ${progressBarColor(kr.progress || 0)}`}
                                      style={{ width: `${Math.min(100, kr.progress || 0)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {goal.checkIns && goal.checkIns.length > 0 && (
                          <div>
                            <h4 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Check-in History</h4>
                            <div className="space-y-2">
                              {goal.checkIns.slice().reverse().map((ci, idx) => (
                                <div key={idx} className="bg-white border border-[#E2E8F0] rounded-lg p-3 text-[12px]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-[#334155]">{formatDate(ci.date)}</span>
                                    <span className="font-semibold text-[#2E86C1]">{ci.progress}%</span>
                                  </div>
                                  {ci.notes && <p className="text-[#64748B]">{ci.notes}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(() => {
                          // Backend stores selfRating/managerRating as scalar numbers;
                          // older responses wrapped them in objects. `ratingValue` handles
                          // both shapes so the page doesn't crash on either.
                          const selfN = ratingValue(goal.selfRating);
                          const mgrN = ratingValue(goal.managerRating);
                          const selfComments =
                            typeof goal.selfRating === "object" ? goal.selfRating?.comments : undefined;
                          const mgrComments =
                            typeof goal.managerRating === "object" ? goal.managerRating?.comments : undefined;
                          if (selfN === undefined && mgrN === undefined) return null;
                          return (
                            <div className="grid grid-cols-2 gap-3">
                              {selfN !== undefined && (
                                <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                                  <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Self Rating</h4>
                                  <p className="text-[18px] font-bold text-[#0F172A]">{selfN} / 5</p>
                                  {selfComments && (
                                    <p className="text-[12px] text-[#64748B] mt-1">{selfComments}</p>
                                  )}
                                </div>
                              )}
                              {mgrN !== undefined && (
                                <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                                  <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Manager Rating</h4>
                                  <p className="text-[18px] font-bold text-[#0F172A]">{mgrN} / 5</p>
                                  {mgrComments && (
                                    <p className="text-[12px] text-[#64748B] mt-1">{mgrComments}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* New Goal Modal */}
      {showNewGoalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-[18px] font-bold text-[#0F172A]">Create New Goal</h2>
              <button
                onClick={resetNewGoalModal}
                className="p-1.5 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Increase customer retention by 20%"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the goal and its context..."
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
                    {GOAL_TYPES.map((t) => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  >
                    {GOAL_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  >
                    {GOAL_PRIORITIES.map((p) => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Parent Goal (for alignment)</label>
                  <select
                    value={newParentGoalId}
                    onChange={(e) => setNewParentGoalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  >
                    <option value="">None (top-level goal)</option>
                    {allGoalsForParent.filter(g => g.type === "company" || g.type === "team").map((g) => (
                      <option key={g._id} value={g._id}>[{g.type?.toUpperCase()}] {g.title}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#94A3B8] mt-1">Link this goal to a company or team objective for OKR alignment</p>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Weightage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newWeightage}
                    onChange={(e) => setNewWeightage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#334155] mb-1">Target Date *</label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                  />
                </div>
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-[#334155]">Key Results</label>
                  <button
                    type="button"
                    onClick={handleAddKeyResult}
                    className="text-[12px] text-[#2E86C1] hover:underline font-medium"
                  >
                    + Add Key Result
                  </button>
                </div>
                <div className="space-y-3">
                  {newKeyResults.map((kr, idx) => (
                    <div key={idx} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold text-[#64748B]">Key Result {idx + 1}</span>
                        {newKeyResults.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyResult(idx)}
                            className="text-[11px] text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Title"
                        value={kr.title}
                        onChange={(e) => handleKeyResultChange(idx, "title", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md border border-[#E2E8F0] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Metric"
                          value={kr.metric || ""}
                          onChange={(e) => handleKeyResultChange(idx, "metric", e.target.value)}
                          className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                        />
                        <input
                          type="number"
                          placeholder="Target"
                          value={kr.targetValue || ""}
                          onChange={(e) => handleKeyResultChange(idx, "targetValue", parseFloat(e.target.value) || 0)}
                          className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={kr.unit || ""}
                          onChange={(e) => handleKeyResultChange(idx, "unit", e.target.value)}
                          className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E2E8F0] flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={resetNewGoalModal} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateGoal}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9]"
              >
                {saving ? "Creating..." : "Create Goal"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {checkInGoal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-[#0F172A]">Check In</h2>
                <p className="text-[12px] text-[#64748B] mt-0.5 truncate max-w-[320px]">{checkInGoal.title}</p>
              </div>
              <button
                onClick={resetCheckInModal}
                className="p-1.5 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-[#334155]">Progress</label>
                  <span className="text-[16px] font-bold text-[#2E86C1]">{checkInProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={checkInProgress}
                  onChange={(e) => setCheckInProgress(parseInt(e.target.value, 10))}
                  className="w-full accent-[#2E86C1]"
                />
                <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden mt-2">
                  <div
                    className={`h-full ${progressBarColor(checkInProgress)} transition-all`}
                    style={{ width: `${checkInProgress}%` }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">Notes</label>
                <textarea
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  rows={4}
                  placeholder="What have you accomplished since the last check-in?"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[#E2E8F0] flex justify-end gap-2">
              <Button variant="outline" onClick={resetCheckInModal} disabled={checkInSaving}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitCheckIn}
                disabled={checkInSaving}
                className="bg-[#2E86C1] hover:bg-[#2574A9]"
              >
                {checkInSaving ? "Saving..." : "Submit Check-in"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
