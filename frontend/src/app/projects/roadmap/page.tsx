"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi, Project, Task } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import RoadmapView, {
  RoadmapProject,
  RoadmapMilestone,
  RoadmapRelease,
  RoadmapEpic,
} from "@/components/projects/RoadmapView";

export default function PortfolioRoadmapPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const isOrgManager = hasOrgRole("manager");

  const [roadmapProjects, setRoadmapProjects] = useState<RoadmapProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(isOrgManager);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Get all active projects
      const projRes = await projectApi.getAll({ status: "active" });
      const allProjects: Project[] = Array.isArray(projRes.data) ? projRes.data : [];

      // If user is not an org manager, filter to projects where they are lead or admin
      const userId = user?._id || (user as any)?.userId;
      let visibleProjects = allProjects;
      if (!isOrgManager && userId) {
        visibleProjects = allProjects.filter((p) => {
          const member = p.team?.find((m) => m.userId === userId);
          return member && (member.role === "lead" || member.role === "admin");
        });
        setCanView(visibleProjects.length > 0);
      }

      // For each project, fetch epics and build roadmap data
      const items: RoadmapProject[] = await Promise.all(
        visibleProjects.map(async (proj) => {
          // Fetch epics for this project
          let epics: Task[] = [];
          try {
            const epicRes = await taskApi.getAll({ projectId: proj._id, type: "epic" } as Record<string, string>);
            epics = Array.isArray(epicRes.data) ? epicRes.data : [];
          } catch {
            // Ignore
          }

          // Build epic items with progress
          const epicItems: RoadmapEpic[] = await Promise.all(
            epics.slice(0, 10).map(async (epic) => {
              let childTotal = 0;
              let childDone = 0;
              try {
                const childRes = await taskApi.getChildren(epic._id);
                const children = Array.isArray(childRes.data) ? childRes.data : [];
                childTotal = children.length;
                childDone = children.filter((c) => c.status === "done").length;
              } catch {
                // Ignore
              }
              return {
                _id: epic._id,
                title: epic.title,
                status: epic.status,
                createdAt: epic.createdAt,
                dueDate: epic.dueDate,
                projectId: epic.projectId,
                projectName: proj.projectName,
                childTotal,
                childDone,
              };
            })
          );

          // Build milestones
          const milestones: RoadmapMilestone[] = (proj.milestones || []).map((m) => ({
            _id: m._id || crypto.randomUUID(),
            name: m.name,
            targetDate: m.targetDate,
            completedDate: m.completedDate,
            status: m.status as RoadmapMilestone["status"],
            description: m.description,
            phase: m.phase,
            deliverables: m.deliverables,
            projectId: proj._id,
            projectName: proj.projectName,
          }));

          // Build releases
          const releases: RoadmapRelease[] = (proj.releases || []).map((r) => ({
            _id: r._id || crypto.randomUUID(),
            name: r.name,
            status: r.status,
            startDate: r.startDate,
            releaseDate: r.releaseDate,
            releasedDate: r.releasedDate,
            description: r.description,
            projectId: proj._id,
            projectName: proj.projectName,
          }));

          return {
            _id: proj._id,
            projectName: proj.projectName,
            milestones,
            releases,
            epics: epicItems,
          };
        })
      );

      // Filter out projects with no roadmap items
      const withData = items.filter(
        (p) => p.milestones.length > 0 || p.releases.length > 0 || p.epics.length > 0
      );

      setRoadmapProjects(withData.length > 0 ? withData : items.slice(0, 5));
    } catch (err: any) {
      toast.error(err.message || "Failed to load portfolio roadmap");
    } finally {
      setLoading(false);
    }
  }, [user, isOrgManager]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleEpicClick = (epicId: string, projectId: string) => {
    router.push(`/projects/${projectId}/items/${epicId}`);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-[#334155] mb-1">Access Restricted</h3>
              <p className="text-[13px] text-[#94A3B8] mb-4">
                The portfolio roadmap is available to org managers/admins or project leads/admins.
              </p>
              <Button
                onClick={() => router.push("/projects")}
                className="bg-[#2E86C1] hover:bg-[#2471A3]"
              >
                Back to Projects
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/projects")}
              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">Portfolio Roadmap</h1>
              <p className="text-[13px] text-[#94A3B8] mt-0.5">
                Cross-project strategic timeline across all active projects
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/projects")}
            className="h-9 px-4 text-[13px]"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            All Projects
          </Button>
        </div>

        {/* Stats bar */}
        {!loading && roadmapProjects.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-[#0F172A]">{roadmapProjects.length}</p>
                <p className="text-[11px] text-[#94A3B8]">Active Projects</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-[#0F172A]">
                  {roadmapProjects.reduce((s, p) => s + p.milestones.length, 0)}
                </p>
                <p className="text-[11px] text-[#94A3B8]">Milestones</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-[#0F172A]">
                  {roadmapProjects.reduce((s, p) => s + p.releases.length, 0)}
                </p>
                <p className="text-[11px] text-[#94A3B8]">Releases</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-[#0F172A]">
                  {roadmapProjects.reduce((s, p) => s + p.epics.length, 0)}
                </p>
                <p className="text-[11px] text-[#94A3B8]">Epics</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex gap-3 mb-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-[#F1F5F9] rounded-lg w-20" />
                  ))}
                </div>
                <div className="h-6 bg-[#F1F5F9] rounded w-full" />
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-10 bg-[#F1F5F9] rounded w-48 shrink-0" />
                    <div className="h-10 bg-[#F1F5F9] rounded flex-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <RoadmapView
            projects={roadmapProjects}
            mode="portfolio"
            onEpicClick={handleEpicClick}
          />
        )}
      </main>
    </div>
  );
}
