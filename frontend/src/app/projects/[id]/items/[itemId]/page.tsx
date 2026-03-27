"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, hrApi, Project, Task, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { RichTextEditor, CommentEditor, CommentContent } from "@/components/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const typeConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  epic: { label: "Epic", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  story: { label: "Story", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "text-green-600", bg: "bg-green-50 border-green-200" },
  task: { label: "Task", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  bug: { label: "Bug", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "text-red-600", bg: "bg-red-50 border-red-200" },
  sub_task: { label: "Subtask", icon: "M4 6h16M4 12h8m-8 6h16", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
  improvement: { label: "Improvement", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-teal-600", bg: "bg-teal-50 border-teal-200" },
  spike: { label: "Spike", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
};

const statusOptions = [
  { value: "backlog", label: "Backlog", dot: "bg-[#94A3B8]" },
  { value: "todo", label: "To Do", dot: "bg-blue-500" },
  { value: "in_progress", label: "In Progress", dot: "bg-amber-500" },
  { value: "in_review", label: "In Review", dot: "bg-violet-500" },
  { value: "blocked", label: "Blocked", dot: "bg-red-500" },
  { value: "done", label: "Done", dot: "bg-emerald-500" },
  { value: "cancelled", label: "Cancelled", dot: "bg-gray-400" },
];

const priorityOptions = [
  { value: "critical", label: "Critical", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "low", label: "Low", color: "bg-gray-400" },
  { value: "trivial", label: "Trivial", color: "bg-gray-300" },
];

const pointScale = [1, 2, 3, 5, 8, 13, 21];

export default function ItemDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const itemId = params.itemId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [status, setStatus] = useState("backlog");
  const [priority, setPriority] = useState("medium");
  const [storyPoints, setStoryPoints] = useState<number | null>(null);
  const [estimatedHours, setEstimatedHours] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  const [dirty, setDirty] = useState(false);

  // Comments
  const [addingComment, setAddingComment] = useState(false);

  // Time log
  const [logHours, setLogHours] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logDesc, setLogDesc] = useState("");
  const [loggingTime, setLoggingTime] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pRes, tRes, eRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getById(itemId),
        hrApi.getEmployees(),
      ]);
      setProject(pRes.data || null);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : []);
      const t = tRes.data;
      if (t) {
        setTask(t);
        if (t.parentTaskId) {
          try { const pRes = await taskApi.getById(t.parentTaskId); setParentTask(pRes.data || null); } catch { setParentTask(null); }
        } else {
          setParentTask(null);
        }
        setTitle(t.title);
        setDescription(t.description || "");
        setType(t.type);
        setStatus(t.status);
        setPriority(t.priority);
        setStoryPoints(t.storyPoints ?? null);
        setEstimatedHours(t.estimatedHours ? String(t.estimatedHours) : "");
        setAssigneeId(t.assigneeId || "");
        setDueDate(t.dueDate ? t.dueDate.split("T")[0] : "");
        setLabels(t.labels?.join(", ") || "");
        setDirty(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [user, projectId, itemId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await taskApi.update(itemId, {
        title,
        description: description || undefined,
        type: type as Task["type"],
        status: status as Task["status"],
        priority: priority as Task["priority"],
        storyPoints: storyPoints ?? undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        labels: labels ? labels.split(",").map((l) => l.trim()).filter(Boolean) : undefined,
      });
      toast.success("Saved!");
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogTime = async () => {
    if (!logHours || Number(logHours) <= 0) { toast.error("Enter valid hours"); return; }
    setLoggingTime(true);
    try {
      await taskApi.logTime(itemId, { hours: Number(logHours), date: logDate, description: logDesc || undefined });
      setLogHours("");
      setLogDesc("");
      toast.success("Time logged");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to log time");
    } finally {
      setLoggingTime(false);
    }
  };

  const markDirty = () => { if (!dirty) setDirty(true); };

  if (authLoading || !user || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[#0F172A]">Item not found</h2>
          <Button className="mt-4" onClick={() => router.push(`/projects/${projectId}`)}>Back to Board</Button>
        </div>
      </div>
    );
  }

  const tc = typeConfig[type] || typeConfig.task;
  const assignee = employees.find((e) => (e.userId || e._id) === assigneeId);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/projects/${projectId}`)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-bold">{project?.projectKey?.slice(0, 2) || "P"}</div>
              <span className="text-[13px] text-[#64748B]">{project?.projectName}</span>
              <svg className="w-4 h-4 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              <span className={`flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded-full border ${tc.bg} ${tc.color}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tc.icon} /></svg>
                {tc.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dirty && <span className="text-[11px] text-amber-600 font-medium">Unsaved changes</span>}
            <Button onClick={handleSave} disabled={saving || !dirty} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 min-w-[100px]">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-0 h-full">
          {/* Left — Main */}
          <div className="flex-1 p-8 lg:p-10 overflow-y-auto space-y-6">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
              className="w-full text-[28px] font-bold text-[#0F172A] placeholder:text-[#CBD5E1] bg-transparent border-0 outline-none p-0"
            />

            {/* Type pills */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeConfig).map(([key, t]) => (
                <button key={key} onClick={() => { setType(key); markDirty(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all ${type === key ? `${t.bg} ${t.color}` : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] bg-white"}`}>
                  <svg className={`w-3.5 h-3.5 ${type === key ? t.color : "text-[#94A3B8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Description — Rich Text */}
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
                Description
              </label>
              <RichTextEditor
                content={description}
                onChange={(html) => { setDescription(html); markDirty(); }}
                placeholder="Add a detailed description... Drag & drop images or paste screenshots."
                minHeight="300px"
              />
            </div>

            {/* Labels */}
            <div>
              <label className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2 block">Labels</label>
              <Input value={labels} onChange={(e) => { setLabels(e.target.value); markDirty(); }} placeholder="frontend, api, urgent" className="h-10 text-sm bg-white border-[#E2E8F0]" />
              {labels && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {labels.split(",").map((l) => l.trim()).filter(Boolean).map((label, i) => (
                    <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">{label}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Activity ({task.comments?.length || 0})
              </label>

              <CommentEditor
                onSubmit={async (text) => {
                  setAddingComment(true);
                  try {
                    await taskApi.addComment(itemId, text);
                    toast.success("Comment added");
                    fetchData();
                  } catch (err: any) {
                    toast.error(err.message || "Failed to add comment");
                  } finally {
                    setAddingComment(false);
                  }
                }}
                employees={employees}
                userInitials={`${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase()}
                submitting={addingComment}
              />

              {(task.comments || []).length > 0 && (
                <div className="space-y-4 mt-5">
                  {(task.comments || []).slice().reverse().map((c, i) => (
                    <div key={c._id || i} className="flex gap-3 ml-12">
                      <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[10px] font-bold text-[#64748B] shrink-0">
                        {(c.userId || "?").slice(-2).toUpperCase()}
                      </div>
                      <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] p-3.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[12px] font-semibold text-[#334155]">{c.userId?.slice(-6) || "User"}</span>
                          <span className="text-[10px] text-[#94A3B8]">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                        <CommentContent text={c.content} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — Details panel */}
          <div className="w-[340px] shrink-0 bg-white border-l border-[#E2E8F0] p-6 overflow-y-auto space-y-5">
            <h3 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Details</h3>

            {/* Parent link */}
            {parentTask && (
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Parent</label>
                <button
                  onClick={() => router.push(`/projects/${projectId}/items/${parentTask._id}`)}
                  className="flex items-center gap-2 text-[12px] text-[#2E86C1] hover:underline w-full text-left"
                >
                  <svg className={`w-3.5 h-3.5 shrink-0 ${(typeConfig[parentTask.type] || typeConfig.task).color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={(typeConfig[parentTask.type] || typeConfig.task).icon} />
                  </svg>
                  <span className="truncate">{parentTask.taskKey ? `${parentTask.taskKey} · ` : ""}{parentTask.title}</span>
                </button>
              </div>
            )}

            {/* Status */}
            <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Status</label>
                <div className="space-y-0.5">
                  {statusOptions.map((s) => (
                    <button key={s.value} onClick={() => { setStatus(s.value); markDirty(); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${status === s.value ? "bg-[#EBF5FB] text-[#2E86C1]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}>
                      <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                      {s.label}
                      {status === s.value && <svg className="w-3.5 h-3.5 ml-auto text-[#2E86C1]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </button>
                  ))}
                </div>
            </div>

            <div className="border-t border-[#F1F5F9]" />

            {/* Priority */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Priority</label>
              <div className="space-y-0.5">
                {priorityOptions.map((p) => (
                  <button key={p.value} onClick={() => { setPriority(p.value); markDirty(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${priority === p.value ? "bg-[#EBF5FB] text-[#2E86C1]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                    {p.label}
                    {priority === p.value && <svg className="w-3.5 h-3.5 ml-auto text-[#2E86C1]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#F1F5F9]" />

            {/* Story Points */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Story Points</label>
              <div className="flex flex-wrap gap-2">
                {pointScale.map((p) => (
                  <button key={p} onClick={() => { setStoryPoints(storyPoints === p ? null : p); markDirty(); }}
                    className={`w-10 h-10 rounded-lg text-[14px] font-bold transition-all ${storyPoints === p ? "bg-[#2E86C1] text-white shadow-sm" : "bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#F1F5F9]" />

            {/* Assignee */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Assignee</label>
              <select value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); markDirty(); }}
                className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e._id} value={e.userId || e._id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>

            <div className="border-t border-[#F1F5F9]" />

            {/* Estimated Hours */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Estimated Hours</label>
              <Input type="number" value={estimatedHours} onChange={(e) => { setEstimatedHours(e.target.value); markDirty(); }} placeholder="0" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>

            {/* Logged Hours */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Logged Hours</label>
              <p className="text-xl font-bold text-[#0F172A]">{task.loggedHours || 0}h</p>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Due Date</label>
              <Input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); markDirty(); }} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>

            <div className="border-t border-[#F1F5F9]" />

            {/* Log Time */}
            <div>
              <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Log Time</label>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="Hours" step="0.5" className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                  <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <Input value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder="What did you work on?" className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                <Button onClick={handleLogTime} disabled={loggingTime || !logHours} size="sm" className="w-full bg-[#2E86C1] hover:bg-[#2471A3] h-9">
                  {loggingTime ? "Logging..." : "Log Time"}
                </Button>
              </div>
            </div>

            <div className="border-t border-[#F1F5F9]" />

            {/* Meta */}
            <div className="space-y-1.5 text-[11px] text-[#94A3B8]">
              {task.createdAt && <p>Created {new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
              {task.updatedAt && <p>Updated {new Date(task.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
            </div>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}
