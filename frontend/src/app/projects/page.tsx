"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, hrApi, Project, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-blue-50 text-blue-700 border-blue-200" },
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  on_hold: { label: "On Hold", color: "bg-amber-50 text-amber-700 border-amber-200" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-600 border-red-200" },
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

const methodologyLabels: Record<string, string> = {
  scrum: "Scrum", kanban: "Kanban", scrumban: "Scrumban", waterfall: "Waterfall", custom: "Custom",
};

export default function ProjectsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const canCreateProject = hasOrgRole('manager');
  const canDeleteProject = hasOrgRole('admin');
  const canEditProject = hasOrgRole('manager');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ projectName: "", description: "", status: "", priority: "", category: "", startDate: "", endDate: "" });
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveAsTemplateProject, setSaveAsTemplateProject] = useState<Project | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", description: "" });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      const [res, empRes] = await Promise.all([
        projectApi.getAll(params),
        hrApi.getEmployees().catch(() => ({ data: [] })),
      ]);
      setProjects(Array.isArray(res.data) ? res.data : []);
      const map = new Map<string, Employee>();
      (Array.isArray(empRes.data) ? empRes.data : []).forEach((emp: Employee) => {
        if (emp.userId) map.set(emp.userId, emp);
        map.set(emp._id, emp);
      });
      setEmployeeMap(map);
    } catch (err: any) {
      toast.error(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  const openEdit = (p: Project) => {
    setEditForm({
      projectName: p.projectName || "",
      description: p.description || "",
      status: p.status || "planning",
      priority: p.priority || "medium",
      category: p.category || "",
      startDate: p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : "",
      endDate: p.endDate ? new Date(p.endDate).toISOString().split("T")[0] : "",
    });
    setEditProject(p);
    setMenuOpen(null);
  };

  const handleEditSave = async () => {
    if (!editProject) return;
    try {
      setSaving(true);
      await projectApi.update(editProject._id, editForm as Partial<Project>);
      toast.success("Project updated");
      setEditProject(null);
      fetchProjects();
    } catch (err: any) {
      toast.error(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProject) return;
    try {
      setSaving(true);
      await projectApi.delete(deleteProject._id);
      toast.success("Project deleted");
      setDeleteProject(null);
      fetchProjects();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!saveAsTemplateProject || !templateForm.name.trim()) return;
    try {
      setSaving(true);
      await projectApi.saveAsTemplate(saveAsTemplateProject._id, {
        name: templateForm.name,
        description: templateForm.description || undefined,
      });
      toast.success("Project saved as template");
      setSaveAsTemplateProject(null);
      setTemplateForm({ name: "", description: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to save as template");
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

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    planning: projects.filter((p) => p.status === "planning").length,
    completed: projects.filter((p) => p.status === "completed").length,
    totalMembers: projects.reduce((sum, p) => sum + (p.team?.length || 0), 0),
  };

  const statusButtons = ["all", "active", "planning", "on_hold", "completed"];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Projects</h1>
            <p className="text-[13px] text-[#94A3B8] mt-1">Manage and track your team&apos;s projects</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push("/projects/templates")} className="gap-2 h-10 px-4 border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Templates
            </Button>
            <Button variant="outline" onClick={() => router.push("/projects/roadmap")} className="gap-2 h-10 px-4 border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Roadmap
            </Button>
            {canCreateProject && (
              <Button onClick={() => router.push("/projects/new")} className="gap-2 h-10 px-5 bg-[#2E86C1] hover:bg-[#2471A3]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </Button>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.total}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Total Projects</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.active}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Active Projects</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.planning}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">In Planning</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{stats.totalMembers}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Team Members</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="pl-10 h-11 text-[15px] bg-[#F8FAFC] border-[#E2E8F0] rounded-xl" />
            </div>
            <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1">
              {statusButtons.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
                  {s === "all" ? "All" : s === "on_hold" ? "On Hold" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <h3 className="text-sm font-semibold text-[#334155] mb-1">No projects yet</h3>
              <p className="text-[13px] text-[#94A3B8] mb-4">Create your first project to get started</p>
              {canCreateProject && (
                <Button onClick={() => router.push("/projects/new")} className="gap-2 bg-[#2E86C1] hover:bg-[#2471A3]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => {
              const stConfig = statusConfig[project.status] || statusConfig.planning;
              const methLabel = methodologyLabels[project.methodology || ""] || "";
              const catColor = categoryColors[project.category || "other"] || categoryColors.other;
              const progress = project.progressPercentage || 0;

              return (
                <Card key={project._id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/projects/${project._id}`)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {project.projectKey?.slice(0, 2) || project.projectName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[#0F172A] truncate">{project.projectName}</h3>
                          <p className="text-[11px] text-[#94A3B8]">{project.projectKey}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border capitalize ${stConfig.color}`}>{stConfig.label}</span>
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === project._id ? null : project._id); }}
                            className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                            </svg>
                          </button>
                          {menuOpen === project._id && (canEditProject || canDeleteProject) && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(null); }} />
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 py-1">
                                {canEditProject && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEdit(project); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F8FAFC]"
                                  >
                                    <svg className="w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Edit
                                  </button>
                                )}
                                {canEditProject && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTemplateForm({ name: `${project.projectName} Template`, description: project.description || "" });
                                      setSaveAsTemplateProject(project);
                                      setMenuOpen(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F8FAFC]"
                                  >
                                    <svg className="w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    Save as Template
                                  </button>
                                )}
                                {(canEditProject || canDeleteProject) && <div className="border-t border-[#F1F5F9] my-0.5" />}
                                {canDeleteProject && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteProject(project); setMenuOpen(null); }}
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
                    </div>

                    {project.description && <p className="text-xs text-[#64748B] line-clamp-2 mb-3">{project.description.replace(/<[^>]*>/g, '')}</p>}

                    <div className="flex items-center gap-1.5 mb-3">
                      {methLabel && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">{methLabel}</span>}
                      {project.category && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${catColor}`}>{project.category}</span>}
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[#64748B]">Progress</span>
                        <span className="font-semibold text-[#0F172A]">{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full">
                        <div className="h-full bg-[#2E86C1] rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
                      <div className="flex -space-x-1.5">
                        {project.team?.slice(0, 4).map((member, i) => {
                          const emp = employeeMap.get(member.userId) || employeeMap.get(member.userId);
                          const name = emp ? `${emp.firstName} ${emp.lastName}` : "";
                          const initial = name.charAt(0).toUpperCase();
                          return (
                            <div key={i} className="w-6 h-6 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white" title={name || "Team member"}>
                              {initial || (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              )}
                            </div>
                          );
                        })}
                        {(project.team?.length || 0) > 4 && <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[9px] font-bold text-[#64748B] border-2 border-white">+{project.team!.length - 4}</div>}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Project Modal */}
      {editProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F172A]">Edit Project</h2>
              <button onClick={() => setEditProject(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
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
              <Button variant="outline" onClick={() => setEditProject(null)} className="h-9 px-4 text-[13px]">Cancel</Button>
              <Button onClick={handleEditSave} disabled={saving || !editForm.projectName.trim()} className="h-9 px-5 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] text-center mb-2">Delete Project</h3>
            <p className="text-[13px] text-[#64748B] text-center mb-6">
              Are you sure you want to delete <span className="font-semibold text-[#334155]">{deleteProject.projectName}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteProject(null)} className="flex-1 h-10 text-[13px]">Cancel</Button>
              <Button onClick={handleDelete} disabled={saving} className="flex-1 h-10 text-[13px] bg-red-600 hover:bg-red-700 text-white">
                {saving ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {saveAsTemplateProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSaveAsTemplateProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Save as Template</h2>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">From: {saveAsTemplateProject.projectName}</p>
              </div>
              <button onClick={() => setSaveAsTemplateProject(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Template Name *</label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="h-10 border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">Description</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
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
              <Button variant="outline" onClick={() => setSaveAsTemplateProject(null)} className="h-9 px-4 text-[13px]">Cancel</Button>
              <Button
                onClick={handleSaveAsTemplate}
                disabled={saving || !templateForm.name.trim()}
                className="h-9 px-5 text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]"
              >
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
