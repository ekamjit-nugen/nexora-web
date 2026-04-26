"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, hrApi, sprintApi, Project, Task, Employee, Sprint } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import GanttChart, { GanttItem } from "@/components/projects/GanttChart";

// ── Helpers ──

function computeProgress(task: Task): number {
  if (task.status === "done") return 100;
  if (task.status === "cancelled") return 0;
  if (task.status === "in_review") return 80;
  if (task.status === "in_progress") return 50;
  if (task.status === "todo") return 10;
  return 0; // backlog, blocked
}

function buildGanttHierarchy(
  tasks: Task[],
  employees: Employee[],
  projectStartDate?: Date,
): GanttItem[] {
  const empMap = new Map<string, string>();
  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`.trim();
    if (emp.userId) empMap.set(emp.userId, name);
    empMap.set(emp._id, name);
  }

  const taskMap = new Map<string, Task>();
  for (const t of tasks) taskMap.set(t._id, t);

  // Find root tasks (no parent or parent not in the set)
  const childrenOf = new Map<string, Task[]>();
  const roots: Task[] = [];

  for (const t of tasks) {
    if (t.parentTaskId && taskMap.has(t.parentTaskId)) {
      const siblings = childrenOf.get(t.parentTaskId) || [];
      siblings.push(t);
      childrenOf.set(t.parentTaskId, siblings);
    } else {
      roots.push(t);
    }
  }

  const now = new Date();
  const fallbackStart = projectStartDate || new Date(now.getTime() - 7 * 86400000);

  function toGanttItem(task: Task, level: number): GanttItem {
    const children = childrenOf.get(task._id) || [];
    const childItems = children.map((c) => toGanttItem(c, level + 1));

    // Determine dates
    let startDate: Date;
    let endDate: Date;

    if (task.createdAt) {
      startDate = new Date(task.createdAt);
    } else {
      startDate = fallbackStart;
    }

    if (task.dueDate) {
      endDate = new Date(task.dueDate);
    } else if (task.completedAt) {
      endDate = new Date(task.completedAt);
    } else {
      // Default: start + 7 days
      endDate = new Date(startDate.getTime() + 7 * 86400000);
    }

    // If children exist, expand parent range to encompass children
    if (childItems.length > 0) {
      const childStart = Math.min(...childItems.map((c) => c.startDate.getTime()));
      const childEnd = Math.max(...childItems.map((c) => c.endDate.getTime()));
      if (childStart < startDate.getTime()) startDate = new Date(childStart);
      if (childEnd > endDate.getTime()) endDate = new Date(childEnd);
    }

    // Ensure end >= start
    if (endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate.getTime() + 86400000);
    }

    const deps = (task.dependencies || [])
      .filter((d) => d.type === "blocked_by")
      .map((d) => d.itemId);

    return {
      id: task._id,
      title: task.title,
      taskKey: task.taskKey,
      type: task.type as GanttItem["type"],
      startDate,
      endDate,
      status: task.status,
      progress: computeProgress(task),
      assignee: task.assigneeId,
      assigneeName: task.assigneeId ? empMap.get(task.assigneeId) : undefined,
      priority: task.priority,
      dependencies: deps.length > 0 ? deps : undefined,
      children: childItems.length > 0 ? childItems : undefined,
      level,
      parentId: task.parentTaskId || undefined,
    };
  }

  // Sort: epics first, then stories, then tasks, then by due date
  const typeOrder: Record<string, number> = { epic: 0, story: 1, task: 2, bug: 3, improvement: 4, spike: 5, sub_task: 6 };
  roots.sort((a, b) => {
    const ta = typeOrder[a.type] ?? 9;
    const tb = typeOrder[b.type] ?? 9;
    if (ta !== tb) return ta - tb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });

  return roots.map((t) => toGanttItem(t, 0));
}

// ── Page ──

export default function TimelinePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes, empRes, sprintsRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getAll({ projectId, limit: "500" } as any),
        hrApi.getEmployees().catch(() => ({ data: [] })),
        sprintApi.getByProject(projectId).catch(() => ({ data: [] })),
      ]);
      setProject(projRes.data || null);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load timeline data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (typeFilter !== "all") result = result.filter((t) => t.type === typeFilter);
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        result = result.filter((t) => !t.assigneeId);
      } else {
        result = result.filter((t) => t.assigneeId === assigneeFilter);
      }
    }
    return result;
  }, [tasks, statusFilter, typeFilter, assigneeFilter]);

  // Build gantt items
  const ganttItems = useMemo(() => {
    const projectStart = project?.startDate ? new Date(project.startDate) : undefined;
    return buildGanttHierarchy(filteredTasks, employees, projectStart);
  }, [filteredTasks, employees, project]);

  // Build milestones
  const ganttMilestones = useMemo(() => {
    if (!project?.milestones) return [];
    return project.milestones.map((m: any) => ({
      id: m._id || m.name,
      name: m.name,
      targetDate: new Date(m.targetDate),
      status: m.status,
    }));
  }, [project]);

  // Unique assignees for filter
  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach((t) => { if (t.assigneeId) ids.add(t.assigneeId); });
    return Array.from(ids).map((id) => {
      const emp = employees.find((e) => e.userId === id || e._id === id);
      return { id, name: emp ? `${emp.firstName} ${emp.lastName}`.trim() : id };
    });
  }, [tasks, employees]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0F172A]">
                  {project?.projectName || "Project"} - Timeline
                </h1>
                {project?.projectKey && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">
                    {project.projectKey}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#94A3B8] mt-0.5">
                Gantt chart view of all project tasks and milestones
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/projects/${projectId}`)}
            variant="outline"
            className="h-9 text-[12px] gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            Board View
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[11px] text-[#475569]"
            >
              <option value="all">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[11px] text-[#475569]"
            >
              <option value="all">All Types</option>
              <option value="epic">Epic</option>
              <option value="story">Story</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="sub_task">Subtask</option>
              <option value="improvement">Improvement</option>
              <option value="spike">Spike</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[11px] text-[#475569]"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <div className="flex-1" />
            <span className="text-[11px] text-[#94A3B8]">
              {filteredTasks.length} of {tasks.length} tasks
            </span>
          </CardContent>
        </Card>

        {/* Chart */}
        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {/* Skeleton loader */}
              <div className="animate-pulse">
                <div className="h-10 bg-[#F1F5F9] border-b border-[#E2E8F0]" />
                <div className="flex">
                  <div className="w-[280px] border-r border-[#E2E8F0] p-3 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-[#E2E8F0]" />
                        <div className="h-3 bg-[#E2E8F0] rounded flex-1" />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-3 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div style={{ width: 60 + Math.random() * 200 }} className="h-5 bg-[#E2E8F0] rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-[#334155] mb-1">No tasks to display</h3>
              <p className="text-[13px] text-[#94A3B8]">
                {tasks.length > 0
                  ? "Try adjusting your filters to see tasks on the timeline."
                  : "Create tasks with dates to see them on the Gantt chart."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <GanttChart
            items={ganttItems}
            projectId={projectId}
            projectStartDate={project?.startDate ? new Date(project.startDate) : undefined}
            projectEndDate={project?.endDate ? new Date(project.endDate) : undefined}
            milestones={ganttMilestones}
          />
        )}
      </main>
    </div>
  );
}
