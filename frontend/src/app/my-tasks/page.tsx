"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { taskApi, hrApi, Task, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────────────────────
// /my-tasks — Personal todo-list page.
//
// Tasks here have no project attached (isPersonal=true on the backend), with
// optional collaborators for sharing. Distinct from /tasks (project index)
// and /my-work (assigned tasks across projects).
//
// Layout matches the rest of the web app: fixed left Sidebar + content
// shifted right with `md:ml-[260px]` so it doesn't slide under the nav.
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_TONES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  critical: { bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200",     label: "Critical" },
  high:     { bg: "bg-orange-50",  text: "text-orange-700",  ring: "ring-orange-200",  label: "High" },
  medium:   { bg: "bg-blue-50",    text: "text-[#2E86C1]",   ring: "ring-blue-200",    label: "Medium" },
  low:      { bg: "bg-slate-100",  text: "text-slate-600",   ring: "ring-slate-200",   label: "Low" },
  trivial:  { bg: "bg-slate-100",  text: "text-slate-500",   ring: "ring-slate-200",   label: "Trivial" },
};

const STATUS_FLOW: Record<string, { next: string; nextLabel: string }> = {
  backlog:     { next: "in_progress", nextLabel: "Start" },
  todo:        { next: "in_progress", nextLabel: "Start" },
  in_progress: { next: "done",        nextLabel: "Complete" },
  in_review:   { next: "done",        nextLabel: "Complete" },
  blocked:     { next: "in_progress", nextLabel: "Resume" },
  done:        { next: "todo",        nextLabel: "Reopen" },
  cancelled:   { next: "todo",        nextLabel: "Reopen" },
};

function formatDue(d?: string): { label: string; tone: string; isOverdue: boolean } {
  if (!d) return { label: "No due date", tone: "text-slate-400", isOverdue: false };
  const due = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: `Overdue · ${Math.abs(diff)}d`, tone: "text-red-600 font-semibold", isOverdue: true };
  if (diff === 0) return { label: "Due today", tone: "text-amber-600 font-semibold", isOverdue: false };
  if (diff === 1) return { label: "Due tomorrow", tone: "text-amber-600", isOverdue: false };
  if (diff < 7) return { label: `Due in ${diff}d`, tone: "text-slate-600", isOverdue: false };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    tone: "text-slate-600",
    isOverdue: false,
  };
}

function formatRelative(d: string): string {
  const date = new Date(d);
  const today = new Date();
  const diff = Math.floor(
    (today.getTime() - date.getTime()) / 86_400_000,
  );
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MyTasksPage() {
  return (
    <RouteGuard>
      <MyTasksInner />
    </RouteGuard>
  );
}

function MyTasksInner() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskApi.getPersonalTasks();
      setTasks((res as { data?: Task[] })?.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Lazy-load employees only when the create dialog opens (collaborator picker).
  useEffect(() => {
    if (!createOpen || employees.length > 0) return;
    hrApi
      .getEmployees({ limit: "200" })
      .then((res) => setEmployees((res as { data?: Employee[] })?.data || []))
      .catch(() => null);
  }, [createOpen, employees.length]);

  // Stats — drive the four cards at the top.
  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
    const done = tasks.filter((t) => t.status === "done");
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const overdue = open.filter((t) => formatDue(t.dueDate).isOverdue);
    return {
      total: tasks.length,
      open: open.length,
      inProgress: inProgress.length,
      done: done.length,
      overdue: overdue.length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let out = [...tasks];
    if (filter === "open") {
      out = out.filter((t) => t.status !== "done" && t.status !== "cancelled");
    } else if (filter === "done") {
      out = out.filter((t) => t.status === "done" || t.status === "cancelled");
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      );
    }
    // Sort: overdue first, then by due date, then by created
    return out.sort((a, b) => {
      const aOverdue = formatDue(a.dueDate).isOverdue ? 0 : 1;
      const bOverdue = formatDue(b.dueDate).isOverdue ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      if (a.dueDate && b.dueDate)
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
  }, [tasks, filter, search]);

  const handleAdvance = async (task: Task) => {
    const flow = STATUS_FLOW[task.status as string] || STATUS_FLOW.todo;
    try {
      await taskApi.update(task._id!, { status: flow.next } as Partial<Task>);
      await fetchTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update.");
    }
  };

  const handleDelete = async (task: Task) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${task.title}"?`)) {
      return;
    }
    try {
      await taskApi.delete(task._id!);
      toast.success("Task deleted");
      await fetchTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* ─── Header ──────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#0F172A]">My Tasks</h1>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#2E86C1]">
                Personal
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#94A3B8]">
              Your personal todo list — no project, no client. Add collaborators when you want to share.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#2E86C1] hover:bg-[#2471A3] gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5v11M1.5 7h11" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New task
          </Button>
        </div>

        {/* ─── Stats ───────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Open"
            value={stats.open}
            colorClass="bg-blue-50"
            iconColor="text-[#2E86C1]"
            iconBg="bg-blue-100"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            }
          />
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            colorClass="bg-amber-50"
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />}
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            colorClass="bg-red-50"
            iconColor="text-red-600"
            iconBg="bg-red-100"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
          />
          <StatCard
            label="Completed"
            value={stats.done}
            colorClass="bg-emerald-50"
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
          />
        </div>

        {/* ─── Filter bar ──────────────────────────────────────────── */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1">
              {[
                { key: "open" as const,  label: "Open",  count: stats.open },
                { key: "done" as const,  label: "Done",  count: stats.done },
                { key: "all" as const,   label: "All",   count: stats.total },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    filter === f.key
                      ? "bg-[#2E86C1] text-white"
                      : "text-[#64748B] hover:bg-[#F1F5F9]"
                  }`}
                >
                  {f.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      filter === f.key
                        ? "bg-white/25 text-white"
                        : "bg-[#F1F5F9] text-[#64748B]"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative max-w-xs flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="h-9 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] pl-10 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── Task list ───────────────────────────────────────────── */}
        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center justify-center p-12 text-sm text-[#94A3B8]">
              Loading…
            </CardContent>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                <svg
                  className="h-8 w-8 text-[#2E86C1]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  {filter === "done" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  )}
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A]">
                {filter === "done" ? "Nothing completed yet" : "Your todo list is empty"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-[#94A3B8]">
                {filter === "done"
                  ? "Tasks you complete will show up here."
                  : "Personal tasks are your own — no project required. Add a teammate as a collaborator if you want to share."}
              </p>
              {filter !== "done" && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="mt-5 bg-[#2E86C1] hover:bg-[#2471A3]"
                >
                  Create your first task
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskRow
                key={task._id}
                task={task}
                onAdvance={() => handleAdvance(task)}
                onDelete={() => handleDelete(task)}
              />
            ))}
          </div>
        )}

        {createOpen && (
          <CreateTaskDialog
            employees={employees}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
              fetchTasks();
              toast.success("Task created");
            }}
          />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card — small icon + value + label, with a soft accent corner.
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  colorClass,
  iconColor,
  iconBg,
  icon,
}: {
  label: string;
  value: number;
  colorClass: string;
  iconColor: string;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className={`absolute right-0 top-0 -mr-2 -mt-2 h-20 w-20 rounded-bl-[60px] ${colorClass}`} />
      <CardContent className="relative p-5">
        <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <svg className={`h-4 w-4 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icon}
          </svg>
        </div>
        <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
        <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task row — checkbox + title + meta + inline actions.
// ─────────────────────────────────────────────────────────────────────────────
function TaskRow({
  task,
  onAdvance,
  onDelete,
}: {
  task: Task;
  onAdvance: () => void;
  onDelete: () => void;
}) {
  const tone = PRIORITY_TONES[task.priority as string] || PRIORITY_TONES.medium;
  const flow = STATUS_FLOW[task.status as string] || STATUS_FLOW.todo;
  const due = formatDue(task.dueDate);
  const isComplete = task.status === "done" || task.status === "cancelled";

  return (
    <Card
      className={`group border-0 shadow-sm transition hover:shadow-md ${
        due.isOverdue && !isComplete ? "ring-1 ring-red-200" : ""
      }`}
    >
      <CardContent className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button
          onClick={onAdvance}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
            isComplete
              ? "border-emerald-500 bg-emerald-500"
              : "border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-blue-50"
          }`}
          aria-label={flow.nextLabel}
          title={flow.nextLabel}
        >
          {isComplete && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className={`text-[15px] font-semibold leading-snug ${
                  isComplete
                    ? "text-[#94A3B8] line-through"
                    : "text-[#0F172A]"
                }`}
              >
                {task.title}
              </h3>
              {task.description && (
                <p className="mt-1 line-clamp-1 text-xs text-[#64748B]">
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
              {!isComplete && (
                <button
                  onClick={onAdvance}
                  className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:border-[#2E86C1] hover:text-[#2E86C1]"
                >
                  {flow.nextLabel}
                </button>
              )}
              <button
                onClick={onDelete}
                className="rounded-md p-1.5 text-[#94A3B8] hover:bg-red-50 hover:text-red-600"
                title="Delete"
                aria-label="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 4h8M5 4V2.5h4V4M4.5 4l.5 7.5h4l.5-7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wider ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
            >
              {tone.label}
            </span>
            <span className={`flex items-center gap-1 font-medium ${due.tone}`}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1.5" y="2.5" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1.5 5h9" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              {due.label}
            </span>
            {Array.isArray(task.collaborators) && task.collaborators.length > 0 ? (
              <span className="flex items-center gap-1 font-medium text-[#64748B]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="4" cy="4.5" r="1.8" stroke="currentColor" strokeWidth="1.1" />
                  <circle cx="8.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                {task.collaborators.length} {task.collaborators.length === 1 ? "collaborator" : "collaborators"}
              </span>
            ) : null}
            <span className="text-[#94A3B8]">· created {formatRelative(task.createdAt!)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Task Dialog
// ─────────────────────────────────────────────────────────────────────────────
function CreateTaskDialog({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [collabSearch, setCollabSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!collabSearch.trim()) return employees;
    const q = collabSearch.trim().toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q),
    );
  }, [employees, collabSearch]);

  const handleSubmit = async () => {
    setError("");
    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters.");
      return;
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError("Due date must be in YYYY-MM-DD format.");
      return;
    }
    setSubmitting(true);
    try {
      await taskApi.createPersonalTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        collaborators: collaboratorIds.length ? collaboratorIds : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">New task</h2>
            <p className="text-xs text-[#94A3B8]">
              Personal · no project required
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#475569]"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              autoFocus
              maxLength={120}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="desc">Description (optional)</Label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes, context, links..."
              className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="trivial">Trivial</option>
              </select>
            </div>
            <div>
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <button
              type="button"
              onClick={() => setShowCollaborators((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">
                  Collaborators {collaboratorIds.length > 0 && (
                    <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#2E86C1]">
                      {collaboratorIds.length}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-[#94A3B8]">
                  Optional — share this task with teammates
                </div>
              </div>
              <span className="text-[#94A3B8]">
                {showCollaborators ? "−" : "+"}
              </span>
            </button>

            {showCollaborators && (
              <div className="mt-3 space-y-2">
                <Input
                  placeholder="Search teammates..."
                  value={collabSearch}
                  onChange={(e) => setCollabSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-auto rounded-md border border-[#E2E8F0] bg-white">
                  {filteredEmployees.length === 0 ? (
                    <p className="p-3 text-center text-xs text-[#94A3B8]">
                      {employees.length === 0 ? "Loading directory…" : "No matches"}
                    </p>
                  ) : (
                    filteredEmployees.slice(0, 50).map((emp) => {
                      const id = emp.userId || emp._id;
                      if (!id) return null;
                      const selected = collaboratorIds.includes(id);
                      const fullName =
                        `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                        emp.email ||
                        "—";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setCollaboratorIds((prev) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id],
                            )
                          }
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-[#F8FAFC] ${
                            selected ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#2E86C1]">
                            {(fullName[0] || "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-[#0F172A]">
                              {fullName}
                            </div>
                            <div className="truncate text-xs text-[#94A3B8]">
                              {emp.email}
                            </div>
                          </div>
                          {selected && (
                            <span className="text-[#2E86C1]">✓</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#2E86C1] hover:bg-[#2471A3]"
          >
            {submitting ? "Creating…" : "Create task"}
          </Button>
        </div>
      </div>
    </div>
  );
}
