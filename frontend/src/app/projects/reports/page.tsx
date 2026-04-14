"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  projectApi, reportingApi, sprintApi,
  Project, Sprint,
  VelocitySprint, WorkloadMember, OverviewStats,
} from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

const STATUS_COLORS: Record<string, string> = {
  backlog: "#94A3B8",
  todo: "#CBD5E1",
  in_progress: "#3B82F6",
  in_review: "#F59E0B",
  blocked: "#EF4444",
  done: "#10B981",
  cancelled: "#6B7280",
};

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

interface ProjectReport {
  project: Project;
  overview: OverviewStats | null;
  velocity: VelocitySprint[];
  workload: WorkloadMember[];
}

export default function PortfolioReportsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [reports, setReports] = useState<Map<string, ProjectReport>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await projectApi.getAll({ status: "active" });
      const data: Project[] = Array.isArray(res.data) ? res.data : [];
      setProjects(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const fetchProjectReport = useCallback(async (proj: Project): Promise<ProjectReport> => {
    const [overviewRes, velocityRes, workloadRes] = await Promise.allSettled([
      reportingApi.getOverview(proj._id),
      reportingApi.getVelocity(proj._id),
      reportingApi.getWorkload(proj._id),
    ]);

    return {
      project: proj,
      overview: overviewRes.status === "fulfilled" ? overviewRes.value.data : null,
      velocity: velocityRes.status === "fulfilled" ? (velocityRes.value.data as any)?.sprints || [] : [],
      workload: workloadRes.status === "fulfilled" ? (workloadRes.value.data as any)?.members || [] : [],
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    (async () => {
      setLoading(true);
      const projs = await fetchProjects();
      const reportMap = new Map<string, ProjectReport>();
      const results = await Promise.allSettled(projs.map(fetchProjectReport));
      results.forEach((r) => {
        if (r.status === "fulfilled") reportMap.set(r.value.project._id, r.value);
      });
      setReports(reportMap);
      setLoading(false);
    })();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  // Aggregate stats across all projects or filter to selected
  const visibleReports = selectedProjectId === "all"
    ? Array.from(reports.values())
    : reports.has(selectedProjectId) ? [reports.get(selectedProjectId)!] : [];

  const totals = visibleReports.reduce(
    (acc, r) => {
      const o = r.overview;
      if (!o) return acc;
      acc.totalTasks += o.totalTasks || 0;
      acc.completedTasks += o.completedTasks || 0;
      acc.openTasks += o.openTasks || 0;
      acc.overdueTasks += o.overdueTasks || 0;
      acc.totalPoints += o.totalPoints || 0;
      acc.completedPoints += o.completedPoints || 0;
      return acc;
    },
    { totalTasks: 0, completedTasks: 0, openTasks: 0, overdueTasks: 0, totalPoints: 0, completedPoints: 0 },
  );

  const completionRate = totals.totalTasks > 0 ? Math.round((totals.completedTasks / totals.totalTasks) * 100) : 0;

  // Task status distribution across all projects
  const statusDistribution = visibleReports.reduce<Record<string, number>>((acc, r) => {
    const o = r.overview;
    if (!o?.statusBreakdown) return acc;
    for (const [status, count] of Object.entries(o.statusBreakdown)) {
      acc[status] = (acc[status] || 0) + (count as number);
    }
    return acc;
  }, {});

  const statusChartData = Object.entries(statusDistribution).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    color: STATUS_COLORS[name] || "#94A3B8",
  }));

  // Velocity across projects
  const velocityByProject = visibleReports
    .filter((r) => r.velocity.length > 0)
    .map((r) => ({
      name: r.project.projectName.length > 15 ? r.project.projectName.slice(0, 15) + "..." : r.project.projectName,
      avgVelocity: r.velocity.length > 0
        ? Math.round(r.velocity.reduce((s, v) => s + (v.completedPoints || 0), 0) / r.velocity.length)
        : 0,
      totalSprints: r.velocity.length,
    }));

  // Workload: top loaded team members
  const allWorkload = visibleReports.flatMap((r) => r.workload);
  const memberLoad = new Map<string, { name: string; tasks: number; points: number }>();
  allWorkload.forEach((w) => {
    const key = w.userId || w.name;
    const existing = memberLoad.get(key);
    if (existing) {
      existing.tasks += w.taskCount || 0;
      existing.points += w.totalPoints || 0;
    } else {
      memberLoad.set(key, { name: w.name || "Unknown", tasks: w.taskCount || 0, points: w.totalPoints || 0 });
    }
  });
  const workloadData = Array.from(memberLoad.values())
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 10);

  // Project health overview
  const projectHealthData = visibleReports.map((r) => {
    const o = r.overview;
    const total = o?.totalTasks || 1;
    const done = o?.completedTasks || 0;
    return {
      name: r.project.projectName.length > 20 ? r.project.projectName.slice(0, 20) + "..." : r.project.projectName,
      completion: Math.round((done / total) * 100),
      overdue: o?.overdueTasks || 0,
      status: r.project.status,
    };
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Work Reports</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Portfolio-wide analytics across {projects.length} active project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.projectName}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} />)}
            </div>
          </>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Projects</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{visibleReports.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Total Tasks</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{totals.totalTasks}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-[#10B981] mt-1">{totals.completedTasks}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Open</p>
                <p className="text-2xl font-bold text-[#3B82F6] mt-1">{totals.openTasks}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Overdue</p>
                <p className="text-2xl font-bold text-[#EF4444] mt-1">{totals.overdueTasks}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Completion</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{completionRate}%</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Task Status Distribution */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Task Status Distribution</h3>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                      >
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No task data available</div>
                )}
              </div>

              {/* Average Velocity by Project */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Average Velocity by Project</h3>
                {velocityByProject.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={velocityByProject} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "#64748B" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} width={120} />
                      <Tooltip
                        formatter={(value: number) => [`${value} pts/sprint`, "Avg Velocity"]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                      <Bar dataKey="avgVelocity" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No sprint velocity data</div>
                )}
              </div>

              {/* Team Workload */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Team Workload (Top 10)</h3>
                {workloadData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={workloadData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Legend />
                      <Bar dataKey="tasks" name="Tasks" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="points" name="Story Points" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No workload data</div>
                )}
              </div>

              {/* Project Health */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Project Health Overview</h3>
                {projectHealthData.length > 0 ? (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto">
                    {projectHealthData.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-[140px] text-xs font-medium text-[#334155] truncate">{p.name}</div>
                        <div className="flex-1 bg-[#F1F5F9] rounded-full h-5 relative overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${p.completion}%`,
                              backgroundColor: p.completion >= 80 ? "#10B981" : p.completion >= 50 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#334155]">
                            {p.completion}%
                          </span>
                        </div>
                        {p.overdue > 0 && (
                          <span className="text-[10px] font-medium text-[#EF4444] whitespace-nowrap">
                            {p.overdue} overdue
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No projects to show</div>
                )}
              </div>
            </div>

            {/* Story Points Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Story Points Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-[#64748B]">Total Estimated</p>
                  <p className="text-xl font-bold text-[#0F172A]">{totals.totalPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Completed</p>
                  <p className="text-xl font-bold text-[#10B981]">{totals.completedPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Remaining</p>
                  <p className="text-xl font-bold text-[#F59E0B]">{totals.totalPoints - totals.completedPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Burn Rate</p>
                  <p className="text-xl font-bold text-[#3B82F6]">
                    {totals.totalPoints > 0 ? Math.round((totals.completedPoints / totals.totalPoints) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
