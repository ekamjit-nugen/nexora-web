"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import {
  getTutorialSections, getCompletedIds, getSectionProgress, getOverallProgress,
  TutorialSection, Tutorial,
} from "@/lib/tutorial-data";

const AUDIENCE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  manager: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  employee: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  all: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
};

type AudienceFilter = "all" | "admin" | "manager" | "employee";

export default function TutorialsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCompletedIds(getCompletedIds());
    // Expand all sections by default
    const sections = getTutorialSections();
    setExpandedSections(new Set(sections.map(s => s.id)));
  }, []);

  if (authLoading || !user) return null;

  const sections = getTutorialSections();
  const overall = getOverallProgress(completedIds);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filterTutorials = (tutorials: Tutorial[]) => {
    return tutorials.filter(t => {
      if (audienceFilter !== "all" && t.audience !== "all" && t.audience !== audienceFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s);
      }
      return true;
    });
  };

  const filteredSections = sections.map(s => ({ ...s, tutorials: filterTutorials(s.tutorials) })).filter(s => s.tutorials.length > 0);

  const tabs: { key: AudienceFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "admin", label: "Admin Setup" },
    { key: "manager", label: "Manager" },
    { key: "employee", label: "Employee" },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0F172A]">Tutorial Center</h1>
          <p className="text-sm text-[#64748B] mt-1">
            {overall.completed} of {overall.total} completed — {overall.percentage}%
          </p>
          {/* Overall Progress Bar */}
          <div className="mt-3 w-full max-w-md bg-[#E2E8F0] rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${overall.percentage}%`, backgroundColor: overall.percentage === 100 ? "#10B981" : "#2E86C1" }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1 bg-white rounded-lg p-1 border border-[#E2E8F0]">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setAudienceFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  audienceFilter === tab.key ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Search tutorials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 text-sm"
          />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {filteredSections.map(section => {
            const progress = getSectionProgress(section.id, completedIds);
            const isExpanded = expandedSections.has(section.id);

            return (
              <div key={section.id} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 p-5 hover:bg-[#F8FAFC] transition-colors"
                >
                  <span className="text-2xl">{section.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-[#0F172A]">{section.title}</h2>
                      <span className="text-[10px] text-[#94A3B8]">{section.tutorials.length} tutorial{section.tutorials.length !== 1 ? "s" : ""}</span>
                    </div>
                    {/* Section Progress */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 max-w-[200px] bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progress.percentage}%`,
                            backgroundColor: progress.percentage === 100 ? "#10B981" : section.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">{progress.completed}/{progress.total}</span>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-[#94A3B8] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Tutorial List */}
                {isExpanded && (
                  <div className="border-t border-[#F1F5F9]">
                    {section.tutorials.map(tutorial => {
                      const isCompleted = completedIds.includes(tutorial.id);
                      const ac = AUDIENCE_COLORS[tutorial.audience] || AUDIENCE_COLORS.all;

                      return (
                        <div
                          key={tutorial.id}
                          onClick={() => router.push(`/tutorials/${tutorial.id}`)}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] cursor-pointer transition-colors border-b border-[#F8FAFC] last:border-0"
                        >
                          {/* Status Icon */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? "bg-[#10B981] text-white"
                              : "bg-[#F1F5F9] text-[#94A3B8]"
                          }`}>
                            {isCompleted ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-[9px] font-bold">{section.tutorials.indexOf(tutorial) + 1}</span>
                            )}
                          </div>

                          {/* Title & Description */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isCompleted ? "text-[#94A3B8] line-through" : "text-[#0F172A]"}`}>
                              {tutorial.title}
                            </p>
                            <p className="text-[11px] text-[#94A3B8] truncate">{tutorial.description}</p>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ac.bg} ${ac.text}`}>
                              {tutorial.audience === "all" ? "EVERYONE" : tutorial.audience.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-[#94A3B8] font-medium whitespace-nowrap">
                              {tutorial.duration} min
                            </span>
                            <svg className="w-4 h-4 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredSections.length === 0 && (
          <div className="text-center py-16 text-[#94A3B8] text-sm">
            No tutorials match your search. Try different keywords or clear the filter.
          </div>
        )}
      </main>
    </div>
  );
}
