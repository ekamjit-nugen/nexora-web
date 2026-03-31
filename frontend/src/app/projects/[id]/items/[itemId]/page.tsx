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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // Children
  const [children, setChildren] = useState<Task[]>([]);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [childType, setChildType] = useState("sub_task");

  // Dependencies
  const [depSearch, setDepSearch] = useState("");
  const [depSearchResults, setDepSearchResults] = useState<Task[]>([]);
  const [depType, setDepType] = useState("blocked_by");
  const [addingDep, setAddingDep] = useState(false);
  const [showDepModal, setShowDepModal] = useState(false);

  // Time log
  const [logHours, setLogHours] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logDesc, setLogDesc] = useState("");
  const [logCategory, setLogCategory] = useState("development");
  const [loggingTime, setLoggingTime] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pRes, tRes, eRes, childRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getById(itemId),
        hrApi.getEmployees(),
        taskApi.getChildren(itemId).catch(() => ({ data: [] })),
      ]);
      setProject(pRes.data || null);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : []);
      setChildren(Array.isArray(childRes.data) ? childRes.data : []);
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
      await taskApi.logTime(itemId, { hours: Number(logHours), date: logDate, description: logDesc || undefined, category: logCategory });
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

  const handleToggleFlag = async () => {
    try { const res = await taskApi.toggleFlag(itemId); setTask(res.data || task); } catch { toast.error("Failed"); }
  };
  const handleToggleWatch = async () => {
    try { const res = await taskApi.toggleWatch(itemId); setTask(res.data || task); } catch { toast.error("Failed"); }
  };
  const handleToggleVote = async () => {
    try { const res = await taskApi.toggleVote(itemId); setTask(res.data || task); } catch { toast.error("Failed"); }
  };

  const handleAddChild = async () => {
    if (!childTitle.trim()) return;
    try {
      await taskApi.create({ title: childTitle, type: childType as Task["type"], projectId, projectKey: project?.projectKey, parentTaskId: itemId, status: "todo", priority: "medium" });
      setChildTitle(""); setAddingChild(false);
      toast.success("Sub-item created");
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDepSearch = async (q: string) => {
    setDepSearch(q);
    if (q.length < 2) { setDepSearchResults([]); return; }
    try {
      const res = await taskApi.getAll({ projectId, search: q });
      const results = (Array.isArray(res.data) ? res.data : []).filter((t) => t._id !== itemId);
      setDepSearchResults(results.slice(0, 8));
    } catch { setDepSearchResults([]); }
  };

  const handleAddDep = async (depItemId: string) => {
    setAddingDep(true);
    try {
      const res = await taskApi.addDependency(itemId, depItemId, depType);
      setTask(res.data || task);
      setShowDepModal(false); setDepSearch(""); setDepSearchResults([]);
      toast.success("Dependency added");
    } catch (err: any) { toast.error(err.message || "Failed"); }
    finally { setAddingDep(false); }
  };

  const handleRemoveDep = async (depItemId: string) => {
    try {
      const res = await taskApi.removeDependency(itemId, depItemId);
      setTask(res.data || task);
      toast.success("Dependency removed");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      const res = await taskApi.updateComment(itemId, commentId, editingCommentText);
      setTask(res.data || task);
      setEditingCommentId(null); setEditingCommentText("");
      toast.success("Comment updated");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await taskApi.deleteComment(itemId, commentId);
      setTask(res.data || task);
      toast.success("Comment deleted");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    try {
      const res = await taskApi.toggleReaction(itemId, commentId, emoji);
      setTask(res.data || task);
    } catch { /* silent */ }
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
          <div className="flex items-center gap-2">
            {/* Flag */}
            <button
              onClick={handleToggleFlag}
              title="Flag"
              className={`p-2 rounded-lg transition-colors ${task.isFlagged ? "bg-amber-50 text-amber-500" : "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-amber-500"}`}
            >
              <svg className="w-4 h-4" fill={task.isFlagged ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18m0-13.5h14.25l-2.5 3.5 2.5 3.5H3" />
              </svg>
            </button>
            {/* Watch */}
            <button
              onClick={handleToggleWatch}
              title="Watch"
              className={`p-2 rounded-lg transition-colors ${task.watchers?.includes(user._id) ? "bg-blue-50 text-blue-500" : "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-blue-500"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {/* Vote */}
            <button
              onClick={handleToggleVote}
              title="Vote"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-[12px] font-medium ${task.votes?.includes(user._id) ? "bg-violet-50 text-violet-600" : "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-violet-600"}`}
            >
              <svg className="w-3.5 h-3.5" fill={task.votes?.includes(user._id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.669A1.989 1.989 0 013.916 17.5v-2.38a2 2 0 00-.91-1.686L2.37 12.5" />
              </svg>
              {(task.votes?.length || 0) > 0 && <span>{task.votes!.length}</span>}
            </button>
            {dirty && <span className="text-[11px] text-amber-600 font-medium ml-1">Unsaved changes</span>}
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

            {/* Dependencies */}
            {(() => {
              const deps: Array<{ itemId: string; type: string }> = (task as any).dependencies || [];
              const blockedByDeps = deps.filter((d) => d.type === "blocked_by");
              const blocksDeps = deps.filter((d) => d.type === "blocks");
              const relatesDeps = deps.filter((d) => d.type === "relates_to");
              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                      Dependencies ({deps.length})
                    </label>
                    <button onClick={() => setShowDepModal(true)} className="text-[11px] font-medium text-[#2E86C1] hover:underline">+ Add</button>
                  </div>

                  {/* Dep modal */}
                  {showDepModal && (
                    <div className="mb-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
                      <div className="flex gap-2">
                        <select value={depType} onChange={(e) => setDepType(e.target.value)} className="h-9 text-sm border border-[#E2E8F0] rounded-lg px-2 bg-white text-[#0F172A]">
                          <option value="blocked_by">Blocked By</option>
                          <option value="blocks">Blocks</option>
                          <option value="relates_to">Relates To</option>
                          <option value="duplicates">Duplicates</option>
                        </select>
                        <input
                          value={depSearch}
                          onChange={(e) => handleDepSearch(e.target.value)}
                          placeholder="Search tasks..."
                          className="flex-1 h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]"
                        />
                        <button onClick={() => { setShowDepModal(false); setDepSearch(""); setDepSearchResults([]); }} className="text-[#94A3B8] hover:text-[#64748B] text-xs">✕</button>
                      </div>
                      {depSearchResults.length > 0 && (
                        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
                          {depSearchResults.map((t) => (
                            <button key={t._id} onClick={() => handleAddDep(t._id)} disabled={addingDep}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F8FAFC] text-left border-b border-[#F1F5F9] last:border-0">
                              <span className="text-[10px] font-mono text-[#94A3B8]">{t.taskKey || t._id.slice(-6)}</span>
                              <span className="text-[12px] text-[#0F172A] truncate">{t.title}</span>
                              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${t.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {deps.length === 0 && !showDepModal && (
                    <p className="text-[12px] text-[#94A3B8] py-1">No dependencies. Add one to link related tasks.</p>
                  )}

                  {[
                    { label: "Blocked By", items: blockedByDeps, dotColor: "bg-red-400" },
                    { label: "Blocks", items: blocksDeps, dotColor: "bg-orange-400" },
                    { label: "Relates To", items: relatesDeps, dotColor: "bg-blue-400" },
                  ].map(({ label, items, dotColor }) => items.length > 0 && (
                    <div key={label} className="mb-3">
                      <p className="text-[10px] font-semibold text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />{label}
                      </p>
                      {items.map((d) => (
                        <div key={d.itemId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] mb-1.5">
                          <span className="text-[11px] text-[#64748B] flex-1 truncate">{d.itemId}</span>
                          <button onClick={() => handleRemoveDep(d.itemId)} className="text-[#94A3B8] hover:text-red-500 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Child Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                  Sub-items ({children.length})
                </label>
                <button onClick={() => setAddingChild(!addingChild)} className="text-[11px] font-medium text-[#2E86C1] hover:underline">+ Add</button>
              </div>

              {/* Progress bar */}
              {children.length > 0 && (() => {
                const done = children.filter((c) => c.status === "done").length;
                const pct = Math.round((done / children.length) * 100);
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1">
                      <span>{done} of {children.length} done</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {addingChild && (
                <div className="flex gap-2 mb-3">
                  <select value={childType} onChange={(e) => setChildType(e.target.value)} className="h-9 text-sm border border-[#E2E8F0] rounded-lg px-2 bg-white text-[#0F172A] shrink-0">
                    <option value="sub_task">Subtask</option>
                    <option value="task">Task</option>
                    <option value="bug">Bug</option>
                    <option value="story">Story</option>
                  </select>
                  <input
                    value={childTitle}
                    onChange={(e) => setChildTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddChild()}
                    placeholder="Sub-item title..."
                    className="flex-1 h-9 text-sm border border-[#E2E8F0] rounded-lg px-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  />
                  <Button onClick={handleAddChild} size="sm" className="bg-[#2E86C1] hover:bg-[#2471A3] h-9">Add</Button>
                  <Button onClick={() => { setAddingChild(false); setChildTitle(""); }} size="sm" variant="outline" className="h-9 border-[#E2E8F0]">✕</Button>
                </div>
              )}

              {children.map((child) => {
                const childAssignee = employees.find((e) => (e.userId || e._id) === child.assigneeId);
                const tc = typeConfig[child.type] || typeConfig.task;
                return (
                  <div
                    key={child._id}
                    onClick={() => router.push(`/projects/${projectId}/items/${child._id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm bg-white cursor-pointer mb-1.5 transition-all"
                  >
                    <svg className={`w-3.5 h-3.5 shrink-0 ${tc.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tc.icon} /></svg>
                    <span className="text-[11px] text-[#94A3B8] font-mono shrink-0">{child.taskKey || ""}</span>
                    <span className="text-[13px] text-[#0F172A] flex-1 truncate">{child.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${child.status === "done" ? "bg-emerald-50 text-emerald-700" : child.status === "in_progress" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {child.status.replace("_", " ")}
                    </span>
                    {childAssignee && (
                      <div className="w-6 h-6 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {childAssignee.firstName.charAt(0)}
                      </div>
                    )}
                  </div>
                );
              })}
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
                  {(task.comments || []).slice().reverse().map((c, i) => {
                    const isOwn = c.userId === user._id;
                    const isEditing = editingCommentId === c._id;
                    const QUICK_EMOJIS = ["👍", "👎", "❤️", "🎉", "🚀", "😄"];
                    return (
                      <div key={c._id || i} className="flex gap-3 ml-12">
                        <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[10px] font-bold text-[#64748B] shrink-0">
                          {(c.userId || "?").slice(-2).toUpperCase()}
                        </div>
                        <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] p-3.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[12px] font-semibold text-[#334155]">{c.userId?.slice(-6) || "User"}</span>
                            <span className="text-[10px] text-[#94A3B8]">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                            {c.isEdited && <span className="text-[10px] text-[#94A3B8] italic">(edited)</span>}
                            {isOwn && !isEditing && (
                              <div className="ml-auto flex items-center gap-1.5">
                                <button onClick={() => { setEditingCommentId(c._id || null); setEditingCommentText(c.content); }} className="text-[10px] text-[#94A3B8] hover:text-[#2E86C1]">Edit</button>
                                <button onClick={() => c._id && handleDeleteComment(c._id)} className="text-[10px] text-[#94A3B8] hover:text-red-500">Delete</button>
                              </div>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="w-full text-sm border border-[#E2E8F0] rounded-lg p-2 outline-none focus:ring-2 focus:ring-[#2E86C1] resize-none"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => c._id && handleEditComment(c._id)} className="h-7 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3]">Save</Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }} className="h-7 text-[11px] border-[#E2E8F0]">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <CommentContent text={c.content} />
                              {/* Reactions */}
                              <div className="flex items-center flex-wrap gap-1.5 mt-2">
                                {(c.reactions || []).map((r) => (
                                  <button
                                    key={r.emoji}
                                    onClick={() => c._id && handleToggleReaction(c._id, r.emoji)}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${r.userIds?.includes(user._id) ? "bg-[#EBF5FB] border-[#2E86C1] text-[#2E86C1]" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"}`}
                                  >
                                    <span>{r.emoji}</span>
                                    <span>{r.userIds?.length || 0}</span>
                                  </button>
                                ))}
                                {/* Quick emoji picker */}
                                <div className="flex gap-0.5">
                                  {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => c._id && handleToggleReaction(c._id, emoji)}
                                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] text-[12px] transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                <select value={logCategory} onChange={(e) => setLogCategory(e.target.value)} className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A]">
                  <option value="development">Development</option>
                  <option value="design">Design</option>
                  <option value="meeting">Meeting</option>
                  <option value="review">Review</option>
                  <option value="testing">Testing</option>
                  <option value="documentation">Documentation</option>
                  <option value="admin">Admin</option>
                  <option value="training">Training</option>
                  <option value="other">Other</option>
                </select>
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
