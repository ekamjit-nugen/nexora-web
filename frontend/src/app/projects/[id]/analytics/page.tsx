"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  projectApi, reportingApi, sprintApi, hrApi,
  Project, Sprint, Employee,
  VelocitySprint, CumulativeFlowData, CycleTimeData, BurndownData,
  WorkloadMember, BudgetUtilization, OverviewStats,
} from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from "recharts";

// ── Constants ──

const STATUS_COLORS: Record<string, string> = {
  backlog: "#94A3B8",
  todo: "#CBD5E1",
  in_progress: "#3B82F6",
  in_review: "#F59E0B",
  done: "#10B981",
};

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
}

// ── Skeleton ──

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 animate-pulse">
      <div className="h-4 bg-[#E2E8F0] rounded w-36 mb-4" />
      <div className="h-[260px] bg-[#F8FAFC] rounded" />
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse">
      <div className="h-3 bg-[#E2E8F0] rounded w-20 mb-3" />
      <div className="h-7 bg-[#E2E8F0] rounded w-14" />
    </div>
  );
}

// ── Main Page ──

export default function ProjectAnalyticsPage() {
  const { user, loading: authLoading, logout, hasOrgRole, isProjectRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [velocity, setVelocity] = useState<VelocitySprint[]>([]);
  const [cumulativeFlow, setCumulativeFlow] = useState<CumulativeFlowData | null>(null);
  const [cycleTime, setCycleTime] = useState<CycleTimeData | null>(null);
  const [burndown, setBurndown] = useState<BurndownData | null>(null);
  const [workload, setWorkload] = useState<WorkloadMember[]>([]);
  const [budget, setBudget] = useState<BudgetUtilization | null>(null);

  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");

  // Role check — allow project members (including viewers) OR org-level managers+
  const projectTeam = (project?.team as Array<{ userId: string; role: string }>) || [];
  const isProjectMember = isProjectRole(projectTeam, 'viewer');
  const isOrgManager = hasOrgRole('manager');
  const isAuthorized = user && (isProjectMember || isOrgManager);

  // Viewer = read-only analytics (no export/configure actions)
  const isReadOnly = isAuthorized && !isOrgManager && !isProjectRole(projectTeam, 'developer');

  const getEmployeeName = useCallback((userId: string) => {
    const emp = employees.find((e) => e.userId === userId || e._id === userId);
    return emp ? `${emp.firstName} ${emp.lastName}` : userId.slice(0, 8);
  }, [employees]);

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

        // Set default sprint to active or first sprint
        const active = sprintList.find((s: Sprint) => s.status === "active");
        setSelectedSprintId(active?._id || sprintList[0]?._id || "");
      } catch {
        setError("Failed to load project data.");
      }
    })();
  }, [user, projectId]);

  // Fetch all analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        reportingApi.getOverview(projectId),
        reportingApi.getVelocity(projectId),
        reportingApi.getCumulativeFlow(projectId, fromDate, toDate),
        reportingApi.getCycleTime(projectId),
        reportingApi.getWorkload(projectId),
        reportingApi.getBudget(projectId),
      ]);

      if (results[0].status === "fulfilled") setOverview(results[0].value.data || null);
      if (results[1].status === "fulfilled") setVelocity(results[1].value.data?.sprints || []);
      if (results[2].status === "fulfilled") setCumulativeFlow(results[2].value.data || null);
      if (results[3].status === "fulfilled") setCycleTime(results[3].value.data || null);
      if (results[4].status === "fulfilled") setWorkload(results[4].value.data?.members || []);
      if (results[5].status === "fulfilled") setBudget(results[5].value.data || null);
    } catch {
      setError("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, [projectId, user, fromDate, toDate]);

  useEffect(() => {
    if (user && projectId) fetchAnalytics();
  }, [user, projectId, fetchAnalytics]);

  // Fetch burndown when sprint changes
  useEffect(() => {
    if (!selectedSprintId || !projectId) return;
    (async () => {
      try {
        const res = await reportingApi.getBurndown(projectId, selectedSprintId);
        setBurndown(res.data || null);
      } catch {
        setBurndown(null);
      }
    })();
  }, [projectId, selectedSprintId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

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
        <main className="flex-1 ml-[260px] p-8">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Access Denied</h2>
            <p className="text-sm text-[#64748B]">You need to be a project member or have manager role to view analytics.</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Build chart data ──

  const velocityChartData = velocity.map((s) => ({
    name: s.sprintName,
    planned: s.planned,
    completed: s.completed,
    carryOver: s.carryOver,
  }));

  const cumulativeFlowChartData = cumulativeFlow
    ? cumulativeFlow.dates.map((date, i) => {
        const row: Record<string, any> = { date: date.slice(5) }; // "MM-DD"
        cumulativeFlow.columns.forEach((col) => {
          row[col.name] = col.counts[i] || 0;
        });
        return row;
      })
    : [];

  const burndownChartData = burndown
    ? burndown.days.map((d) => ({
        date: d.date.slice(5),
        ideal: d.ideal,
        actual: d.actual,
      }))
    : [];

  const workloadChartData = workload.map((m) => ({
    name: getEmployeeName(m.userId),
    logged: m.logged,
    estimated: m.estimated,
    tasks: m.taskCount,
  }));

  const budgetPieData = budget
    ? [
        { name: "Spent", value: budget.spent },
        { name: "Remaining", value: budget.remaining },
      ]
    : [];

  const cycleDistributionData = cycleTime?.distribution || [];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8 overflow-auto">
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
                {project?.projectName || "Project"} — Analytics
              </h1>
              {project?.projectKey && (
                <span className="text-xs font-mono bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded">{project.projectKey}</span>
              )}
            </div>
            <p className="text-[13px] text-[#64748B] ml-7">
              Performance metrics, velocity, and team insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-[#E2E8F0] px-3 py-2">
              <label className="text-[12px] text-[#64748B]">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-[13px] text-[#0F172A] border-0 outline-none bg-transparent"
              />
              <span className="text-[#CBD5E1]">|</span>
              <label className="text-[12px] text-[#64748B]">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-[13px] text-[#0F172A] border-0 outline-none bg-transparent"
              />
            </div>
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
            <button onClick={fetchAnalytics} className="ml-3 underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => <ChartSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <OverviewCard
                label="Total Tasks"
                value={overview?.totalTasks ?? 0}
                sub={`${overview?.completedTasks ?? 0} completed`}
                color="blue"
                icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
              <OverviewCard
                label="Completion Rate"
                value={`${overview?.completionRate ?? 0}%`}
                sub={`${overview?.completedPoints ?? 0} / ${overview?.totalPoints ?? 0} points`}
                color="green"
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <OverviewCard
                label="Avg Cycle Time"
                value={`${overview?.avgCycleTime ?? 0}d`}
                sub="in_progress to done"
                color="amber"
                icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <OverviewCard
                label="Budget Health"
                value={budget ? `${Math.round((budget.spent / Math.max(budget.total, 1)) * 100)}%` : "N/A"}
                sub={budget ? `${budget.currency} ${budget.spent.toLocaleString()} / ${budget.total.toLocaleString()}` : "No budget set"}
                color={budget && budget.spent > budget.total * 0.9 ? "red" : "purple"}
                icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Velocity Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Sprint Velocity</h3>
                {velocityChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={velocityChartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="planned" name="Planned" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="carryOver" name="Carry Over" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No sprint data available" />
                )}
              </div>

              {/* Cumulative Flow Diagram */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Cumulative Flow</h3>
                {cumulativeFlowChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={cumulativeFlowChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {cumulativeFlow?.columns.map((col) => (
                        <Area
                          key={col.name}
                          type="monotone"
                          dataKey={col.name}
                          stackId="1"
                          fill={col.color}
                          stroke={col.color}
                          fillOpacity={0.7}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No flow data for selected period" />
                )}
              </div>

              {/* Burndown Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">Sprint Burndown</h3>
                  {sprints.length > 0 && (
                    <select
                      value={selectedSprintId}
                      onChange={(e) => setSelectedSprintId(e.target.value)}
                      className="text-[12px] border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#334155] bg-[#F8FAFC]"
                    >
                      {sprints.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} {s.status === "active" ? "(Active)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {burndownChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={burndownChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#CBD5E1" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No sprint selected or no data" />
                )}
              </div>

              {/* Team Workload */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Team Workload</h3>
                {workloadChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={workloadChartData} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748B" }} width={100} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="estimated" name="Estimated (h)" fill="#93C5FD" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="logged" name="Logged (h)" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No workload data available" />
                )}
              </div>

              {/* Budget Utilization */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Budget Utilization</h3>
                {budget && budget.total > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={240}>
                      <PieChart>
                        <Pie
                          data={budgetPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                          strokeWidth={2}
                        >
                          <Cell fill="#EF4444" />
                          <Cell fill="#10B981" />
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `${budget.currency} ${value.toLocaleString()}`}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Total Budget</span>
                        <span className="font-semibold text-[#0F172A]">{budget.currency} {budget.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Spent</span>
                        <span className="font-semibold text-red-600">{budget.currency} {budget.spent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Remaining</span>
                        <span className="font-semibold text-emerald-600">{budget.currency} {budget.remaining.toLocaleString()}</span>
                      </div>
                      <hr className="border-[#F1F5F9]" />
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Daily Burn Rate</span>
                        <span className="font-medium text-[#334155]">{budget.currency} {budget.burnRate.toLocaleString()}/day</span>
                      </div>
                      {budget.projectedOverrun > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Projected Overrun</span>
                          <span className="font-semibold text-red-600">{budget.currency} {budget.projectedOverrun.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Billing Type</span>
                        <span className="font-medium text-[#334155] capitalize">{budget.billingType.replace("_", " & ")}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No budget configured for this project" />
                )}
              </div>

              {/* Cycle Time Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Cycle Time Analysis</h3>
                {cycleTime && cycleTime.tasks.length > 0 ? (
                  <div>
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="text-center p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <p className="text-[11px] text-[#64748B] uppercase font-medium mb-1">Average</p>
                        <p className="text-xl font-bold text-[#0F172A]">{cycleTime.average}<span className="text-xs font-normal text-[#64748B] ml-0.5">days</span></p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <p className="text-[11px] text-[#64748B] uppercase font-medium mb-1">Median</p>
                        <p className="text-xl font-bold text-[#0F172A]">{cycleTime.median}<span className="text-xs font-normal text-[#64748B] ml-0.5">days</span></p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <p className="text-[11px] text-[#64748B] uppercase font-medium mb-1">P90</p>
                        <p className="text-xl font-bold text-[#0F172A]">{cycleTime.p90}<span className="text-xs font-normal text-[#64748B] ml-0.5">days</span></p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={cycleDistributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#64748B" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                        <Bar dataKey="count" name="Tasks" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState message="No completed tasks with cycle time data" />
                )}
              </div>
            </div>

            {/* Workload Table */}
            {workload.length > 0 && (
              <div className="mt-6 bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Team Workload Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#F1F5F9]">
                        <th className="text-left py-2.5 px-3 text-[#64748B] font-medium">Member</th>
                        <th className="text-right py-2.5 px-3 text-[#64748B] font-medium">Tasks</th>
                        <th className="text-right py-2.5 px-3 text-[#64748B] font-medium">Completed</th>
                        <th className="text-right py-2.5 px-3 text-[#64748B] font-medium">Points</th>
                        <th className="text-right py-2.5 px-3 text-[#64748B] font-medium">Estimated</th>
                        <th className="text-right py-2.5 px-3 text-[#64748B] font-medium">Logged</th>
                        <th className="text-right py-2.5 px-3 text-[#64748B] font-medium">Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workload.map((m) => (
                        <tr key={m.userId} className="border-b border-[#F8FAFC] hover:bg-[#FAFBFC]">
                          <td className="py-2.5 px-3 font-medium text-[#0F172A]">{getEmployeeName(m.userId)}</td>
                          <td className="py-2.5 px-3 text-right text-[#334155]">{m.taskCount}</td>
                          <td className="py-2.5 px-3 text-right text-[#334155]">{m.completedTasks}</td>
                          <td className="py-2.5 px-3 text-right text-[#334155]">{m.totalPoints}</td>
                          <td className="py-2.5 px-3 text-right text-[#334155]">{m.estimated}h</td>
                          <td className="py-2.5 px-3 text-right text-[#334155]">{m.logged}h</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              m.utilization > 100 ? "bg-red-100 text-red-700" :
                              m.utilization > 80 ? "bg-amber-100 text-amber-700" :
                              m.utilization > 0 ? "bg-green-100 text-green-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {m.utilization}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Shared Components ──

function OverviewCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-blue-100" },
    green: { bg: "bg-emerald-50", text: "text-emerald-600", iconBg: "bg-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-amber-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", iconBg: "bg-purple-100" },
    red: { bg: "bg-red-50", text: "text-red-600", iconBg: "bg-red-100" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
        <svg className={`w-5 h-5 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-[11px] text-[#94A3B8] uppercase font-medium tracking-wide">{label}</p>
        <p className="text-xl font-bold text-[#0F172A] mt-0.5">{value}</p>
        <p className="text-[11px] text-[#64748B] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-[#94A3B8]">
      <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-[13px]">{message}</p>
    </div>
  );
}
