"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi, projectApi, Task, Project } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import PersonalStatsPanel from "@/components/PersonalStatsPanel";

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
  trivial: "bg-gray-50 text-gray-500",
};

const priorityIcons: Record<string, string> = {
  critical: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  high: "M5 15l7-7 7 7",
  medium: "M20 12H4",
  low: "M19 9l-7 7-7-7",
  trivial: "M19 14l-7 7-7-7",
};

const statusOptions = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

interface MyWorkData {
  overdue: Task[];
  dueToday: Task[];
  inProgress: Task[];
  readyToStart: Task[];
  blocked: Task[];
  upcomingThisSprint: Task[];
  recentlyCompleted: Task[];
}

interface SectionConfig {
  key: keyof MyWorkData;
  label: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  focusMode: boolean;
}

const sections: SectionConfig[] = [
  { key: "overdue", label: "Overdue", accentColor: "bg-red-500", bgColor: "bg-red-50", textColor: "text-red-700", borderColor: "border-red-200", focusMode: true },
  { key: "dueToday", label: "Due Today", accentColor: "bg-amber-500", bgColor: "bg-amber-50", textColor: "text-amber-700", borderColor: "border-amber-200", focusMode: true },
  { key: "inProgress", label: "In Progress", accentColor: "bg-blue-500", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200", focusMode: true },
  { key: "readyToStart", label: "Ready to Start", accentColor: "bg-emerald-500", bgColor: "bg-emerald-50", textColor: "text-emerald-700", borderColor: "border-emerald-200", focusMode: false },
  { key: "blocked", label: "Blocked", accentColor: "bg-red-500", bgColor: "bg-red-50", textColor: "text-red-700", borderColor: "border-red-200", focusMode: false },
  { key: "upcomingThisSprint", label: "This Sprint", accentColor: "bg-gray-500", bgColor: "bg-gray-50", textColor: "text-gray-700", borderColor: "border-gray-200", focusMode: false },
  { key: "recentlyCompleted", label: "Recently Completed", accentColor: "bg-emerald-400", bgColor: "bg-emerald-50", textColor: "text-emerald-600", borderColor: "border-emerald-200", focusMode: false },
];

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDueDate(dueDate?: string): string {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(dueDate) < startOfDay;
}

function isDueToday(dueDate?: string): boolean {
  if (!dueDate) return false;
  const now = new Date();
  const d = new Date(dueDate);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function MyWorkPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MyWorkData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [projectFilter, setProjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [workRes, projRes] = await Promise.all([
        taskApi.getMyWork(),
        projectApi.getAll(),
      ]);
      setData(workRes.data || null);
      setProjects(Array.isArray(projRes.data) ? projRes.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load work data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await taskApi.updateStatus(taskId, newStatus);
      toast.success("Status updated");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const projectMap = new Map(projects.map((p) => [p._id, p]));
  const projectName = (id: string) => projectMap.get(id)?.projectName || "Unknown";
  const projectColor = (id: string) => {
    const colors = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500"];
    const idx = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length;
    return colors[idx];
  };

  const filterTasks = (tasks: Task[]): Task[] => {
    let filtered = tasks;
    if (projectFilter !== "all") {
      filtered = filtered.filter((t) => t.projectId === projectFilter);
    }
    if (priorityFilter !== "all") {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }
    return filtered;
  };

  // Compute summary stats
  const overdueCount = data ? filterTasks(data.overdue).length : 0;
  const dueTodayCount = data ? filterTasks(data.dueToday).length : 0;
  const inProgressCount = data ? filterTasks(data.inProgress).length : 0;
  const blockedCount = data ? filterTasks(data.blocked).length : 0;

  // Total estimated hours remaining
  const totalEstRemaining = data
    ? [...data.overdue, ...data.dueToday, ...data.inProgress, ...data.readyToStart, ...data.blocked, ...data.upcomingThisSprint]
        .filter((t) => projectFilter === "all" || t.projectId === projectFilter)
        .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
        .reduce((sum, t) => sum + (t.estimatedHours || 0) - (t.loggedHours || 0), 0)
    : 0;

  return (
    <RouteGuard minOrgRole="member">
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">{greeting}, {user.firstName}!</h1>
              <p className="text-[13px] text-[#94A3B8] mt-1">{todayStr}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Focus Mode Toggle */}
              <button
                onClick={() => setFocusMode(!focusMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  focusMode
                    ? "bg-[#2E86C1] text-white shadow-sm"
                    : "bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Focus Mode
              </button>
            </div>
          </div>

          {/* Personal Stats */}
          <PersonalStatsPanel />

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-bl-[60px] -mr-2 -mt-2" />
              <CardContent className="p-5 relative">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{overdueCount}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Overdue</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
              <CardContent className="p-5 relative">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{dueTodayCount}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Due Today</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
              <CardContent className="p-5 relative">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{inProgressCount}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">In Progress</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-bl-[60px] -mr-2 -mt-2" />
              <CardContent className="p-5 relative">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{blockedCount}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Blocked</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters Row */}
          <Card className="border-0 shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>{p.projectName}</option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]"
                >
                  <option value="all">All Priority</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="trivial">Trivial</option>
                </select>

                {totalEstRemaining > 0 && (
                  <div className="ml-auto flex items-center gap-1.5 text-[12px] text-[#64748B]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-[#334155]">{Math.round(totalEstRemaining * 10) / 10}h</span>
                    estimated remaining
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
            </div>
          ) : !data ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[#334155] mb-1">No work data available</h3>
                <p className="text-[13px] text-[#94A3B8]">Check back later or make sure you have tasks assigned.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {sections
                .filter((s) => !focusMode || s.focusMode)
                .map((section) => {
                  const tasks = filterTasks(data[section.key] || []);
                  if (tasks.length === 0) return null;
                  const isCollapsed = collapsedSections.has(section.key);
                  const isCompleted = section.key === "recentlyCompleted";

                  return (
                    <div key={section.key}>
                      {/* Section header */}
                      <button
                        onClick={() => toggleSection(section.key)}
                        className="flex items-center gap-2.5 mb-3 px-1 w-full text-left group"
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${section.accentColor}`} />
                        <h3 className="text-[13px] font-semibold text-[#0F172A]">{section.label}</h3>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${section.bgColor} ${section.textColor}`}>
                          {tasks.length}
                        </span>
                        <svg
                          className={`w-4 h-4 text-[#94A3B8] transition-transform ml-1 ${isCollapsed ? "-rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Task rows */}
                      {!isCollapsed && (
                        <Card className={`border-0 shadow-sm overflow-hidden ${isCompleted ? "opacity-70" : ""}`}>
                          {tasks.map((task, i) => (
                            <div
                              key={task._id}
                              className={`flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] cursor-pointer transition-colors ${
                                i < tasks.length - 1 ? "border-b border-[#F1F5F9]" : ""
                              }`}
                              onClick={() => router.push(`/projects/${task.projectId}/items/${task._id}`)}
                            >
                              {/* Project badge */}
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${projectColor(task.projectId)}`}
                                title={projectName(task.projectId)}
                              >
                                {projectMap.get(task.projectId)?.projectKey?.slice(0, 2) ||
                                  projectName(task.projectId).charAt(0).toUpperCase()}
                              </div>

                              {/* Task key + title */}
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                {task.taskKey && (
                                  <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">{task.taskKey}</span>
                                )}
                                <p className={`text-[13px] font-medium truncate ${isCompleted ? "line-through text-[#94A3B8]" : "text-[#0F172A]"}`}>
                                  {task.title}
                                </p>
                              </div>

                              {/* Priority icon */}
                              <div className={`shrink-0 ${priorityColors[task.priority]}`} title={task.priority}>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d={priorityIcons[task.priority] || priorityIcons.medium} />
                                </svg>
                              </div>

                              {/* Due date */}
                              {task.dueDate && (
                                <span
                                  className={`text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded ${
                                    isOverdue(task.dueDate)
                                      ? "bg-red-100 text-red-700"
                                      : isDueToday(task.dueDate)
                                      ? "bg-amber-100 text-amber-700"
                                      : "text-[#94A3B8]"
                                  }`}
                                >
                                  {formatDueDate(task.dueDate)}
                                  {section.key === "overdue" && task.dueDate && (
                                    <span className="ml-1 font-bold">({daysOverdue(task.dueDate)}d)</span>
                                  )}
                                </span>
                              )}

                              {/* Story points */}
                              {task.storyPoints != null && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">
                                  {task.storyPoints}
                                </span>
                              )}

                              {/* Blocking info for blocked tasks */}
                              {section.key === "blocked" && (task.dependencies || []).filter((d) => d.type === "blocked_by").length > 0 && (
                                <span className="text-[10px] text-red-500 shrink-0" title="Blocked by dependencies">
                                  <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  {(task.dependencies || []).filter((d) => d.type === "blocked_by").length}
                                </span>
                              )}

                              {/* Quick status dropdown */}
                              <select
                                value={task.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(task._id, e.target.value);
                                }}
                                className="h-7 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[10px] text-[#475569] shrink-0 cursor-pointer"
                              >
                                {statusOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </Card>
                      )}
                    </div>
                  );
                })}

              {/* Empty state when all sections are empty after filtering */}
              {sections
                .filter((s) => !focusMode || s.focusMode)
                .every((s) => filterTasks(data[s.key] || []).length === 0) && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[#334155] mb-1">All clear!</h3>
                    <p className="text-[13px] text-[#94A3B8]">
                      {focusMode
                        ? "No urgent items. Try disabling Focus Mode to see all work."
                        : "No tasks match your current filters."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}
