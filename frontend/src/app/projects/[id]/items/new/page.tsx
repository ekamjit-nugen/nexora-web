"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, hrApi, Project, Task, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { RichTextEditor, CommentEditor, CommentContent } from "@/components/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Type config ──

const typeOptions = [
  { value: "epic", label: "Epic", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", desc: "Large body of work broken into stories" },
  { value: "story", label: "Story", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "text-green-600", bg: "bg-green-50 border-green-200", desc: "User-facing feature or requirement" },
  { value: "task", label: "Task", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", desc: "General work item" },
  { value: "bug", label: "Bug", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "text-red-600", bg: "bg-red-50 border-red-200", desc: "Something that needs fixing" },
  { value: "improvement", label: "Improvement", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-teal-600", bg: "bg-teal-50 border-teal-200", desc: "Enhancement to existing feature" },
  { value: "spike", label: "Spike", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", desc: "Time-boxed research or investigation" },
  { value: "sub_task", label: "Subtask", icon: "M4 6h16M4 12h8m-8 6h16", color: "text-gray-600", bg: "bg-gray-50 border-gray-200", desc: "Smaller piece of a parent item" },
];

const priorityOptions = [
  { value: "critical", label: "Critical", color: "bg-red-500", ring: "ring-red-200" },
  { value: "high", label: "High", color: "bg-orange-500", ring: "ring-orange-200" },
  { value: "medium", label: "Medium", color: "bg-blue-500", ring: "ring-blue-200" },
  { value: "low", label: "Low", color: "bg-gray-400", ring: "ring-gray-200" },
  { value: "trivial", label: "Trivial", color: "bg-gray-300", ring: "ring-gray-100" },
];

const pointScale = [1, 2, 3, 5, 8, 13, 21];

// ── Templates ──

const descTemplates = [
  {
    name: "User Story",
    desc: "As a / I want / So that",
    icon: "M12 6.253v13",
    color: "text-green-600",
    bg: "bg-green-50",
    content: `<h2>User Story</h2><p><strong>As a</strong> [type of user]<br><strong>I want</strong> [an action or feature]<br><strong>So that</strong> [benefit or value]</p><h3>Acceptance Criteria</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Criteria 1</p></li><li data-type="taskItem" data-checked="false"><p>Criteria 2</p></li><li data-type="taskItem" data-checked="false"><p>Criteria 3</p></li></ul><h3>Notes</h3><p></p>`,
  },
  {
    name: "Bug Report",
    desc: "Steps to reproduce, expected vs actual",
    icon: "M12 9v2m0 4h.01",
    color: "text-red-600",
    bg: "bg-red-50",
    content: `<h2>Bug Report</h2><h3>Description</h3><p>Brief description of the issue.</p><h3>Steps to Reproduce</h3><ol><li><p>Step 1</p></li><li><p>Step 2</p></li><li><p>Step 3</p></li></ol><h3>Expected Behavior</h3><p>What should happen.</p><h3>Actual Behavior</h3><p>What actually happens.</p><h3>Environment</h3><ul><li><p>Browser: </p></li><li><p>OS: </p></li><li><p>Version: </p></li></ul><h3>Screenshots</h3><p><em>Drag and drop images here</em></p>`,
  },
  {
    name: "Technical Task",
    desc: "Implementation plan with testing",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    color: "text-blue-600",
    bg: "bg-blue-50",
    content: `<h2>Technical Task</h2><h3>Objective</h3><p>What needs to be accomplished.</p><h3>Technical Approach</h3><p>How will this be implemented?</p><h3>Implementation Steps</h3><ol><li><p>Step 1</p></li><li><p>Step 2</p></li><li><p>Step 3</p></li></ol><h3>Testing Plan</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Unit tests</p></li><li data-type="taskItem" data-checked="false"><p>Integration tests</p></li><li data-type="taskItem" data-checked="false"><p>Manual QA</p></li></ul><h3>Dependencies</h3><ul><li><p></p></li></ul><h3>Rollback Plan</h3><p></p>`,
  },
  {
    name: "Feature Request",
    desc: "Proposal with use case and solution",
    icon: "M9.663 17h4.673M12 3v1",
    color: "text-violet-600",
    bg: "bg-violet-50",
    content: `<h2>Feature Request</h2><h3>Summary</h3><p>One-line description of the feature.</p><h3>Problem Statement</h3><p>What problem does this solve?</p><h3>Proposed Solution</h3><p>How should this work?</p><h3>User Impact</h3><ul><li><p>Who benefits?</p></li><li><p>How many users affected?</p></li></ul><h3>Acceptance Criteria</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Criteria 1</p></li><li data-type="taskItem" data-checked="false"><p>Criteria 2</p></li></ul><h3>Design / Mockups</h3><p><em>Drag and drop images here</em></p>`,
  },
  {
    name: "Spike / Research",
    desc: "Time-boxed investigation",
    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0",
    color: "text-amber-600",
    bg: "bg-amber-50",
    content: `<h2>Research Spike</h2><h3>Question</h3><p>What are we trying to learn?</p><h3>Background</h3><p>Context and motivation for this research.</p><h3>Approach</h3><ol><li><p></p></li><li><p></p></li></ol><h3>Time Box</h3><p><strong>_ hours</strong></p><h3>Expected Output</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Written findings document</p></li><li data-type="taskItem" data-checked="false"><p>Recommendation</p></li><li data-type="taskItem" data-checked="false"><p>Proof of concept (if applicable)</p></li></ul>`,
  },
  {
    name: "API Endpoint",
    desc: "REST API specification",
    icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    content: `<h2>API Endpoint</h2><h3>Endpoint</h3><p><code>METHOD /api/v1/resource</code></p><h3>Description</h3><p>What does this endpoint do?</p><h3>Request</h3><pre><code>{\n  "field": "value"\n}</code></pre><h3>Response</h3><pre><code>{\n  "success": true,\n  "data": {}\n}</code></pre><h3>Authentication</h3><p>Bearer token required: <strong>Yes</strong></p><h3>Error Codes</h3><ul><li><p><code>400</code> - Bad Request</p></li><li><p><code>401</code> - Unauthorized</p></li><li><p><code>404</code> - Not Found</p></li></ul>`,
  },
  {
    name: "Release Checklist",
    desc: "Pre-deployment verification",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    content: `<h2>Release Checklist</h2><h3>Pre-Release</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>All PRs merged to main</p></li><li data-type="taskItem" data-checked="false"><p>CI/CD pipeline green</p></li><li data-type="taskItem" data-checked="false"><p>Staging environment tested</p></li><li data-type="taskItem" data-checked="false"><p>Database migrations reviewed</p></li><li data-type="taskItem" data-checked="false"><p>Release notes drafted</p></li></ul><h3>Deployment</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Deploy to production</p></li><li data-type="taskItem" data-checked="false"><p>Verify health checks</p></li><li data-type="taskItem" data-checked="false"><p>Smoke test critical flows</p></li></ul><h3>Post-Release</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Monitor error rates</p></li><li data-type="taskItem" data-checked="false"><p>Notify stakeholders</p></li><li data-type="taskItem" data-checked="false"><p>Update documentation</p></li></ul>`,
  },
];

// ── Page ──

export default function NewItemPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [parentTasks, setParentTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("medium");
  const [storyPoints, setStoryPoints] = useState<number | null>(null);
  const [estimatedHours, setEstimatedHours] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  const [parentTaskId, setParentTaskId] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  // Comments (local before creation)
  const [comments, setComments] = useState<{ text: string; user: string; time: string }[]>([]);

  // URL params
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const defaultStatus = searchParams?.get("status") || "backlog";
  const defaultColumnId = searchParams?.get("columnId") || "";
  const defaultBoardId = searchParams?.get("boardId") || "";

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !projectId) return;
    Promise.all([
      projectApi.getById(projectId),
      hrApi.getEmployees(),
      taskApi.getAll({ projectId }),
    ]).then(([pRes, eRes, tRes]) => {
      setProject(pRes.data || null);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : []);
      setParentTasks((Array.isArray(tRes.data) ? tRes.data : []).filter((t: Task) => ["epic", "story"].includes(t.type)));
    }).catch(() => {});
  }, [user, projectId]);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const res = await taskApi.create({
        title,
        description: description || undefined,
        projectId,
        projectKey: project?.projectKey,
        type: type as Task["type"],
        priority: priority as Task["priority"],
        status: defaultStatus as Task["status"],
        storyPoints: storyPoints ?? undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        labels: labels ? labels.split(",").map((l) => l.trim()).filter(Boolean) : undefined,
        parentTaskId: parentTaskId || undefined,
        boardId: defaultBoardId || undefined,
        columnId: defaultColumnId || undefined,
      } as any);

      if (res.data?._id && comments.length > 0) {
        for (const c of comments) {
          try { await taskApi.addComment(res.data._id, c.text); } catch {}
        }
      }

      toast.success("Item created!");
      router.push(res.data?._id ? `/projects/${projectId}/items/${res.data._id}` : `/projects/${projectId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;
  }

  const userInitials = `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase();

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
              <span className="text-[13px] font-semibold text-[#0F172A]">New Item</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)} className="border-[#E2E8F0] text-[#64748B] h-9">Discard</Button>
            <Button onClick={handleCreate} disabled={saving || !title.trim()} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 min-w-[120px]">
              {saving ? "Creating..." : "Create Item"}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            {/* Left — Main */}
            <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-8">
              {/* Title */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="w-full text-[28px] font-bold text-[#0F172A] placeholder:text-[#CBD5E1] bg-transparent border-0 outline-none focus:ring-0 p-0"
              />

              {/* Type selector */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 block">Item Type</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {typeOptions.map((t) => (
                    <button key={t.value} onClick={() => setType(t.value)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${type === t.value ? `${t.bg} border-current ${t.color}` : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] bg-white"}`}>
                      <svg className={`w-4 h-4 shrink-0 ${type === t.value ? t.color : "text-[#94A3B8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold">{t.label}</p>
                        {type === t.value && <p className="text-[10px] opacity-70 truncate">{t.desc}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description — Rich Text */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
                    Description
                  </label>
                  <div className="relative">
                    <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-medium text-[#64748B] hover:border-[#2E86C1] hover:text-[#2E86C1] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      Templates
                    </button>
                    {showTemplates && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#E2E8F0] shadow-xl z-20 py-2 max-h-[400px] overflow-y-auto">
                        <p className="px-4 py-1.5 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Choose a template</p>
                        {descTemplates.map((tmpl) => (
                          <button key={tmpl.name} onClick={() => { setDescription(tmpl.content); setShowTemplates(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] transition-colors">
                            <div className={`w-8 h-8 rounded-lg ${tmpl.bg} flex items-center justify-center shrink-0`}>
                              <svg className={`w-4 h-4 ${tmpl.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tmpl.icon} /></svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#0F172A]">{tmpl.name}</p>
                              <p className="text-[11px] text-[#94A3B8] truncate">{tmpl.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <RichTextEditor
                  content={description}
                  onChange={setDescription}
                  placeholder="Add a detailed description... Drag & drop images, paste screenshots, or click the image button in the toolbar."
                  minHeight="320px"
                />
              </div>

              {/* Labels & Parent */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    Labels
                  </label>
                  <Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="frontend, api, urgent (comma-separated)" className="h-11 text-sm bg-white border-[#E2E8F0]" />
                  {labels && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {labels.split(",").map((l) => l.trim()).filter(Boolean).map((label, i) => (
                        <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">{label}</span>
                      ))}
                    </div>
                  )}
                </div>
                {parentTasks.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        Link to Parent
                      </label>
                      {parentTaskId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/projects/${projectId}/items/${parentTaskId}`)}
                          className="text-[11px] text-[#2E86C1] hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          View parent
                        </button>
                      )}
                    </div>
                    <select value={parentTaskId} onChange={(e) => setParentTaskId(e.target.value)} className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                      <option value="">None (top-level item)</option>
                      {parentTasks.map((t) => <option key={t._id} value={t._id}>[{t.type.toUpperCase()}] {t.title}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Comments {comments.length > 0 && `(${comments.length})`}
                </label>

                <CommentEditor
                  onSubmit={(text) => setComments((prev) => [...prev, { text, user: `${user.firstName} ${user.lastName}`, time: new Date().toISOString() }])}
                  employees={employees}
                  userInitials={userInitials}
                />

                {comments.length > 0 && (
                  <div className="space-y-4 mt-5">
                    {comments.map((c, i) => (
                      <div key={i} className="flex gap-3 ml-12">
                        <div className="w-8 h-8 rounded-full bg-[#EBF5FB] flex items-center justify-center text-[10px] font-bold text-[#2E86C1] shrink-0">
                          {c.user.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] p-3.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[12px] font-semibold text-[#334155]">{c.user}</span>
                            <span className="text-[10px] text-[#94A3B8]">Just now</span>
                            <button onClick={() => setComments((prev) => prev.filter((_, idx) => idx !== i))} className="ml-auto p-0.5 rounded hover:bg-red-50 text-[#CBD5E1] hover:text-red-500">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <CommentContent text={c.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right — Details panel */}
            <div className="w-[340px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto">
              <div className="p-6 space-y-5">
                <h3 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Details</h3>

                {/* Status */}
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Status</label>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]" />
                    <span className="text-[13px] font-medium text-[#334155] capitalize">{defaultStatus.replace(/_/g, " ")}</span>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Priority</label>
                  <div className="space-y-1">
                    {priorityOptions.map((p) => (
                      <button key={p.value} onClick={() => setPriority(p.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${priority === p.value ? "bg-[#EBF5FB] text-[#2E86C1]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                        {p.label}
                        {priority === p.value && <svg className="w-4 h-4 ml-auto text-[#2E86C1]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
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
                      <button key={p} onClick={() => setStoryPoints(storyPoints === p ? null : p)}
                        className={`w-10 h-10 rounded-lg text-[14px] font-bold transition-all ${storyPoints === p ? "bg-[#2E86C1] text-white shadow-sm" : "bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"}`}>{p}</button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#F1F5F9]" />

                {/* Assignee */}
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Assignee</label>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                    <option value="">Unassigned</option>
                    {employees.map((e) => <option key={e._id} value={e.userId || e._id}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </div>

                <div className="border-t border-[#F1F5F9]" />

                {/* Estimated Hours */}
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Estimated Hours</label>
                  <Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="0" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>

                {/* Due Date */}
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-2 block">Due Date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>

                <div className="border-t border-[#F1F5F9]" />

                {/* Summary */}
                <div className="space-y-2 text-[11px] text-[#94A3B8]">
                  <p className="font-bold uppercase tracking-wider mb-1">Summary</p>
                  <div className="flex justify-between"><span>Type</span><span className="text-[#0F172A] font-medium capitalize">{type.replace("_", " ")}</span></div>
                  <div className="flex justify-between"><span>Priority</span><span className="text-[#0F172A] font-medium capitalize">{priority}</span></div>
                  {storyPoints && <div className="flex justify-between"><span>Points</span><span className="text-[#0F172A] font-medium">{storyPoints}</span></div>}
                  {estimatedHours && <div className="flex justify-between"><span>Est. Hours</span><span className="text-[#0F172A] font-medium">{estimatedHours}h</span></div>}
                  {comments.length > 0 && <div className="flex justify-between"><span>Comments</span><span className="text-[#0F172A] font-medium">{comments.length}</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
