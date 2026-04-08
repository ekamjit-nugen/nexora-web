"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { projectApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ──

interface ActiveSprint {
  name: string;
  daysRemaining: number;
  completionRate: number;
}

interface ProjectHealth {
  projectId: string;
  name: string;
  key: string;
  status: string;
  healthScore: number;
  progressPercentage: number;
  activeSprint: ActiveSprint | null;
  overdueTaskCount: number;
  blockedTaskCount: number;
  budgetUtilization: number;
}

interface TeamSummary {
  totalMembers: number;
  overAllocated: number;
  underAllocated: number;
}

interface PendingApprovals {
  timesheets: number;
  leaveRequests: number;
}

interface UpcomingMilestone {
  projectName: string;
  milestoneName: string;
  targetDate: string;
  status: string;
  daysUntil: number;
}

interface WeeklyMetrics {
  tasksCompleted: number;
  tasksCreated: number;
  hoursLogged: number;
  avgCycleTime: number;
}

interface ManagerOverview {
  projectHealth: ProjectHealth[];
  teamSummary: TeamSummary;
  pendingApprovals: PendingApprovals;
  upcomingMilestones: UpcomingMilestone[];
  weeklyMetrics: WeeklyMetrics;
}

// ── Helpers ──

function healthColor(score: number): { bg: string; text: string; label: string } {
  if (score > 70) return { bg: "bg-emerald-50", text: "text-emerald-700", label: "Healthy" };
  if (score > 40) return { bg: "bg-amber-50", text: "text-amber-700", label: "At Risk" };
  return { bg: "bg-red-50", text: "text-red-700", label: "Critical" };
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    planning: "bg-blue-50 text-blue-700",
    active: "bg-emerald-50 text-emerald-700",
    on_hold: "bg-amber-50 text-amber-700",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-50 text-red-600",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

// ── Component ──

export default function ManagerDashboardPage() {
  const { user, loading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<ManagerOverview | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user && hasOrgRole("manager");

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    try {
      const res = await projectApi.getManagerOverview();
      setOverview(res.data as ManagerOverview);
    } catch (err: any) {
      setError(err.message || "Failed to load manager overview");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && !hasOrgRole("manager")) {
      router.push("/dashboard");
    }
  }, [user, loading, hasOrgRole, router]);

  useEffect(() => {
    if (user && canAccess) {
      fetchData();
    }
  }, [user, canAccess, fetchData]);

  if (loading) {
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

  if (!user || !canAccess) return null;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Compute active sprint count from project health
  const activeSprintCount = overview?.projectHealth.filter(p => p.activeSprint).length ?? 0;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Manager Dashboard</h1>
            <p className="text-[13px] text-[#64748B] mt-1">{dateStr}</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : overview ? (
          <>
            {/* ── Section 1: Weekly Metrics Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Tasks Completed */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{overview.weeklyMetrics.tasksCompleted}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Tasks Completed This Week</p>
                </CardContent>
              </Card>

              {/* Hours Logged */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{overview.weeklyMetrics.hoursLogged}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Hours Logged (Team Total)</p>
                </CardContent>
              </Card>

              {/* Avg Cycle Time */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-violet-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {overview.weeklyMetrics.avgCycleTime > 0 ? `${overview.weeklyMetrics.avgCycleTime}d` : "--"}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Avg Cycle Time</p>
                </CardContent>
              </Card>

              {/* Active Sprints */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{activeSprintCount}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Active Sprints</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Main Content: Health Grid + Action Panel ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Project Health Grid — 2 cols */}
              <div className="lg:col-span-2">
                <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Project Health ({overview.projectHealth.length})
                </h2>

                {overview.projectHealth.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <p className="text-[13px] font-medium text-[#334155]">No active projects</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Create a project to see health metrics here</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {overview.projectHealth.map((project) => {
                      const hc = healthColor(project.healthScore);
                      return (
                        <Link key={project.projectId} href={`/projects/${project.projectId}`}>
                          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-5">
                              {/* Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded flex items-center justify-center bg-[#F1F5F9] text-[9px] font-bold text-[#64748B] shrink-0">
                                    {project.key.slice(0, 2) || project.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{project.name}</p>
                                    <p className="text-[10px] text-[#94A3B8]">{project.key}</p>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${hc.bg} ${hc.text}`}>
                                  {project.healthScore} - {hc.label}
                                </span>
                              </div>

                              {/* Progress Bar */}
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-[#94A3B8]">Progress</span>
                                  <span className="text-[10px] font-medium text-[#334155]">{project.progressPercentage}%</span>
                                </div>
                                <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#2E86C1] rounded-full transition-all"
                                    style={{ width: `${Math.min(project.progressPercentage, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Active Sprint */}
                              {project.activeSprint && (
                                <div className="mb-3 p-2 rounded-lg bg-[#F8FAFC]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#334155] truncate">{project.activeSprint.name}</span>
                                    <span className="text-[10px] text-[#64748B]">
                                      {project.activeSprint.daysRemaining > 0
                                        ? `${project.activeSprint.daysRemaining}d left`
                                        : "Overdue"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <div className="flex-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${Math.min(project.activeSprint.completionRate, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-[#64748B]">{project.activeSprint.completionRate}%</span>
                                  </div>
                                </div>
                              )}

                              {/* Badges Row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusBadge(project.status)}`}>
                                  {project.status.replace("_", " ")}
                                </span>
                                {project.overdueTaskCount > 0 && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                    {project.overdueTaskCount} overdue
                                  </span>
                                )}
                                {project.blockedTaskCount > 0 && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
                                    {project.blockedTaskCount} blocked
                                  </span>
                                )}
                              </div>

                              {/* Budget Utilization */}
                              {project.budgetUtilization > 0 && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-[#94A3B8]">Budget</span>
                                    <span className={`text-[10px] font-medium ${
                                      project.budgetUtilization > 90 ? "text-red-600" :
                                      project.budgetUtilization > 70 ? "text-amber-600" : "text-[#334155]"
                                    }`}>
                                      {project.budgetUtilization}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        project.budgetUtilization > 90 ? "bg-red-500" :
                                        project.budgetUtilization > 70 ? "bg-amber-500" : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${Math.min(project.budgetUtilization, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Action Required Panel — 1 col ── */}
              <div className="space-y-4">
                {/* Pending Approvals */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      Action Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Link href="/timesheets" className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="text-[12px] text-[#334155]">Timesheets pending</span>
                      </div>
                      <span className="text-[12px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        {overview.pendingApprovals.timesheets}
                      </span>
                    </Link>
                    <Link href="/leaves" className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <span className="text-[12px] text-[#334155]">Leave requests</span>
                      </div>
                      <span className="text-[12px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        {overview.pendingApprovals.leaveRequests}
                      </span>
                    </Link>
                  </CardContent>
                </Card>

                {/* Team Summary */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-violet-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      Team Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#64748B]">Total Members</span>
                        <span className="text-[13px] font-bold text-[#0F172A]">{overview.teamSummary.totalMembers}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#64748B]">Over-allocated (&gt;100%)</span>
                        <span className={`text-[13px] font-bold ${overview.teamSummary.overAllocated > 0 ? "text-red-600" : "text-[#0F172A]"}`}>
                          {overview.teamSummary.overAllocated}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#64748B]">Under-allocated (&lt;50%)</span>
                        <span className={`text-[13px] font-bold ${overview.teamSummary.underAllocated > 0 ? "text-amber-600" : "text-[#0F172A]"}`}>
                          {overview.teamSummary.underAllocated}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Milestones This Week */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm0 0h18" />
                        </svg>
                      </div>
                      Approaching Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overview.upcomingMilestones.filter(m => m.daysUntil <= 7).length === 0 ? (
                      <p className="text-[12px] text-[#94A3B8] text-center py-3">No milestones due this week</p>
                    ) : (
                      <div className="space-y-2">
                        {overview.upcomingMilestones
                          .filter(m => m.daysUntil <= 7)
                          .map((m, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#F8FAFC]">
                              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                m.daysUntil <= 2 ? "bg-red-500" : "bg-amber-500"
                              }`} />
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-[#0F172A] truncate">{m.milestoneName}</p>
                                <p className="text-[10px] text-[#94A3B8]">
                                  {m.projectName} &middot; {m.daysUntil === 0 ? "Today" : m.daysUntil === 1 ? "Tomorrow" : `${m.daysUntil}d`}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ── Section 4: Upcoming Milestones Timeline ── */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upcoming Milestones (Next 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.upcomingMilestones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm0 0h18" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-medium text-[#334155]">No upcoming milestones</p>
                    <p className="text-xs text-[#94A3B8] mt-1">Milestones due in the next 30 days will appear here</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute top-3 left-0 right-0 h-0.5 bg-[#E2E8F0]" />

                    {/* Scrollable container */}
                    <div className="flex gap-0 overflow-x-auto pb-2 pt-0 relative">
                      {overview.upcomingMilestones.map((milestone, index) => {
                        const isUrgent = milestone.daysUntil <= 3;
                        const progressPct = Math.max(0, Math.min(100, ((30 - milestone.daysUntil) / 30) * 100));

                        return (
                          <div
                            key={index}
                            className="flex flex-col items-center shrink-0"
                            style={{
                              minWidth: "120px",
                              marginLeft: index === 0 ? `${progressPct}%` : undefined,
                            }}
                          >
                            {/* Dot */}
                            <div className={`w-2.5 h-2.5 rounded-full border-2 z-10 ${
                              isUrgent
                                ? "bg-red-500 border-red-300"
                                : "bg-[#2E86C1] border-blue-300"
                            }`} />

                            {/* Content */}
                            <div className="mt-2 text-center px-2">
                              <p className={`text-[11px] font-semibold truncate max-w-[110px] ${
                                isUrgent ? "text-red-700" : "text-[#0F172A]"
                              }`}>
                                {milestone.milestoneName}
                              </p>
                              <p className="text-[10px] text-[#64748B] truncate max-w-[110px]">{milestone.projectName}</p>
                              <p className={`text-[10px] font-medium mt-0.5 ${
                                isUrgent ? "text-red-600" : "text-[#94A3B8]"
                              }`}>
                                {milestone.daysUntil === 0
                                  ? "Today"
                                  : milestone.daysUntil === 1
                                    ? "Tomorrow"
                                    : `In ${milestone.daysUntil} days`}
                              </p>
                              <p className="text-[9px] text-[#94A3B8]">
                                {new Date(milestone.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
