"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, boardApi, sprintApi, hrApi, Project, Task, Board, Sprint, Employee, ActivityLog } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BoardFilters } from "@/components/board-filters";
import { BoardSwimlanes } from "@/components/board-swimlanes";
import { BulkOperations } from "@/components/bulk-operations";
import GanttChart, { GanttItem } from "@/components/projects/GanttChart";
import RoadmapView, { RoadmapProject, RoadmapMilestone, RoadmapRelease, RoadmapEpic } from "@/components/projects/RoadmapView";
import ActivityFeed from "@/components/projects/ActivityFeed";
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
  isSelected = false,
  onSelectionChange,
}: {
  task: Task;
  projectId: string;
  employees?: Array<{ _id: string; userId?: string; firstName: string; lastName: string; avatar?: string }>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  parentTask?: Task | null;
  childCount?: number;
  isSelected?: boolean;
  onSelectionChange?: (taskId: string) => void;
}) {
  const router = useRouter();
  const typeInfo = typeIcons[task.type] || typeIcons.task;
  const assignee = employees?.find((e) => e.userId === task.assigneeId || e._id === task.assigneeId);

  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-all group ${
        isSelected
          ? "bg-[#EBF5FB] border-[#2E86C1]"
          : "bg-white border-[#E2E8F0] hover:border-[#CBD5E1]"
      }`}
      onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
    >
      {/* Selection checkbox */}
      {onSelectionChange && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectionChange(task._id);
            }}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-[#2E86C1] border-[#2E86C1]"
                : "border-[#E2E8F0] hover:border-[#2E86C1]"
            }`}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      )}
      {/* Flagged indicator */}
      {task.isFlagged && (
        <div className="flex items-center gap-1 mb-1.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 w-fit">
          <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 7l2.55 2.4A1 1 0 0116 11H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
          </svg>
          <span className="text-[9px] font-semibold text-amber-700">Flagged</span>
        </div>
      )}

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
          {(task as any).dependencies?.some((d: any) => d.type === 'blocked_by') && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">BLOCKED</span>
          )}
        </div>
      )}
      {!(task.labels && task.labels.length > 0) && (task as any).dependencies?.some((d: any) => d.type === 'blocked_by') && (
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">BLOCKED</span>
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
  onTaskUpdate,
  parentMap,
  childrenMap,
  methodology,
  canCreateTask,
  canManageProject,
}: {
  tasks: Task[];
  board: Board | null;
  projectId: string;
  projectKey?: string;
  employees: Employee[];
  onRefresh: () => void;
  onTaskUpdate: (taskId: string, patch: Partial<Task>) => void;
  parentMap: Map<string, Task>;
  childrenMap: Map<string, Task[]>;
  methodology?: string;
  canCreateTask?: boolean;
  canManageProject?: boolean;
}) {
  const router = useRouter();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({});
  const [quickAddSaving, setQuickAddSaving] = useState<string | null>(null);
  // User filter
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  // Advanced filters
  const [filters, setFilters] = useState<{
    search?: string;
    assignees?: string[];
    labels?: string[];
    priority?: string;
    status?: string;
    type?: string;
  }>({});
  // Swimlane grouping
  const [swimlaneGroupBy, setSwimlaneGroupBy] = useState<"assignee" | "priority" | "type" | "none">("none");
  // Bulk operations
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  // Add column
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColStatus, setNewColStatus] = useState("todo");
  const [addingColumn, setAddingColumn] = useState(false);
  // Auto-scroll on drag
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  const stopAutoScroll = () => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  };

  const handleBoardDragOver = (e: React.DragEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    const { left, right } = container.getBoundingClientRect();
    const ZONE = 80; // px from edge that triggers scroll
    const MAX_SPEED = 18;
    const x = e.clientX;

    stopAutoScroll();

    if (x < left + ZONE || x > right - ZONE) {
      const scroll = () => {
        if (!scrollRef.current) return;
        const dist = x < left + ZONE ? x - (left + ZONE) : x - (right - ZONE);
        // dist is negative when near left edge, positive near right
        const speed = Math.round((Math.abs(dist) / ZONE) * MAX_SPEED);
        scrollRef.current.scrollLeft += dist < 0 ? -speed : speed;
        scrollRafRef.current = requestAnimationFrame(scroll);
      };
      scrollRafRef.current = requestAnimationFrame(scroll);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleBulkUpdate = async (updates: any) => {
    if (selectedTasks.size === 0) return;
    setBulkUpdating(true);
    try {
      await taskApi.bulkUpdate({
        taskIds: Array.from(selectedTasks),
        ...updates,
      });
      onRefresh?.();
      setSelectedTasks(new Set());
    } catch (error: any) {
      throw new Error(error.message || "Failed to update tasks");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleAddColumn = async () => {
    if (!board || !newColName.trim()) return;
    setAddingColumn(true);
    try {
      await boardApi.addColumn(board._id, {
        name: newColName.trim(),
        statusMapping: [newColStatus],
      } as any);
      setNewColName("");
      setNewColStatus("todo");
      setShowAddColumn(false);
      onRefresh();
      toast.success("Column added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add column");
    } finally {
      setAddingColumn(false);
    }
  };

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
        status: (Array.isArray(column.statusMapping) ? column.statusMapping[0] : (column.statusMapping || column.key)) as Task["status"],
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
    // statusMapping can be a string or an array of strings
    const mapping = column.statusMapping;
    const statusKeys: string[] = Array.isArray(mapping)
      ? mapping
      : mapping
      ? [mapping]
      : column.key
      ? [column.key]
      : [];
    return tasks.filter((t) => {
      const matchesCol = t.columnId && (column._id || column.id)
        ? t.columnId === (column._id || column.id)
        : statusKeys.includes(t.status);
      if (!matchesCol) return false;

      // Apply advanced filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!(t.title.toLowerCase().includes(searchLower) || t.taskKey?.toLowerCase().includes(searchLower))) {
          return false;
        }
      }
      if (filters.assignees && filters.assignees.length > 0) {
        if (!t.assigneeId || !filters.assignees.includes(t.assigneeId)) return false;
      } else if (selectedUsers.size > 0) {
        if (!t.assigneeId || !selectedUsers.has(t.assigneeId)) return false;
      }
      if (filters.labels && filters.labels.length > 0) {
        if (!t.labels || !filters.labels.some((l) => t.labels?.includes(l))) return false;
      }
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.type && t.type !== filters.type) return false;

      return true;
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

    const mapping = column.statusMapping;
    const statusKey = Array.isArray(mapping) ? mapping[0] : (mapping || column.key);
    const columnId = column._id || column.id;

    // Optimistic update — move card instantly, no full page refresh
    const patch: Partial<Task> = {
      status: statusKey as Task["status"],
      columnId: columnId || undefined,
    };
    onTaskUpdate(draggedTask._id, patch);
    const movedTask = draggedTask;
    setDraggedTask(null);

    try {
      if (board?._id && columnId) {
        await boardApi.moveTask(board._id, movedTask._id, {
          fromColumnId: movedTask.columnId || '',
          toColumnId: columnId,
        });
      } else {
        await taskApi.update(movedTask._id, patch);
      }
    } catch (err: any) {
      // Revert on failure
      onTaskUpdate(movedTask._id, { status: movedTask.status, columnId: movedTask.columnId });
      toast.error(err.message || "Failed to move task");
    }
  };

  const isKanban = methodology === "kanban";
  const isScrum = methodology === "scrum" || methodology === "scrumban";

  // Employees who have at least one task on this board
  const activeEmployees = employees.filter((emp) =>
    tasks.some((t) => t.assigneeId === (emp.userId || emp._id))
  );

  // Get all unique labels from tasks for the filter
  const availableLabels = Array.from(new Set(tasks.flatMap((t) => t.labels || [])));

  return (
    <>
      {/* Advanced Board Filters */}
      <BoardFilters
        onFilterChange={(newFilters) => setFilters(newFilters)}
        employees={employees}
        availableLabels={availableLabels}
      />

      {/* Toolbar row: methodology badge + user filter + add column */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {/* Methodology badge */}
        {methodology && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium ${
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

        {/* Right side: assignee filter + add column */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Assignee filter */}
          {activeEmployees.length > 0 && (
            <div className="flex items-center gap-1.5">
              {selectedUsers.size > 0 && (
                <button
                  onClick={() => setSelectedUsers(new Set())}
                  className="text-[10px] text-[#94A3B8] hover:text-[#475569] px-1.5 py-0.5 rounded hover:bg-[#F1F5F9] transition-colors"
                >
                  Clear
                </button>
              )}
              <span className="text-[10px] text-[#94A3B8] mr-0.5">Assignee:</span>
              <div className="flex items-center gap-1">
                {activeEmployees.map((emp) => {
                  const uid = emp.userId || emp._id;
                  const isActive = selectedUsers.has(uid);
                  const initials = `${emp.firstName?.charAt(0) || ""}${emp.lastName?.charAt(0) || ""}`.toUpperCase();
                  return (
                    <button
                      key={uid}
                      onClick={() => toggleUser(uid)}
                      title={`${emp.firstName} ${emp.lastName}`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border-2 ${
                        isActive
                          ? "border-[#2E86C1] ring-2 ring-[#2E86C1]/30 scale-110"
                          : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                      } bg-gradient-to-br from-[#2E86C1] to-[#1A5276] text-white`}
                    >
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={initials} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        initials
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedUsers.size > 0 && (
                <span className="text-[10px] font-medium text-[#2E86C1] bg-[#EBF5FB] px-1.5 py-0.5 rounded-full border border-[#2E86C1]/20">
                  {selectedUsers.size} selected
                </span>
              )}
            </div>
          )}

          {/* Swimlane Toggle */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-[#94A3B8] font-medium">Group by:</label>
            <select
              value={swimlaneGroupBy}
              onChange={(e) => setSwimlaneGroupBy(e.target.value as any)}
              className="h-8 text-[12px] border border-[#E2E8F0] rounded-lg px-2 bg-white text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
            >
              <option value="none">None (Standard Board)</option>
              <option value="assignee">Assignee</option>
              <option value="priority">Priority</option>
              <option value="type">Type</option>
            </select>
          </div>

          {/* Add Column button */}
          {board && (
            <button
              onClick={() => setShowAddColumn((v) => !v)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-medium transition-colors ${
                showAddColumn
                  ? "bg-[#EBF5FB] border-[#2E86C1] text-[#2E86C1]"
                  : "bg-white border-[#E2E8F0] text-[#475569] hover:border-[#2E86C1] hover:text-[#2E86C1]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Column
            </button>
          )}
        </div>
      </div>

      {/* Add Column inline panel */}
      {showAddColumn && board && (
        <div className="mb-3 bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-end gap-3 shadow-sm">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#475569] mb-1">Column Name</label>
            <input
              autoFocus
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setShowAddColumn(false); }}
              placeholder="e.g. In Testing"
              className="w-full h-9 border border-[#E2E8F0] rounded-lg px-3 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
            />
          </div>
          <div className="w-44">
            <label className="block text-[11px] font-semibold text-[#475569] mb-1">Maps to Status</label>
            <select
              value={newColStatus}
              onChange={(e) => setNewColStatus(e.target.value)}
              className="w-full h-9 border border-[#E2E8F0] rounded-lg px-2 text-[13px] text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1] bg-white"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <button
            onClick={handleAddColumn}
            disabled={!newColName.trim() || addingColumn}
            className="h-9 px-4 bg-[#2E86C1] hover:bg-[#2471A3] text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {addingColumn ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            Add
          </button>
          <button
            onClick={() => setShowAddColumn(false)}
            className="h-9 px-3 text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] rounded-lg text-[13px] transition-colors shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {swimlaneGroupBy !== "none" ? (
        <BoardSwimlanes
          tasks={tasks}
          board={board}
          columns={columns}
          employees={employees}
          groupBy={swimlaneGroupBy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          TaskCard={(props: any) => (
            <TaskCard
              {...props}
              projectId={projectId}
              employees={employees}
              parentTask={props.task.parentTaskId ? parentMap.get(props.task.parentTaskId) || null : null}
              childCount={childrenMap.get(props.task._id)?.length || 0}
            />
          )}
        />
      ) : (
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-2"
          onDragOver={handleBoardDragOver}
          onDragEnd={stopAutoScroll}
          onDrop={stopAutoScroll}
        >
          <div className="flex gap-3 pb-4" style={{ minHeight: "calc(100vh - 360px)", minWidth: "max-content" }}>
            {columns.map((column) => {
          const colTasks = getColumnTasks(column);
          const colStatuses: string[] = Array.isArray(column.statusMapping) ? column.statusMapping : column.statusMapping ? [column.statusMapping] : column.key ? [column.key] : [];
          const isDoneCol = column.isDoneColumn || colStatuses.includes("done") || column.key === "done";
          const colPoints = colTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
          const wipExceeded = column.wipLimit && colTasks.length > column.wipLimit;
          const wipAtLimit = column.wipLimit && colTasks.length === column.wipLimit;

          return (
            <div
              key={column._id || column.key}
              className="shrink-0 w-72"
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
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isDoneCol ? "bg-emerald-500" : colStatuses.includes("in_progress") ? "bg-amber-500" : colStatuses.includes("blocked") ? "bg-red-500" : colStatuses.includes("in_review") ? "bg-violet-500" : "bg-[#94A3B8]"}`} />
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
                  {canCreateTask && <button
                    onClick={() => router.push(`/projects/${projectId}/items/new?status=${(Array.isArray(column.statusMapping) ? column.statusMapping[0] : null) || column.key}&columnId=${column._id || column.id || ""}&boardId=${board?._id || ""}`)}
                    className="p-1 rounded-md hover:bg-white text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>}
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
                      isSelected={selectedTasks.has(task._id)}
                      onSelectionChange={toggleTaskSelection}
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
        </div>
      )}

      {/* Bulk Operations FAB */}
      <BulkOperations
        selectedTasks={selectedTasks}
        onClearSelection={() => setSelectedTasks(new Set())}
        onBulkUpdate={handleBulkUpdate}
        employees={employees}
        loading={bulkUpdating}
      />
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

// ── Hierarchy View ──

function HierarchyView({
  tasks,
  projectId,
  employees,
  childrenMap,
}: {
  tasks: Task[];
  projectId: string;
  employees: Employee[];
  childrenMap: Map<string, Task[]>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const typeOrder: Record<string, number> = { epic: 0, story: 1, task: 2, bug: 3, sub_task: 4, improvement: 5, spike: 6 };

  const statusColors: Record<string, string> = {
    backlog: "bg-gray-100 text-gray-600",
    todo: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-700",
    in_review: "bg-violet-100 text-violet-700",
    blocked: "bg-red-100 text-red-700",
    done: "bg-emerald-100 text-emerald-700",
  };

  const topLevel = tasks
    .filter((t) => !t.parentTaskId)
    .sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderRow = (task: Task, depth: number) => {
    const typeInfo = typeIcons[task.type] || typeIcons.task;
    const children = childrenMap.get(task._id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(task._id);
    const assignee = employees.find((e) => (e.userId || e._id) === task.assigneeId);
    const doneChildren = children.filter((c) => c.status === "done").length;
    const progressPct = hasChildren ? Math.round((doneChildren / children.length) * 100) : 0;

    return (
      <div key={task._id}>
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer group transition-colors"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
          onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
        >
          {/* Expand toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(task._id); }}
            className={`w-4 h-4 flex items-center justify-center shrink-0 rounded transition-colors ${hasChildren ? "hover:bg-[#E2E8F0] text-[#64748B]" : "text-transparent"}`}
          >
            {hasChildren && (
              <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {/* Type icon */}
          <svg className={`w-4 h-4 shrink-0 ${typeInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={typeInfo.icon} />
          </svg>

          {/* Task key */}
          {task.taskKey && (
            <span className="text-[10px] font-mono text-[#94A3B8] shrink-0 w-20">{task.taskKey}</span>
          )}

          {/* Title */}
          <span className="flex-1 text-[13px] font-medium text-[#0F172A] truncate">{task.title}</span>

          {/* Progress bar for parents */}
          {hasChildren && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[9px] text-[#94A3B8] w-8 text-right">{doneChildren}/{children.length}</span>
            </div>
          )}

          {/* Status badge */}
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusColors[task.status] || "bg-gray-100 text-gray-600"}`}>
            {task.status.replace(/_/g, " ").toUpperCase()}
          </span>

          {/* Priority badge */}
          {task.priority && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${priorityColors[task.priority]}`}>
              {task.priority.toUpperCase()}
            </span>
          )}

          {/* Story points */}
          {task.storyPoints != null && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0 w-8 text-center">
              {task.storyPoints}
            </span>
          )}

          {/* Assignee */}
          {assignee ? (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[9px] font-bold shrink-0" title={`${assignee.firstName} ${assignee.lastName}`}>
              {assignee.firstName?.charAt(0)}{assignee.lastName?.charAt(0)}
            </div>
          ) : (
            <div className="w-6 h-6 shrink-0" />
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && children
          .sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9))
          .map((child) => renderRow(child, depth + 1))
        }
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="w-4 shrink-0" />
        <div className="w-4 shrink-0" />
        <span className="text-[10px] font-semibold text-[#94A3B8] uppercase w-20 shrink-0">Key</span>
        <span className="flex-1 text-[10px] font-semibold text-[#94A3B8] uppercase">Title</span>
        <span className="text-[10px] font-semibold text-[#94A3B8] uppercase w-[116px] shrink-0 text-right pr-1">Progress</span>
        <span className="text-[10px] font-semibold text-[#94A3B8] uppercase w-24 shrink-0">Status</span>
        <span className="text-[10px] font-semibold text-[#94A3B8] uppercase w-16 shrink-0">Priority</span>
        <span className="text-[10px] font-semibold text-[#94A3B8] uppercase w-8 shrink-0 text-center">Pts</span>
        <span className="text-[10px] font-semibold text-[#94A3B8] uppercase w-6 shrink-0"></span>
      </div>

      {topLevel.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#94A3B8]">No work items yet</div>
      ) : (
        topLevel.map((task) => renderRow(task, 0))
      )}
    </div>
  );
}

// ── Dashboard View ──

function DashboardView({
  tasks,
  sprints,
  employees,
  project,
  onRefresh,
}: {
  tasks: Task[];
  sprints: Sprint[];
  employees: Employee[];
  project?: Project | null;
  onRefresh?: () => void;
}) {
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: "", targetDate: "", description: "" });
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [riskForm, setRiskForm] = useState({ description: "", probability: "medium", impact: "medium", mitigation: "" });
  const [savingRisk, setSavingRisk] = useState(false);

  const milestones = project?.milestones || [];
  const risks = (project as any)?.risks || [];

  const handleAddMilestone = async () => {
    if (!project || !milestoneForm.name.trim()) return;
    setSavingMilestone(true);
    try {
      await projectApi.addMilestone(project._id, { name: milestoneForm.name, targetDate: milestoneForm.targetDate || undefined, description: milestoneForm.description || undefined, status: "pending" });
      toast.success("Milestone added");
      setMilestoneForm({ name: "", targetDate: "", description: "" });
      setShowMilestoneForm(false);
      onRefresh?.();
    } catch (err: any) { toast.error(err.message || "Failed"); }
    finally { setSavingMilestone(false); }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!project) return;
    try {
      await projectApi.deleteMilestone(project._id, milestoneId);
      toast.success("Milestone removed");
      onRefresh?.();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleUpdateMilestone = async (milestoneId: string, data: Record<string, unknown>) => {
    if (!project) return;
    try {
      await projectApi.updateMilestone(project._id, milestoneId, data);
      onRefresh?.();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleAddRisk = async () => {
    if (!project || !riskForm.description.trim()) return;
    setSavingRisk(true);
    try {
      await projectApi.addRisk(project._id, { description: riskForm.description, probability: riskForm.probability, impact: riskForm.impact, mitigation: riskForm.mitigation || undefined, status: "open" });
      toast.success("Risk added");
      setRiskForm({ description: "", probability: "medium", impact: "medium", mitigation: "" });
      setShowRiskForm(false);
      onRefresh?.();
    } catch (err: any) { toast.error(err.message || "Failed"); }
    finally { setSavingRisk(false); }
  };

  const handleDeleteRisk = async (riskId: string) => {
    if (!project) return;
    try {
      await projectApi.deleteRisk(project._id, riskId);
      toast.success("Risk removed");
      onRefresh?.();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const statusConfig = [
    { key: "backlog", label: "Backlog", color: "bg-gray-400" },
    { key: "todo", label: "To Do", color: "bg-slate-400" },
    { key: "in_progress", label: "In Progress", color: "bg-amber-400" },
    { key: "in_review", label: "In Review", color: "bg-violet-400" },
    { key: "blocked", label: "Blocked", color: "bg-red-500" },
    { key: "done", label: "Done", color: "bg-emerald-500" },
  ];

  const statusCounts = statusConfig.map((s) => ({
    ...s,
    count: tasks.filter((t) => t.status === s.key).length,
  }));
  const maxStatusCount = Math.max(...statusCounts.map((s) => s.count), 1);

  // Velocity chart data
  const sprintVelocity = sprints.slice(-6).map((s) => {
    const sprintTasks = tasks.filter((t) => t.sprintId === s._id);
    const planned = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const done = sprintTasks.filter((t) => t.status === "done").reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    return { name: s.name, planned, done };
  });
  const maxVelocity = Math.max(...sprintVelocity.map((s) => s.planned), 1);

  // Team workload
  const assigneeIds = Array.from(new Set(tasks.map((t) => t.assigneeId).filter(Boolean)));
  const workloadData = assigneeIds.map((id) => {
    const assigneeTasks = tasks.filter((t) => t.assigneeId === id);
    const emp = employees.find((e) => (e.userId || e._id) === id);
    return {
      id,
      name: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
      total: assigneeTasks.length,
      done: assigneeTasks.filter((t) => t.status === "done").length,
      inProgress: assigneeTasks.filter((t) => t.status === "in_progress").length,
      blocked: assigneeTasks.filter((t) => t.status === "blocked").length,
    };
  }).sort((a, b) => b.total - a.total).slice(0, 8);
  const maxWorkload = Math.max(...workloadData.map((w) => w.total), 1);

  // Priority breakdown
  const priorityConfig = [
    { key: "critical", label: "Critical", color: "bg-red-500", hex: "#EF4444" },
    { key: "high", label: "High", color: "bg-orange-400", hex: "#FB923C" },
    { key: "medium", label: "Medium", color: "bg-blue-400", hex: "#60A5FA" },
    { key: "low", label: "Low", color: "bg-gray-300", hex: "#D1D5DB" },
    { key: "trivial", label: "Trivial", color: "bg-slate-200", hex: "#E2E8F0" },
  ];
  const priorityCounts = priorityConfig.map((p) => ({
    ...p,
    count: tasks.filter((t) => t.priority === p.key).length,
  }));
  const totalPriority = priorityCounts.reduce((s, p) => s + p.count, 0) || 1;

  // Summary stats
  const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const donePoints = tasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
  const bugCount = tasks.filter((t) => t.type === "bug").length;
  const completionPct = tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Status Distribution + Velocity */}
      <div className="grid grid-cols-2 gap-4">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Status Distribution</h3>
            <span className="text-[10px] text-[#94A3B8] ml-auto">{tasks.length} total</span>
          </div>
          <div className="space-y-2.5">
            {statusCounts.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="text-[11px] text-[#64748B] w-20 shrink-0">{s.label}</span>
                <div className="flex-1 h-5 bg-[#F1F5F9] rounded-md overflow-hidden">
                  <div
                    className={`h-full ${s.color} rounded-md transition-all flex items-center`}
                    style={{ width: `${s.count > 0 ? Math.max(4, (s.count / maxStatusCount) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-[#334155] w-8 text-right shrink-0">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Velocity Chart */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Sprint Velocity</h3>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-[#94A3B8]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#BFDBFE] inline-block" />Planned</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E86C1] inline-block" />Done</span>
            </div>
          </div>
          {sprintVelocity.length === 0 ? (
            <div className="flex items-center justify-center h-[160px] text-[12px] text-[#94A3B8]">No sprint data</div>
          ) : (
            <svg width="100%" height="180" viewBox={`0 0 ${Math.max(sprintVelocity.length * 80, 320)} 180`} preserveAspectRatio="xMidYMid meet">
              {sprintVelocity.map((s, i) => {
                const barHeight = maxVelocity > 0 ? (s.planned / maxVelocity) * 140 : 0;
                const doneHeight = maxVelocity > 0 ? (s.done / maxVelocity) * 140 : 0;
                const x = i * 80 + 10;
                const barWidth = 30;
                return (
                  <g key={i}>
                    <rect x={x} y={160 - barHeight} width={barWidth} height={Math.max(barHeight, 0)} fill="#BFDBFE" rx="3" />
                    <rect x={x} y={160 - doneHeight} width={barWidth} height={Math.max(doneHeight, 0)} fill="#2E86C1" rx="3" />
                    {s.planned > 0 && (
                      <text x={x + barWidth / 2} y={160 - barHeight - 4} textAnchor="middle" fontSize="9" fill="#94A3B8">{s.planned}</text>
                    )}
                    <text x={x + barWidth / 2} y="175" textAnchor="middle" fontSize="9" fill="#94A3B8">
                      {s.name.replace(/sprint\s*/i, "S")}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Row 2: Team Workload + Priority Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Team Workload */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Team Workload</h3>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-[#94A3B8]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Done</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Active</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#CBD5E1] inline-block" />Todo</span>
            </div>
          </div>
          {workloadData.length === 0 ? (
            <div className="flex items-center justify-center h-[120px] text-[12px] text-[#94A3B8]">No assignees</div>
          ) : (
            <div className="space-y-2.5">
              {workloadData.map((w) => {
                const remaining = w.total - w.done - w.inProgress - w.blocked;
                return (
                  <div key={w.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                      {w.name.charAt(0)}
                    </div>
                    <span className="text-[11px] text-[#64748B] w-24 truncate shrink-0">{w.name}</span>
                    <div className="flex-1 h-5 bg-[#F1F5F9] rounded-md overflow-hidden flex">
                      {w.done > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${(w.done / maxWorkload) * 100}%` }} />}
                      {w.inProgress > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(w.inProgress / maxWorkload) * 100}%` }} />}
                      {w.blocked > 0 && <div className="bg-red-400 h-full" style={{ width: `${(w.blocked / maxWorkload) * 100}%` }} />}
                      {remaining > 0 && <div className="bg-[#CBD5E1] h-full" style={{ width: `${(remaining / maxWorkload) * 100}%` }} />}
                    </div>
                    <span className="text-[11px] font-semibold text-[#334155] w-6 text-right shrink-0">{w.total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Priority Breakdown</h3>
          </div>

          {/* Donut via stacked conic-gradient */}
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <div
                className="w-28 h-28 rounded-full"
                style={{
                  background: (() => {
                    let pct = 0;
                    const segments = priorityCounts
                      .filter((p) => p.count > 0)
                      .map((p) => {
                        const start = pct;
                        pct += (p.count / totalPriority) * 100;
                        return `${p.hex} ${start}% ${pct}%`;
                      });
                    return segments.length > 0
                      ? `conic-gradient(${segments.join(", ")})`
                      : "conic-gradient(#E2E8F0 0% 100%)";
                  })(),
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-[#0F172A]">{tasks.length}</span>
                  <span className="text-[8px] text-[#94A3B8]">total</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              {priorityCounts.filter((p) => p.count > 0).map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${p.color}`} />
                  <span className="text-[11px] text-[#64748B] flex-1">{p.label}</span>
                  <span className="text-[11px] font-semibold text-[#334155]">{p.count}</span>
                  <span className="text-[10px] text-[#94A3B8] w-8 text-right">{Math.round((p.count / totalPriority) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary row */}
          <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-[#2E86C1]">{completionPct}%</p>
              <p className="text-[9px] text-[#94A3B8]">Complete</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#0F172A]">{donePoints}/{totalPoints}</p>
              <p className="text-[9px] text-[#94A3B8]">Points</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${bugCount > 0 ? "text-rose-600" : "text-[#0F172A]"}`}>{bugCount}</p>
              <p className="text-[9px] text-[#94A3B8]">Bugs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Milestones ({milestones.length})</h3>
          </div>
          <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="text-[12px] font-medium text-[#2E86C1] hover:underline">+ Add</button>
        </div>

        {showMilestoneForm && (
          <div className="mb-4 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
            <input value={milestoneForm.name} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} placeholder="Milestone name *" className="w-full h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={milestoneForm.targetDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, targetDate: e.target.value })} className="h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]" />
              <input value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} placeholder="Description (optional)" className="h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowMilestoneForm(false)} className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">Cancel</button>
              <button onClick={handleAddMilestone} disabled={savingMilestone} className="text-[12px] px-3 py-1.5 rounded-lg bg-[#2E86C1] text-white hover:bg-[#2471A3] disabled:opacity-60">
                {savingMilestone ? "Saving..." : "Add Milestone"}
              </button>
            </div>
          </div>
        )}

        {milestones.length === 0 && !showMilestoneForm ? (
          <p className="text-[12px] text-[#94A3B8] py-2">No milestones yet. Add one to track key deliverables.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            {milestones.length > 0 && <div className="absolute left-3 top-3 bottom-3 w-px bg-[#E2E8F0]" />}
            <div className="space-y-3">
              {milestones.map((m) => {
                const msColors: Record<string, { dot: string; badge: string }> = {
                  completed: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
                  in_progress: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
                  missed: { dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
                  pending: { dot: "bg-gray-300", badge: "bg-gray-100 text-gray-600" },
                };
                const mc = msColors[m.status] || msColors.pending;
                return (
                  <div key={m._id} className="flex items-start gap-3 pl-7 relative">
                    <div className={`absolute left-2 top-1.5 w-2.5 h-2.5 rounded-full ${mc.dot} ring-2 ring-white`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-[#0F172A]">{m.name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${mc.badge}`}>{m.status}</span>
                        {m.targetDate && <span className="text-[11px] text-[#94A3B8]">{new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                      </div>
                      {m.description && <p className="text-[11px] text-[#64748B] mt-0.5">{m.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.status !== "completed" && (
                        <button onClick={() => m._id && handleUpdateMilestone(m._id, { status: "completed" })} className="text-[10px] text-emerald-600 hover:underline px-1.5 py-0.5 rounded hover:bg-emerald-50">Done</button>
                      )}
                      <button onClick={() => m._id && handleDeleteMilestone(m._id)} className="text-[#94A3B8] hover:text-red-500 transition-colors p-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Risks */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </div>
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Risks ({risks.length})</h3>
          </div>
          <button onClick={() => setShowRiskForm(!showRiskForm)} className="text-[12px] font-medium text-[#2E86C1] hover:underline">+ Add</button>
        </div>

        {showRiskForm && (
          <div className="mb-4 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
            <input value={riskForm.description} onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })} placeholder="Risk description *" className="w-full h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]" />
            <div className="grid grid-cols-2 gap-2">
              <select value={riskForm.probability} onChange={(e) => setRiskForm({ ...riskForm, probability: e.target.value })} className="h-9 text-sm border border-[#E2E8F0] rounded-lg px-2 bg-white text-[#0F172A]">
                <option value="low">Probability: Low</option>
                <option value="medium">Probability: Medium</option>
                <option value="high">Probability: High</option>
              </select>
              <select value={riskForm.impact} onChange={(e) => setRiskForm({ ...riskForm, impact: e.target.value })} className="h-9 text-sm border border-[#E2E8F0] rounded-lg px-2 bg-white text-[#0F172A]">
                <option value="low">Impact: Low</option>
                <option value="medium">Impact: Medium</option>
                <option value="high">Impact: High</option>
                <option value="critical">Impact: Critical</option>
              </select>
            </div>
            <input value={riskForm.mitigation} onChange={(e) => setRiskForm({ ...riskForm, mitigation: e.target.value })} placeholder="Mitigation plan (optional)" className="w-full h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRiskForm(false)} className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">Cancel</button>
              <button onClick={handleAddRisk} disabled={savingRisk} className="text-[12px] px-3 py-1.5 rounded-lg bg-[#2E86C1] text-white hover:bg-[#2471A3] disabled:opacity-60">
                {savingRisk ? "Saving..." : "Add Risk"}
              </button>
            </div>
          </div>
        )}

        {risks.length === 0 && !showRiskForm ? (
          <p className="text-[12px] text-[#94A3B8] py-2">No risks logged. Add one to track potential issues.</p>
        ) : (
          <div className="space-y-2">
            {risks.map((r: any) => {
              const impactColor: Record<string, string> = {
                critical: "bg-red-100 text-red-700",
                high: "bg-orange-100 text-orange-700",
                medium: "bg-amber-100 text-amber-700",
                low: "bg-gray-100 text-gray-600",
              };
              const probColor: Record<string, string> = {
                high: "text-red-600",
                medium: "text-amber-600",
                low: "text-gray-500",
              };
              return (
                <div key={r._id} className="flex items-start gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0F172A]">{r.description}</p>
                    {r.mitigation && <p className="text-[11px] text-[#64748B] mt-0.5">Mitigation: {r.mitigation}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${impactColor[r.impact] || impactColor.medium}`}>Impact: {r.impact}</span>
                      <span className={`text-[11px] font-medium ${probColor[r.probability] || probColor.medium}`}>Prob: {r.probability}</span>
                      {r.status && <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === "mitigated" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{r.status}</span>}
                    </div>
                  </div>
                  <button onClick={() => r._id && handleDeleteRisk(r._id)} className="text-[#94A3B8] hover:text-red-500 transition-colors shrink-0 p-0.5 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timeline View ──

function TimelineView({
  tasks,
  sprints,
  projectId,
  employees,
}: {
  tasks: Task[];
  sprints: Sprint[];
  projectId: string;
  employees: Array<{ _id: string; userId?: string; firstName: string; lastName: string; avatar?: string }>;
}) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  // Build a date range: 3 months back to 3 months forward from current
  const rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0);
  const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;

  const dayWidth = 28; // px per day
  const rowHeight = 36;
  const labelWidth = 260;

  // Build month headers
  const months: { label: string; startDay: number; days: number }[] = [];
  let d = new Date(rangeStart);
  while (d <= rangeEnd) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const startDay = Math.max(0, Math.ceil((firstOfMonth.getTime() - rangeStart.getTime()) / 86400000));
    const endDay = Math.min(totalDays - 1, Math.ceil((lastOfMonth.getTime() - rangeStart.getTime()) / 86400000));
    months.push({
      label: firstOfMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      startDay,
      days: endDay - startDay + 1,
    });
    d = new Date(year, month + 1, 1);
  }

  // Today marker
  const todayOffset = Math.ceil((new Date().setHours(0,0,0,0) - rangeStart.setHours(0,0,0,0)) / 86400000);

  // Separate tasks with and without dates
  const datedTasks = tasks.filter((t) => t.dueDate);
  const undatedTasks = tasks.filter((t) => !t.dueDate);

  // Group by sprint
  const sprintGroups: { sprint: Sprint | null; tasks: Task[] }[] = [];
  const activeSprint = sprints.find((s) => s.status === "active");
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const allSprints = [activeSprint, ...planningSprints].filter(Boolean) as Sprint[];

  for (const sprint of allSprints) {
    const sprintTasks = datedTasks.filter((t) => t.sprintId === sprint._id);
    if (sprintTasks.length > 0) {
      sprintGroups.push({ sprint, tasks: sprintTasks });
    }
  }

  const unsprintedDated = datedTasks.filter((t) => !t.sprintId || !allSprints.find((s) => s._id === t.sprintId));
  if (unsprintedDated.length > 0) {
    sprintGroups.push({ sprint: null, tasks: unsprintedDated });
  }

  const getTaskBarProps = (task: Task) => {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const created = task.createdAt ? new Date(task.createdAt) : null;
    if (!due) return null;
    const endDay = Math.ceil((due.getTime() - new Date(rangeStart).setHours(0,0,0,0)) / 86400000);
    const startDay = created ? Math.max(0, Math.ceil((created.getTime() - new Date(rangeStart).setHours(0,0,0,0)) / 86400000)) : Math.max(0, endDay - 1);
    const clampedStart = Math.max(0, Math.min(startDay, totalDays - 1));
    const clampedEnd = Math.max(0, Math.min(endDay, totalDays - 1));
    const width = Math.max(1, clampedEnd - clampedStart + 1) * dayWidth;
    const left = clampedStart * dayWidth;
    return { left, width, inRange: clampedEnd >= 0 && clampedStart < totalDays };
  };

  const barColors: Record<string, string> = {
    critical: "#EF4444",
    high: "#F97316",
    medium: "#3B82F6",
    low: "#94A3B8",
    trivial: "#CBD5E1",
  };

  const typeLabels: Record<string, string> = {
    epic: "E", story: "S", task: "T", bug: "B", sub_task: "ST", improvement: "I", spike: "SP",
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-semibold text-[#0F172A]">Timeline</h3>
          <span className="text-[11px] text-[#94A3B8]">{datedTasks.length} items with dates</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-[12px] font-medium text-[#334155] min-w-[120px] text-center">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE] hover:bg-[#BFDBFE] transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {datedTasks.length === 0 && undatedTasks.length === 0 ? (
        <div className="py-20 text-center text-sm text-[#94A3B8]">No tasks yet</div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: labelWidth + totalDays * dayWidth }}>
            {/* Month / Day header */}
            <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] sticky top-0 z-10">
              <div style={{ width: labelWidth, minWidth: labelWidth }} className="shrink-0 border-r border-[#E2E8F0] px-3 py-2 text-[11px] font-semibold text-[#94A3B8] uppercase">Task</div>
              <div className="relative flex-1 overflow-hidden">
                {/* Month labels */}
                <div className="flex h-5">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      style={{ width: m.days * dayWidth }}
                      className="shrink-0 flex items-center justify-center text-[10px] font-semibold text-[#64748B] border-r border-[#E2E8F0] overflow-hidden"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Day numbers */}
                <div className="flex h-5">
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const date = new Date(rangeStart.getTime() + i * 86400000);
                    const isToday = i === todayOffset;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <div
                        key={i}
                        style={{ width: dayWidth }}
                        className={`shrink-0 flex items-center justify-center text-[9px] font-medium border-r border-[#F1F5F9] ${
                          isToday ? "text-[#2E86C1] font-bold" : isWeekend ? "text-[#CBD5E1]" : "text-[#94A3B8]"
                        }`}
                      >
                        {date.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Groups */}
            {sprintGroups.map(({ sprint, tasks: groupTasks }, gi) => (
              <div key={gi}>
                {/* Group header */}
                <div className="flex items-center border-b border-[#F1F5F9] bg-[#FAFBFC]">
                  <div style={{ width: labelWidth, minWidth: labelWidth }} className="shrink-0 border-r border-[#E2E8F0] px-3 py-1.5 flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${sprint?.status === "active" ? "bg-emerald-500" : sprint?.status === "planning" ? "bg-blue-400" : "bg-[#94A3B8]"}`} />
                    <span className="text-[11px] font-semibold text-[#334155]">{sprint?.name || "Unassigned"}</span>
                    <span className="text-[10px] text-[#94A3B8]">({groupTasks.length})</span>
                  </div>
                  <div className="relative flex-1" style={{ height: 26 }}>
                    {/* Sprint date range bar */}
                    {sprint?.startDate && sprint?.endDate && (() => {
                      const start = Math.max(0, Math.ceil((new Date(sprint.startDate).getTime() - rangeStart.getTime()) / 86400000));
                      const end = Math.min(totalDays - 1, Math.ceil((new Date(sprint.endDate).getTime() - rangeStart.getTime()) / 86400000));
                      if (end < 0 || start > totalDays - 1) return null;
                      return (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-blue-200"
                          style={{ left: start * dayWidth, width: Math.max(1, end - start + 1) * dayWidth }}
                        />
                      );
                    })()}
                    {/* Weekend shading */}
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const date = new Date(rangeStart.getTime() + i * 86400000);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      return isWeekend ? (
                        <div key={i} className="absolute top-0 bottom-0 bg-[#F8FAFC]" style={{ left: i * dayWidth, width: dayWidth }} />
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Task rows */}
                {groupTasks.map((task) => {
                  const bar = getTaskBarProps(task);
                  const assignee = employees.find((e) => (e.userId || e._id) === task.assigneeId);
                  const isHovered = hoveredTask === task._id;

                  return (
                    <div
                      key={task._id}
                      className="flex items-center border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group"
                      style={{ height: rowHeight }}
                      onMouseEnter={() => setHoveredTask(task._id)}
                      onMouseLeave={() => setHoveredTask(null)}
                    >
                      {/* Label */}
                      <div
                        style={{ width: labelWidth, minWidth: labelWidth }}
                        className="shrink-0 border-r border-[#E2E8F0] px-3 flex items-center gap-2 cursor-pointer"
                        onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
                      >
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          task.priority === "critical" ? "bg-red-100 text-red-700" :
                          task.priority === "high" ? "bg-orange-100 text-orange-700" :
                          task.priority === "medium" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{typeLabels[task.type] || "T"}</span>
                        {task.taskKey && <span className="text-[9px] font-mono text-[#94A3B8] shrink-0">{task.taskKey}</span>}
                        <span className="text-[12px] text-[#0F172A] truncate group-hover:text-[#2E86C1] transition-colors">{task.title}</span>
                        {assignee && (
                          <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[8px] font-bold">
                            {assignee.firstName?.charAt(0)}{assignee.lastName?.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Chart area */}
                      <div className="relative flex-1 overflow-hidden" style={{ height: rowHeight }}>
                        {/* Weekend shading */}
                        {Array.from({ length: totalDays }).map((_, i) => {
                          const date = new Date(rangeStart.getTime() + i * 86400000);
                          return (date.getDay() === 0 || date.getDay() === 6) ? (
                            <div key={i} className="absolute top-0 bottom-0 bg-[#F8FAFC]" style={{ left: i * dayWidth, width: dayWidth }} />
                          ) : null;
                        })}
                        {/* Today line */}
                        {todayOffset >= 0 && todayOffset < totalDays && (
                          <div className="absolute top-0 bottom-0 w-px bg-[#2E86C1] opacity-40 z-10" style={{ left: todayOffset * dayWidth + dayWidth / 2 }} />
                        )}
                        {/* Task bar */}
                        {bar && bar.inRange && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 cursor-pointer transition-all hover:brightness-90 z-20"
                            style={{
                              left: bar.left,
                              width: bar.width,
                              height: 20,
                              backgroundColor: barColors[task.priority] || "#3B82F6",
                              opacity: task.status === "done" ? 0.5 : 1,
                            }}
                            onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
                            title={`${task.title} — Due: ${task.dueDate ? formatDate(task.dueDate) : "No date"}`}
                          >
                            {bar.width > 50 && (
                              <span className="text-white text-[9px] font-medium truncate">{task.title}</span>
                            )}
                            {task.status === "done" && (
                              <svg className="w-3 h-3 text-white ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Undated tasks */}
      {undatedTasks.length > 0 && (
        <div className="border-t border-[#E2E8F0] p-4">
          <h4 className="text-[11px] font-semibold text-[#94A3B8] uppercase mb-2">No Due Date ({undatedTasks.length})</h4>
          <div className="flex flex-wrap gap-1.5">
            {undatedTasks.map((t) => (
              <button
                key={t._id}
                onClick={() => router.push(`/projects/${projectId}/items/${t._id}`)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] hover:border-[#2E86C1] hover:text-[#2E86C1] transition-colors"
              >
                {t.taskKey && <span className="text-[#94A3B8] mr-1">{t.taskKey}</span>}
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-[#E2E8F0] px-4 py-2.5 bg-[#F8FAFC] flex items-center gap-4 flex-wrap">
        {[
          { label: "Critical", color: "#EF4444" },
          { label: "High", color: "#F97316" },
          { label: "Medium", color: "#3B82F6" },
          { label: "Low", color: "#94A3B8" },
        ].map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
            <span className="text-[10px] text-[#64748B]">{p.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-px h-3 bg-[#2E86C1]" />
          <span className="text-[10px] text-[#64748B]">Today</span>
        </div>
      </div>
    </div>
  );
}

// ── Calendar View ──

function CalendarView({
  tasks,
  projectId,
}: {
  tasks: Task[];
  projectId: string;
}) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build task map by date
  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = tasksByDate.get(key) || [];
      existing.push(task);
      tasksByDate.set(key, existing);
    }
  }

  const priorityDot: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-blue-500",
    low: "bg-gray-400",
    trivial: "bg-gray-300",
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(null); };

  const selectedTasks = selectedDate ? (tasksByDate.get(selectedDate) || []) : null;

  const totalWithDueDate = tasks.filter((t) => t.dueDate).length;
  const dueSoon = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000);
    return diff >= 0 && diff <= 7 && t.status !== "done";
  }).length;
  const overdue = tasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < today && t.status !== "done";
  }).length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <p className="text-lg font-bold text-[#0F172A]">{totalWithDueDate}</p>
            <p className="text-[10px] text-[#94A3B8]">Scheduled tasks</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-600">{dueSoon}</p>
            <p className="text-[10px] text-[#94A3B8]">Due in 7 days</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${overdue > 0 ? "bg-red-50" : "bg-gray-50"}`}>
            <svg className={`w-4 h-4 ${overdue > 0 ? "text-red-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <p className={`text-lg font-bold ${overdue > 0 ? "text-red-600" : "text-[#0F172A]"}`}>{overdue}</p>
            <p className="text-[10px] text-[#94A3B8]">Overdue</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-[14px] font-semibold text-[#0F172A] min-w-[140px] text-center">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <button onClick={goToday} className="px-3 py-1 text-[11px] font-medium rounded-lg bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE] hover:bg-[#BFDBFE] transition-colors">
              Today
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[#E2E8F0]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold text-[#94A3B8] uppercase">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells for first week */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-[#F1F5F9] bg-[#FAFBFC]" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTasks = tasksByDate.get(dateKey) || [];
              const isToday = dateKey === todayStr;
              const isSelected = dateKey === selectedDate;
              const isWeekend = (firstDay + i) % 7 === 0 || (firstDay + i) % 7 === 6;
              const hasOverdue = dayTasks.some((t) => t.status !== "done" && new Date(dateKey) < today);

              return (
                <div
                  key={day}
                  className={`min-h-[80px] border-b border-r border-[#F1F5F9] p-1.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-[#EBF5FB] border-[#BFDBFE]" :
                    isToday ? "bg-blue-50" :
                    isWeekend ? "bg-[#FAFBFC]" :
                    "hover:bg-[#F8FAFC]"
                  }`}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold mb-1 ${
                    isToday ? "bg-[#2E86C1] text-white" : "text-[#334155]"
                  }`}>
                    {day}
                  </div>

                  {dayTasks.slice(0, 3).map((t) => (
                    <div
                      key={t._id}
                      className="flex items-center gap-1 mb-0.5 cursor-pointer group"
                      onClick={(e) => { e.stopPropagation(); router.push(`/projects/${projectId}/items/${t._id}`); }}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[t.priority] || "bg-gray-400"}`} />
                      <span className={`text-[9px] truncate group-hover:text-[#2E86C1] ${t.status === "done" ? "line-through text-[#94A3B8]" : hasOverdue ? "text-red-600" : "text-[#475569]"}`}>
                        {t.title}
                      </span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[9px] text-[#94A3B8] font-medium">+{dayTasks.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel: selected day or upcoming tasks */}
        <div className="w-72 shrink-0 space-y-3">
          {selectedDate && selectedTasks ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                <h4 className="text-[13px] font-semibold text-[#0F172A]">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </h4>
                <button onClick={() => setSelectedDate(null)} className="p-1 rounded hover:bg-[#F1F5F9] text-[#94A3B8]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {selectedTasks.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-[#94A3B8]">No tasks due</div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {selectedTasks.map((t) => (
                    <div
                      key={t._id}
                      className="px-4 py-3 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                      onClick={() => router.push(`/projects/${projectId}/items/${t._id}`)}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={`w-2 h-2 rounded-full ${priorityDot[t.priority] || "bg-gray-400"}`} />
                        <span className={`text-[12px] font-medium ${t.status === "done" ? "line-through text-[#94A3B8]" : "text-[#0F172A]"}`}>
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-4">
                        {t.taskKey && <span className="text-[10px] font-mono text-[#94A3B8]">{t.taskKey}</span>}
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          t.status === "done" ? "bg-emerald-50 text-emerald-700" :
                          t.status === "in_progress" ? "bg-amber-50 text-amber-700" :
                          t.status === "blocked" ? "bg-red-50 text-red-700" :
                          "bg-[#F1F5F9] text-[#64748B]"
                        }`}>{t.status.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Upcoming */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <h4 className="text-[12px] font-semibold text-[#334155]">Upcoming (7 days)</h4>
                </div>
                <div className="divide-y divide-[#F1F5F9] max-h-60 overflow-y-auto">
                  {tasks
                    .filter((t) => {
                      if (!t.dueDate || t.status === "done") return false;
                      const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000);
                      return diff >= 0 && diff <= 7;
                    })
                    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                    .map((t) => {
                      const daysLeft = Math.ceil((new Date(t.dueDate!).getTime() - today.getTime()) / 86400000);
                      return (
                        <div
                          key={t._id}
                          className="px-4 py-2.5 cursor-pointer hover:bg-[#F8FAFC] transition-colors flex items-start gap-2"
                          onClick={() => router.push(`/projects/${projectId}/items/${t._id}`)}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityDot[t.priority] || "bg-gray-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-[#0F172A] truncate">{t.title}</p>
                            <p className={`text-[10px] font-medium ${daysLeft === 0 ? "text-red-600" : daysLeft <= 2 ? "text-amber-600" : "text-[#94A3B8]"}`}>
                              {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  {tasks.filter((t) => {
                    if (!t.dueDate || t.status === "done") return false;
                    const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000);
                    return diff >= 0 && diff <= 7;
                  }).length === 0 && (
                    <div className="py-6 text-center text-[11px] text-[#94A3B8]">Nothing due soon</div>
                  )}
                </div>
              </div>

              {/* Overdue */}
              {overdue > 0 && (
                <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                    <h4 className="text-[12px] font-semibold text-red-700">Overdue ({overdue})</h4>
                  </div>
                  <div className="divide-y divide-[#F1F5F9] max-h-48 overflow-y-auto">
                    {tasks
                      .filter((t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "done")
                      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                      .map((t) => (
                        <div
                          key={t._id}
                          className="px-4 py-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2"
                          onClick={() => router.push(`/projects/${projectId}/items/${t._id}`)}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[t.priority] || "bg-gray-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-[#0F172A] truncate">{t.title}</p>
                            <p className="text-[10px] text-red-600 font-medium">
                              {new Date(t.dueDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reports View ──

const REPORT_TYPES = [
  { key: "burndown", label: "Burndown Chart", icon: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6", desc: "Track remaining work across sprint duration" },
  { key: "velocity", label: "Velocity Chart", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", desc: "Story points completed per sprint" },
  { key: "sprint_report", label: "Sprint Report", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7", desc: "Detailed breakdown of sprint completion" },
  { key: "spillover", label: "Spillover & Carry-over", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", desc: "Tasks carried between sprints and spillover history" },
  { key: "cumulative_flow", label: "Cumulative Flow", icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", desc: "Work item status distribution over time" },
  { key: "work_distribution", label: "Work Distribution", icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z", desc: "Breakdown by type, priority and assignee" },
  { key: "bug_report", label: "Bug Report", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", desc: "Open, resolved and trend of bugs" },
  { key: "activity_log", label: "Activity Log", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", desc: "Full audit trail of all project actions" },
] as const;

type ReportKey = typeof REPORT_TYPES[number]["key"];

function ReportsView({
  tasks,
  sprints,
  employees,
  project,
  activityLogs = [],
}: {
  tasks: Task[];
  sprints: Sprint[];
  employees: Array<{ _id: string; userId?: string; firstName: string; lastName: string; avatar?: string }>;
  project: Project;
  activityLogs?: ActivityLog[];
}) {
  const [activeReport, setActiveReport] = useState<ReportKey>("burndown");
  const activeSprint = sprints.find((s) => s.status === "active");
  const [selectedSprintId, setSelectedSprintId] = useState<string>(activeSprint?._id || sprints[0]?._id || "");
  const selectedSprint = sprints.find((s) => s._id === selectedSprintId) || sprints[0] || null;

  const getSprintTasks = (sprint: Sprint) => tasks.filter((t) => t.sprintId === sprint._id);

  // ── Burndown ──
  function BurndownReport() {
    if (!selectedSprint) return <div className="py-20 text-center text-sm text-[#94A3B8]">No sprints available</div>;

    const sprintTasks = getSprintTasks(selectedSprint);
    const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const donePoints = sprintTasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
    const remainingPoints = totalPoints - donePoints;

    const start = selectedSprint.startDate ? new Date(selectedSprint.startDate) : null;
    const end = selectedSprint.endDate ? new Date(selectedSprint.endDate) : null;
    const today = new Date();

    if (!start || !end) return <div className="py-20 text-center text-sm text-[#94A3B8]">Sprint has no dates set</div>;

    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const elapsedDays = Math.min(totalDays, Math.max(0, Math.ceil((today.getTime() - start.getTime()) / 86400000)));

    // Build burndown series: simulate daily completion using task updatedAt
    const doneTasks = sprintTasks.filter((t) => t.status === "done");
    const dayPoints: number[] = Array(totalDays + 1).fill(0);
    for (const t of doneTasks) {
      if (t.updatedAt) {
        const completedDay = Math.min(totalDays, Math.max(0, Math.ceil((new Date(t.updatedAt).getTime() - start.getTime()) / 86400000)));
        dayPoints[completedDay] += t.storyPoints || 0;
      }
    }

    // Cumulative done per day
    let cumDone = 0;
    const actualLine: { day: number; remaining: number }[] = [{ day: 0, remaining: totalPoints }];
    for (let d = 1; d <= elapsedDays; d++) {
      cumDone += dayPoints[d];
      actualLine.push({ day: d, remaining: Math.max(0, totalPoints - cumDone) });
    }

    // SVG dims
    const W = 600; const H = 260;
    const padL = 44; const padR = 20; const padT = 16; const padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const maxY = totalPoints || 1;

    const toX = (day: number) => padL + (day / totalDays) * chartW;
    const toY = (pts: number) => padT + chartH - (pts / maxY) * chartH;

    // Ideal line
    const idealPath = `M${toX(0)},${toY(totalPoints)} L${toX(totalDays)},${toY(0)}`;
    // Actual path
    const actualPath = actualLine.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.day)},${toY(p.remaining)}`).join(" ");
    // Area under actual
    const areaPath = actualPath + ` L${toX(actualLine[actualLine.length - 1].day)},${toY(0)} L${toX(0)},${toY(0)} Z`;

    const pct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
    const isOnTrack = elapsedDays > 0 ? remainingPoints <= totalPoints - (totalPoints / totalDays) * elapsedDays : true;

    return (
      <div className="space-y-4">
        {/* Sprint selector + stats */}
        <div className="flex items-center justify-between">
          <select
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
          >
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.status})</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${isOnTrack ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              {isOnTrack ? "On Track" : "Behind Schedule"}
            </span>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Points", value: totalPoints, color: "text-[#0F172A]", bg: "bg-blue-50" },
            { label: "Completed", value: donePoints, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Remaining", value: remainingPoints, color: remainingPoints > 0 ? "text-amber-600" : "text-emerald-600", bg: "bg-amber-50" },
            { label: "Days Left", value: daysLeft, color: daysLeft <= 2 ? "text-red-600" : "text-[#0F172A]", bg: "bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
              <div className={`w-8 h-8 ${s.bg} rounded-lg mb-2 flex items-center justify-center`}>
                <div className="w-3 h-3 rounded-full bg-current opacity-50" />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-[#94A3B8]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Burndown Chart — {selectedSprint.name}</h4>
            <div className="flex items-center gap-4 text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#CBD5E1] inline-block border-t-2 border-dashed border-[#94A3B8]" />Ideal</span>
              <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#2E86C1] inline-block" />Actual</span>
            </div>
          </div>
          {totalPoints === 0 ? (
            <div className="py-12 text-center text-[12px] text-[#94A3B8]">No story points assigned in this sprint</div>
          ) : (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1={padL} x2={W - padR} y1={padT + f * chartH} y2={padT + f * chartH} stroke="#F1F5F9" strokeWidth={1} />
                  <text x={padL - 6} y={padT + f * chartH + 4} textAnchor="end" fontSize={9} fill="#94A3B8">
                    {Math.round(maxY * (1 - f))}
                  </text>
                </g>
              ))}
              {/* X axis labels */}
              {Array.from({ length: Math.min(totalDays + 1, 8) }).map((_, i) => {
                const day = Math.round(i * totalDays / Math.min(totalDays, 7));
                const d = new Date(start.getTime() + day * 86400000);
                return (
                  <text key={i} x={toX(day)} y={H - padB + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">
                    {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </text>
                );
              })}
              {/* Area */}
              <path d={areaPath} fill="#DBEAFE" opacity={0.4} />
              {/* Ideal line */}
              <path d={idealPath} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
              {/* Actual line */}
              {actualLine.length > 1 && <path d={actualPath} stroke="#2E86C1" strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
              {/* Today marker */}
              {elapsedDays > 0 && elapsedDays < totalDays && (
                <line x1={toX(elapsedDays)} x2={toX(elapsedDays)} y1={padT} y2={H - padB} stroke="#94A3B8" strokeWidth={1} strokeDasharray="3 3" />
              )}
              {/* Data points */}
              {actualLine.map((p, i) => (
                <circle key={i} cx={toX(p.day)} cy={toY(p.remaining)} r={3} fill="#2E86C1" />
              ))}
              {/* Progress label */}
              <text x={W - padR} y={padT + 12} textAnchor="end" fontSize={11} fontWeight="bold" fill={pct >= 80 ? "#059669" : "#2E86C1"}>{pct}% done</text>
            </svg>
          )}
          {selectedSprint.goal && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
              <p className="text-[11px] text-[#64748B]"><span className="font-semibold text-[#334155]">Sprint Goal: </span>{selectedSprint.goal}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Velocity ──
  function VelocityReport() {
    const completedSprints = sprints.filter((s) => s.status === "completed" || s.status === "active").slice(-8);
    if (completedSprints.length === 0) return <div className="py-20 text-center text-sm text-[#94A3B8]">No sprint data yet</div>;

    const data = completedSprints.map((s) => {
      const st = getSprintTasks(s);
      const planned = st.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const done = st.filter((t) => t.status === "done").reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      return { name: s.name, planned, done, status: s.status };
    });

    const maxVal = Math.max(...data.map((d) => d.planned), 1);
    const avgVelocity = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.done, 0) / data.length) : 0;
    const lastVelocity = data[data.length - 1]?.done || 0;
    const trend = lastVelocity >= avgVelocity ? "up" : "down";

    const W = 600; const H = 240;
    const padL = 44; const padR = 20; const padT = 16; const padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const barGroupW = chartW / data.length;
    const barW = Math.min(32, barGroupW * 0.35);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Avg Velocity</p>
            <p className="text-2xl font-bold text-[#2E86C1]">{avgVelocity}</p>
            <p className="text-[10px] text-[#64748B]">story points / sprint</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Last Sprint</p>
            <p className={`text-2xl font-bold ${trend === "up" ? "text-emerald-600" : "text-amber-600"}`}>{lastVelocity}</p>
            <p className={`text-[10px] ${trend === "up" ? "text-emerald-600" : "text-amber-600"}`}>{trend === "up" ? "▲" : "▼"} vs avg</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Sprints Tracked</p>
            <p className="text-2xl font-bold text-[#0F172A]">{data.length}</p>
            <p className="text-[10px] text-[#64748B]">sprints</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Velocity Chart</h4>
            <div className="flex items-center gap-4 text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#BFDBFE] inline-block" />Planned</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#2E86C1] inline-block" />Completed</span>
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W - padR} y1={padT + f * chartH} y2={padT + f * chartH} stroke="#F1F5F9" strokeWidth={1} />
                <text x={padL - 6} y={padT + f * chartH + 4} textAnchor="end" fontSize={9} fill="#94A3B8">{Math.round(maxVal * (1 - f))}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + i * barGroupW + barGroupW / 2;
              const plannedH = maxVal > 0 ? (d.planned / maxVal) * chartH : 0;
              const doneH = maxVal > 0 ? (d.done / maxVal) * chartH : 0;
              return (
                <g key={i}>
                  <rect x={cx - barW - 2} y={padT + chartH - plannedH} width={barW} height={Math.max(plannedH, 1)} fill="#BFDBFE" rx={3} />
                  <rect x={cx + 2} y={padT + chartH - doneH} width={barW} height={Math.max(doneH, 1)} fill={d.status === "active" ? "#93C5FD" : "#2E86C1"} rx={3} />
                  {d.planned > 0 && <text x={cx - barW / 2 - 2} y={padT + chartH - plannedH - 3} textAnchor="middle" fontSize={9} fill="#94A3B8">{d.planned}</text>}
                  {d.done > 0 && <text x={cx + barW / 2 + 2} y={padT + chartH - doneH - 3} textAnchor="middle" fontSize={9} fill="#2E86C1" fontWeight="bold">{d.done}</text>}
                  <text x={cx} y={H - padB + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">{d.name.replace(/sprint\s*/i, "S")}</text>
                  {d.status === "active" && (
                    <rect x={cx - barGroupW / 2 + 2} y={padT} width={barGroupW - 4} height={chartH} fill="#2E86C1" opacity={0.04} rx={4} />
                  )}
                </g>
              );
            })}
            {/* Avg line */}
            {avgVelocity > 0 && (
              <>
                <line x1={padL} x2={W - padR} y1={padT + chartH - (avgVelocity / maxVal) * chartH} y2={padT + chartH - (avgVelocity / maxVal) * chartH} stroke="#F97316" strokeWidth={1.5} strokeDasharray="5 3" />
                <text x={W - padR + 2} y={padT + chartH - (avgVelocity / maxVal) * chartH + 4} fontSize={9} fill="#F97316">avg</text>
              </>
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ── Sprint Report ──
  function SprintReportView() {
    if (!selectedSprint) return <div className="py-20 text-center text-sm text-[#94A3B8]">No sprints available</div>;

    const sprintTasks = getSprintTasks(selectedSprint);
    const statusGroups = [
      { key: "done", label: "Completed", color: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700" },
      { key: "in_progress", label: "In Progress", color: "bg-amber-500", bg: "bg-amber-50 text-amber-700" },
      { key: "in_review", label: "In Review", color: "bg-violet-500", bg: "bg-violet-50 text-violet-700" },
      { key: "blocked", label: "Blocked", color: "bg-red-500", bg: "bg-red-50 text-red-700" },
      { key: "todo", label: "To Do", color: "bg-blue-400", bg: "bg-blue-50 text-blue-700" },
      { key: "backlog", label: "Backlog", color: "bg-gray-400", bg: "bg-gray-100 text-gray-600" },
    ];

    const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const doneCount = sprintTasks.filter((t) => t.status === "done").length;
    const completionRate = sprintTasks.length > 0 ? Math.round((doneCount / sprintTasks.length) * 100) : 0;

    // Group tasks by assignee
    const assigneeMap = new Map<string, Task[]>();
    for (const t of sprintTasks) {
      const key = t.assigneeId || "__unassigned";
      const arr = assigneeMap.get(key) || [];
      arr.push(t);
      assigneeMap.set(key, arr);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
          >
            {sprints.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          {selectedSprint.goal && (
            <p className="text-[12px] text-[#64748B] italic">"{selectedSprint.goal}"</p>
          )}
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {statusGroups.map((sg) => {
            const count = sprintTasks.filter((t) => t.status === sg.key).length;
            const pts = sprintTasks.filter((t) => t.status === sg.key).reduce((s, t) => s + (t.storyPoints || 0), 0);
            return (
              <div key={sg.key} className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#94A3B8]">{sg.label}</p>
                  <p className="text-lg font-bold text-[#0F172A]">{count}</p>
                </div>
                {pts > 0 && <span className="text-[10px] font-semibold text-[#2E86C1]">{pts}pt</span>}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-[#0F172A]">Sprint Progress</span>
            <span className="text-[13px] font-bold text-[#2E86C1]">{completionRate}%</span>
          </div>
          <div className="h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[#94A3B8]">
            <span>{doneCount} of {sprintTasks.length} tasks done</span>
            <span>{totalPoints} total points</span>
          </div>
        </div>

        {/* Tasks by assignee */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Tasks by Assignee</h4>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {Array.from(assigneeMap.entries()).map(([uid, uTasks]) => {
              const member = uid === "__unassigned" ? null : employees.find((e) => (e.userId || e._id) === uid);
              const done = uTasks.filter((t) => t.status === "done").length;
              const pct = uTasks.length > 0 ? Math.round((done / uTasks.length) * 100) : 0;
              return (
                <div key={uid} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {member ? `${member.firstName?.charAt(0)}${member.lastName?.charAt(0)}` : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#0F172A]">{member ? `${member.firstName} ${member.lastName}` : "Unassigned"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-[#94A3B8] shrink-0">{done}/{uTasks.length}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
                    {statusGroups.slice(0, 4).map((sg) => {
                      const c = uTasks.filter((t) => t.status === sg.key).length;
                      return c > 0 ? (
                        <span key={sg.key} className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${sg.bg}`}>{c} {sg.label.toLowerCase()}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Cumulative Flow ──
  function CumulativeFlowReport() {
    const allTasks = tasks;
    if (allTasks.length === 0) return <div className="py-20 text-center text-sm text-[#94A3B8]">No task data</div>;

    const statuses = ["backlog", "todo", "in_progress", "in_review", "done"] as const;
    const statusColors = { backlog: "#94A3B8", todo: "#60A5FA", in_progress: "#F59E0B", in_review: "#8B5CF6", done: "#10B981" };
    const statusLabels = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done" };

    // Build time buckets (weekly for last 8 weeks)
    const now = new Date();
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now.getTime() - (7 - i) * 7 * 86400000);
      return d;
    });

    // Simulate cumulative flow: for each week, count tasks created before that week
    // and approximate status at that point using current status + updatedAt
    const weekData = weeks.map((weekEnd) => {
      const weekTasks = allTasks.filter((t) => t.createdAt && new Date(t.createdAt) <= weekEnd);
      const counts: Record<string, number> = {};
      for (const s of statuses) {
        counts[s] = weekTasks.filter((t) => {
          if (t.status === s) return true;
          if (s === "done" && t.status === "done" && t.updatedAt && new Date(t.updatedAt) <= weekEnd) return true;
          return false;
        }).length;
      }
      return { date: weekEnd, counts };
    });

    const maxTotal = Math.max(...weekData.map((w) => Object.values(w.counts).reduce((a, b) => a + b, 0)), 1);
    const W = 600; const H = 240;
    const padL = 40; const padR = 16; const padT = 16; const padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Build stacked area paths
    const buildAreaPath = (statusIdx: number) => {
      const topPoints = weekData.map((w, i) => {
        const x = padL + (i / (weekData.length - 1)) * chartW;
        let cumulative = 0;
        for (let j = 0; j <= statusIdx; j++) {
          cumulative += w.counts[statuses[j]] || 0;
        }
        const y = padT + chartH - (cumulative / maxTotal) * chartH;
        return { x, y };
      });
      const bottomPoints = statusIdx === 0
        ? topPoints.map((p) => ({ x: p.x, y: padT + chartH }))
        : weekData.map((w, i) => {
            const x = padL + (i / (weekData.length - 1)) * chartW;
            let cumulative = 0;
            for (let j = 0; j < statusIdx; j++) {
              cumulative += w.counts[statuses[j]] || 0;
            }
            const y = padT + chartH - (cumulative / maxTotal) * chartH;
            return { x, y };
          });
      const topPath = topPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const bottomPath = [...bottomPoints].reverse().map((p, i) => `${i === 0 ? "L" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return `${topPath} ${bottomPath} Z`;
    };

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Cumulative Flow Diagram</h4>
            <div className="flex items-center gap-3 flex-wrap">
              {statuses.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[10px] text-[#64748B]">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: statusColors[s] }} />
                  {statusLabels[s]}
                </span>
              ))}
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W - padR} y1={padT + f * chartH} y2={padT + f * chartH} stroke="#F1F5F9" strokeWidth={1} />
                <text x={padL - 6} y={padT + f * chartH + 4} textAnchor="end" fontSize={9} fill="#94A3B8">{Math.round(maxTotal * (1 - f))}</text>
              </g>
            ))}
            {/* Stacked areas */}
            {statuses.map((s, i) => (
              <path key={s} d={buildAreaPath(i)} fill={statusColors[s]} opacity={0.75} />
            ))}
            {/* X labels */}
            {weekData.map((w, i) => (
              <text key={i} x={padL + (i / (weekData.length - 1)) * chartW} y={H - padB + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">
                {w.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </text>
            ))}
          </svg>
        </div>

        {/* Current snapshot */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">Current Status Snapshot</h4>
          <div className="space-y-2">
            {statuses.map((s) => {
              const count = tasks.filter((t) => t.status === s).length;
              const pct = tasks.length > 0 ? (count / tasks.length) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#64748B] w-24 shrink-0">{statusLabels[s]}</span>
                  <div className="flex-1 h-5 bg-[#F1F5F9] rounded-md overflow-hidden">
                    <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, backgroundColor: statusColors[s] }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#334155] w-8 text-right shrink-0">{count}</span>
                  <span className="text-[10px] text-[#94A3B8] w-10 text-right shrink-0">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Work Distribution ──
  function WorkDistributionReport() {
    const typeConfig = [
      { key: "epic", label: "Epic", color: "#8B5CF6" },
      { key: "story", label: "Story", color: "#10B981" },
      { key: "task", label: "Task", color: "#3B82F6" },
      { key: "bug", label: "Bug", color: "#EF4444" },
      { key: "sub_task", label: "Subtask", color: "#94A3B8" },
      { key: "spike", label: "Spike", color: "#F59E0B" },
      { key: "improvement", label: "Improvement", color: "#06B6D4" },
    ];
    const priorityConfig = [
      { key: "critical", label: "Critical", color: "#EF4444" },
      { key: "high", label: "High", color: "#F97316" },
      { key: "medium", label: "Medium", color: "#3B82F6" },
      { key: "low", label: "Low", color: "#94A3B8" },
      { key: "trivial", label: "Trivial", color: "#CBD5E1" },
    ];

    const total = tasks.length || 1;

    const DonutChart = ({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) => {
      const r = size * 0.36;
      const cx = size / 2;
      const cy = size / 2;
      const total = data.reduce((s, d) => s + d.value, 0) || 1;
      let startAngle = -Math.PI / 2;
      const slices = data.filter((d) => d.value > 0).map((d) => {
        const angle = (d.value / total) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        const result = { ...d, path, startAngle, endAngle };
        startAngle = endAngle;
        return result;
      });
      return (
        <svg width={size} height={size}>
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} opacity={0.85} stroke="white" strokeWidth={1.5} />
          ))}
          <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#0F172A">{total}</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fontSize={8} fill="#94A3B8">items</text>
        </svg>
      );
    };

    const typeData = typeConfig.map((t) => ({ ...t, value: tasks.filter((tk) => tk.type === t.key).length })).filter((d) => d.value > 0);
    const priorityData = priorityConfig.map((p) => ({ ...p, value: tasks.filter((tk) => tk.priority === p.key).length })).filter((d) => d.value > 0);

    // Top assignees
    const assigneeCounts = new Map<string, number>();
    for (const t of tasks) {
      const key = t.assigneeId || "__unassigned";
      assigneeCounts.set(key, (assigneeCounts.get(key) || 0) + 1);
    }
    const topAssignees = Array.from(assigneeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* By Type */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">By Work Item Type</h4>
            <div className="flex items-start gap-4">
              <DonutChart data={typeData} />
              <div className="flex-1 space-y-1.5">
                {typeData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-[#64748B] flex-1">{d.label}</span>
                    <span className="text-[11px] font-semibold text-[#334155]">{d.value}</span>
                    <span className="text-[10px] text-[#94A3B8] w-8 text-right">{Math.round((d.value / total) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By Priority */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">By Priority</h4>
            <div className="flex items-start gap-4">
              <DonutChart data={priorityData} />
              <div className="flex-1 space-y-1.5">
                {priorityData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-[#64748B] flex-1">{d.label}</span>
                    <span className="text-[11px] font-semibold text-[#334155]">{d.value}</span>
                    <span className="text-[10px] text-[#94A3B8] w-8 text-right">{Math.round((d.value / total) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* By Assignee */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">By Assignee</h4>
          <div className="space-y-2.5">
            {topAssignees.map(([uid, count]) => {
              const member = uid === "__unassigned" ? null : employees.find((e) => (e.userId || e._id) === uid);
              const pct = (count / tasks.length) * 100;
              const donePct = Math.round((tasks.filter((t) => t.assigneeId === uid && t.status === "done").length / count) * 100);
              return (
                <div key={uid} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {member ? `${member.firstName?.charAt(0)}${member.lastName?.charAt(0)}` : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-[#0F172A]">{member ? `${member.firstName} ${member.lastName}` : "Unassigned"}</span>
                      <span className="text-[10px] text-[#94A3B8]">{count} tasks · {donePct}% done</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2E86C1] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Bug Report ──
  function BugReportView() {
    const bugs = tasks.filter((t) => t.type === "bug");
    const openBugs = bugs.filter((t) => t.status !== "done" && t.status !== "cancelled");
    const resolvedBugs = bugs.filter((t) => t.status === "done");
    const resolutionRate = bugs.length > 0 ? Math.round((resolvedBugs.length / bugs.length) * 100) : 0;

    const priorityConfig = [
      { key: "critical", label: "Critical", color: "#EF4444", bg: "bg-red-50 text-red-700 border-red-200" },
      { key: "high", label: "High", color: "#F97316", bg: "bg-orange-50 text-orange-700 border-orange-200" },
      { key: "medium", label: "Medium", color: "#3B82F6", bg: "bg-blue-50 text-blue-700 border-blue-200" },
      { key: "low", label: "Low", color: "#94A3B8", bg: "bg-gray-100 text-gray-600 border-gray-200" },
    ];

    const statusConfig = [
      { key: "backlog", label: "Backlog" },
      { key: "todo", label: "To Do" },
      { key: "in_progress", label: "In Progress" },
      { key: "in_review", label: "In Review" },
      { key: "blocked", label: "Blocked" },
      { key: "done", label: "Resolved" },
    ];

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Total Bugs</p>
            <p className="text-2xl font-bold text-[#0F172A]">{bugs.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Open</p>
            <p className={`text-2xl font-bold ${openBugs.length > 0 ? "text-red-600" : "text-[#0F172A]"}`}>{openBugs.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600">{resolvedBugs.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Resolution Rate</p>
            <p className={`text-2xl font-bold ${resolutionRate >= 70 ? "text-emerald-600" : resolutionRate >= 40 ? "text-amber-600" : "text-red-600"}`}>{resolutionRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Open by priority */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">Open Bugs by Priority</h4>
            {openBugs.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-emerald-600 font-medium">No open bugs!</div>
            ) : (
              <div className="space-y-2.5">
                {priorityConfig.map((p) => {
                  const count = openBugs.filter((b) => b.priority === p.key).length;
                  const pct = openBugs.length > 0 ? (count / openBugs.length) * 100 : 0;
                  return (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border w-16 text-center ${p.bg}`}>{p.label}</span>
                      <div className="flex-1 h-4 bg-[#F1F5F9] rounded overflow-hidden">
                        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                      </div>
                      <span className="text-[11px] font-semibold text-[#334155] w-5 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bugs by status */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">All Bugs by Status</h4>
            {bugs.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#94A3B8]">No bugs tracked</div>
            ) : (
              <div className="space-y-2.5">
                {statusConfig.map((sc) => {
                  const count = bugs.filter((b) => b.status === sc.key).length;
                  const pct = bugs.length > 0 ? (count / bugs.length) * 100 : 0;
                  return count > 0 ? (
                    <div key={sc.key} className="flex items-center gap-2">
                      <span className="text-[11px] text-[#64748B] w-20 shrink-0">{sc.label}</span>
                      <div className="flex-1 h-4 bg-[#F1F5F9] rounded overflow-hidden">
                        <div className="h-full rounded transition-all bg-[#2E86C1] opacity-80" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-[#334155] w-5 text-right">{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Critical & High open bugs list */}
        {openBugs.filter((b) => b.priority === "critical" || b.priority === "high").length > 0 && (
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-red-100 bg-red-50">
              <h4 className="text-[13px] font-semibold text-red-700">Critical & High Priority Open Bugs</h4>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {openBugs
                .filter((b) => b.priority === "critical" || b.priority === "high")
                .map((bug) => {
                  const assignee = employees.find((e) => (e.userId || e._id) === bug.assigneeId);
                  return (
                    <div key={bug._id} className="px-4 py-3 flex items-center gap-3">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${bug.priority === "critical" ? "bg-red-50 text-red-700 border-red-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                        {bug.priority?.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#0F172A] truncate">{bug.title}</p>
                        {bug.taskKey && <p className="text-[10px] font-mono text-[#94A3B8]">{bug.taskKey}</p>}
                      </div>
                      <span className="text-[10px] text-[#64748B] shrink-0">{bug.status.replace(/_/g, " ")}</span>
                      {assignee ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[8px] font-bold shrink-0" title={`${assignee.firstName} ${assignee.lastName}`}>
                          {assignee.firstName?.charAt(0)}{assignee.lastName?.charAt(0)}
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Spillover & Carry-over Report ──
  function SpilloverReport() {
    const completedSprints = sprints.filter((s) => s.status === "completed");
    if (completedSprints.length === 0) return <div className="py-20 text-center text-sm text-[#94A3B8]">No completed sprints yet</div>;

    const totalSpillover = completedSprints.reduce((s, sp) => s + ((sp as any).spilloverPoints || 0), 0);
    const totalCarryOver = completedSprints.reduce((s, sp) => s + ((sp as any).carryOverPoints || 0), 0);
    const avgSpilloverRate = completedSprints.length > 0
      ? Math.round(completedSprints.reduce((s, sp) => {
          const planned = (sp as any).plannedPoints || 0;
          const spill = (sp as any).spilloverPoints || 0;
          return s + (planned > 0 ? (spill / planned) * 100 : 0);
        }, 0) / completedSprints.length)
      : 0;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Total Spillover Points</p>
            <p className="text-2xl font-bold text-amber-600">{totalSpillover}</p>
            <p className="text-[10px] text-[#64748B]">across all sprints</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Total Carry-Over Points</p>
            <p className="text-2xl font-bold text-blue-600">{totalCarryOver}</p>
            <p className="text-[10px] text-[#64748B]">moved to next sprint</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Avg Spillover Rate</p>
            <p className={`text-2xl font-bold ${avgSpilloverRate > 30 ? "text-red-600" : avgSpilloverRate > 15 ? "text-amber-600" : "text-emerald-600"}`}>{avgSpilloverRate}%</p>
            <p className="text-[10px] text-[#64748B]">{avgSpilloverRate <= 15 ? "Healthy" : avgSpilloverRate <= 30 ? "Moderate" : "High — review capacity"}</p>
          </div>
        </div>

        {/* Per-sprint table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Sprint-by-Sprint Spillover History</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  {["Sprint", "Planned Pts", "Completed Pts", "Spillover Pts", "Carry-Over Pts", "Spillover %", "Velocity"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedSprints.map((sp) => {
                  const planned = (sp as any).plannedPoints || 0;
                  const completed = (sp as any).completedPoints || sp.velocity || 0;
                  const spillover = (sp as any).spilloverPoints || 0;
                  const carryOver = (sp as any).carryOverPoints || 0;
                  const spillRate = planned > 0 ? Math.round((spillover / planned) * 100) : 0;
                  return (
                    <tr key={sp._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-medium text-[#0F172A]">{sp.name}</p>
                        {sp.goal && <p className="text-[10px] text-[#94A3B8] truncate max-w-[160px]">{sp.goal}</p>}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#334155] font-medium">{planned}</td>
                      <td className="px-4 py-3"><span className="text-[12px] font-medium text-emerald-600">{completed}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-[12px] font-medium ${spillover > 0 ? "text-amber-600" : "text-gray-400"}`}>{spillover}</span>
                        {(sp as any).spilloverTaskIds?.length > 0 && (
                          <p className="text-[9px] text-[#94A3B8]">{(sp as any).spilloverTaskIds.length} items</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[12px] font-medium ${carryOver > 0 ? "text-blue-600" : "text-gray-400"}`}>{carryOver}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${spillRate === 0 ? "bg-emerald-50 text-emerald-700" : spillRate <= 20 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                          {spillRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-bold text-[#2E86C1]">{completed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active sprint forecast */}
        {(() => {
          const active = sprints.find((s) => s.status === "active");
          if (!active) return null;
          const activeTasks = tasks.filter((t) => t.sprintId === active._id);
          const incomplete = activeTasks.filter((t) => t.status !== "done");
          const incompletePoints = incomplete.reduce((s, t) => s + (t.storyPoints || 0), 0);
          if (incomplete.length === 0) return null;
          return (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h4 className="text-[13px] font-semibold text-amber-800">Active Sprint Forecast</h4>
              </div>
              <p className="text-[12px] text-amber-700">
                <span className="font-bold">{active.name}</span> currently has{" "}
                <span className="font-bold">{incomplete.length} incomplete items ({incompletePoints} pts)</span>{" "}
                at risk of spilling over.
              </p>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Activity Log Report ──
  function ActivityLogReport() {
    const [activityFilter, setActivityFilter] = useState("all");

    const actionLabels: Record<string, { label: string; color: string; dot: string }> = {
      "task.created": { label: "Created", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
      "task.updated": { label: "Updated", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
      "task.status_changed": { label: "Status Changed", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
      "task.assigned": { label: "Assigned", color: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
      "task.commented": { label: "Commented", color: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
      "sprint.started": { label: "Sprint Started", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
      "sprint.completed": { label: "Sprint Completed", color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-600" },
    };

    const filteredLogs = activityFilter === "all" ? activityLogs : activityLogs.filter((l) => l.action === activityFilter);

    const actionCounts = activityLogs.reduce((acc, l) => {
      acc[l.action] = (acc[l.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const timeAgo = (dateStr: string) => {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return "just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Total Events</p>
            <p className="text-2xl font-bold text-[#0F172A]">{activityLogs.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Tasks Created</p>
            <p className="text-2xl font-bold text-blue-600">{actionCounts["task.created"] || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Status Changes</p>
            <p className="text-2xl font-bold text-amber-600">{actionCounts["task.status_changed"] || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">Updates</p>
            <p className="text-2xl font-bold text-[#64748B]">{actionCounts["task.updated"] || 0}</p>
          </div>
        </div>

        {/* Filter + Log */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Activity Feed</h4>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="h-7 text-[11px] rounded-lg border border-[#E2E8F0] bg-white px-2 text-[#475569] focus:outline-none"
            >
              <option value="all">All Events</option>
              {Object.keys(actionCounts).map((k) => (
                <option key={k} value={k}>{actionLabels[k]?.label || k} ({actionCounts[k]})</option>
              ))}
            </select>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-[12px] text-[#94A3B8]">
              {activityLogs.length === 0 ? "No activity logged yet. Create or update tasks to see logs." : "No events match the filter."}
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9] max-h-[500px] overflow-y-auto">
              {filteredLogs.map((log, i) => {
                const meta = actionLabels[log.action] || { label: log.action, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
                return (
                  <div key={log._id || i} className="px-4 py-3 flex items-start gap-3 hover:bg-[#F8FAFC] transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
                        {log.entityTitle && (
                          <span className="text-[12px] font-medium text-[#0F172A] truncate max-w-[200px]">{log.entityTitle}</span>
                        )}
                      </div>
                      {log.details && log.action === "task.status_changed" && log.details.from && (
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          <span className="font-medium">{(log.details.from as string).replace(/_/g, " ")}</span>
                          <span className="mx-1">→</span>
                          <span className="font-medium text-emerald-600">{(log.details.to as string).replace(/_/g, " ")}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[7px] font-bold">
                          {(log.actorName || "U").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-[#94A3B8]">{log.actorName || "Unknown"}</span>
                        <span className="text-[10px] text-[#CBD5E1]">·</span>
                        <span className="text-[10px] text-[#94A3B8]">{timeAgo(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeReportMeta = REPORT_TYPES.find((r) => r.key === activeReport)!;

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="grid grid-cols-3 gap-3">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeReport === r.key
                ? "bg-[#EBF5FB] border-[#2E86C1] shadow-sm"
                : "bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeReport === r.key ? "bg-[#2E86C1]" : "bg-[#F1F5F9]"}`}>
                <svg className={`w-3.5 h-3.5 ${activeReport === r.key ? "text-white" : "text-[#64748B]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={r.icon} />
                </svg>
              </div>
              <span className={`text-[12px] font-semibold ${activeReport === r.key ? "text-[#2E86C1]" : "text-[#334155]"}`}>{r.label}</span>
            </div>
            <p className="text-[10px] text-[#94A3B8] pl-9">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Active report */}
      <div>
        {activeReport === "burndown" && <BurndownReport />}
        {activeReport === "velocity" && <VelocityReport />}
        {activeReport === "sprint_report" && <SprintReportView />}
        {activeReport === "cumulative_flow" && <CumulativeFlowReport />}
        {activeReport === "work_distribution" && <WorkDistributionReport />}
        {activeReport === "bug_report" && <BugReportView />}
        {activeReport === "spillover" && <SpilloverReport />}
        {activeReport === "activity_log" && <ActivityLogReport />}
      </div>
    </div>
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
  canManageProject,
  canCreateTask,
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
  canManageProject?: boolean;
  canCreateTask?: boolean;
}) {
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const draggedTaskIdRef = useRef<string | null>(null);
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
    draggedTaskIdRef.current = taskId;
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToSprint = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = draggedTaskIdRef.current || e.dataTransfer.getData("text/plain");
    if (!taskId || !selectedSprint) return;
    draggedTaskIdRef.current = null;
    setDraggedTaskId(null);
    try {
      await taskApi.update(taskId, { sprintId: selectedSprint._id } as any);
      try { await sprintApi.addTasks(selectedSprint._id, [taskId]); } catch {}
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to move task to sprint");
    }
  };

  const handleDropToBacklog = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = draggedTaskIdRef.current || e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    draggedTaskIdRef.current = null;
    setDraggedTaskId(null);
    try {
      await taskApi.update(taskId, { sprintId: null } as any);
      if (selectedSprint) {
        try { await sprintApi.removeTask(selectedSprint._id, taskId); } catch {}
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to move task to backlog");
    }
  };

  const handleCreateSprint = async () => {
    if (!newSprintName.trim()) return;
    setCreatingSprint(true);
    try {
      await sprintApi.create({
        name: newSprintName.trim(),
        goal: newSprintGoal.trim() || undefined,
        startDate: newSprintStart || undefined,
        endDate: newSprintEnd || undefined,
        boardId: board?._id || projectId,
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
                {canManageProject && (
                  <button
                    onClick={() => setShowCreateSprint(!showCreateSprint)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#2E86C1] hover:bg-[#EBF5FB] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New Sprint
                  </button>
                )}
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

// ── Gantt Chart View ──

function computeGanttProgress(task: Task): number {
  if (task.status === "done") return 100;
  if (task.status === "cancelled") return 0;
  if (task.status === "in_review") return 80;
  if (task.status === "in_progress") return 50;
  if (task.status === "todo") return 10;
  return 0;
}

function buildGanttItems(
  tasks: Task[],
  employees: Array<{ _id: string; userId?: string; firstName: string; lastName: string }>,
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

  function toItem(task: Task, level: number): GanttItem {
    const children = childrenOf.get(task._id) || [];
    const childItems = children.map((c) => toItem(c, level + 1));

    let startDate = task.createdAt ? new Date(task.createdAt) : fallbackStart;
    let endDate = task.dueDate
      ? new Date(task.dueDate)
      : task.completedAt
        ? new Date(task.completedAt)
        : new Date(startDate.getTime() + 7 * 86400000);

    if (childItems.length > 0) {
      const cs = Math.min(...childItems.map((c) => c.startDate.getTime()));
      const ce = Math.max(...childItems.map((c) => c.endDate.getTime()));
      if (cs < startDate.getTime()) startDate = new Date(cs);
      if (ce > endDate.getTime()) endDate = new Date(ce);
    }

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
      progress: computeGanttProgress(task),
      assignee: task.assigneeId,
      assigneeName: task.assigneeId ? empMap.get(task.assigneeId) : undefined,
      priority: task.priority,
      dependencies: deps.length > 0 ? deps : undefined,
      children: childItems.length > 0 ? childItems : undefined,
      level,
      parentId: task.parentTaskId || undefined,
    };
  }

  const typeOrder: Record<string, number> = { epic: 0, story: 1, task: 2, bug: 3, improvement: 4, spike: 5, sub_task: 6 };
  roots.sort((a, b) => {
    const ta = typeOrder[a.type] ?? 9;
    const tb = typeOrder[b.type] ?? 9;
    if (ta !== tb) return ta - tb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });

  return roots.map((t) => toItem(t, 0));
}

function GanttChartView({
  tasks,
  projectId,
  employees,
  project,
}: {
  tasks: Task[];
  projectId: string;
  employees: Array<{ _id: string; userId?: string; firstName: string; lastName: string }>;
  project: Project | null;
}) {
  const ganttItems = useMemo(
    () => buildGanttItems(tasks, employees, project?.startDate ? new Date(project.startDate) : undefined),
    [tasks, employees, project],
  );

  const milestones = useMemo(() => {
    if (!project?.milestones) return [];
    return (project.milestones as Array<any>).map((m: any) => ({
      id: m._id || m.name,
      name: m.name,
      targetDate: new Date(m.targetDate),
      status: m.status,
    }));
  }, [project]);

  if (tasks.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h12M3 12h16M3 16h8M3 20h14" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[#334155] mb-1">No tasks to display</h3>
          <p className="text-[13px] text-[#94A3B8]">Create tasks with dates to see them on the Gantt chart.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <GanttChart
      items={ganttItems}
      projectId={projectId}
      projectStartDate={project?.startDate ? new Date(project.startDate) : undefined}
      projectEndDate={project?.endDate ? new Date(project.endDate) : undefined}
      milestones={milestones}
    />
  );
}

// ── Roadmap Inline View ──

function RoadmapInlineView({ projectId, project }: { projectId: string; project: Project | null }) {
  const router = useRouter();
  const [roadmapData, setRoadmapData] = useState<RoadmapProject | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoadmapData = useCallback(async () => {
    if (!project) return;
    try {
      setLoading(true);
      let epics: Task[] = [];
      try {
        const epicRes = await taskApi.getAll({ projectId, type: "epic" } as Record<string, string>);
        epics = Array.isArray(epicRes.data) ? epicRes.data : [];
      } catch {
        // ignore
      }

      const epicItems: RoadmapEpic[] = await Promise.all(
        epics.map(async (epic) => {
          let childTotal = 0;
          let childDone = 0;
          try {
            const childRes = await taskApi.getChildren(epic._id);
            const children = Array.isArray(childRes.data) ? childRes.data : [];
            childTotal = children.length;
            childDone = children.filter((c) => c.status === "done").length;
          } catch {
            // ignore
          }
          return {
            _id: epic._id,
            title: epic.title,
            status: epic.status,
            createdAt: epic.createdAt,
            dueDate: epic.dueDate,
            projectId: epic.projectId,
            childTotal,
            childDone,
          };
        })
      );

      const milestones: RoadmapMilestone[] = (project.milestones || []).map((m) => ({
        _id: m._id || crypto.randomUUID(),
        name: m.name,
        targetDate: m.targetDate,
        completedDate: m.completedDate,
        status: m.status as RoadmapMilestone["status"],
        description: m.description,
        phase: m.phase,
        deliverables: m.deliverables,
      }));

      const releases: RoadmapRelease[] = (project.releases || []).map((r) => ({
        _id: r._id || crypto.randomUUID(),
        name: r.name,
        status: r.status,
        startDate: r.startDate,
        releaseDate: r.releaseDate,
        releasedDate: r.releasedDate,
        description: r.description,
      }));

      setRoadmapData({
        _id: project._id,
        projectName: project.projectName,
        milestones,
        releases,
        epics: epicItems,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId, project]);

  useEffect(() => {
    fetchRoadmapData();
  }, [fetchRoadmapData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-[#F1F5F9] rounded w-full" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="h-10 bg-[#F1F5F9] rounded w-48 shrink-0" />
            <div className="h-10 bg-[#F1F5F9] rounded flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!roadmapData) return null;

  return (
    <RoadmapView
      projects={[roadmapData]}
      mode="single"
      onEpicClick={(epicId, projId) => router.push(`/projects/${projId}/items/${epicId}`)}
    />
  );
}

// ── Main Page ──

type ViewTab = "summary" | "timeline" | "board" | "calendar" | "list" | "planning" | "hierarchy" | "reports" | "gantt" | "roadmap" | "activity";

export default function ProjectDetailPage() {
  const { user, loading: authLoading, logout, isProjectRole, hasOrgRole } = useAuth();
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
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [saveTemplateForm, setSaveTemplateForm] = useState({ name: "", description: "" });
  const [showCompleteSprintModal, setShowCompleteSprintModal] = useState(false);
  const [completingSprintId, setCompletingSprintId] = useState<string | null>(null);
  const [completeSprintOption, setCompleteSprintOption] = useState<"backlog" | "next_sprint">("backlog");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [editForm, setEditForm] = useState({ projectName: "", description: "", status: "", priority: "", category: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  // Permission helpers — computed from project team and org role
  const projectTeam = (project?.team as Array<{ userId: string; role: string }>) || [];
  const canManageProject = isProjectRole(projectTeam, 'manager');
  const canCreateTask = isProjectRole(projectTeam, 'member');
  const canDeleteProject = hasOrgRole('admin');

  const handleTaskUpdate = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, ...patch } : t));
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes, boardsRes, empRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getAll({ projectId, limit: "100" } as any),
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

      // Fetch sprints by projectId (works regardless of board)
      try {
        const sprintsRes = await sprintApi.getByProject(projectId);
        setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
      } catch {
        setSprints([]);
      }

      // Fetch activity logs
      try {
        const actRes = await taskApi.getProjectActivity(projectId, 100);
        setActivityLogs(Array.isArray(actRes.data) ? actRes.data : []);
      } catch {
        setActivityLogs([]);
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

  const handleCompleteSprint = (sprintId: string) => {
    setCompletingSprintId(sprintId);
    setCompleteSprintOption("backlog");
    setShowCompleteSprintModal(true);
  };

  const confirmCompleteSprint = async () => {
    if (!completingSprintId) return;
    setSaving(true);
    try {
      await sprintApi.complete(completingSprintId, {
        moveUnfinishedTo: completeSprintOption as 'backlog' | 'next_sprint',
      });
      const incompleteCount = tasks.filter((t) => t.sprintId === completingSprintId && t.status !== "done").length;
      toast.success(`Sprint completed! ${incompleteCount > 0 ? `${incompleteCount} unfinished items moved to ${completeSprintOption === "next_sprint" ? "next sprint" : "backlog"}.` : "All items completed!"}`);
      setShowCompleteSprintModal(false);
      setCompletingSprintId(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete sprint");
    } finally {
      setSaving(false);
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

  const handleSaveAsTemplate = async () => {
    if (!saveTemplateForm.name.trim()) return;
    try {
      setSaving(true);
      await projectApi.saveAsTemplate(projectId, {
        name: saveTemplateForm.name,
        description: saveTemplateForm.description || undefined,
      });
      toast.success("Project saved as template");
      setShowSaveTemplateModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save as template");
    } finally {
      setSaving(false);
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
              {showMenu && (canManageProject || canDeleteProject) && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 py-1">
                    {canManageProject && (
                      <button
                        onClick={openEditModal}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Project
                      </button>
                    )}
                    {canManageProject && (
                      <button
                        onClick={() => {
                          setSaveTemplateForm({ name: `${project.projectName} Template`, description: project.description || "" });
                          setShowSaveTemplateModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Save as Template
                      </button>
                    )}
                    {(canManageProject || canDeleteProject) && <div className="border-t border-[#F1F5F9] my-1" />}
                    {canDeleteProject && (
                      <button
                        onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Project
                      </button>
                    )}
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
              <div className="flex gap-0.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-1">
                {([
                  { key: "summary", label: "Summary", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" },
                  { key: "timeline", label: "Timeline", icon: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" },
                  { key: "gantt", label: "Gantt", icon: "M3 4h18M3 8h12M3 12h16M3 16h8M3 20h14" },
                  { key: "board", label: "Board", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" },
                  { key: "calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                  { key: "list", label: "List", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
                  { key: "planning", label: "Backlog", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
                  { key: "reports", label: "Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                  { key: "roadmap", label: "Roadmap", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
                  { key: "activity", label: "Activity", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                ] as const).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveView(key as ViewTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === key ? "bg-white text-[#2E86C1] shadow-sm border border-[#E2E8F0]" : "text-[#64748B] hover:text-[#334155] hover:bg-white/60"}`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    {label}
                  </button>
                ))}
                {/* Analytics link */}
                <button
                  onClick={() => router.push(`/projects/${projectId}/analytics`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-[#8B5CF6] hover:bg-purple-50 border border-transparent hover:border-purple-200"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Analytics
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

            {canCreateTask && (
              <Button size="sm" onClick={() => router.push(`/projects/${projectId}/items/new?boardId=${board?._id || ""}`)} className="gap-1.5 h-9 bg-[#2E86C1] hover:bg-[#2471A3]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Views */}
        {activeView === "board" && (
          <BoardView tasks={filteredTasks} board={board} projectId={projectId} projectKey={project?.projectKey} employees={employees} onRefresh={fetchAll} onTaskUpdate={handleTaskUpdate} parentMap={parentMap} childrenMap={childrenMap} methodology={project?.methodology} canCreateTask={canCreateTask} canManageProject={canManageProject} />
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
            canManageProject={canManageProject}
            canCreateTask={canCreateTask}
          />
        )}
        {activeView === "hierarchy" && (
          <HierarchyView tasks={filteredTasks} projectId={projectId} employees={employees} childrenMap={childrenMap} />
        )}
        {activeView === "summary" && (
          <DashboardView tasks={tasks} sprints={sprints} employees={employees} project={project} onRefresh={fetchAll} />
        )}
        {activeView === "timeline" && (
          <TimelineView tasks={filteredTasks} sprints={sprints} projectId={projectId} employees={employees} />
        )}
        {activeView === "gantt" && (
          <GanttChartView tasks={filteredTasks} projectId={projectId} employees={employees} project={project} />
        )}
        {activeView === "calendar" && (
          <CalendarView tasks={filteredTasks} projectId={projectId} />
        )}
        {activeView === "reports" && (
          <ReportsView tasks={tasks} sprints={sprints} employees={employees} project={project} activityLogs={activityLogs} />
        )}
        {activeView === "roadmap" && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-[#64748B]">Strategic roadmap view for this project</p>
              <button
                onClick={() => router.push(`/projects/${projectId}/roadmap`)}
                className="text-[12px] text-[#2E86C1] hover:text-[#2471A3] font-medium flex items-center gap-1"
              >
                Open Full View
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
            <RoadmapInlineView projectId={projectId} project={project} />
          </div>
        )}
        {activeView === "activity" && (
          <div className="mt-2">
            <ActivityFeed projectId={projectId} limit={30} />
          </div>
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

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Save as Template</h2>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">From: {project.projectName}</p>
              </div>
              <button onClick={() => setShowSaveTemplateModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Template Name *</label>
                <Input
                  value={saveTemplateForm.name}
                  onChange={(e) => setSaveTemplateForm({ ...saveTemplateForm, name: e.target.value })}
                  className="h-10 border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Description</label>
                <textarea
                  value={saveTemplateForm.description}
                  onChange={(e) => setSaveTemplateForm({ ...saveTemplateForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-none"
                />
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="text-[11px] font-semibold text-[#475569] mb-1">What will be saved:</p>
                <ul className="text-[11px] text-[#64748B] space-y-0.5">
                  <li>Project settings (board type, sprint duration, estimation)</li>
                  <li>Milestones (converted to relative day offsets)</li>
                  <li>Team role structure</li>
                  <li>Category and methodology</li>
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveTemplateModal(false)} className="h-9 px-4 text-[13px]">Cancel</Button>
              <Button
                onClick={handleSaveAsTemplate}
                disabled={saving || !saveTemplateForm.name.trim()}
                className="h-9 px-5 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]"
              >
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Sprint Modal */}
      {showCompleteSprintModal && completingSprintId && (() => {
        const sprint = sprints.find((s) => s._id === completingSprintId);
        if (!sprint) return null;
        const sprintTasks = tasks.filter((t) => t.sprintId === completingSprintId);
        const doneTasks = sprintTasks.filter((t) => t.status === "done");
        const incompleteTasks = sprintTasks.filter((t) => t.status !== "done");
        const donePoints = doneTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const incompletePoints = incompleteTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const hasNextSprint = sprints.some((s) => s.status === "planning");
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCompleteSprintModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-[#F1F5F9]">
                <h2 className="text-lg font-bold text-[#0F172A]">Complete Sprint</h2>
                <p className="text-[13px] text-[#64748B] mt-0.5">{sprint.name}</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{doneTasks.length}</p>
                    <p className="text-[10px] text-emerald-600">Completed</p>
                    <p className="text-[10px] text-emerald-500 font-medium">{donePoints} pts</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${incompleteTasks.length > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                    <p className={`text-2xl font-bold ${incompleteTasks.length > 0 ? "text-amber-600" : "text-gray-400"}`}>{incompleteTasks.length}</p>
                    <p className={`text-[10px] ${incompleteTasks.length > 0 ? "text-amber-600" : "text-gray-400"}`}>Incomplete</p>
                    {incompletePoints > 0 && <p className="text-[10px] text-amber-500 font-medium">{incompletePoints} pts</p>}
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#2E86C1]">{totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0}%</p>
                    <p className="text-[10px] text-[#2E86C1]">Velocity</p>
                    <p className="text-[10px] text-blue-400 font-medium">{donePoints}/{totalPoints} pts</p>
                  </div>
                </div>
                {incompleteTasks.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#334155] mb-2">What to do with {incompleteTasks.length} incomplete item{incompleteTasks.length !== 1 ? "s" : ""}?</p>
                    <div className="space-y-2">
                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${completeSprintOption === "backlog" ? "border-[#2E86C1] bg-[#EBF5FB]" : "border-[#E2E8F0] hover:border-[#CBD5E1]"}`}>
                        <input type="radio" name="carryover" value="backlog" checked={completeSprintOption === "backlog"} onChange={() => setCompleteSprintOption("backlog")} className="mt-0.5" />
                        <div>
                          <p className="text-[13px] font-medium text-[#0F172A]">Move to Backlog</p>
                          <p className="text-[11px] text-[#64748B]">Items return to backlog for future sprint planning</p>
                        </div>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${completeSprintOption === "next_sprint" ? "border-[#2E86C1] bg-[#EBF5FB]" : !hasNextSprint ? "border-[#F1F5F9] bg-[#F8FAFC] opacity-50 cursor-not-allowed" : "border-[#E2E8F0] hover:border-[#CBD5E1]"}`}>
                        <input type="radio" name="carryover" value="next_sprint" disabled={!hasNextSprint} checked={completeSprintOption === "next_sprint"} onChange={() => setCompleteSprintOption("next_sprint")} className="mt-0.5" />
                        <div>
                          <p className="text-[13px] font-medium text-[#0F172A]">Carry over to next sprint <span className="text-[10px] text-amber-600 font-semibold ml-1">{incompletePoints}pts carry-over</span></p>
                          <p className="text-[11px] text-[#64748B]">{hasNextSprint ? "Items move to the next planned sprint automatically" : "No planning sprint available — create one first"}</p>
                        </div>
                      </label>
                    </div>
                    <div className="mt-3 max-h-32 overflow-y-auto space-y-1">
                      {incompleteTasks.slice(0, 5).map((t) => (
                        <div key={t._id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#F8FAFC]">
                          <div className={`w-1.5 h-1.5 rounded-full ${t.status === "blocked" ? "bg-red-500" : t.status === "in_progress" ? "bg-amber-500" : "bg-gray-400"}`} />
                          <span className="text-[11px] text-[#334155] truncate flex-1">{t.title}</span>
                          {t.storyPoints && <span className="text-[10px] text-[#94A3B8]">{t.storyPoints}pt</span>}
                        </div>
                      ))}
                      {incompleteTasks.length > 5 && <p className="text-[10px] text-[#94A3B8] pl-2">+{incompleteTasks.length - 5} more</p>}
                    </div>
                  </div>
                )}
                {incompleteTasks.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-[12px] text-emerald-700 font-medium">All items completed — perfect sprint!</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-[#F1F5F9] flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCompleteSprintModal(false)} className="h-9 px-4 text-[13px]">Cancel</Button>
                <Button onClick={confirmCompleteSprint} disabled={saving} className="h-9 px-5 text-[13px] bg-emerald-600 hover:bg-emerald-700">
                  {saving ? "Completing..." : "Complete Sprint"}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
