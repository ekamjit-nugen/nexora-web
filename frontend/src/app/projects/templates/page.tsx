"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, ProjectTemplate, Project } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const methodologyLabels: Record<string, string> = {
  scrum: "Scrum", kanban: "Kanban", scrumban: "Scrumban", waterfall: "Waterfall",
  xp: "XP", lean: "Lean", safe: "SAFe", custom: "Custom",
};

const categoryColors: Record<string, string> = {
  web: "bg-blue-50 text-blue-700 border-blue-200",
  mobile: "bg-violet-50 text-violet-700 border-violet-200",
  api: "bg-emerald-50 text-emerald-700 border-emerald-200",
  devops: "bg-orange-50 text-orange-700 border-orange-200",
  design: "bg-pink-50 text-pink-700 border-pink-200",
  data: "bg-cyan-50 text-cyan-700 border-cyan-200",
  internal: "bg-gray-50 text-gray-600 border-gray-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function TemplatesPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const isOrgManager = hasOrgRole("manager");
  const isOrgAdmin = hasOrgRole("admin");

  // Track whether user is a project lead/admin on any project
  const [isProjectLeadOrAdmin, setIsProjectLeadOrAdmin] = useState(false);
  const canManage = isOrgManager || isProjectLeadOrAdmin;
  const canDelete = isOrgAdmin;

  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Apply modal state
  const [applyTemplate, setApplyTemplate] = useState<ProjectTemplate | null>(null);
  const [applyForm, setApplyForm] = useState({ projectName: "", startDate: "", description: "" });
  const [applying, setApplying] = useState(false);

  // Create/Edit modal state
  const [editTemplate, setEditTemplate] = useState<ProjectTemplate | null | "new">(null);
  const [editForm, setEditForm] = useState({
    name: "", description: "", category: "", methodology: "", isPublic: false,
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTemplate, setDeleteTemplate] = useState<ProjectTemplate | null>(null);

  // Menu state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await projectApi.getTemplates(params);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchTemplates();
  }, [user, fetchTemplates]);

  // Check if user is a lead/admin on any project (for non-org-managers)
  useEffect(() => {
    if (!user || isOrgManager) return;
    const userId = user._id || (user as any)?.userId;
    if (!userId) return;
    (async () => {
      try {
        const projRes = await projectApi.getAll();
        const projects: Project[] = Array.isArray(projRes.data) ? projRes.data : [];
        const hasLeadRole = projects.some((p) => {
          const member = p.team?.find((m) => m.userId === userId);
          return member && (member.role === "lead" || member.role === "admin");
        });
        setIsProjectLeadOrAdmin(hasLeadRole);
      } catch {
        // Ignore — leave as false
      }
    })();
  }, [user, isOrgManager]);

  const handleApply = async () => {
    if (!applyTemplate || !applyForm.projectName.trim()) return;
    try {
      setApplying(true);
      const res = await projectApi.applyTemplate(applyTemplate._id, {
        projectName: applyForm.projectName,
        startDate: applyForm.startDate || undefined,
        description: applyForm.description || undefined,
      });
      toast.success("Project created from template");
      setApplyTemplate(null);
      setApplyForm({ projectName: "", startDate: "", description: "" });
      if (res.data?._id) {
        router.push(`/projects/${res.data._id}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setApplying(false);
    }
  };

  const openCreate = () => {
    setEditForm({ name: "", description: "", category: "", methodology: "", isPublic: false });
    setEditTemplate("new");
  };

  const openEdit = (t: ProjectTemplate) => {
    setEditForm({
      name: t.name,
      description: t.description || "",
      category: t.category || "",
      methodology: t.methodology || "",
      isPublic: t.isPublic,
    });
    setEditTemplate(t);
    setMenuOpen(null);
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) return;
    try {
      setSaving(true);
      if (editTemplate === "new") {
        await projectApi.createTemplate({
          name: editForm.name,
          description: editForm.description || undefined,
          category: editForm.category || undefined,
          methodology: editForm.methodology || undefined,
          isPublic: editForm.isPublic,
        } as any);
        toast.success("Template created");
      } else if (editTemplate) {
        await projectApi.updateTemplate((editTemplate as ProjectTemplate)._id, {
          name: editForm.name,
          description: editForm.description || undefined,
          category: editForm.category || undefined,
          methodology: editForm.methodology || undefined,
          isPublic: editForm.isPublic,
        } as any);
        toast.success("Template updated");
      }
      setEditTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    try {
      setSaving(true);
      await projectApi.deleteTemplate(deleteTemplate._id);
      toast.success("Template deleted");
      setDeleteTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    } finally {
      setSaving(false);
    }
  };

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
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => router.push("/projects")} className="text-[#94A3B8] hover:text-[#64748B] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h1 className="text-2xl font-bold text-[#0F172A]">Project Templates</h1>
            </div>
            <p className="text-[13px] text-[#94A3B8] ml-8">Reusable project structures to speed up project creation</p>
          </div>
          {canManage && (
            <Button onClick={openCreate} className="gap-2 h-10 px-5 bg-[#2E86C1] hover:bg-[#2471A3]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Template
            </Button>
          )}
        </div>

        {/* Search */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="relative max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-10 h-11 text-[15px] bg-[#F8FAFC] border-[#E2E8F0] rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-[#334155] mb-1">No templates yet</h3>
              <p className="text-[13px] text-[#94A3B8] mb-4">Create a template or save an existing project as a template</p>
              {canManage && (
                <Button onClick={openCreate} className="gap-2 bg-[#2E86C1] hover:bg-[#2471A3]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((template) => {
              const methLabel = methodologyLabels[template.methodology || ""] || "";
              const catColor = categoryColors[template.category || "other"] || categoryColors.other;
              const milestoneCount = template.milestoneTemplates?.length || 0;
              const taskCount = template.taskTemplates?.length || 0;

              return (
                <Card key={template._id} className="border-0 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white shrink-0">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[#0F172A] truncate">{template.name}</h3>
                          {template.isPublic && (
                            <span className="text-[10px] text-[#94A3B8]">Public</span>
                          )}
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setMenuOpen(menuOpen === template._id ? null : template._id)}
                          className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                          </svg>
                        </button>
                        {menuOpen === template._id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 py-1">
                              {canManage && (
                                <button
                                  onClick={() => openEdit(template)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F8FAFC]"
                                >
                                  <svg className="w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => { setDeleteTemplate(template); setMenuOpen(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {template.description && (
                      <p className="text-xs text-[#64748B] line-clamp-2 mb-3">{template.description}</p>
                    )}

                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      {methLabel && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">{methLabel}</span>}
                      {template.category && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${catColor}`}>{template.category}</span>}
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-[11px] text-[#64748B] mb-4">
                      {milestoneCount > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          <span>{milestoneCount} milestone{milestoneCount !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {taskCount > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span>Used {template.usageCount} time{template.usageCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-[#F1F5F9]">
                      {canManage && (
                        <Button
                          onClick={() => {
                            setApplyForm({ projectName: "", startDate: "", description: "" });
                            setApplyTemplate(template);
                          }}
                          className="w-full h-9 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]"
                        >
                          Use Template
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Apply Template Modal */}
      {applyTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setApplyTemplate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Create Project from Template</h2>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">Using: {applyTemplate.name}</p>
              </div>
              <button onClick={() => setApplyTemplate(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Project Name *</label>
                <Input
                  value={applyForm.projectName}
                  onChange={(e) => setApplyForm({ ...applyForm, projectName: e.target.value })}
                  placeholder="My New Project"
                  className="h-10 border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Start Date</label>
                <Input
                  type="date"
                  value={applyForm.startDate}
                  onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                  className="h-10 border-[#E2E8F0] rounded-lg"
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">Milestone dates will be calculated relative to this date</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Description</label>
                <textarea
                  value={applyForm.description}
                  onChange={(e) => setApplyForm({ ...applyForm, description: e.target.value })}
                  rows={3}
                  placeholder="Optional project description..."
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-none"
                />
              </div>

              {/* Template Preview */}
              {(applyTemplate.milestoneTemplates?.length || 0) > 0 && (
                <div className="bg-[#F8FAFC] rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-[#475569] mb-2">Template includes:</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-[#64748B]">
                    <span>{applyTemplate.milestoneTemplates?.length} milestone{(applyTemplate.milestoneTemplates?.length || 0) !== 1 ? "s" : ""}</span>
                    {(applyTemplate.taskTemplates?.length || 0) > 0 && (
                      <span>/ {applyTemplate.taskTemplates?.length} task{(applyTemplate.taskTemplates?.length || 0) !== 1 ? "s" : ""}</span>
                    )}
                    {applyTemplate.methodology && <span>/ {methodologyLabels[applyTemplate.methodology]}</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApplyTemplate(null)} className="h-9 px-4 text-[13px]">Cancel</Button>
              <Button
                onClick={handleApply}
                disabled={applying || !applyForm.projectName.trim()}
                className="h-9 px-5 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]"
              >
                {applying ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {editTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditTemplate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F172A]">
                {editTemplate === "new" ? "Create Template" : "Edit Template"}
              </h2>
              <button onClick={() => setEditTemplate(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Template Name *</label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-10 border-[#E2E8F0] rounded-lg" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Methodology</label>
                  <select value={editForm.methodology} onChange={(e) => setEditForm({ ...editForm, methodology: e.target.value })} className="w-full h-10 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                    <option value="">Select methodology</option>
                    <option value="scrum">Scrum</option>
                    <option value="kanban">Kanban</option>
                    <option value="scrumban">Scrumban</option>
                    <option value="waterfall">Waterfall</option>
                    <option value="xp">XP</option>
                    <option value="lean">Lean</option>
                    <option value="safe">SAFe</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={editForm.isPublic}
                  onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
                  className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <label htmlFor="isPublic" className="text-[12px] text-[#475569]">Make this template public (visible to all organizations)</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTemplate(null)} className="h-9 px-4 text-[13px]">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editForm.name.trim()} className="h-9 px-5 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]">
                {saving ? "Saving..." : editTemplate === "new" ? "Create" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteTemplate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] text-center mb-2">Delete Template</h3>
            <p className="text-[13px] text-[#64748B] text-center mb-6">
              Are you sure you want to delete <span className="font-semibold text-[#334155]">{deleteTemplate.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteTemplate(null)} className="flex-1 h-10 text-[13px]">Cancel</Button>
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
