"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, sprintApi, timesheetApi, attendanceApi, Project, Sprint, Timesheet } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

interface AttendanceStat {
  userId?: string;
  employeeName?: string;
  name?: string;
  present?: number;
  absent?: number;
  late?: number;
  total?: number;
}

interface VelocityDataPoint {
  sprint: string;
  project: string;
  velocity: number;
}

interface TeamUtilizationRow {
  userId: string;
  name: string;
  totalHours: number;
  timesheetCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  planning: "bg-blue-50 text-blue-700 border-blue-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  on_hold: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

function healthColor(score?: number) {
  if (!score) return "text-gray-400";
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function exportCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityDataPoint[]>([]);
  const [utilization, setUtilization] = useState<TeamUtilizationRow[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);

  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams: Record<string, string> = {};
      if (startDate) dateParams.startDate = startDate;
      if (endDate) dateParams.endDate = endDate;

      const [projRes, tsRes, attRes] = await Promise.allSettled([
        projectApi.getAll(),
        timesheetApi.getAll(dateParams),
        attendanceApi.getStats(dateParams),
      ]);

      // Projects
      const projs: Project[] = projRes.status === "fulfilled" && Array.isArray(projRes.value.data)
        ? projRes.value.data
        : [];
      setProjects(projs);

      // Sprint velocity — fetch per project
      const sprintResults = await Promise.allSettled(
        projs.map((p) => sprintApi.getByProject(p._id))
      );
      const points: VelocityDataPoint[] = [];
      sprintResults.forEach((res, idx) => {
        if (res.status === "fulfilled" && Array.isArray(res.value.data)) {
          const sprints: Sprint[] = res.value.data;
          sprints
            .filter((s) => s.status === "completed" && (s.velocity ?? s.completedPoints) != null)
            .forEach((s) => {
              points.push({
                sprint: s.name,
                project: projs[idx].projectKey || projs[idx].projectName,
                velocity: s.velocity ?? s.completedPoints ?? 0,
              });
            });
        }
      });
      setVelocityData(points);

      // Timesheets → utilization per user
      if (tsRes.status === "fulfilled") {
        const sheets: Timesheet[] = Array.isArray(tsRes.value.data) ? tsRes.value.data : [];
        const map = new Map<string, TeamUtilizationRow>();
        sheets.forEach((ts) => {
          const existing = map.get(ts.userId);
          if (existing) {
            existing.totalHours += ts.totalHours || 0;
            existing.timesheetCount += 1;
          } else {
            map.set(ts.userId, {
              userId: ts.userId,
              name: ts.userId,
              totalHours: ts.totalHours || 0,
              timesheetCount: 1,
            });
          }
        });
        setUtilization(Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours));
      }

      // Attendance stats
      if (attRes.status === "fulfilled") {
        const raw = attRes.value.data;
        const stats: AttendanceStat[] = Array.isArray(raw)
          ? raw
          : (raw as any)?.employees ?? (raw as any)?.stats ?? [];
        setAttendanceStats(stats);
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  if (authLoading || !user) return null;

  // ── Export handlers ──────────────────────────────────────────────────────

  function exportProjects() {
    exportCSV(
      "project-health.csv",
      projects.map((p) => [
        p.projectName,
        p.status,
        String(p.progressPercentage ?? 0) + "%",
        String(p.healthScore ?? "N/A"),
      ]),
      ["Project Name", "Status", "Progress", "Health Score"]
    );
  }

  function exportVelocity() {
    exportCSV(
      "sprint-velocity.csv",
      velocityData.map((v) => [v.project, v.sprint, String(v.velocity)]),
      ["Project", "Sprint", "Velocity"]
    );
  }

  function exportUtilization() {
    exportCSV(
      "team-utilization.csv",
      utilization.map((u) => [u.name, String(u.totalHours), String(u.timesheetCount)]),
      ["Employee", "Total Hours", "Timesheets"]
    );
  }

  function exportAttendance() {
    exportCSV(
      "attendance-summary.csv",
      attendanceStats.map((a) => [
        a.employeeName || a.name || a.userId || "—",
        String(a.present ?? 0),
        String(a.absent ?? 0),
        String(a.late ?? 0),
      ]),
      ["Employee", "Present", "Absent", "Late"]
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar user={user} onLogout={logout} />

      <main className="ml-[260px] flex-1 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-1">Platform-wide analytics and summaries</p>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 shrink-0">From</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-38 text-sm h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 shrink-0">To</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-38 text-sm h-9"
              />
            </div>
            <Button size="sm" onClick={fetchAll} className="shrink-0">
              Apply
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            Loading reports…
          </div>
        ) : (
          <div className="space-y-8">

            {/* 1. Project Health */}
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Project Health</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{projects.length} projects</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportProjects}>Export CSV</Button>
                </div>
                {projects.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-400 text-center">No projects found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Project</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Progress</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Health Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {projects.map((p) => (
                          <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-800">{p.projectName}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusColors[p.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                {p.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-100 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full"
                                    style={{ width: `${p.progressPercentage ?? 0}%` }}
                                  />
                                </div>
                                <span className="text-slate-600 text-xs">{p.progressPercentage ?? 0}%</span>
                              </div>
                            </td>
                            <td className={`px-6 py-3 font-semibold ${healthColor(p.healthScore)}`}>
                              {p.healthScore != null ? p.healthScore : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Sprint Velocity */}
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Sprint Velocity</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Completed sprints across all projects</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportVelocity}>Export CSV</Button>
                </div>
                {velocityData.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-400 text-center">No completed sprint data available.</p>
                ) : (
                  <div className="px-6 py-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={velocityData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="sprint"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                          formatter={(value: number) => [value, "Velocity"]}
                          labelFormatter={(label) => {
                            const item = velocityData.find((d) => d.sprint === label);
                            return item ? `${item.project} — ${label}` : label;
                          }}
                        />
                        <Bar dataKey="velocity" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. Team Utilization */}
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Team Utilization</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Hours logged via timesheets</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportUtilization}>Export CSV</Button>
                </div>
                {utilization.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-400 text-center">No timesheet data available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Employee</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Total Hours</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Timesheets</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {utilization.map((row) => (
                          <tr key={row.userId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-800">{row.name}</td>
                            <td className="px-6 py-3 text-slate-600">{row.totalHours.toFixed(1)} hrs</td>
                            <td className="px-6 py-3 text-slate-500">{row.timesheetCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. Attendance Summary */}
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Attendance Summary</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Present / absent / late counts</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportAttendance}>Export CSV</Button>
                </div>
                {attendanceStats.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-400 text-center">No attendance data available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Employee</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Present</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Absent</th>
                          <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Late</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {attendanceStats.map((stat, i) => (
                          <tr key={stat.userId ?? i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-800">
                              {stat.employeeName || stat.name || stat.userId || "—"}
                            </td>
                            <td className="px-6 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {stat.present ?? 0}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                {stat.absent ?? 0}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                {stat.late ?? 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </main>
    </div>
  );
}
