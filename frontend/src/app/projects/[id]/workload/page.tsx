"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  projectApi, reportingApi, sprintApi, hrApi, taskApi,
  Project, Sprint, Employee, CapacityData, CapacityMember,
} from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, LineChart, Line,
} from "recharts";

// ── Status colors ──

const STATUS_COLORS: Record<string, string> = {
  todo: "#94A3B8",
  inProgress: "#3B82F6",
  inReview: "#8B5CF6",
  blocked: "#EF4444",
  done: "#10B981",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  inProgress: "In Progress",
  inReview: "In Review",
  blocked: "Blocked",
  done: "Done",
};

// ── Skeletons ──

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 animate-pulse">
      <div className="h-4 bg-[#E2E8F0] rounded w-36 mb-4" />
      <div className="h-[260px] bg-[#F8FAFC] rounded" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#E2E8F0] animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[#E2E8F0]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[#E2E8F0] rounded w-32" />
        <div className="h-2 bg-[#E2E8F0] rounded w-full" />
      </div>
      <div className="h-3 bg-[#E2E8F0] rounded w-16" />
    </div>
  );
}

// ── Utilization bar color ──

function utilizationColor(pct: number): string {
  if (pct > 100) return "#EF4444"; // red
  if (pct >= 80) return "#F59E0B"; // yellow
  return "#10B981"; // green
}

function utilizationBg(pct: number): string {
  if (pct > 100) return "bg-red-50";
  if (pct >= 80) return "bg-amber-50";
  return "bg-emerald-50";
}

// ── Mini sparkline for daily hours ──

function DailySparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className="w-3 rounded-sm bg-[#3B82F6] transition-all"
            style={{ height: `${Math.max(2, (h / max) * 20)}px`, opacity: h > 0 ? 1 : 0.2 }}
            title={`${days[i]}: ${h}h`}
          />
          <span className="text-[8px] text-[#94A3B8]">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Status dots ──

function TaskStatusDots({ breakdown }: { breakdown: CapacityMember["taskBreakdown"] }) {
  const items = [
    { key: "todo", count: breakdown.todo, color: STATUS_COLORS.todo, label: STATUS_LABELS.todo },
    { key: "inProgress", count: breakdown.inProgress, color: STATUS_COLORS.inProgress, label: STATUS_LABELS.inProgress },
    { key: "inReview", count: breakdown.inReview, color: STATUS_COLORS.inReview, label: STATUS_LABELS.inReview },
    { key: "blocked", count: breakdown.blocked, color: STATUS_COLORS.blocked, label: STATUS_LABELS.blocked },
    { key: "done", count: breakdown.done, color: STATUS_COLORS.done, label: STATUS_LABELS.done },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-1" title={`${item.label}: ${item.count}`}>
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: item.color, opacity: item.count > 0 ? 1 : 0.2 }}
          />
          <span className="text-[11px] text-[#64748B]">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──

export default function ProjectWorkloadPage() {
  const { user, loading: authLoading, logout, isProjectRole, hasOrgRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  // Role check — visible to leads and managers
  const projectTeam = (project?.team as Array<{ userId: string; role: string }>) || [];
  const isAuthorized = user && (
    isProjectRole(projectTeam, "manager") ||
    hasOrgRole("admin") ||
    hasOrgRole("owner") ||
    hasOrgRole("super_admin") ||
    user.role === "manager" || user.role === "admin" || user.role === "owner" || user.role === "super_admin"
  );

  const getEmployeeName = useCallback((userId: string) => {
    const emp = employees.find((e) => e.userId === userId || e._id === userId);
    return emp ? `${emp.firstName} ${emp.lastName}` : userId.slice(0, 8);
  }, [employees]);

  const getEmployeeAvatar = useCallback((userId: string) => {
    const emp = employees.find((e) => e.userId === userId || e._id === userId);
    return emp?.avatar || null;
  }, [employees]);

  const getTeamRole = useCallback((userId: string) => {
    const member = projectTeam.find((m) => m.userId === userId);
    return member?.role || "member";
  }, [projectTeam]);

  const getTeamAllocation = useCallback((userId: string) => {
    const member = project?.team?.find((m) => m.userId === userId);
    return (member as any)?.allocation ?? 100;
  }, [project?.team]);

  // Fetch project + sprints + employees
  useEffect(() => {
    if (!user || !projectId) return;
    (async () => {
      try {
        const [projRes, sprintRes, empRes] = await Promise.all([
          projectApi.getById(projectId),
          sprintApi.getByProject(projectId).catch(() => ({ data: [] })),
          hrApi.getEmployees().catch(() => ({ data: [] })),
        ]);
        setProject(projRes.data || null);
        const sprintList = Array.isArray(sprintRes.data) ? sprintRes.data : [];
        setSprints(sprintList);
        setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
        const active = sprintList.find((s: Sprint) => s.status === "active");
        setSelectedSprintId(active?._id || sprintList[0]?._id || "");
      } catch {
        setError("Failed to load project data.");
      }
    })();
  }, [user, projectId]);

  // Fetch capacity data
  const fetchCapacity = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reportingApi.getCapacity(projectId, selectedSprintId || undefined);
      setCapacity(res.data || null);
    } catch {
      setError("Failed to load capacity data.");
    } finally {
      setLoading(false);
    }
  }, [projectId, user, selectedSprintId]);

  useEffect(() => {
    if (user && projectId) fetchCapacity();
  }, [user, projectId, fetchCapacity]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Quick assign handler
  const handleQuickAssign = async (taskId: string, assigneeId: string) => {
    try {
      setAssigningTaskId(taskId);
      await taskApi.update(taskId, { assigneeId });
      await fetchCapacity();
    } catch {
      setError("Failed to assign task.");
    } finally {
      setAssigningTaskId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[#64748B]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-8">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Access Denied</h2>
            <p className="text-sm text-[#64748B]">You need a manager or admin role to view team workload.</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Build chart data ──

  const members = capacity?.members || [];
  const sc = capacity?.sprintCapacity;
  const unassigned = capacity?.unassignedTasks || [];

  // Workload distribution stacked bar data
  const distributionData = members.map((m) => ({
    name: getEmployeeName(m.userId),
    todo: m.taskBreakdown.todo,
    inProgress: m.taskBreakdown.inProgress,
    inReview: m.taskBreakdown.inReview,
    blocked: m.taskBreakdown.blocked,
    done: m.taskBreakdown.done,
    capacity: m.currentSprint.assignedPoints,
  }));

  // Sprint capacity bar data
  const capacityBarWidth = sc ? Math.max(sc.totalPoints, sc.committedPoints, 1) : 1;
  const completedPct = sc ? (sc.completedPoints / capacityBarWidth) * 100 : 0;
  const remainingCommittedPct = sc ? ((sc.committedPoints - sc.completedPoints) / capacityBarWidth) * 100 : 0;
  const overCommittedPct = sc && sc.committedPoints > sc.totalPoints
    ? ((sc.committedPoints - sc.totalPoints) / capacityBarWidth) * 100
    : 0;

  // Team members for quick assign dropdown
  const teamMembers = projectTeam.map((m) => ({
    userId: m.userId,
    name: getEmployeeName(m.userId),
  }));

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 min-w-0 md:ml-[260px] p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="text-[#64748B] hover:text-[#2E86C1] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-[#0F172A]">
                {project?.projectName || "Project"} — Team Workload
              </h1>
              {project?.projectKey && (
                <span className="text-xs font-mono bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded">{project.projectKey}</span>
              )}
            </div>
            <p className="text-[13px] text-[#64748B] ml-7">
              Capacity planning, utilization, and task distribution
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sprint selector */}
            {sprints.length > 0 && (
              <select
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#475569] shadow-sm"
              >
                {sprints.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.status === "active" ? "(Active)" : s.status === "completed" ? "(Done)" : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => router.push(`/projects/${projectId}/analytics`)}
              className="px-3 py-2 text-[13px] text-[#8B5CF6] hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-200"
            >
              Analytics
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-3 py-2 text-[13px] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              Back to Project
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={fetchCapacity} className="ml-3 underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="space-y-6">
            <ChartSkeleton />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          </div>
        ) : (
          <>
            {/* Section 1: Sprint Capacity Bar */}
            {sc && (
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">Sprint Capacity</h3>
                  <div className="flex items-center gap-4 text-[12px] text-[#64748B]">
                    {sc.sprintName && <span className="font-medium text-[#0F172A]">{sc.sprintName}</span>}
                    <span>{sc.remainingDays} days remaining</span>
                  </div>
                </div>

                {/* Capacity stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-[#F0FDF4] rounded-lg">
                    <div className="text-[20px] font-bold text-emerald-600">{sc.completedPoints}</div>
                    <div className="text-[11px] text-[#64748B]">Completed</div>
                  </div>
                  <div className="text-center p-3 bg-[#EFF6FF] rounded-lg">
                    <div className="text-[20px] font-bold text-blue-600">{sc.committedPoints}</div>
                    <div className="text-[11px] text-[#64748B]">Committed</div>
                  </div>
                  <div className="text-center p-3 bg-[#F8FAFC] rounded-lg">
                    <div className="text-[20px] font-bold text-[#475569]">{sc.totalPoints}</div>
                    <div className="text-[11px] text-[#64748B]">Total Points</div>
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="w-full h-6 bg-[#F1F5F9] rounded-full overflow-hidden flex">
                  {completedPct > 0 && (
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{ width: `${Math.min(completedPct, 100)}%` }}
                      title={`Completed: ${sc.completedPoints} pts`}
                    />
                  )}
                  {remainingCommittedPct > 0 && !overCommittedPct && (
                    <div
                      className="h-full bg-blue-400 transition-all"
                      style={{ width: `${Math.min(remainingCommittedPct, 100 - completedPct)}%` }}
                      title={`Remaining committed: ${sc.committedPoints - sc.completedPoints} pts`}
                    />
                  )}
                  {overCommittedPct > 0 && (
                    <>
                      <div
                        className="h-full bg-blue-400 transition-all"
                        style={{ width: `${Math.max(0, 100 - completedPct - overCommittedPct)}%` }}
                      />
                      <div
                        className="h-full bg-red-400 transition-all"
                        style={{ width: `${Math.min(overCommittedPct, 100)}%` }}
                        title={`Over-committed by ${sc.committedPoints - sc.totalPoints} pts`}
                      />
                    </>
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 text-[11px] text-[#64748B]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                    Completed
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-400" />
                    Remaining
                  </div>
                  {overCommittedPct > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-red-400" />
                      Over-committed
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 2: Team Heatmap Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
              <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Team Members</h3>

              {members.length === 0 ? (
                <div className="text-center py-12 text-[#94A3B8]">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-sm">No team workload data available for this sprint.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="grid grid-cols-[200px_140px_1fr_120px_80px_100px] gap-3 px-3 text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide">
                    <div>Member</div>
                    <div>Utilization</div>
                    <div>Task Breakdown</div>
                    <div>Points</div>
                    <div>Hours</div>
                    <div>This Week</div>
                  </div>

                  {members.map((m) => {
                    const name = getEmployeeName(m.userId);
                    const avatar = getEmployeeAvatar(m.userId);
                    const role = getTeamRole(m.userId);
                    const allocation = getTeamAllocation(m.userId);
                    const utilPct = m.utilizationPercent;

                    return (
                      <div
                        key={m.userId}
                        className={`grid grid-cols-[200px_140px_1fr_120px_80px_100px] gap-3 items-center p-3 rounded-lg border border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors ${utilizationBg(utilPct)}`}
                      >
                        {/* Name + role */}
                        <div className="flex items-center gap-2.5">
                          {avatar ? (
                            <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[11px] font-bold text-[#64748B]">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-[13px] font-medium text-[#0F172A] leading-tight">{name}</div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E2E8F0] text-[#475569] capitalize">{role}</span>
                              {allocation < 100 && (
                                <span className="text-[10px] text-[#94A3B8]">{allocation}%</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Utilization bar */}
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="flex-1 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(utilPct, 100)}%`,
                                  backgroundColor: utilizationColor(utilPct),
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold" style={{ color: utilizationColor(utilPct) }}>
                              {utilPct}%
                            </span>
                          </div>
                        </div>

                        {/* Task breakdown dots */}
                        <TaskStatusDots breakdown={m.taskBreakdown} />

                        {/* Points */}
                        <div className="text-[12px] text-[#475569]">
                          <span className="font-semibold text-[#0F172A]">{m.currentSprint.completedPoints}</span>
                          <span className="text-[#94A3B8]"> / {m.currentSprint.assignedPoints} pts</span>
                        </div>

                        {/* Hours */}
                        <div className="text-[12px] text-[#475569]">
                          {m.timeTracking.loggedHoursThisSprint}h
                        </div>

                        {/* Sparkline */}
                        <DailySparkline data={m.timeTracking.dailyHoursThisWeek} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Workload Distribution Chart */}
            {distributionData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                  <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Workload Distribution (Story Points)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={distributionData} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#475569" }}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="todo" name="To Do" stackId="a" fill={STATUS_COLORS.todo} radius={0} />
                      <Bar dataKey="inProgress" name="In Progress" stackId="a" fill={STATUS_COLORS.inProgress} />
                      <Bar dataKey="inReview" name="In Review" stackId="a" fill={STATUS_COLORS.inReview} />
                      <Bar dataKey="blocked" name="Blocked" stackId="a" fill={STATUS_COLORS.blocked} />
                      <Bar dataKey="done" name="Done" stackId="a" fill={STATUS_COLORS.done} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Hours chart */}
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                  <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Hours Logged This Sprint</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={members.map((m) => ({
                      name: getEmployeeName(m.userId),
                      thisWeek: m.timeTracking.loggedHoursThisWeek,
                      thisSprint: m.timeTracking.loggedHoursThisSprint,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="thisSprint" name="Sprint Total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="thisWeek" name="This Week" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Section 4: Unassigned Tasks Alert */}
            {unassigned.length > 0 && (
              <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-[14px] font-semibold text-amber-900">
                    Unassigned Tasks ({unassigned.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {unassigned.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100"
                    >
                      <div className="flex items-center gap-3">
                        {task.taskKey && (
                          <span className="text-[11px] font-mono text-[#94A3B8]">{task.taskKey}</span>
                        )}
                        <span className="text-[13px] text-[#0F172A]">{task.title}</span>
                        {task.storyPoints > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                            {task.storyPoints} pts
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] capitalize">
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      <select
                        className="h-7 rounded border border-[#E2E8F0] bg-white px-2 text-[11px] text-[#475569]"
                        value=""
                        disabled={assigningTaskId === task._id}
                        onChange={(e) => {
                          if (e.target.value) handleQuickAssign(task._id, e.target.value);
                        }}
                      >
                        <option value="">Assign to...</option>
                        {teamMembers.map((tm) => (
                          <option key={tm.userId} value={tm.userId}>{tm.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {members.length === 0 && !sc && (
              <div className="text-center py-20 text-[#94A3B8]">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No workload data available. Assign tasks to team members in a sprint to see capacity data.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
