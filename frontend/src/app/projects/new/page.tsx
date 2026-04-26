"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, boardApi, clientApi, hrApi, Project, Client, Employee, Department } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ── Config ──

const STEPS = [
  { key: "details", label: "Project Details", desc: "Name, category & timeline", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", required: true, color: "blue" },
  { key: "board", label: "Board Type", desc: "Choose your workflow", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7", required: true, color: "violet" },
  { key: "client", label: "Client", desc: "Link a client", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", required: false, color: "emerald" },
  { key: "team", label: "Team", desc: "Add members", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", required: false, color: "amber" },
  { key: "budget", label: "Budget & Tags", desc: "Financials & labels", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", required: false, color: "rose" },
];

const methodologies: Record<string, { label: string; icon: string; desc: string; boardType: string; columns: string; color: string; features: string[] }> = {
  scrum: { label: "Scrum", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", desc: "Sprint-based agile with velocity tracking", boardType: "scrum", columns: "Backlog → Sprint Ready → In Progress → In Review → Done", color: "blue", features: ["Sprint planning", "Burndown charts", "Velocity tracking"] },
  kanban: { label: "Kanban", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7", desc: "Continuous flow with WIP limits", boardType: "kanban", columns: "Inbox → Ready → Doing → Review → Shipped", color: "emerald", features: ["WIP limits", "Cycle time", "Flow metrics"] },
  scrumban: { label: "Scrumban", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", desc: "Best of both — sprints + WIP limits", boardType: "scrum", columns: "Backlog → Ready → In Progress → Testing → Done", color: "violet", features: ["Sprint cadence", "WIP limits", "Hybrid metrics"] },
  waterfall: { label: "Waterfall", icon: "M19 14l-7 7m0 0l-7-7m7 7V3", desc: "Phase-gated sequential delivery", boardType: "kanban", columns: "Requirements → Design → Development → Testing → Deployment", color: "amber", features: ["Phase gates", "Milestones", "Sign-offs"] },
  custom: { label: "Custom", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4", desc: "Build your own from scratch", boardType: "custom", columns: "To Do → In Progress → Done", color: "gray", features: ["Full control", "Custom columns", "Flexible rules"] },
};

const methColorMap: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  blue: { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", icon: "bg-blue-100 text-blue-600" },
  emerald: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
  violet: { border: "border-violet-300", bg: "bg-violet-50", text: "text-violet-700", icon: "bg-violet-100 text-violet-600" },
  amber: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", icon: "bg-amber-100 text-amber-600" },
  gray: { border: "border-gray-300", bg: "bg-gray-50", text: "text-gray-700", icon: "bg-gray-100 text-gray-600" },
};

const categoryOptions = [
  { value: "web", label: "Web", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9", color: "blue" },
  { value: "mobile", label: "Mobile", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z", color: "violet" },
  { value: "api", label: "API", icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", color: "emerald" },
  { value: "devops", label: "DevOps", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0", color: "orange" },
  { value: "design", label: "Design", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", color: "pink" },
  { value: "data", label: "Data", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4", color: "cyan" },
  { value: "internal", label: "Internal", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5", color: "gray" },
  { value: "other", label: "Other", icon: "M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z", color: "gray" },
];

const catColorMap: Record<string, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  violet: "bg-violet-50 border-violet-200 text-violet-700",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  pink: "bg-pink-50 border-pink-200 text-pink-700",
  cyan: "bg-cyan-50 border-cyan-200 text-cyan-700",
  gray: "bg-gray-50 border-gray-200 text-gray-600",
};

// ── Page ──

export default function NewProjectPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("web");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [methodology, setMethodology] = useState("");
  const [clientId, setClientId] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("INR");
  const [billingType, setBillingType] = useState("fixed");
  const [tags, setTags] = useState("");

  const [milestones, setMilestones] = useState<Array<{ name: string; description: string; targetDate: string }>>([]);
  const [newMilestoneName, setNewMilestoneName] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    Promise.all([clientApi.getClients().catch(() => ({ data: [] })), hrApi.getEmployees().catch(() => ({ data: [] })), hrApi.getDepartments().catch(() => ({ data: [] }))]).then(([c, e, d]) => {
      setClients(Array.isArray(c.data) ? c.data : []); setEmployees(Array.isArray(e.data) ? e.data : []); setDepartments(Array.isArray(d.data) ? d.data : []);
    }).finally(() => setLoadingData(false));
  }, [user]);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return; setCreatingClient(true);
    try { const r = await clientApi.createClient({ companyName: newClientName, contactPerson: newClientEmail ? { name: newClientName, email: newClientEmail } : undefined } as any); if (r.data?._id) { setClients((p) => [r.data as Client, ...p]); setClientId(r.data._id); setShowNewClient(false); setNewClientName(""); setNewClientEmail(""); toast.success("Client created"); } } catch (e: any) { toast.error(e.message || "Failed"); } finally { setCreatingClient(false); }
  };

  const canProceed = () => { if (step === 0) return projectName.trim().length > 0; if (step === 1) return !!methodology; return true; };

  const handleCreate = async () => {
    if (!projectName.trim() || !methodology) return; setSaving(true);
    try {
      const mc = methodologies[methodology];
      const data: any = { projectName, description: description || undefined, category, methodology, priority, clientId: clientId || undefined, departmentId: departmentId || undefined, startDate: startDate || undefined, endDate: endDate || undefined, tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined, settings: { boardType: mc?.boardType || "kanban", enableSprints: methodology === "scrum" || methodology === "scrumban", enableEpics: true, enableSubtasks: true, enableTimeTracking: true, estimationUnit: "story_points", sprintDuration: methodology === "scrum" || methodology === "scrumban" ? 14 : undefined } };
      if (budgetAmount) data.budget = { amount: Number(budgetAmount), currency: budgetCurrency, billingType };
      const project = await projectApi.create(data);
      if (project.data?._id) { const pid = project.data._id; try { await boardApi.createFromTemplate({ projectId: pid, templateId: mc?.boardType || "kanban" }); } catch {} for (const uid of teamMemberIds) { if (uid === user?._id) continue; try { await projectApi.addTeamMember(pid, { userId: uid, role: "member" }); } catch {} } for (const m of milestones) { try { await projectApi.addMilestone(pid, { name: m.name, description: m.description || undefined, targetDate: m.targetDate || undefined, status: "pending" }); } catch {} } toast.success("Project created!"); router.push(`/projects/${pid}`); }
      else { toast.success("Project created!"); router.push("/projects"); }
    } catch (e: any) { toast.error(e.message || "Failed"); } finally { setSaving(false); }
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;

  const isOptional = step > 1;
  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* Top bar with progress */}
        <div className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/projects")} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[11px] font-bold">N</div>
              <div>
                <p className="text-[14px] font-semibold text-[#0F172A]">New Project</p>
                <p className="text-[11px] text-[#94A3B8]">{STEPS[step].label} &middot; Step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push("/projects")} className="border-[#E2E8F0] text-[#64748B] h-9">Discard</Button>
              {isOptional && <Button variant="outline" onClick={handleCreate} disabled={saving} className="border-[#E2E8F0] text-[#64748B] h-9">{saving ? "Creating..." : "Skip & Create"}</Button>}
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="bg-gradient-to-r from-[#2E86C1] to-[#2471A3] hover:from-[#2471A3] hover:to-[#1A5276] h-9 min-w-[110px] shadow-sm">{isOptional ? "Next" : "Continue"}</Button>
              ) : (
                <Button onClick={handleCreate} disabled={saving} className="bg-gradient-to-r from-[#2E86C1] to-[#2471A3] hover:from-[#2471A3] hover:to-[#1A5276] h-9 min-w-[140px] shadow-sm">{saving ? "Creating..." : "Create Project"}</Button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-[#F1F5F9]"><div className="h-full bg-gradient-to-r from-[#2E86C1] to-[#60A5FA] transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} /></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            {/* Left — Form */}
            <div className="flex-1 overflow-y-auto p-8 lg:p-10">
              <div>

              {/* Step 0: Details */}
              {step === 0 && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></div>
                      <div><h2 className="text-[22px] font-bold text-[#0F172A]">Project Details</h2><p className="text-[13px] text-[#94A3B8]">Give your project a name and set the basics</p></div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Project Name *</label>
                    <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Customer Portal Redesign" className="h-12 text-[15px] bg-white border-[#E2E8F0] rounded-xl shadow-sm" autoFocus />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
                      Description
                    </label>
                    <RichTextEditor content={description} onChange={setDescription} placeholder="Describe the project goals, scope, and key deliverables... You can add images, links, and formatting." minHeight="180px" />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 block">Category</label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {categoryOptions.map((c) => {
                        const cc = catColorMap[c.color] || catColorMap.gray;
                        return (
                          <button key={c.value} onClick={() => setCategory(c.value)} className={`flex flex-col items-center gap-2 px-3 py-3.5 rounded-xl border-2 transition-all ${category === c.value ? `${cc} border-current shadow-sm` : "border-[#E2E8F0] text-[#64748B] bg-white hover:border-[#CBD5E1] hover:shadow-sm"}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={c.icon} /></svg>
                            <span className="text-[11px] font-semibold">{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Priority</label>
                      <div className="space-y-1.5">
                        {[{ v: "critical", l: "Critical", c: "bg-red-500" }, { v: "high", l: "High", c: "bg-orange-500" }, { v: "medium", l: "Medium", c: "bg-blue-500" }, { v: "low", l: "Low", c: "bg-gray-400" }].map((p) => (
                          <button key={p.v} onClick={() => setPriority(p.v)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${priority === p.v ? "bg-[#EBF5FB] text-[#2E86C1] shadow-sm" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}>
                            <div className={`w-2 h-2 rounded-full ${p.c}`} />{p.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Start Date</label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 text-sm bg-white border-[#E2E8F0] shadow-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">End Date</label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 text-sm bg-white border-[#E2E8F0] shadow-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Board */}
              {step === 1 && (
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg></div>
                    <div><h2 className="text-[22px] font-bold text-[#0F172A]">Board Type</h2><p className="text-[13px] text-[#94A3B8]">Choose a methodology that matches your team&apos;s workflow</p></div>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(methodologies).map(([key, m]) => {
                      const mc = methColorMap[m.color] || methColorMap.gray;
                      const sel = methodology === key;
                      return (
                        <button key={key} onClick={() => setMethodology(key)} className={`w-full flex items-start gap-5 p-5 rounded-2xl border-2 text-left transition-all ${sel ? `${mc.border} ${mc.bg} shadow-sm` : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-sm"}`}>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${sel ? mc.icon : "bg-[#F1F5F9] text-[#64748B]"}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={m.icon} /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-bold text-[15px] ${sel ? mc.text : "text-[#0F172A]"}`}>{m.label}</p>
                              {sel && <svg className={`w-5 h-5 ${mc.text}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                            </div>
                            <p className="text-[13px] text-[#64748B]">{m.desc}</p>
                            <div className="flex items-center gap-1.5 mt-2.5">
                              {m.features.map((f, i) => (
                                <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sel ? `${mc.bg} ${mc.text} border ${mc.border}` : "bg-[#F1F5F9] text-[#94A3B8]"}`}>{f}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              <svg className="w-3 h-3 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                              <p className="text-[10px] text-[#94A3B8] font-mono">{m.columns}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Client */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div>
                    <div><h2 className="text-[22px] font-bold text-[#0F172A]">Link a Client</h2><p className="text-[13px] text-[#94A3B8]">Associate this project with a client for billing and reporting</p></div>
                  </div>
                  {showNewClient ? (
                    <Card className="border-0 shadow-sm"><CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-[#0F172A]">New Client</p><button onClick={() => setShowNewClient(false)} className="text-[12px] text-[#64748B] hover:text-[#0F172A]">Cancel</button></div>
                      <div><label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Company Name *</label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g., Acme Corp" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" /></div>
                      <div><label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Contact Email</label><Input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="contact@acme.com" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" /></div>
                      <Button onClick={handleCreateClient} disabled={creatingClient || !newClientName.trim()} className="w-full bg-gradient-to-r from-[#2E86C1] to-[#2471A3]">{creatingClient ? "Creating..." : "Create & Link Client"}</Button>
                    </CardContent></Card>
                  ) : (
                    <>
                      <div className="relative"><svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients..." className="pl-10 h-12 text-sm bg-white border-[#E2E8F0] rounded-xl shadow-sm" /></div>
                      <Card className="border-0 shadow-sm overflow-hidden"><div className="max-h-[340px] overflow-y-auto">
                        <button onClick={() => setClientId("")} className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-[#F1F5F9] transition-colors ${!clientId ? "bg-[#EBF5FB]" : "hover:bg-[#F8FAFC]"}`}>
                          <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center"><svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg></div>
                          <div><p className="text-[13px] font-medium text-[#64748B]">No client (internal project)</p></div>
                          {!clientId && <svg className="w-5 h-5 text-[#2E86C1] ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                        </button>
                        {clients.filter((c) => !clientSearch || c.companyName?.toLowerCase().includes(clientSearch.toLowerCase())).map((client) => (
                          <button key={client._id} onClick={() => setClientId(client._id)} className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-[#F1F5F9] last:border-0 transition-colors ${clientId === client._id ? "bg-[#EBF5FB]" : "hover:bg-[#F8FAFC]"}`}>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-sm font-bold shrink-0">{(client.companyName || "?").charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-[#0F172A] truncate">{client.companyName}</p>{client.industry && <p className="text-[11px] text-[#94A3B8] capitalize">{client.industry}</p>}</div>
                            {client.status && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${client.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>{client.status}</span>}
                            {clientId === client._id && <svg className="w-5 h-5 text-[#2E86C1] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                          </button>
                        ))}
                      </div></Card>
                      <button onClick={() => setShowNewClient(true)} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-[#CBD5E1] text-[13px] font-medium text-[#64748B] hover:border-[#2E86C1] hover:text-[#2E86C1] hover:bg-[#EBF5FB] transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Create New Client
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Team */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                    <div><h2 className="text-[22px] font-bold text-[#0F172A]">Team Members</h2><p className="text-[13px] text-[#94A3B8]">Add people from your employee directory</p></div>
                  </div>
                  <div className="relative"><svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><Input value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Search employees..." className="pl-10 h-12 text-sm bg-white border-[#E2E8F0] rounded-xl shadow-sm" /></div>
                  {teamMemberIds.length > 0 && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#EBF5FB] border border-[#BFDBFE]"><svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span className="text-[12px] font-medium text-[#2E86C1]">{teamMemberIds.length} member{teamMemberIds.length > 1 ? "s" : ""} selected</span><button onClick={() => setTeamMemberIds([])} className="ml-auto text-[11px] text-[#64748B] hover:text-red-500">Clear</button></div>}
                  <Card className="border-0 shadow-sm overflow-hidden"><div className="max-h-[320px] overflow-y-auto">
                    {loadingData ? <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2E86C1] border-t-transparent" /></div> :
                    employees.filter((e) => !teamSearch || `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(teamSearch.toLowerCase())).length === 0 ? <div className="px-5 py-10 text-center"><p className="text-[13px] text-[#94A3B8]">No employees found</p></div> :
                    employees.filter((e) => !teamSearch || `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(teamSearch.toLowerCase())).map((emp) => {
                      const id = emp.userId || emp._id; const sel = teamMemberIds.includes(id);
                      return <button key={emp._id} onClick={() => setTeamMemberIds(sel ? teamMemberIds.filter((m) => m !== id) : [...teamMemberIds, id])} className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-[#F1F5F9] last:border-0 transition-colors ${sel ? "bg-[#EBF5FB]" : "hover:bg-[#F8FAFC]"}`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-[11px] font-bold shrink-0">{emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}</div>
                        <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p><p className="text-[11px] text-[#94A3B8] truncate">{emp.email}</p></div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? "bg-[#2E86C1] border-[#2E86C1]" : "border-[#CBD5E1]"}`}>{sel && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}</div>
                      </button>;
                    })}
                  </div></Card>
                  {departments.length > 0 && <div><label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Link to Department</label><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full h-11 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"><option value="">No department</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>}
                </div>
              )}

              {/* Step 4: Budget */}
              {step === 4 && (
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center"><svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div><h2 className="text-[22px] font-bold text-[#0F172A]">Budget & Tags</h2><p className="text-[13px] text-[#94A3B8]">Set project financials and organize with tags</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Budget Amount</label><Input type="number" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="0.00" className="h-11 text-sm bg-white border-[#E2E8F0] shadow-sm" /></div>
                    <div><label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Currency</label><select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option></select></div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 block">Billing Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "fixed", label: "Fixed Price", desc: "One-time project cost", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z", color: "blue" },
                        { value: "time_and_material", label: "Time & Material", desc: "Billed by hours worked", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "amber" },
                        { value: "retainer", label: "Retainer", desc: "Monthly fixed fee", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", color: "violet" },
                        { value: "internal", label: "Internal", desc: "No client billing", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5", color: "gray" },
                      ].map((bt) => {
                        const sel = billingType === bt.value;
                        const mc = methColorMap[bt.color] || methColorMap.gray;
                        return (
                          <button key={bt.value} onClick={() => setBillingType(bt.value)} className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${sel ? `${mc.border} ${mc.bg} shadow-sm` : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-sm"}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sel ? mc.icon : "bg-[#F1F5F9] text-[#64748B]"}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={bt.icon} /></svg></div>
                            <div><p className={`text-[13px] font-semibold ${sel ? mc.text : "text-[#0F172A]"}`}>{bt.label}</p><p className="text-[11px] text-[#94A3B8]">{bt.desc}</p></div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 block">Tags</label>
                    <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, redesign, q2-2026 (comma-separated)" className="h-11 text-sm bg-white border-[#E2E8F0] shadow-sm" />
                    {tags && <div className="flex flex-wrap gap-1.5 mt-2.5">{tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag, i) => <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">{tag}</span>)}</div>}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 block">Milestones</label>
                    {milestones.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {milestones.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                            <svg className="w-3.5 h-3.5 text-[#2E86C1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                            <span className="text-[12px] font-medium text-[#334155] flex-1 truncate">{m.name}</span>
                            {m.targetDate && <span className="text-[10px] text-[#94A3B8]">{m.targetDate}</span>}
                            <button onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="text-[#94A3B8] hover:text-red-500 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input value={newMilestoneName} onChange={(e) => setNewMilestoneName(e.target.value)} placeholder="Milestone name" className="h-10 text-sm bg-white border-[#E2E8F0] shadow-sm" onKeyDown={(e) => { if (e.key === "Enter" && newMilestoneName.trim()) { setMilestones([...milestones, { name: newMilestoneName.trim(), description: "", targetDate: "" }]); setNewMilestoneName(""); }}} />
                      <Button type="button" variant="outline" onClick={() => { if (newMilestoneName.trim()) { setMilestones([...milestones, { name: newMilestoneName.trim(), description: "", targetDate: "" }]); setNewMilestoneName(""); }}} className="h-10 px-3 border-[#E2E8F0] text-[#64748B] shrink-0">Add</Button>
                    </div>
                  </div>
                </div>
              )}

              </div>
            </div>

            {/* Right — Steps + Summary */}
            <div className="w-[300px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto">
              <div className="p-5 border-b border-[#E2E8F0]">
                <h3 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Steps</h3>
                <div className="space-y-1">
                  {STEPS.map((s, i) => {
                    const isActive = step === i; const isDone = step > i;
                    const stepColor = methColorMap[s.color] || methColorMap.gray;
                    return (
                      <button key={s.key} onClick={() => { if (i <= step || (i <= 1 && canProceed()) || (i > 1 && step >= 1 && methodology)) setStep(i); }}
                        disabled={i > step && (i <= 1 ? !canProceed() : step < 1 || !methodology)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${isActive ? "bg-[#F8FAFC] shadow-sm border border-[#E2E8F0]" : isDone ? "hover:bg-[#F8FAFC]" : "opacity-40 cursor-not-allowed"}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? stepColor.icon : isDone ? "bg-emerald-100 text-emerald-600" : "bg-[#F1F5F9] text-[#CBD5E1]"}`}>
                          {isDone ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : <span className="text-[10px] font-bold">{i + 1}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-[12px] font-semibold ${isActive ? "text-[#0F172A]" : isDone ? "text-[#334155]" : "text-[#CBD5E1]"}`}>{s.label}</p>
                            {!s.required && <span className="text-[8px] font-bold bg-[#F1F5F9] text-[#94A3B8] px-1 py-0.5 rounded">OPT</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              {projectName && (
                <div className="p-5">
                  <h3 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Summary</h3>
                  <div className="space-y-3">
                    <Card className="border-0 shadow-sm"><CardContent className="p-3">
                      <p className="text-[10px] text-[#94A3B8] mb-0.5">Project</p>
                      <p className="text-[13px] font-semibold text-[#0F172A] truncate">{projectName}</p>
                    </CardContent></Card>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {category && <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"><p className="text-[#94A3B8] text-[9px] mb-0.5">CATEGORY</p><p className="font-semibold text-[#0F172A] capitalize">{category}</p></div>}
                      {priority && <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"><p className="text-[#94A3B8] text-[9px] mb-0.5">PRIORITY</p><p className="font-semibold text-[#0F172A] capitalize">{priority}</p></div>}
                      {methodology && <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"><p className="text-[#94A3B8] text-[9px] mb-0.5">BOARD</p><p className="font-semibold text-[#0F172A] capitalize">{methodology}</p></div>}
                      {teamMemberIds.length > 0 && <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"><p className="text-[#94A3B8] text-[9px] mb-0.5">TEAM</p><p className="font-semibold text-[#0F172A]">{teamMemberIds.length} members</p></div>}
                    </div>

                    {clientId && <div className="px-3 py-2 rounded-lg bg-[#EBF5FB] border border-[#BFDBFE]"><p className="text-[#2E86C1] text-[9px] mb-0.5 font-bold">CLIENT</p><p className="text-[12px] font-semibold text-[#2E86C1] truncate">{clients.find((c) => c._id === clientId)?.companyName || "—"}</p></div>}
                    {budgetAmount && <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"><p className="text-[#94A3B8] text-[9px] mb-0.5">BUDGET</p><p className="text-[13px] font-bold text-[#0F172A]">{budgetCurrency} {Number(budgetAmount).toLocaleString()}</p></div>}
                    {tags && <div className="flex flex-wrap gap-1 mt-1">{tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag, i) => <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">{tag}</span>)}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
