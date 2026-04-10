"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, Project, Task } from "@/lib/api";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_WIDTH = 40;
const ROW_HEIGHT = 48;
const BAR_HEIGHT = 32;
const HEADER_HEIGHT = 60;

const statusColors: Record<string, string> = {
  backlog: "#94A3B8",
  todo: "#94A3B8",
  in_progress: "#3B82F6",
  in_review: "#F59E0B",
  done: "#10B981",
  blocked: "#EF4444",
  cancelled: "#64748B",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const statusColor = (s?: string) => statusColors[s || "todo"] || "#94A3B8";

// Derive progress from status (no explicit progress field on Task)
function computeProgress(task: Task): number {
  if (task.status === "done") return 100;
  if (task.status === "cancelled") return 0;
  if (task.status === "in_review") return 80;
  if (task.status === "in_progress") return 50;
  if (task.status === "todo") return 10;
  return 0;
}

// Task has `dueDate` but no `startDate`. We fall back to createdAt or
// (dueDate - estimatedHours in days) so tasks still render on the timeline.
function getTaskStart(task: Task): Date | null {
  const anyTask = task as Task & { startDate?: string };
  if (anyTask.startDate) return new Date(anyTask.startDate);
  if (task.createdAt && task.dueDate) {
    const created = new Date(task.createdAt);
    const due = new Date(task.dueDate);
    // Clamp start to at most 30 days before due to keep timeline tight.
    const maxSpan = 30 * 86400000;
    if (due.getTime() - created.getTime() > maxSpan) {
      return new Date(due.getTime() - maxSpan);
    }
    return created;
  }
  if (task.dueDate) {
    const hours = task.estimatedHours || 8;
    const days = Math.max(1, Math.ceil(hours / 8));
    const due = new Date(task.dueDate);
    return new Date(due.getTime() - days * 86400000);
  }
  return null;
}

function getTaskEnd(task: Task): Date | null {
  if (task.dueDate) return new Date(task.dueDate);
  return null;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatMonth(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProjectGanttPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const { user, logout } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);

  // Drag state for updating task dates
  const dragState = useRef<{
    taskId: string;
    mode: "move" | "resize-start" | "resize-end";
    originX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ taskId: string; deltaDays: number; mode: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projRes, tasksRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getAll({ projectId, limit: "500" }),
      ]);
      setProject(projRes.data as Project);
      setTasks(Array.isArray(tasksRes.data) ? (tasksRes.data as Task[]) : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load project";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter only tasks that have some date info we can render
  const visibleTasks = useMemo(
    () => tasks.filter((t) => getTaskEnd(t) !== null),
    [tasks],
  );

  // Compute timeline range
  const { startDate, endDate, days } = useMemo(() => {
    const dates: Date[] = [];
    for (const t of visibleTasks) {
      const s = getTaskStart(t);
      const e = getTaskEnd(t);
      if (s) dates.push(s);
      if (e) dates.push(e);
    }
    if (dates.length === 0) {
      const today = startOfDay(new Date());
      const end = new Date(today.getTime() + 30 * 86400000);
      return { startDate: today, endDate: end, days: 30 };
    }
    const minTs = Math.min(...dates.map((d) => d.getTime()));
    const maxTs = Math.max(...dates.map((d) => d.getTime()));
    const min = startOfDay(new Date(minTs));
    const max = startOfDay(new Date(maxTs));
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 3);
    const dayCount = Math.max(
      14,
      Math.ceil((max.getTime() - min.getTime()) / 86400000),
    );
    return { startDate: min, endDate: max, days: dayCount };
  }, [visibleTasks]);

  const dayToX = useCallback(
    (date: Date) => {
      const diff = (date.getTime() - startDate.getTime()) / 86400000;
      return diff * DAY_WIDTH;
    },
    [startDate],
  );

  const taskPosition = useCallback(
    (task: Task) => {
      const start = getTaskStart(task);
      const end = getTaskEnd(task);
      if (!start || !end) return null;
      const x = dayToX(start);
      const width = Math.max(20, dayToX(end) - x + DAY_WIDTH);
      return { x, width };
    },
    [dayToX],
  );

  // Build month span headers
  const monthSpans = useMemo(() => {
    const spans: Array<{ label: string; width: number }> = [];
    let cursor = new Date(startDate);
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      if (i === 0 || d.getDate() === 1) {
        spans.push({ label: formatMonth(d), width: DAY_WIDTH });
        cursor = d;
      } else {
        spans[spans.length - 1].width += DAY_WIDTH;
      }
    }
    return spans;
  }, [startDate, days]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleBarMouseDown = (
    e: React.MouseEvent,
    task: Task,
    mode: "move" | "resize-start" | "resize-end",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const start = getTaskStart(task);
    const end = getTaskEnd(task);
    if (!start || !end) return;
    dragState.current = {
      taskId: task._id,
      mode,
      originX: e.clientX,
      origStart: start,
      origEnd: end,
    };
    setDragPreview({ taskId: task._id, deltaDays: 0, mode });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.originX;
      const deltaDays = Math.round(dx / DAY_WIDTH);
      setDragPreview({
        taskId: dragState.current.taskId,
        deltaDays,
        mode: dragState.current.mode,
      });
    };
    const handleUp = async () => {
      const state = dragState.current;
      const preview = dragPreview;
      dragState.current = null;
      if (!state || !preview || preview.deltaDays === 0) {
        setDragPreview(null);
        return;
      }
      const task = tasks.find((t) => t._id === state.taskId);
      if (!task) {
        setDragPreview(null);
        return;
      }
      const deltaMs = preview.deltaDays * 86400000;
      let newStart = new Date(state.origStart);
      let newEnd = new Date(state.origEnd);
      if (state.mode === "move") {
        newStart = new Date(state.origStart.getTime() + deltaMs);
        newEnd = new Date(state.origEnd.getTime() + deltaMs);
      } else if (state.mode === "resize-start") {
        newStart = new Date(state.origStart.getTime() + deltaMs);
        if (newStart >= newEnd) newStart = new Date(newEnd.getTime() - 86400000);
      } else if (state.mode === "resize-end") {
        newEnd = new Date(state.origEnd.getTime() + deltaMs);
        if (newEnd <= newStart) newEnd = new Date(newStart.getTime() + 86400000);
      }
      setDragPreview(null);
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t._id === task._id
            ? ({ ...t, dueDate: newEnd.toISOString(), startDate: newStart.toISOString() } as Task)
            : t,
        ),
      );
      try {
        await taskApi.update(task._id, {
          dueDate: newEnd.toISOString(),
          // startDate is not on Task interface but backend may accept it
          ...( { startDate: newStart.toISOString() } as Partial<Task>),
        });
        toast.success("Task dates updated");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update task";
        toast.error(msg);
        fetchData();
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragPreview, tasks, fetchData]);

  // ── Export (CSV) ──────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = [["Task", "Status", "Start", "End", "Progress %"]];
    for (const t of visibleTasks) {
      const s = getTaskStart(t);
      const e = getTaskEnd(t);
      rows.push([
        (t.title || "").replace(/"/g, '""'),
        statusLabels[t.status] || t.status,
        s ? s.toISOString().slice(0, 10) : "",
        e ? e.toISOString().slice(0, 10) : "",
        String(computeProgress(t)),
      ]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.projectName || "project"}-gantt.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 ml-[260px] flex items-center justify-center">
          <div className="text-[#64748B] text-sm">Loading Gantt chart…</div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 ml-[260px] flex items-center justify-center">
          <div className="text-[#64748B] text-sm">Project not found</div>
        </main>
      </div>
    );
  }

  const todayX = (() => {
    const today = startOfDay(new Date());
    if (today < startDate || today > endDate) return null;
    return dayToX(today);
  })();

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#64748B]"
              aria-label="Back to project"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">
                {project.projectKey}
              </div>
              <h1 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                {project.projectName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View switcher */}
            <div className="flex gap-0.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-1">
              {[
                { key: "board", label: "Board", href: `/projects/${projectId}` },
                { key: "list", label: "List", href: `/projects/${projectId}/list` },
                { key: "gantt", label: "Gantt", href: `/projects/${projectId}/gantt`, active: true },
                { key: "calendar", label: "Calendar", href: `/projects/${projectId}` },
              ].map((v) => (
                <button
                  key={v.key}
                  onClick={() => router.push(v.href)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    v.active
                      ? "bg-white text-[#2E86C1] shadow-sm border border-[#E2E8F0]"
                      : "text-[#64748B] hover:text-[#334155] hover:bg-white/60"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Gantt body */}
        {visibleTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h12M3 12h16M3 16h8M3 20h14" />
                </svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[#0F172A] mb-1">No scheduled tasks</h3>
              <p className="text-[13px] text-[#64748B]">
                Add due dates to your tasks to see them on the Gantt chart.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar: task names */}
            <div className="w-[280px] border-r border-[#E2E8F0] bg-white overflow-y-auto shrink-0">
              <div
                className="border-b border-[#E2E8F0] sticky top-0 bg-[#F8FAFC] flex items-center px-4 font-semibold text-[13px] text-[#475569] z-10"
                style={{ height: HEADER_HEIGHT }}
              >
                <div className="flex-1">Task</div>
                <div className="w-20 text-right">Status</div>
              </div>
              {visibleTasks.map((task) => (
                <div
                  key={task._id}
                  className="border-b border-[#F1F5F9] flex items-center px-4 gap-2 hover:bg-[#F8FAFC] cursor-pointer"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0F172A] truncate">
                      {task.taskKey ? (
                        <span className="text-[11px] text-[#94A3B8] font-mono mr-1.5">
                          {task.taskKey}
                        </span>
                      ) : null}
                      {task.title}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      {task.assigneeId ? `Assigned` : "Unassigned"}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: statusColor(task.status) + "20",
                      color: statusColor(task.status),
                    }}
                  >
                    {statusLabels[task.status] || task.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Right: Gantt chart */}
            <div className="flex-1 overflow-auto relative" ref={chartRef}>
              <div style={{ width: days * DAY_WIDTH, minWidth: "100%" }}>
                {/* Time axis */}
                <div
                  className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] z-20"
                  style={{ width: days * DAY_WIDTH }}
                >
                  {/* Month headers */}
                  <div className="flex h-[30px] border-b border-[#E2E8F0]">
                    {monthSpans.map((span, i) => (
                      <div
                        key={i}
                        className="text-[11px] font-semibold text-[#475569] flex items-center px-2 border-r border-[#E2E8F0]"
                        style={{ width: span.width, minWidth: span.width }}
                      >
                        {span.label}
                      </div>
                    ))}
                  </div>
                  {/* Day headers */}
                  <div className="flex h-[30px]">
                    {Array.from({ length: days }).map((_, i) => {
                      const d = new Date(startDate);
                      d.setDate(d.getDate() + i);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday =
                        d.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={i}
                          className={`text-[10px] flex flex-col items-center justify-center border-r border-[#F1F5F9] ${
                            isWeekend ? "bg-[#F1F5F9]" : ""
                          } ${isToday ? "bg-red-50 text-red-600 font-bold" : "text-[#64748B]"}`}
                          style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                        >
                          <span className="text-[9px] leading-none">
                            {d.toLocaleString("en-US", { weekday: "narrow" })}
                          </span>
                          <span className="leading-none">{d.getDate()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Task bars area */}
                <div
                  className="relative"
                  style={{
                    width: days * DAY_WIDTH,
                    height: visibleTasks.length * ROW_HEIGHT,
                  }}
                >
                  {/* Weekend columns */}
                  {Array.from({ length: days }).map((_, i) => {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    if (!isWeekend) return null;
                    return (
                      <div
                        key={`we-${i}`}
                        className="absolute top-0 bottom-0 bg-[#F8FAFC]"
                        style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                      />
                    );
                  })}

                  {/* Row separators */}
                  {visibleTasks.map((_, idx) => (
                    <div
                      key={`row-${idx}`}
                      className="absolute left-0 right-0 border-b border-[#F1F5F9]"
                      style={{ top: (idx + 1) * ROW_HEIGHT - 1, height: 1 }}
                    />
                  ))}

                  {/* Today line */}
                  {todayX !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                      style={{ left: todayX }}
                    >
                      <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}

                  {/* Dependency arrows (SVG) */}
                  <svg
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{
                      width: days * DAY_WIDTH,
                      height: visibleTasks.length * ROW_HEIGHT,
                    }}
                  >
                    <defs>
                      <marker
                        id="gantt-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 z" fill="#64748B" />
                      </marker>
                    </defs>
                    {visibleTasks.flatMap((task, idx) => {
                      const deps = task.dependencies || [];
                      if (!Array.isArray(deps) || deps.length === 0) return [];
                      return deps
                        .map((dep) => {
                          const depId = dep?.itemId;
                          if (!depId) return null;
                          const depIdx = visibleTasks.findIndex(
                            (t) => t._id === depId,
                          );
                          if (depIdx < 0) return null;
                          const depTask = visibleTasks[depIdx];
                          const depPos = taskPosition(depTask);
                          const curPos = taskPosition(task);
                          if (!depPos || !curPos) return null;
                          const x1 = depPos.x + depPos.width;
                          const y1 = depIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                          const x2 = curPos.x;
                          const y2 = idx * ROW_HEIGHT + ROW_HEIGHT / 2;
                          return (
                            <path
                              key={`${task._id}-${depId}`}
                              d={`M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${y2} L ${x2} ${y2}`}
                              fill="none"
                              stroke="#64748B"
                              strokeWidth="1.5"
                              markerEnd="url(#gantt-arrow)"
                              strokeDasharray="4,2"
                            />
                          );
                        })
                        .filter(Boolean);
                    })}
                  </svg>

                  {/* Task bars */}
                  {visibleTasks.map((task, idx) => {
                    const pos = taskPosition(task);
                    if (!pos) return null;
                    const color = statusColor(task.status);
                    const progress = computeProgress(task);
                    const isMilestone = task.type === "epic";
                    const isDragging = dragPreview?.taskId === task._id;
                    const deltaPx = isDragging
                      ? (dragPreview?.deltaDays || 0) * DAY_WIDTH
                      : 0;

                    let left = pos.x;
                    let width = pos.width;
                    if (isDragging && dragPreview) {
                      if (dragPreview.mode === "move") {
                        left = pos.x + deltaPx;
                      } else if (dragPreview.mode === "resize-start") {
                        left = pos.x + deltaPx;
                        width = Math.max(20, pos.width - deltaPx);
                      } else if (dragPreview.mode === "resize-end") {
                        width = Math.max(20, pos.width + deltaPx);
                      }
                    }

                    if (isMilestone) {
                      // Diamond marker at end date
                      const cx = pos.x + pos.width - DAY_WIDTH / 2;
                      const cy = idx * ROW_HEIGHT + ROW_HEIGHT / 2;
                      return (
                        <div
                          key={task._id}
                          className="absolute cursor-pointer group z-10"
                          style={{
                            left: cx - 10,
                            top: cy - 10,
                            width: 20,
                            height: 20,
                          }}
                          onClick={() => setSelectedTask(task)}
                        >
                          <div
                            className="w-full h-full rotate-45 rounded-sm border-2 border-white shadow"
                            style={{ backgroundColor: color }}
                          />
                          <div className="absolute hidden group-hover:block bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-[11px] rounded px-2 py-1 whitespace-nowrap z-30">
                            {task.title}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={task._id}
                        className="absolute rounded-md cursor-pointer hover:shadow-md transition-shadow group z-10"
                        style={{
                          top: idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2,
                          left,
                          width,
                          height: BAR_HEIGHT,
                          backgroundColor: color + "33",
                          border: `1px solid ${color}`,
                        }}
                        onMouseDown={(e) => handleBarMouseDown(e, task, "move")}
                        onClick={(e) => {
                          // Only open if we didn't drag
                          if (dragPreview && dragPreview.deltaDays !== 0) return;
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        onDoubleClick={() =>
                          router.push(`/projects/${projectId}/items/${task._id}`)
                        }
                      >
                        {/* Resize handles */}
                        <div
                          className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize opacity-0 group-hover:opacity-100"
                          style={{ backgroundColor: color }}
                          onMouseDown={(e) =>
                            handleBarMouseDown(e, task, "resize-start")
                          }
                        />
                        <div
                          className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize opacity-0 group-hover:opacity-100"
                          style={{ backgroundColor: color }}
                          onMouseDown={(e) =>
                            handleBarMouseDown(e, task, "resize-end")
                          }
                        />

                        {/* Progress fill */}
                        <div
                          className="absolute top-0 left-0 h-full rounded-l-md pointer-events-none"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: color + "99",
                          }}
                        />

                        {/* Task title */}
                        <div className="absolute inset-0 px-2 flex items-center text-[11px] font-semibold text-[#0F172A] truncate pointer-events-none">
                          {task.title}
                        </div>

                        {/* Tooltip */}
                        <div className="absolute hidden group-hover:block bottom-full mb-1 left-0 bg-[#0F172A] text-white text-[11px] rounded px-2 py-1.5 whitespace-nowrap z-30 shadow-lg">
                          <div className="font-semibold">{task.title}</div>
                          <div className="text-[#CBD5E1]">
                            {getTaskStart(task)?.toLocaleDateString()} →{" "}
                            {getTaskEnd(task)?.toLocaleDateString()}
                          </div>
                          <div className="text-[#CBD5E1]">
                            {statusLabels[task.status] || task.status} ·{" "}
                            {progress}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task detail modal */}
        {selectedTask && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTask(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  {selectedTask.taskKey && (
                    <div className="text-[11px] text-[#94A3B8] font-mono mb-1">
                      {selectedTask.taskKey}
                    </div>
                  )}
                  <h3 className="text-[16px] font-bold text-[#0F172A]">
                    {selectedTask.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#64748B]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Status</span>
                  <span
                    className="font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: statusColor(selectedTask.status) + "20",
                      color: statusColor(selectedTask.status),
                    }}
                  >
                    {statusLabels[selectedTask.status] || selectedTask.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Start</span>
                  <span className="text-[#0F172A] font-medium">
                    {getTaskStart(selectedTask)?.toLocaleDateString() || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Due</span>
                  <span className="text-[#0F172A] font-medium">
                    {getTaskEnd(selectedTask)?.toLocaleDateString() || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Progress</span>
                  <span className="text-[#0F172A] font-medium">
                    {computeProgress(selectedTask)}%
                  </span>
                </div>
                {selectedTask.priority && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Priority</span>
                    <span className="text-[#0F172A] font-medium capitalize">
                      {selectedTask.priority}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() =>
                  router.push(`/projects/${projectId}/items/${selectedTask._id}`)
                }
                className="mt-4 w-full bg-[#2E86C1] hover:bg-[#2574A9] text-white text-[13px] font-medium rounded-lg py-2"
              >
                Open Task
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
