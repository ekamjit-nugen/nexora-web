"use client";

import { useState } from "react";
import { aiApi } from "@/lib/api";
import { toast } from "sonner";

interface AiPromptPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    type: "project-create" | "project-detail";
    projectName?: string;
    category?: string;
    description?: string;
    projectId?: string;
  };
  onApply: (data: Record<string, unknown>) => void;
}

interface PromptCard {
  id: string;
  title: string;
  description: string;
  comingSoon?: boolean;
}

type ThinkingPhase = "Analyzing project context..." | "Generating recommendations..." | "Structuring output...";

const THINKING_PHASES: ThinkingPhase[] = [
  "Analyzing project context...",
  "Generating recommendations...",
  "Structuring output...",
];

const CREATE_PROMPTS: PromptCard[] = [
  { id: "plan", title: "Generate complete project plan", description: "Creates description, milestones, tasks, and suggests a board type" },
  { id: "milestones", title: "Suggest project milestones", description: "AI-powered milestone suggestions based on project type" },
  { id: "description", title: "Write project description", description: "Generate a professional project description" },
];

const DETAIL_PROMPTS: PromptCard[] = [
  { id: "board", title: "Generate sprint tasks", description: "Create tasks based on milestones and board type" },
  { id: "risks", title: "Analyze project risks", description: "Identify potential risks and mitigation strategies", comingSoon: true },
  { id: "team", title: "Suggest team structure", description: "Recommend roles and team composition", comingSoon: true },
];

interface PlanResult {
  description: string;
  milestones: Array<{ name: string; durationDays: number }>;
  tasks: Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }>;
  suggestedBoardType: string;
}

interface MilestonesResult {
  milestones: Array<{ name: string; durationDays: number }>;
}

interface DescriptionResult {
  description: string;
}

interface BoardResult {
  tasks: Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }>;
}

type AiResult = PlanResult | MilestonesResult | DescriptionResult | BoardResult;

export function AiPromptPanel({ isOpen, onClose, context, onApply }: AiPromptPanelProps) {
  const [loading, setLoading] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [resultType, setResultType] = useState<string | null>(null);

  // Editable state for preview
  const [editDescription, setEditDescription] = useState("");
  const [editMilestones, setEditMilestones] = useState<Array<{ name: string; durationDays: number }>>([]);
  const [editTasks, setEditTasks] = useState<Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }>>([]);
  const [editBoardType, setEditBoardType] = useState("");

  const prompts = context.type === "project-create" ? CREATE_PROMPTS : DETAIL_PROMPTS;

  const runThinkingAnimation = () => {
    setThinkingPhase(0);
    const interval = setInterval(() => {
      setThinkingPhase((prev) => {
        if (prev >= THINKING_PHASES.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
    return interval;
  };

  const handlePromptClick = async (promptId: string) => {
    if (!context.projectName?.trim()) {
      toast.error("Project name is required for AI generation");
      return;
    }

    setActivePrompt(promptId);
    setLoading(true);
    setResult(null);
    setResultType(null);

    const thinkingInterval = runThinkingAnimation();

    try {
      switch (promptId) {
        case "plan": {
          const res = await aiApi.generateProjectPlan({
            projectName: context.projectName,
            category: context.category || "other",
            description: context.description || undefined,
          });
          if (res.data) {
            const data = res.data;
            setResult(data);
            setResultType("plan");
            setEditDescription(data.description);
            setEditMilestones([...data.milestones]);
            setEditTasks([...data.tasks]);
            setEditBoardType(data.suggestedBoardType);
          }
          break;
        }
        case "milestones": {
          const res = await aiApi.generateMilestones({
            projectName: context.projectName,
            category: context.category || "other",
            description: context.description || undefined,
          });
          if (res.data) {
            setResult(res.data);
            setResultType("milestones");
            setEditMilestones([...res.data.milestones]);
          }
          break;
        }
        case "description": {
          const res = await aiApi.generateDescription({
            projectName: context.projectName,
            category: context.category || "other",
            context: context.description || undefined,
          });
          if (res.data) {
            setResult(res.data);
            setResultType("description");
            setEditDescription(res.data.description);
          }
          break;
        }
        case "board": {
          const res = await aiApi.generateBoard({
            projectName: context.projectName,
            category: context.category || "other",
            milestones: [],
            boardType: "kanban",
          });
          if (res.data) {
            setResult(res.data);
            setResultType("board");
            setEditTasks([...res.data.tasks]);
          }
          break;
        }
      }
    } catch {
      toast.error("AI generation failed. Please try again.");
    } finally {
      clearInterval(thinkingInterval);
      setLoading(false);
      setActivePrompt(null);
    }
  };

  const handleDiscard = () => {
    setResult(null);
    setResultType(null);
    setEditDescription("");
    setEditMilestones([]);
    setEditTasks([]);
    setEditBoardType("");
  };

  const handleApply = () => {
    const data: Record<string, unknown> = { type: resultType };

    if (resultType === "plan") {
      data.description = editDescription;
      data.milestones = editMilestones;
      data.tasks = editTasks;
      data.suggestedBoardType = editBoardType;
    } else if (resultType === "milestones") {
      data.milestones = editMilestones;
    } else if (resultType === "description") {
      data.description = editDescription;
    } else if (resultType === "board") {
      data.tasks = editTasks;
    }

    onApply(data);
    handleDiscard();
    onClose();
  };

  const removeMilestone = (idx: number) => {
    setEditMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeTask = (idx: number) => {
    setEditTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[200] transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-white shadow-2xl border-l border-[#E2E8F0] z-[201] flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E86C1] to-[#85C1E9] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-[#0F172A]">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-[#E2E8F0]" />
                <div className="absolute inset-0 rounded-full border-2 border-[#2E86C1] border-t-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#2E86C1]/10 to-[#85C1E9]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2 w-full max-w-[240px]">
                {THINKING_PHASES.map((phase, idx) => (
                  <div key={idx} className={`flex items-center gap-2 transition-opacity duration-300 ${idx <= thinkingPhase ? "opacity-100" : "opacity-30"}`}>
                    {idx < thinkingPhase ? (
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                      </svg>
                    ) : idx === thinkingPhase ? (
                      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#2E86C1] animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#E2E8F0]" />
                      </div>
                    )}
                    <span className="text-[13px] text-[#334155]">{phase}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Cards (when no result) */}
          {!loading && !result && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#64748B] mb-4">
                {context.projectName
                  ? `Choose an action for "${context.projectName}"`
                  : "Select a prompt to get started"}
              </p>
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => !prompt.comingSoon && handlePromptClick(prompt.id)}
                  disabled={prompt.comingSoon}
                  className={`w-full text-left border rounded-xl p-3 transition-all group ${
                    prompt.comingSoon
                      ? "border-[#E2E8F0] opacity-50 cursor-not-allowed"
                      : "border-[#E2E8F0] hover:border-[#2E86C1] hover:shadow-sm cursor-pointer"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${prompt.comingSoon ? "bg-[#F1F5F9]" : "bg-[#2E86C1]/5 group-hover:bg-[#2E86C1]/10"}`}>
                      <svg className={`w-4 h-4 ${prompt.comingSoon ? "text-[#94A3B8]" : "text-[#2E86C1]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-[13px] font-semibold ${prompt.comingSoon ? "text-[#94A3B8]" : "text-[#0F172A] group-hover:text-[#2E86C1]"}`}>
                          {prompt.title}
                        </p>
                        {prompt.comingSoon && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#94A3B8]">
                            Soon
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#94A3B8] mt-0.5">{prompt.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Result Preview */}
          {!loading && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[13px] font-semibold text-[#0F172A]">AI Result</span>
              </div>

              {/* Description Section */}
              {(resultType === "plan" || resultType === "description") && (
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-2">Description</h4>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                  />
                </div>
              )}

              {/* Board Type Section */}
              {resultType === "plan" && editBoardType && (
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-2">Suggested Board Type</h4>
                  <span className="text-[13px] font-medium text-[#334155] capitalize bg-white px-3 py-1.5 rounded-lg border border-[#E2E8F0] inline-block">
                    {editBoardType}
                  </span>
                </div>
              )}

              {/* Milestones Section */}
              {(resultType === "plan" || resultType === "milestones") && editMilestones.length > 0 && (
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Milestones ({editMilestones.length})</h4>
                  </div>
                  <div className="space-y-1.5">
                    {editMilestones.map((ms, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#E2E8F0]">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-[#2E86C1] shrink-0" />
                          <span className="text-[13px] text-[#334155] truncate">{ms.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-[#94A3B8]">{ms.durationDays}d</span>
                          <button
                            onClick={() => removeMilestone(idx)}
                            className="text-[#CBD5E1] hover:text-red-400 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              {(resultType === "plan" || resultType === "board") && editTasks.length > 0 && (
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Tasks ({editTasks.length})</h4>
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {editTasks.map((task, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#E2E8F0]">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-[13px] text-[#334155] truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              task.type === "feature" ? "bg-violet-100 text-violet-700" :
                              task.type === "bug" ? "bg-red-100 text-red-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>{task.type}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              task.priority === "high" || task.priority === "critical" ? "bg-red-100 text-red-700" :
                              task.priority === "medium" ? "bg-amber-100 text-amber-700" :
                              "bg-green-100 text-green-700"
                            }`}>{task.priority}</span>
                            {task.storyPoints > 0 && (
                              <span className="text-[10px] text-[#94A3B8]">{task.storyPoints}sp</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeTask(idx)}
                          className="text-[#CBD5E1] hover:text-red-400 transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && result && (
          <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center gap-3">
            <button
              onClick={handleDiscard}
              className="flex-1 h-10 rounded-xl text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleApply}
              className="flex-1 h-10 rounded-xl text-[13px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Apply
            </button>
          </div>
        )}
      </div>
    </>
  );
}
