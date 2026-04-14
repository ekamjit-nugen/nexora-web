"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  getTutorialById, getAdjacentTutorials, getCompletedIds, markComplete, markIncomplete,
  Tutorial, TUTORIALS,
} from "@/lib/tutorial-data";

const AUDIENCE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  manager: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  employee: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  all: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
};

export default function TutorialDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tutorialId = params.id as string;

  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    setCompletedIds(getCompletedIds());
  }, []);

  if (authLoading || !user) return null;

  const tutorial = getTutorialById(tutorialId);
  if (!tutorial) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="ml-[260px] p-8">
          <div className="text-center py-20 text-[#94A3B8]">Tutorial not found</div>
        </main>
      </div>
    );
  }

  const { prev, next } = getAdjacentTutorials(tutorialId);
  const isCompleted = completedIds.includes(tutorialId);
  const ac = AUDIENCE_COLORS[tutorial.audience] || AUDIENCE_COLORS.all;

  const handleToggleComplete = () => {
    if (isCompleted) {
      setCompletedIds(markIncomplete(tutorialId));
    } else {
      setCompletedIds(markComplete(tutorialId));
    }
  };

  const relatedTutorials = tutorial.relatedIds
    .map(id => TUTORIALS.find(t => t.id === id))
    .filter(Boolean) as Tutorial[];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push("/tutorials")}
            className="text-xs text-[#64748B] hover:text-[#2E86C1] mb-6 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Tutorials
          </button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{tutorial.sectionIcon}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ac.bg} ${ac.text}`}>
                {tutorial.audience === "all" ? "EVERYONE" : tutorial.audience.toUpperCase()}
              </span>
              <span className="text-xs text-[#94A3B8]">{tutorial.duration} min</span>
              {isCompleted && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D1FAE5] text-[#065F46]">COMPLETED</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A]">{tutorial.title}</h1>
            <p className="text-sm text-[#64748B] mt-2">{tutorial.description}</p>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-5">Step-by-Step Guide</h2>
            <div className="space-y-6">
              {tutorial.steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: tutorial.sectionColor }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-sm font-semibold text-[#0F172A] mb-1">{step.title}</h3>
                    <p className="text-sm text-[#475569] leading-relaxed">{step.description}</p>
                    {step.tip && (
                      <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-[#FFF7ED] border border-[#FED7AA] rounded-lg">
                        <span className="text-sm">💡</span>
                        <p className="text-xs text-[#92400E]">{step.tip}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tips */}
          {tutorial.proTips.length > 0 && (
            <div className="bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] p-6 mb-6">
              <h2 className="text-sm font-semibold text-[#1E40AF] mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Pro Tips
              </h2>
              <ul className="space-y-2">
                {tutorial.proTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#3B82F6] mt-1 shrink-0">&#8226;</span>
                    <span className="text-sm text-[#1E40AF]">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mark Complete Button */}
          <div className="flex justify-center mb-8">
            <Button
              onClick={handleToggleComplete}
              className={`text-sm px-8 py-3 ${
                isCompleted
                  ? "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                  : "bg-[#10B981] text-white hover:bg-[#059669]"
              }`}
            >
              {isCompleted ? (
                <>
                  <svg className="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Completed — Click to Undo
                </>
              ) : (
                "Mark as Complete"
              )}
            </Button>
          </div>

          {/* Related Tutorials */}
          {relatedTutorials.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Related Tutorials</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedTutorials.map(rel => {
                  const relCompleted = completedIds.includes(rel.id);
                  return (
                    <div
                      key={rel.id}
                      onClick={() => router.push(`/tutorials/${rel.id}`)}
                      className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-4 hover:shadow-md hover:border-[#2E86C1] cursor-pointer transition-all flex items-center gap-3"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        relCompleted ? "bg-[#10B981] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
                      }`}>
                        {relCompleted ? (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-[8px] font-bold">{rel.sectionIcon}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#0F172A] truncate">{rel.title}</p>
                        <p className="text-[10px] text-[#94A3B8]">{rel.duration} min</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-[#E2E8F0]">
            {prev ? (
              <button
                onClick={() => router.push(`/tutorials/${prev.id}`)}
                className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#2E86C1] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-[#94A3B8]">Previous</p>
                  <p className="text-xs font-medium">{prev.title}</p>
                </div>
              </button>
            ) : <div />}
            {next ? (
              <button
                onClick={() => router.push(`/tutorials/${next.id}`)}
                className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#2E86C1] transition-colors"
              >
                <div className="text-right">
                  <p className="text-[10px] text-[#94A3B8]">Next</p>
                  <p className="text-xs font-medium">{next.title}</p>
                </div>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : <div />}
          </div>
        </div>
      </main>
    </div>
  );
}
