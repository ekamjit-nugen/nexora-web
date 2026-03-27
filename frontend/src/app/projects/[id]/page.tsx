"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, boardApi, sprintApi, hrApi, Project, Task, Board, Sprint, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Constants ──

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
  trivial: "bg-[#F8FAFC] text-gray-500",
};

const typeIcons: Record<string, { icon: string; color: string }> = {
  epic: { icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-purple-500" },
  story: { icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "text-green-500" },
  task: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-blue-500" },
  bug: { icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "text-red-500" },
  sub_task: { icon: "M4 6h16M4 12h8m-8 6h16", color: "text-gray-500" },
  improvement: { icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-teal-500" },
  spike: { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "text-yellow-500" },
};

// ── Task Card ──

function TaskCard({
  task,
  projectId,
  employees,
  draggable,
  onDragStart,
  parentTask,
  childCount,
}: {
  task: Task;
  projectId: string;
  employees?: Array<{ _id: string; userId?: string; firstName: string; lastName: string; avatar?: string }>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  parentTask?: Task | null;
  childCount?: number;
}) {
  const router = useRouter();
  const typeInfo = typeIcons[task.type] || typeIcons.task;
  const assignee = employees?.find((e) => (e.userId || e._id) === task.assigneeId);

  return (
    <div
      className="bg-white rounded-lg border border-[#E2E8F0] p-3 cursor-pointer hover:shadow-md hover:border-[#CBD5E1] transition-all group"
      onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
    >
      {/* Parent breadcrumb */}
      {parentTask && (
        <div className="flex items-center gap-1 mb-1">
          <svg className={`w-2.5 h-2.5 ${(typeIcons[parentTask.type] || typeIcons.task).color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={(typeIcons[parentTask.type] || typeIcons.task).icon} />
          </svg>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/projects/${projectId}/items/${parentTask._id}`); }}
            className="text-[9px] text-[#94A3B8] hover:text-[#2E86C1] hover:underline truncate transition-colors"
          >
            {parentTask.taskKey || parentTask.title}
          </button>
        </div>
      )}

      {/* Task key */}
      {task.taskKey && (
        <p className="text-[10px] font-mono font-medium text-[#94A3B8] mb-1.5">{task.taskKey}</p>
      )}

      <div className="flex items-start gap-1.5 mb-2">
        <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${typeInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={typeInfo.icon} />
        </svg>
        <span className="text-[13px] font-medium text-[#0F172A] line-clamp-2 leading-snug">{task.title}</span>
      </div>

      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">{label}</span>
          ))}
          {task.labels.length > 3 && <span className="text-[9px] text-[#94A3B8]">+{task.labels.length - 3}</span>}
        </div>
      )}

      {childCount != null && childCount > 0 && (
        <div className="flex items-center gap-1 mt-1.5 text-[9px] text-[#64748B]">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          {childCount} sub-item{childCount !== 1 ? "s" : ""}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-1.5">
          {task.priority && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>
              {task.priority.toUpperCase()}
            </span>
          )}
          {task.storyPoints != null && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {task.storyPoints}
            </span>
          )}
        </div>
        {assignee ? (
          <div className="relative group/avatar">
            {assignee.avatar ? (
              <img src={assignee.avatar} alt={`${assignee.firstName} ${assignee.lastName}`} className="w-6 h-6 rounded-full object-cover border border-[#E2E8F0]" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[9px] font-bold">
                {assignee.firstName?.charAt(0)}{assignee.lastName?.charAt(0)}
              </div>
            )}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#0F172A] text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-10">
              {assignee.firstName} {assignee.lastName}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#0F172A]" />
            </div>
          </div>
        ) : task.assigneeId ? (
          <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Board View ──

function BoardView({
  tasks,
  board,
  projectId,
  projectKey,
  employees,
  onRefresh,
  parentMap,
  childrenMap,
  methodology,
}: {
  tasks: Task[];
  board: Board | null;
  projectId: string;
  projectKey?: string;
  employees: Employee[];
  onRefresh: () => void;
  parentMap: Map<string, Task>;
  childrenMap: Map<string, Task[]>;
  methodology?: string;
}) {
  const router = useRouter();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({});
  const [quickAddSaving, setQuickAddSaving] = useState<string | null>(null);

  const handleQuickAdd = async (column: any) => {
    const colKey = column._id || column.key;
    const title = (quickAdd[colKey] || "").trim();
    if (!title) return;
    setQuickAddSaving(colKey);
    try {
      await taskApi.create({
        title,
        projectId,
        projectKey,
        type: "task",
        priority: "medium",
        status: (column.statusMapping || column.key) as Task["status"],
        boardId: board?._id || undefined,
        columnId: (column._id || column.id) || undefined,
      } as any);
      setQuickAdd((prev) => ({ ...prev, [colKey]: "" }));
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create item");
    } finally {
      setQuickAddSaving(null);
    }
  };

  const columns = board?.columns?.sort((a, b) => a.order - b.order) || [
    { name: "Backlog", key: "backlog", order: 0 },
    { name: "To Do", key: "todo", order: 1 },
    { name: "In Progress", key: "in_progress", order: 2 },
    { name: "In Review", key: "in_review", order: 3 },
    { name: "Done", key: "done", order: 4 },
  ];

  const getColumnTasks = (column: any) => {
    const statusKey = column.statusMapping || column.key;
    return tasks.filter((t) => {
      if (t.columnId && column._id) return t.columnId === column._id;
      if (t.columnId && column.id) return t.columnId === column.id;
      return t.status === statusKey;
    });
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, column: any) => {
    e.preventDefault();
    if (!draggedTask) return;

    const statusKey = column.statusMapping || column.key;
    const columnId = column._id || column.id;

    try {
      await taskApi.update(draggedTask._id, {
        status: statusKey as Task["status"],
        columnId: columnId || undefined,
      });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to move task");
    }
    setDraggedTask(null);
  };

  const isKanban = methodology === "kanban";
  const isScrum = methodology === "scrum" || methodology === "scrumban";

  return (
    <>
      {/* Methodology badge */}
      {methodology && (
        <div className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium ${
          isKanban ? "bg-teal-50 border-teal-200 text-teal-700" :
          isScrum ? "bg-violet-50 border-violet-200 text-violet-700" :
          "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]"
        }`}>
          {isKanban ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
              Kanban — Continuous flow. WIP limits help prevent bottlenecks.
            </>
          ) : isScrum ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {methodology === "scrumban" ? "Scrumban" : "Scrum"} — Sprint-based delivery. Use Planning view to assign items to sprints.
            </>
          ) : null}
        </div>
      )}
      <div className="flex gap-3 pb-4" style={{ minHeight: "calc(100vh - 360px)" }}>
        {columns.map((column) => {
          const colTasks = getColumnTasks(column);
          const isDoneCol = column.isDoneColumn || column.key === "done";
          const colPoints = colTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
          const wipExceeded = column.wipLimit && colTasks.length > column.wipLimit;
          const wipAtLimit = column.wipLimit && colTasks.length === column.wipLimit;

          return (
            <div
              key={column._id || column.key}
              className="flex-1 min-w-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column)}
            >
              <div className={`rounded-xl p-2.5 h-full border ${
                wipExceeded ? "bg-amber-50 border-amber-200" :
                isKanban && wipAtLimit ? "bg-orange-50 border-orange-200" :
                "bg-[#F1F5F9] border-[#E2E8F0]"
              }`}>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isDoneCol ? "bg-emerald-500" : column.key === "in_progress" ? "bg-amber-500" : column.key === "blocked" ? "bg-red-500" : column.key === "in_review" ? "bg-violet-500" : "bg-[#94A3B8]"}`} />
                    <h3 className="text-[12px] font-semibold text-[#334155] truncate">{column.name}</h3>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      wipExceeded ? "bg-amber-100 text-amber-700 border-amber-300" :
                      "bg-white text-[#64748B] border-[#E2E8F0]"
                    }`}>
                      {colTasks.length}{column.wipLimit ? `/${column.wipLimit}` : ""}
                    </span>
                    {colPoints > 0 && isScrum && (
                      <span className="text-[9px] font-medium text-[#94A3B8]">{colPoints}pt</span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/items/new?status=${column.statusMapping || column.key}&columnId=${column._id || column.id || ""}&boardId=${board?._id || ""}`)}
                    className="p-1 rounded-md hover:bg-white text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {wipExceeded && (
                  <div className="mb-2 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-300 px-2 py-1 rounded-md mx-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    WIP limit exceeded ({colTasks.length}/{column.wipLimit})
                  </div>
                )}

                <div className="space-y-2 px-0.5">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      projectId={projectId}
                      employees={employees}
                      draggable
                      onDragStart={handleDragStart}
                      parentTask={task.parentTaskId ? parentMap.get(task.parentTaskId) || null : null}
                      childCount={childrenMap.get(task._id)?.length || 0}
                    />
                  ))}
                </div>

                {colTasks.length === 0 && (
                  <div className="py-6 text-center text-[11px] text-[#94A3B8] border border-dashed border-[#CBD5E1] rounded-lg mx-0.5 mt-1">
                    Drop items here
                  </div>
                )}

                {/* Quick add */}
                <div className="mt-2 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={quickAdd[column._id || column.key] || ""}
                      onChange={(e) => setQuickAdd((prev) => ({ ...prev, [column._id || column.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(column); }}
                      placeholder="+ Add item..."
                      disabled={quickAddSaving === (column._id || column.key)}
                      className="flex-1 min-w-0 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#2E86C1] focus:border-[#2E86C1] transition-colors"
                    />
                    {(quickAdd[column._id || column.key] || "").trim() && (
                      <button
                        onClick={() => handleQuickAdd(column)}
                        disabled={quickAddSaving === (column._id || column.key)}
                        className="p-1.5 rounded-lg bg-[#2E86C1] text-white hover:bg-[#2471A3] transition-colors shrink-0 disabled:opacity-50"
                      >
                        {quickAddSaving === (column._id || column.key) ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </>
  );
}

// ── List View ──

function ListView({
  tasks,
  projectId,
  board,
  onRefresh,
  parentMap,
  childrenMap,
}: {
  tasks: Task[];
  projectId: string;
  board: Board | null;
  onRefresh: () => void;
  parentMap: Map<string, Task>;
  childrenMap: Map<string, Task[]>;
}) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<string>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const priorityOrder: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, trivial: 1 };

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "priority") cmp = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
    else if (sortBy === "title") cmp = a.title.localeCompare(b.title);
    else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
    else if (sortBy === "points") cmp = (a.storyPoints || 0) - (b.storyPoints || 0);
    else if (sortBy === "type") cmp = a.type.localeCompare(b.type);
    return sortDir === "desc" ? -cmp : cmp;
  });

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-700">
      {children}
      {sortBy === field && <span>{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
    </button>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px_80px_100px] gap-4 px-4 py-3 border-b border-gray-200 bg-[#F8FAFC]">
          <SortHeader field="title">Title</SortHeader>
          <SortHeader field="type">Type</SortHeader>
          <SortHeader field="status">Status</SortHeader>
          <SortHeader field="points">Points</SortHeader>
          <SortHeader field="priority">Priority</SortHeader>
        </div>
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No work items yet</div>
        ) : (
          sorted.map((task) => {
            const typeInfo = typeIcons[task.type] || typeIcons.task;
            return (
              <div
                key={task._id}
                onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
                className="grid grid-cols-[1fr_100px_100px_80px_100px] gap-4 px-4 py-3 border-b border-gray-100 hover:bg-[#F8FAFC] cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {task.parentTaskId && <span className="text-[9px] text-[#94A3B8] ml-4">{"\u21B3"}</span>}
                  <svg className={`w-4 h-4 shrink-0 ${typeInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={typeInfo.icon} />
                  </svg>
                  <span className="text-sm text-gray-900 truncate">{task.title}</span>
                  {(childrenMap.get(task._id)?.length || 0) > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                      {childrenMap.get(task._id)!.length} children
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 capitalize">{task.type.replace("_", " ")}</span>
                <span className="text-xs text-gray-500 capitalize">{task.status.replace(/_/g, " ")}</span>
                <span className="text-xs text-gray-500">{task.storyPoints ?? "—"}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded self-center w-fit ${priorityColors[task.priority]}`}>
                  {task.priority.toUpperCase()}
                </span>
              </div>
            );
          })
        )}
      </div>

    </>
  );
}

// ── Sprint Bar ──

const sprintStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  planning: { label: "Planning", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
};

function SprintBar({
  sprints,
  tasks,
  onStartSprint,
  onCompleteSprint,
  methodology,
  projectId,
}: {
  sprints: Sprint[];
  tasks: Task[];
  onStartSprint: (id: string) => void;
  onCompleteSprint: (id: string) => void;
  methodology?: string;
  projectId: string;
}) {
  const router = useRouter();
  const [showAllSprints, setShowAllSprints] = useState(false);
  const [hoveredSprint, setHoveredSprint] = useState<string | null>(null);

  const activeSprint = sprints.find((s) => s.status === "active");
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const completedSprints = sprints.filter((s) => s.status === "completed").sort(
    (a, b) => new Date(b.updatedAt || b.endDate || 0).getTime() - new Date(a.updatedAt || a.endDate || 0).getTime()
  );

  if (sprints.length === 0) return null;

  const getSprintTasks = (sprint: Sprint) => tasks.filter((t) => t.sprintId === sprint._id);
  const getSprintStats = (sprint: Sprint) => {
    const st = getSprintTasks(sprint);
    const done = st.filter((t) => t.status === "done").length;
    const inProgress = st.filter((t) => t.status === "in_progress").length;
    const inReview = st.filter((t) => t.status === "in_review").length;
    const blocked = st.filter((t) => t.status === "blocked").length;
    const todo = st.filter((t) => ["backlog", "todo"].includes(t.status)).length;
    const totalPts = st.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const donePts = st.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
    const pct = st.length > 0 ? Math.round((done / st.length) * 100) : 0;
    return { total: st.length, done, inProgress, inReview, blocked, todo, totalPts, donePts, pct };
  };

  const getDaysInfo = (sprint: Sprint) => {
    if (!sprint.startDate || !sprint.endDate) return null;
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const now = new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const elapsed = Math.ceil((now.getTime() - start.getTime()) / 86400000);
    const remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
    return { totalDays, elapsed, remaining, pct };
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  // Velocity from completed sprints
  const velocities = completedSprints.slice(0, 5).map((s) => {
    const st = getSprintTasks(s);
    return st.filter((t) => t.status === "done").reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  });
  const avgVelocity = velocities.length > 0 ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length) : 0;
  const maxVel = Math.max(...velocities, 1);

  const SprintHoverCard = ({ sprint, direction = "down" }: { sprint: Sprint; direction?: "down" | "up" }) => {
    const stats = getSprintStats(sprint);
    const days = getDaysInfo(sprint);
    const sc = sprintStatusConfig[sprint.status] || sprintStatusConfig.planning;
    const sprintTasks = getSprintTasks(sprint);

    return (
      <div className={`absolute ${direction === "up" ? "bottom-full left-0 pb-2" : "top-full left-0 pt-2"} w-[420px] z-50 animate-in fade-in ${direction === "up" ? "slide-in-from-bottom-1" : "slide-in-from-top-1"} duration-200`}>
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
            <h4 className="text-sm font-bold text-[#0F172A]">{sprint.name}</h4>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
          </div>
          <span className="text-[10px] text-[#94A3B8]">{formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}</span>
        </div>

        {/* Goal */}
        {sprint.goal && (
          <p className="text-xs text-[#64748B] mb-3 bg-[#F8FAFC] rounded-lg px-3 py-2 border border-[#F1F5F9]">{sprint.goal}</p>
        )}

        {/* Days Progress */}
        {days && sprint.status === "active" && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#64748B]">{days.elapsed} of {days.totalDays} days</span>
              <span className={`font-semibold ${days.remaining <= 2 ? "text-red-600" : days.remaining <= 5 ? "text-amber-600" : "text-[#64748B]"}`}>
                {days.remaining} day{days.remaining !== 1 ? "s" : ""} left
              </span>
            </div>
            <div className="h-1.5 bg-[#F1F5F9] rounded-full">
              <div className={`h-full rounded-full transition-all ${days.remaining <= 2 ? "bg-red-500" : days.remaining <= 5 ? "bg-amber-500" : "bg-[#2E86C1]"}`} style={{ width: `${days.pct}%` }} />
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-[#F8FAFC] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-[#0F172A]">{stats.total}</p>
            <p className="text-[9px] text-[#94A3B8]">Tasks</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-emerald-600">{stats.done}</p>
            <p className="text-[9px] text-emerald-600">Done</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-600">{stats.totalPts}</p>
            <p className="text-[9px] text-blue-600">Points</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-violet-600">{stats.donePts}</p>
            <p className="text-[9px] text-violet-600">Done Pts</p>
          </div>
        </div>

        {/* Task Status Breakdown */}
        {stats.total > 0 && (
          <div className="mb-3">
            <div className="flex h-2 rounded-full overflow-hidden bg-[#F1F5F9]">
              {stats.done > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.done / stats.total) * 100}%` }} />}
              {stats.inReview > 0 && <div className="bg-violet-500 transition-all" style={{ width: `${(stats.inReview / stats.total) * 100}%` }} />}
              {stats.inProgress > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${(stats.inProgress / stats.total) * 100}%` }} />}
              {stats.blocked > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(stats.blocked / stats.total) * 100}%` }} />}
              {stats.todo > 0 && <div className="bg-[#CBD5E1] transition-all" style={{ width: `${(stats.todo / stats.total) * 100}%` }} />}
            </div>
            <div className="flex gap-3 mt-1.5">
              {stats.done > 0 && <span className="text-[9px] text-[#64748B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{stats.done} done</span>}
              {stats.inProgress > 0 && <span className="text-[9px] text-[#64748B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{stats.inProgress} active</span>}
              {stats.inReview > 0 && <span className="text-[9px] text-[#64748B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" />{stats.inReview} review</span>}
              {stats.blocked > 0 && <span className="text-[9px] text-[#64748B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{stats.blocked} blocked</span>}
              {stats.todo > 0 && <span className="text-[9px] text-[#64748B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />{stats.todo} todo</span>}
            </div>
          </div>
        )}

        {/* Velocity (for completed) */}
        {sprint.status === "completed" && sprint.velocity != null && (
          <div className="bg-[#F8FAFC] rounded-lg p-2.5 mb-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">Velocity: {sprint.velocity} pts</p>
              <p className="text-[10px] text-[#94A3B8]">{stats.done}/{stats.total} tasks completed</p>
            </div>
          </div>
        )}

        {/* Recent tasks preview */}
        {sprintTasks.length > 0 && (
          <div className="border-t border-[#F1F5F9] pt-2.5 mt-1">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1.5">Tasks</p>
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {sprintTasks.slice(0, 8).map((t) => {
                const ti = typeIcons[t.type] || typeIcons.task;
                return (
                  <div key={t._id} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-[#F8FAFC]">
                    <svg className={`w-3 h-3 shrink-0 ${ti.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={ti.icon} /></svg>
                    <span className="text-[11px] text-[#334155] truncate flex-1">{t.title}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-500" : t.status === "in_progress" ? "bg-amber-500" : t.status === "blocked" ? "bg-red-500" : "bg-[#CBD5E1]"}`} />
                    {t.storyPoints != null && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded">{t.storyPoints}</span>}
                  </div>
                );
              })}
              {sprintTasks.length > 8 && <p className="text-[10px] text-[#94A3B8] px-1.5">+{sprintTasks.length - 8} more</p>}
            </div>
          </div>
        )}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-4">
      {/* Current Sprint Bar */}
      {activeSprint && (() => {
        const stats = getSprintStats(activeSprint);
        const days = getDaysInfo(activeSprint);
        return (
          <div
            className="relative"
            onMouseEnter={() => setHoveredSprint(activeSprint._id)}
            onMouseLeave={() => setHoveredSprint(null)}
          >
            <div
              className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-3.5 flex items-center gap-4 cursor-pointer hover:border-[#CBD5E1] transition-colors group"
            >
              {/* Sprint icon */}
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>

              {/* Sprint info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className="text-[13px] font-semibold text-[#0F172A] hover:text-[#2E86C1] hover:underline cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); router.push(`/projects/${projectId}/sprints/${activeSprint._id}`); }}
                  >{activeSprint.name}</h3>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                  {methodology && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE] capitalize">{methodology}</span>}
                </div>
                {activeSprint.goal && <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">{activeSprint.goal}</p>}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-4 shrink-0">
                {/* Task breakdown mini bar */}
                <div className="w-24">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-[#F1F5F9]">
                    {stats.done > 0 && <div className="bg-emerald-500" style={{ width: `${(stats.done / Math.max(stats.total, 1)) * 100}%` }} />}
                    {stats.inProgress > 0 && <div className="bg-amber-500" style={{ width: `${(stats.inProgress / Math.max(stats.total, 1)) * 100}%` }} />}
                    {stats.blocked > 0 && <div className="bg-red-500" style={{ width: `${(stats.blocked / Math.max(stats.total, 1)) * 100}%` }} />}
                  </div>
                  <p className="text-[9px] text-[#94A3B8] mt-0.5">{stats.done}/{stats.total} tasks</p>
                </div>

                {/* Points */}
                <div className="text-center">
                  <p className="text-sm font-bold text-[#2E86C1]">{stats.donePts}/{stats.totalPts}</p>
                  <p className="text-[9px] text-[#94A3B8]">points</p>
                </div>

                {/* Days remaining */}
                {days && (
                  <div className="text-center">
                    <p className={`text-sm font-bold ${days.remaining <= 2 ? "text-red-600" : days.remaining <= 5 ? "text-amber-600" : "text-[#0F172A]"}`}>{days.remaining}d</p>
                    <p className="text-[9px] text-[#94A3B8]">left</p>
                  </div>
                )}

                {/* Complete button */}
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onCompleteSprint(activeSprint._id); }}
                  className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 px-3"
                >
                  Complete Sprint
                </Button>

                {/* Sprint list toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllSprints(!showAllSprints); }}
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors"
                  title="View all sprints"
                >
                  <svg className={`w-4 h-4 transition-transform ${showAllSprints ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
            {hoveredSprint === activeSprint._id && (
              <div onMouseEnter={() => setHoveredSprint(activeSprint._id)} onMouseLeave={() => setHoveredSprint(null)}>
                <SprintHoverCard sprint={activeSprint} />
              </div>
            )}
          </div>
        );
      })()}

      {/* No active sprint but planning ones exist */}
      {!activeSprint && planningSprints.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-[#CBD5E1] p-3.5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-[#334155]">No active sprint</p>
            <p className="text-[11px] text-[#94A3B8]">{planningSprints.length} sprint{planningSprints.length !== 1 ? "s" : ""} in planning</p>
          </div>
          <Button
            size="sm"
            onClick={() => onStartSprint(planningSprints[0]._id)}
            className="h-7 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3] px-3"
          >
            Start {planningSprints[0].name}
          </Button>
          <button
            onClick={() => setShowAllSprints(!showAllSprints)}
            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showAllSprints ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Expanded Sprint List */}
      {showAllSprints && (
        <div className="mt-2 bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-visible">
          {/* Velocity Chart (for scrum/scrumban) */}
          {["scrum", "scrumban", "safe", "xp"].includes(methodology || "") && completedSprints.length > 0 && (
            <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#FAFBFC]">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="text-[11px] font-semibold text-[#334155]">Velocity Trend</span>
                <span className="text-[10px] text-[#94A3B8]">Avg: {avgVelocity} pts</span>
              </div>
              <div className="flex items-end gap-2 h-12">
                {[...velocities].reverse().map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-[#334155]">{v}</span>
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-[#2E86C1] to-[#5DADE2]"
                      style={{ height: `${Math.max(6, (v / maxVel) * 44)}px` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-1">
                {completedSprints.slice(0, 5).reverse().map((s, i) => (
                  <span key={i} className="flex-1 text-[8px] text-[#94A3B8] text-center truncate">{s.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Sprint rows */}
          {[...planningSprints, ...completedSprints.slice(0, 5)].map((sprint) => {
            const stats = getSprintStats(sprint);
            const sc = sprintStatusConfig[sprint.status] || sprintStatusConfig.planning;
            return (
              <div
                key={sprint._id}
                className="relative px-4 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                onMouseEnter={() => setHoveredSprint(sprint._id)}
                onMouseLeave={() => setHoveredSprint(null)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-medium text-[#0F172A] hover:text-[#2E86C1] hover:underline cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); router.push(`/projects/${projectId}/sprints/${sprint._id}`); }}
                      >{sprint.name}</span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8]">{formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-[#64748B]">{stats.done}/{stats.total} tasks</span>
                    {stats.totalPts > 0 && <span className="text-[11px] font-medium text-[#2E86C1]">{stats.donePts}/{stats.totalPts} pts</span>}
                    {sprint.velocity != null && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">vel: {sprint.velocity}</span>}
                    {sprint.status === "planning" && !activeSprint && (
                      <Button size="sm" onClick={() => onStartSprint(sprint._id)} className="h-6 text-[10px] bg-[#2E86C1] hover:bg-[#2471A3] px-2">Start</Button>
                    )}
                  </div>
                </div>
                {hoveredSprint === sprint._id && (
                  <div onMouseEnter={() => setHoveredSprint(sprint._id)} onMouseLeave={() => setHoveredSprint(null)}>
                    <SprintHoverCard sprint={sprint} direction="up" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Planning View ──

function PlanningView({
  tasks,
  sprints,
  board,
  projectId,
  projectKey,
  employees,
  onRefresh,
  parentMap,
  childrenMap,
}: {
  tasks: Task[];
  sprints: Sprint[];
  board: Board | null;
  projectId: string;
  projectKey?: string;
  employees: Employee[];
  onRefresh: () => void;
  parentMap: Map<string, Task>;
  childrenMap: Map<string, Task[]>;
}) {
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprintName, setNewSprintName] = useState(`Sprint ${sprints.length + 1}`);
  const [newSprintGoal, setNewSprintGoal] = useState("");
  const [newSprintStart, setNewSprintStart] = useState("");
  const [newSprintEnd, setNewSprintEnd] = useState("");
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [backlogTypeFilter, setBacklogTypeFilter] = useState("all");

  const plannable = sprints.filter((s) => s.status === "active" || s.status === "planning");
  const selectedSprint = plannable.find((s) => s._id === selectedSprintId) || plannable[0] || null;

  const sprintTasks = selectedSprint ? tasks.filter((t) => t.sprintId === selectedSprint._id) : [];
  const backlogTasks = tasks.filter((t) => !t.sprintId);
  const filteredBacklog = backlogTypeFilter === "all" ? backlogTasks : backlogTasks.filter((t) => t.type === backlogTypeFilter);

  const sprintPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const backlogPoints = backlogTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToSprint = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTaskId || !selectedSprint) return;
    try {
      await taskApi.update(draggedTaskId, { sprintId: selectedSprint._id } as any);
      try { await sprintApi.addTasks(selectedSprint._id, [draggedTaskId]); } catch {}
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to move task to sprint");
    }
    setDraggedTaskId(null);
  };

  const handleDropToBacklog = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    try {
      await taskApi.update(draggedTaskId, { sprintId: null } as any);
      if (selectedSprint) {
        try { await sprintApi.removeTask(selectedSprint._id, draggedTaskId); } catch {}
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to move task to backlog");
    }
    setDraggedTaskId(null);
  };

  const handleCreateSprint = async () => {
    if (!newSprintName.trim() || !board?._id) return;
    setCreatingSprint(true);
    try {
      await sprintApi.create({
        name: newSprintName.trim(),
        goal: newSprintGoal.trim() || undefined,
        startDate: newSprintStart || undefined,
        endDate: newSprintEnd || undefined,
        boardId: board._id,
        projectId,
      } as any);
      toast.success("Sprint created!");
      setShowCreateSprint(false);
      setNewSprintName(`Sprint ${sprints.length + 2}`);
      setNewSprintGoal("");
      setNewSprintStart("");
      setNewSprintEnd("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create sprint");
    } finally {
      setCreatingSprint(false);
    }
  };

  const TaskRow = ({ task }: { task: Task }) => {
    const typeInfo = typeIcons[task.type] || typeIcons.task;
    const parent = task.parentTaskId ? parentMap.get(task.parentTaskId) || null : null;
    const children = childrenMap.get(task._id)?.length || 0;
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, task._id)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white hover:shadow-sm hover:border-[#CBD5E1] cursor-grab transition-all group"
      >
        <svg className={`w-3.5 h-3.5 shrink-0 ${typeInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={typeInfo.icon} />
        </svg>
        <div className="flex-1 min-w-0">
          {parent && (
            <p className="text-[9px] text-[#94A3B8] truncate mb-0.5">{"\u21B3"} {parent.taskKey || parent.title}</p>
          )}
          <p className="text-[12px] font-medium text-[#0F172A] truncate">{task.title}</p>
        </div>
        {children > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] shrink-0">{children}</span>
        )}
        {task.storyPoints != null && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">{task.storyPoints}</span>
        )}
        {task.priority && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${priorityColors[task.priority]}`}>
            {task.priority.toUpperCase()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-4" style={{ minHeight: "calc(100vh - 340px)" }}>
      {/* Sprint Panel - Left */}
      <div className="flex-[3] min-w-0">
        <Card className="border-0 shadow-sm h-full">
          <CardContent className="p-4">
            {/* Sprint selector */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EBF5FB] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                {plannable.length > 0 ? (
                  <select
                    value={selectedSprint?._id || ""}
                    onChange={(e) => setSelectedSprintId(e.target.value)}
                    className="h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-sm font-medium text-[#0F172A]"
                  >
                    {plannable.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.status})</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-medium text-[#64748B]">No sprints available</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedSprint && (
                  <span className="text-[11px] font-medium text-[#2E86C1] bg-blue-50 px-2 py-1 rounded-md">
                    {sprintPoints} pts / {sprintTasks.length} items
                  </span>
                )}
                <button
                  onClick={() => setShowCreateSprint(!showCreateSprint)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#2E86C1] hover:bg-[#EBF5FB] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  New Sprint
                </button>
              </div>
            </div>

            {/* Create sprint form */}
            {showCreateSprint && (
              <div className="mb-4 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#64748B] uppercase mb-1 block">Name</label>
                    <Input value={newSprintName} onChange={(e) => setNewSprintName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#64748B] uppercase mb-1 block">Goal</label>
                    <Input value={newSprintGoal} onChange={(e) => setNewSprintGoal(e.target.value)} placeholder="Sprint goal..." className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#64748B] uppercase mb-1 block">Start Date</label>
                    <Input type="date" value={newSprintStart} onChange={(e) => setNewSprintStart(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#64748B] uppercase mb-1 block">End Date</label>
                    <Input type="date" value={newSprintEnd} onChange={(e) => setNewSprintEnd(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowCreateSprint(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleCreateSprint} disabled={creatingSprint || !newSprintName.trim()} className="h-7 text-xs bg-[#2E86C1] hover:bg-[#2471A3]">
                    {creatingSprint ? "Creating..." : "Create Sprint"}
                  </Button>
                </div>
              </div>
            )}

            {/* Sprint goal and dates */}
            {selectedSprint && (
              <div className="mb-3 flex items-center gap-3 text-[11px] text-[#64748B]">
                {selectedSprint.goal && (
                  <span className="bg-[#F8FAFC] rounded px-2 py-1 border border-[#F1F5F9] truncate flex-1">{selectedSprint.goal}</span>
                )}
                {selectedSprint.startDate && (
                  <span className="shrink-0">{new Date(selectedSprint.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {selectedSprint.endDate ? new Date(selectedSprint.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No end date"}</span>
                )}
              </div>
            )}

            {/* Sprint tasks */}
            <div
              className="space-y-1.5 min-h-[200px] rounded-lg border-2 border-dashed border-[#E2E8F0] p-2 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDropToSprint}
            >
              {selectedSprint && sprintTasks.length === 0 && (
                <div className="py-10 text-center text-[12px] text-[#94A3B8]">
                  Drag items from the backlog to add them to this sprint
                </div>
              )}
              {!selectedSprint && (
                <div className="py-10 text-center text-[12px] text-[#94A3B8]">
                  Create a sprint to start planning
                </div>
              )}
              {sprintTasks.map((task) => (
                <TaskRow key={task._id} task={task} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backlog Panel - Right */}
      <div className="flex-[2] min-w-0">
        <Card className="border-0 shadow-sm h-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-[#0F172A]">Backlog</h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                  {backlogTasks.length}
                </span>
                <span className="text-[10px] text-[#94A3B8]">{backlogPoints} pts</span>
              </div>
              <select
                value={backlogTypeFilter}
                onChange={(e) => setBacklogTypeFilter(e.target.value)}
                className="h-7 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 text-[10px] text-[#475569]"
              >
                <option value="all">All Types</option>
                <option value="epic">Epic</option>
                <option value="story">Story</option>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="sub_task">Subtask</option>
                <option value="spike">Spike</option>
              </select>
            </div>

            <div
              className="space-y-1.5 min-h-[200px] rounded-lg border-2 border-dashed border-[#E2E8F0] p-2 transition-colors overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 440px)" }}
              onDragOver={handleDragOver}
              onDrop={handleDropToBacklog}
            >
              {filteredBacklog.length === 0 && (
                <div className="py-10 text-center text-[12px] text-[#94A3B8]">
                  {backlogTasks.length === 0 ? "No unassigned items" : "No items match filter"}
                </div>
              )}
              {filteredBacklog.map((task) => (
                <TaskRow key={task._id} task={task} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ──

type ViewTab = "board" | "list" | "planning";

export default function ProjectDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewTab>("board");
  // showCreate removed — using /projects/[id]/items/new page
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ projectName: "", description: "", status: "", priority: "", category: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes, boardsRes, empRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getAll({ projectId }),
        boardApi.getByProject(projectId),
        hrApi.getEmployees().catch(() => ({ data: [] })),
      ]);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      const proj = projRes.data || null;
      setProject(proj);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      const boards = Array.isArray(boardsRes.data) ? boardsRes.data : [];
      const activeBoard = boards.find((b) => b.isDefault) || boards[0] || null;
      setBoard(activeBoard);

      // Fetch sprints for the board
      if (activeBoard?._id) {
        try {
          const sprintsRes = await sprintApi.getByBoard(activeBoard._id);
          setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
        } catch {
          setSprints([]);
        }
      }

      // Store active project for sidebar shortcut
      if (proj) {
        try {
          localStorage.setItem("nexora_active_project", JSON.stringify({ id: proj._id, name: proj.projectName }));
        } catch {}
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && projectId) fetchAll();
  }, [user, projectId, fetchAll]);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-hex,#2E86C1)] border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="ml-[260px] p-8">
          <div className="text-center py-20">
            <h2 className="text-lg font-semibold text-gray-900">Project not found</h2>
            <Button className="mt-4" onClick={() => router.push("/projects")}>Back to Projects</Button>
          </div>
        </main>
      </div>
    );
  }

  // Apply filters
  let filteredTasks = tasks;
  if (search) filteredTasks = filteredTasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
  if (typeFilter !== "all") filteredTasks = filteredTasks.filter((t) => t.type === typeFilter);
  if (priorityFilter !== "all") filteredTasks = filteredTasks.filter((t) => t.priority === priorityFilter);

  // Build parent-child map
  const childrenMap = new Map<string, Task[]>();
  const parentMap = new Map<string, Task>();
  for (const t of tasks) {
    if (t.parentTaskId) {
      const children = childrenMap.get(t.parentTaskId) || [];
      children.push(t);
      childrenMap.set(t.parentTaskId, children);
    }
    parentMap.set(t._id, t);
  }

  const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const bugCount = tasks.filter((t) => t.type === "bug").length;
  const completionPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const handleStartSprint = async (sprintId: string) => {
    try {
      await sprintApi.start(sprintId);
      toast.success("Sprint started!");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    try {
      await sprintApi.complete(sprintId, { moveToBacklog: true });
      toast.success("Sprint completed! Unfinished items moved to backlog.");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete sprint");
    }
  };

  const openEditModal = () => {
    if (!project) return;
    setEditForm({
      projectName: project.projectName || "",
      description: project.description || "",
      status: project.status || "planning",
      priority: project.priority || "medium",
      category: project.category || "",
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
      endDate: project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "",
    });
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleEditSave = async () => {
    try {
      setSaving(true);
      await projectApi.update(projectId, editForm as Partial<Project>);
      toast.success("Project updated");
      setShowEditModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await projectApi.delete(projectId);
      toast.success("Project deleted");
      router.push("/projects");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] overflow-hidden">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-6 overflow-y-auto overflow-x-hidden" style={{ maxHeight: "100vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/projects")} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-10 h-10 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-sm">
              {project.projectKey?.slice(0, 2) || project.projectName?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0F172A]">{project.projectName}</h1>
                <span className="text-[10px] font-medium text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded">{project.projectKey}</span>
                {project.methodology && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE] capitalize">{project.methodology}</span>
                )}
              </div>
              {project.description && (
                <p className="text-[13px] text-[#64748B] mt-0.5 max-w-xl truncate">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.team && project.team.length > 0 && (
              <div className="flex -space-x-1.5 mr-2">
                {project.team.slice(0, 4).map((m, i) => {
                  const initial = (m.name || m.email || "").charAt(0).toUpperCase();
                  return (
                    <div key={i} className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-bold border-2 border-white" title={m.name || m.email || "Team member"}>
                      {initial || (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      )}
                    </div>
                  );
                })}
                {project.team.length > 4 && (
                  <div className="w-7 h-7 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[10px] font-bold text-[#64748B] border-2 border-white">+{project.team.length - 4}</div>
                )}
              </div>
            )}
            {/* Project actions menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                </svg>
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 py-1">
                    <button
                      onClick={openEditModal}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Project
                    </button>
                    <div className="border-t border-[#F1F5F9] my-1" />
                    <button
                      onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Project
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Total</p>
              </div>
              <p className="text-xl font-bold text-[#0F172A]">{tasks.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Active</p>
              </div>
              <p className="text-xl font-bold text-amber-600">{inProgressTasks}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Done</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-emerald-600">{completedTasks}</p>
                <div className="flex-1">
                  <div className="h-1.5 bg-[#F1F5F9] rounded-full"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} /></div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">{completionPct}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-red-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${blockedTasks > 0 ? "bg-red-100" : "bg-gray-100"}`}>
                  <svg className={`w-3 h-3 ${blockedTasks > 0 ? "text-red-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Blocked</p>
              </div>
              <p className={`text-xl font-bold ${blockedTasks > 0 ? "text-red-600" : "text-[#0F172A]"}`}>{blockedTasks}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-violet-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Points</p>
              </div>
              <p className="text-xl font-bold text-[#2E86C1]">{totalPoints}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bugCount > 0 ? "bg-rose-100" : "bg-gray-100"}`}>
                  <svg className={`w-3 h-3 ${bugCount > 0 ? "text-rose-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Bugs</p>
              </div>
              <p className={`text-xl font-bold ${bugCount > 0 ? "text-rose-600" : "text-[#0F172A]"}`}>{bugCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Sprint Bar */}
        <SprintBar
          sprints={sprints}
          tasks={tasks}
          onStartSprint={handleStartSprint}
          onCompleteSprint={handleCompleteSprint}
          methodology={project.methodology}
          projectId={projectId}
        />

        {/* Toolbar */}
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* View switcher */}
              <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1">
                <button
                  onClick={() => setActiveView("board")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === "board" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}
                >
                  Board
                </button>
                <button
                  onClick={() => setActiveView("list")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === "list" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}
                >
                  List
                </button>
                <button
                  onClick={() => setActiveView("planning")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === "planning" ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}
                >
                  Planning
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 h-9 w-48 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg" />
              </div>

              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-xs text-[#475569]">
                <option value="all">All Types</option>
                <option value="epic">Epic</option>
                <option value="story">Story</option>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="sub_task">Subtask</option>
                <option value="spike">Spike</option>
              </select>

              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-xs text-[#475569]">
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <Button size="sm" onClick={() => router.push(`/projects/${projectId}/items/new?boardId=${board?._id || ""}`)} className="gap-1.5 h-9 bg-[#2E86C1] hover:bg-[#2471A3]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </Button>
          </CardContent>
        </Card>

        {/* Views */}
        {activeView === "board" && (
          <BoardView tasks={filteredTasks} board={board} projectId={projectId} projectKey={project?.projectKey} employees={employees} onRefresh={fetchAll} parentMap={parentMap} childrenMap={childrenMap} methodology={project?.methodology} />
        )}
        {activeView === "list" && (
          <ListView tasks={filteredTasks} projectId={projectId} board={board} onRefresh={fetchAll} parentMap={parentMap} childrenMap={childrenMap} />
        )}
        {activeView === "planning" && (
          <PlanningView
            tasks={tasks}
            sprints={sprints}
            board={board}
            projectId={projectId}
            projectKey={project?.projectKey}
            employees={employees}
            onRefresh={fetchAll}
            parentMap={parentMap}
            childrenMap={childrenMap}
          />
        )}

      </main>

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F172A]">Edit Project</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Project Name</label>
                <Input value={editForm.projectName} onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })} className="h-10 border-[#E2E8F0] rounded-lg" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full h-10 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Priority</label>
                  <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className="w-full h-10 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full h-10 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                  <option value="">Select category</option>
                  <option value="web">Web</option>
                  <option value="mobile">Mobile</option>
                  <option value="api">API</option>
                  <option value="devops">DevOps</option>
                  <option value="design">Design</option>
                  <option value="data">Data</option>
                  <option value="internal">Internal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Start Date</label>
                  <Input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} className="h-10 border-[#E2E8F0] rounded-lg" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">End Date</label>
                  <Input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} className="h-10 border-[#E2E8F0] rounded-lg" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)} className="h-9 px-4 text-[13px]">Cancel</Button>
              <Button onClick={handleEditSave} disabled={saving || !editForm.projectName.trim()} className="h-9 px-5 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] text-center mb-2">Delete Project</h3>
            <p className="text-[13px] text-[#64748B] text-center mb-6">
              Are you sure you want to delete <span className="font-semibold text-[#334155]">{project.projectName}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-10 text-[13px]">Cancel</Button>
              <Button onClick={handleDelete} disabled={saving} className="flex-1 h-10 text-[13px] bg-red-600 hover:bg-red-700 text-white">
                {saving ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
