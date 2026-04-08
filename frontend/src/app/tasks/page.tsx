"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi, projectApi, hrApi, Task, Project, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
  trivial: "bg-gray-50 text-gray-500",
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  backlog: { label: "Backlog", color: "bg-gray-100 text-gray-600", dot: "bg-[#94A3B8]" },
  todo: { label: "To Do", color: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  in_review: { label: "In Review", color: "bg-purple-50 text-purple-600", dot: "bg-violet-500" },
  blocked: { label: "Blocked", color: "bg-red-50 text-red-600", dot: "bg-red-500" },
  done: { label: "Done", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500", dot: "bg-gray-400" },
};

const typeConfig: Record<string, { label: string; icon: string; color: string }> = {
  epic: { label: "Epics", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-purple-500" },
  story: { label: "Stories", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "text-green-500" },
  task: { label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-blue-500" },
  bug: { label: "Bugs", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "text-red-500" },
  sub_task: { label: "Subtasks", icon: "M4 6h16M4 12h8m-8 6h16", color: "text-gray-500" },
  improvement: { label: "Improvements", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-teal-500" },
  spike: { label: "Spikes", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "text-yellow-500" },
};

type GroupBy = "type" | "status" | "priority" | "project" | "none";

export default function TasksPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const canViewAllTasks = hasOrgRole('manager');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  // Members default to "my" view; managers+ can switch to "all"
  const [viewMode, setViewMode] = useState<"my" | "all">(canViewAllTasks ? "my" : "my");
  const [groupBy, setGroupBy] = useState<GroupBy>("type");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (projectFilter !== "all") params.projectId = projectFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const [tasksRes, projRes, empRes] = await Promise.all([
        viewMode === "my" ? taskApi.getMyTasks() : taskApi.getAll(params),
        projectApi.getAll(),
        hrApi.getEmployees().catch(() => ({ data: [] })),
      ]);

      let taskList = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      setProjects(Array.isArray(projRes.data) ? projRes.data : []);
      const map = new Map<string, Employee>();
      (Array.isArray(empRes.data) ? empRes.data : []).forEach((emp: Employee) => {
        if (emp.userId) map.set(emp.userId, emp);
        map.set(emp._id, emp);
      });
      setEmployeeMap(map);

      if (viewMode === "my") {
        if (statusFilter !== "all") taskList = taskList.filter((t) => t.status === statusFilter);
        if (projectFilter !== "all") taskList = taskList.filter((t) => t.projectId === projectFilter);
      }

      setTasks(taskList);
    } catch (err: any) {
      toast.error(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [viewMode, statusFilter, projectFilter]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchTasks();
  }, [user, fetchTasks]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;
  }

  // Apply client-side filters
  let filtered = tasks;
  if (search) filtered = filtered.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
  if (typeFilter !== "all") filtered = filtered.filter((t) => t.type === typeFilter);
  if (priorityFilter !== "all") filtered = filtered.filter((t) => t.priority === priorityFilter);

  // Group tasks
  const groupTasks = (tasks: Task[]): Record<string, Task[]> => {
    if (groupBy === "none") return { "All Items": tasks };
    const groups: Record<string, Task[]> = {};
    for (const t of tasks) {
      let key = "";
      if (groupBy === "type") key = t.type;
      else if (groupBy === "status") key = t.status;
      else if (groupBy === "priority") key = t.priority;
      else if (groupBy === "project") key = t.projectId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  };

  const grouped = groupTasks(filtered);
  const projectName = (id: string) => projects.find((p) => p._id === id)?.projectName || "Unknown";

  const getGroupLabel = (key: string) => {
    if (groupBy === "type") return typeConfig[key]?.label || key;
    if (groupBy === "status") return statusConfig[key]?.label || key;
    if (groupBy === "priority") return key.charAt(0).toUpperCase() + key.slice(1);
    if (groupBy === "project") return projectName(key);
    return key;
  };

  const getGroupIcon = (key: string) => {
    if (groupBy === "type") {
      const tc = typeConfig[key];
      return tc ? <svg className={`w-4 h-4 ${tc.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tc.icon} /></svg> : null;
    }
    if (groupBy === "status") {
      const sc = statusConfig[key];
      return sc ? <div className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} /> : null;
    }
    if (groupBy === "priority") {
      const pc = priorityColors[key];
      return <div className={`w-2.5 h-2.5 rounded-full ${key === "critical" ? "bg-red-500" : key === "high" ? "bg-orange-500" : key === "medium" ? "bg-blue-500" : "bg-gray-400"}`} />;
    }
    return null;
  };

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  // Sort order for groups
  const groupOrder = Object.keys(grouped).sort((a, b) => {
    if (groupBy === "type") {
      const order = ["epic", "story", "task", "bug", "improvement", "spike", "sub_task"];
      return order.indexOf(a) - order.indexOf(b);
    }
    if (groupBy === "status") {
      const order = ["in_progress", "todo", "in_review", "blocked", "backlog", "done", "cancelled"];
      return order.indexOf(a) - order.indexOf(b);
    }
    if (groupBy === "priority") {
      const order = ["critical", "high", "medium", "low", "trivial"];
      return order.indexOf(a) - order.indexOf(b);
    }
    return a.localeCompare(b);
  });

  return (
    <RouteGuard minOrgRole="member">
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Tasks</h1>
            <p className="text-[13px] text-[#94A3B8] mt-1">Track and manage work items across projects</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.total}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Total Tasks</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.inProgress}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">In Progress</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.blocked}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Blocked</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.done}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* View mode */}
              <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1">
                <button onClick={() => setViewMode("my")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "my" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>My Tasks</button>
                {canViewAllTasks && (
                  <button onClick={() => setViewMode("all")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "all" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>All Tasks</button>
                )}
              </div>

              <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="pl-10 h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg" />
              </div>

              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]">
                <option value="all">All Projects</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.projectName}</option>)}
              </select>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]">
                <option value="all">All Status</option>
                {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>

              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]">
                <option value="all">All Types</option>
                {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>

              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]">
                <option value="all">All Priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] font-medium text-[#94A3B8] uppercase">Group by</span>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#475569]">
                  <option value="type">Type</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="project">Project</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <h3 className="text-sm font-semibold text-[#334155] mb-1">No tasks found</h3>
              <p className="text-[13px] text-[#94A3B8]">
                {viewMode === "my" ? "You have no assigned tasks" : "No tasks match your filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupOrder.filter((k) => grouped[k]?.length > 0).map((groupKey) => {
              const groupTasks = grouped[groupKey];
              const totalPts = groupTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

              return (
                <div key={groupKey}>
                  {/* Group header */}
                  <div className="flex items-center gap-2.5 mb-3 px-1">
                    {getGroupIcon(groupKey)}
                    <h3 className="text-[13px] font-semibold text-[#0F172A]">{getGroupLabel(groupKey)}</h3>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">{groupTasks.length}</span>
                    {totalPts > 0 && <span className="text-[10px] font-medium text-[#94A3B8]">{totalPts} pts</span>}
                  </div>

                  {/* Task rows */}
                  <Card className="border-0 shadow-sm overflow-hidden">
                    {groupTasks.map((task, i) => {
                      const tc = typeConfig[task.type] || typeConfig.task;
                      const sc = statusConfig[task.status] || statusConfig.backlog;
                      return (
                        <div
                          key={task._id}
                          onClick={() => router.push(`/projects/${task.projectId}/items/${task._id}`)}
                          className={`flex items-center gap-4 px-4 py-3 hover:bg-[#F8FAFC] cursor-pointer transition-colors ${i < groupTasks.length - 1 ? "border-b border-[#F1F5F9]" : ""}`}
                        >
                          {/* Type icon */}
                          <svg className={`w-4 h-4 shrink-0 ${tc.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tc.icon} /></svg>

                          {/* Title */}
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <p className="text-[13px] font-medium text-[#0F172A] truncate">{task.title}</p>
                            {(task.recurrence?.enabled || task.isRecurringInstance) && (
                              <span title={task.isRecurringInstance ? "Recurring instance" : "Recurring task"} className="shrink-0">
                                <svg className="w-3.5 h-3.5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              </span>
                            )}
                          </div>

                          {/* Project */}
                          {groupBy !== "project" && (
                            <span className="text-[10px] font-medium text-[#94A3B8] truncate max-w-[120px]">{projectName(task.projectId)}</span>
                          )}

                          {/* Status */}
                          {groupBy !== "status" && (
                            <span className="flex items-center gap-1.5 shrink-0">
                              <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              <span className="text-[10px] font-medium text-[#64748B]">{sc.label}</span>
                            </span>
                          )}

                          {/* Points */}
                          {task.storyPoints != null && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">{task.storyPoints}</span>
                          )}

                          {/* Priority */}
                          {groupBy !== "priority" && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${priorityColors[task.priority]}`}>
                              {task.priority.toUpperCase()}
                            </span>
                          )}

                          {/* Assignee */}
                          {task.assigneeId ? (() => {
                            const emp = employeeMap.get(task.assigneeId);
                            const initial = emp ? `${emp.firstName} ${emp.lastName}`.charAt(0).toUpperCase() : "?";
                            const title = emp ? `${emp.firstName} ${emp.lastName}` : task.assigneeId;
                            return (
                              <div className="w-6 h-6 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[9px] font-bold shrink-0" title={title}>{initial}</div>
                            );
                          })() : (
                            <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
    </RouteGuard>
  );
}
