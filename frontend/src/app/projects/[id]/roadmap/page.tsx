"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function ProjectRoadmapPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [roadmapData, setRoadmapData] = useState<RoadmapProject | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, epicsRes] = await Promise.all([
        projectApi.getById(projectId),
        taskApi.getAll({ projectId, type: "epic" } as Record<string, string>),
      ]);

      const proj = projRes.data || null;
      setProject(proj);

      if (!proj) {
        toast.error("Project not found");
        return;
      }

      const epics: Task[] = Array.isArray(epicsRes.data) ? epicsRes.data : [];

      // For each epic, fetch child tasks to compute progress
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
            // Ignore — children not available
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
      }));

      setRoadmapData({
        _id: proj._id,
        projectName: proj.projectName,
        milestones,
        releases,
        epics: epicItems,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load roadmap data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && projectId) fetchData();
  }, [user, projectId, fetchData]);

  const handleEpicClick = (epicId: string, projId: string) => {
    router.push(`/projects/${projId}/items/${epicId}`);
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
      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                {project?.projectKey && (
                  <span className="text-[11px] font-medium text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded">
                    {project.projectKey}
                  </span>
                )}
                <h1 className="text-xl font-bold text-[#0F172A]">Roadmap</h1>
              </div>
              <p className="text-[13px] text-[#94A3B8] mt-0.5">
                {project?.projectName || "Loading..."} — strategic timeline view
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="h-9 px-4 text-[13px]"
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              Board
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/projects/roadmap")}
              className="h-9 px-4 text-[13px]"
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              Portfolio View
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              {/* Skeleton */}
              <div className="animate-pulse space-y-4">
                <div className="flex gap-3 mb-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-[#F1F5F9] rounded-lg w-20" />
                  ))}
                </div>
                <div className="h-6 bg-[#F1F5F9] rounded w-full" />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-10 bg-[#F1F5F9] rounded w-48 shrink-0" />
                    <div className="h-10 bg-[#F1F5F9] rounded flex-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : roadmapData ? (
          <RoadmapView
            projects={[roadmapData]}
            mode="single"
            onEpicClick={handleEpicClick}
          />
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <h3 className="text-sm font-semibold text-[#334155] mb-1">Project not found</h3>
              <p className="text-[13px] text-[#94A3B8]">Unable to load roadmap data for this project.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
