"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, roleApi, hrApi } from "@/lib/api";
import type { User, Department } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Survey configuration
// ---------------------------------------------------------------------------
const surveyTypeConfig: Record<string, { label: string; color: string }> = {
  poll: { label: "Poll", color: "bg-blue-50 text-blue-700 border-blue-200" },
  pulse: { label: "Pulse", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  enps: { label: "eNPS", color: "bg-purple-50 text-purple-700 border-purple-200" },
  "360_feedback": { label: "360° Feedback", color: "bg-pink-50 text-pink-700 border-pink-200" },
  exit: { label: "Exit", color: "bg-orange-50 text-orange-700 border-orange-200" },
  engagement: { label: "Engagement", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  custom: { label: "Custom", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const SURVEY_TYPE_OPTIONS = Object.keys(surveyTypeConfig);

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-200" },
  archived: { label: "Archived", color: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

const QUESTION_TYPE_OPTIONS = [
  { key: "single_choice", label: "Single choice" },
  { key: "multi_choice", label: "Multi choice" },
  { key: "rating", label: "Rating (1-5)" },
  { key: "nps", label: "NPS (0-10)" },
  { key: "scale", label: "Scale (1-10)" },
  { key: "text", label: "Text" },
  { key: "yes_no", label: "Yes / No" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SurveyQuestion {
  _id?: string;
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
}

interface Survey {
  _id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  isAnonymous?: boolean;
  targetAudience?: string;
  targetDepartmentId?: string;
  targetEmployeeIds?: string[];
  startDate?: string;
  endDate?: string;
  questions: SurveyQuestion[];
  responseCount?: number;
  targetCount?: number;
  createdAt?: string;
}

interface QuestionResult {
  questionId?: string;
  questionText: string;
  questionType: string;
  // For choice questions
  optionCounts?: Record<string, number>;
  totalResponses?: number;
  // For rating / scale
  average?: number;
  distribution?: Record<string, number>;
  // For NPS
  promoters?: number;
  passives?: number;
  detractors?: number;
  npsScore?: number;
  // For text
  responses?: string[];
}

interface SurveyResults {
  survey?: Survey;
  questions: QuestionResult[];
  totalResponses?: number;
  responseRate?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysRemaining = (endDate?: string): number | null => {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
};

type TabKey = "my" | "all" | "results";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SurveysPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [mySurveys, setMySurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Results tab
  const [selectedResultsId, setSelectedResultsId] = useState("");
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // New survey modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<string>("poll");
  const [newIsAnonymous, setNewIsAnonymous] = useState(true);
  const [newAudience, setNewAudience] = useState<"all" | "department" | "specific">("all");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newEmployeeIds, setNewEmployeeIds] = useState<string[]>([]);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newQuestions, setNewQuestions] = useState<SurveyQuestion[]>([
    { text: "", type: "single_choice", options: ["", ""], required: true },
  ]);
  const [saving, setSaving] = useState(false);

  // Respond modal
  const [respondSurvey, setRespondSurvey] = useState<Survey | null>(null);
  const [responseAnswers, setResponseAnswers] = useState<Record<string, any>>({});
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Directory
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchMySurveys = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getActiveSurveysForUser();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.surveys ?? [];
      setMySurveys(data as Survey[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load your surveys");
    }
  }, [user]);

  const fetchAllSurveys = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const res = await payrollApi.listSurveys();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.surveys ?? [];
      setAllSurveys(data as Survey[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load all surveys");
    }
  }, [user, isAdmin]);

  const fetchDirectory = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [userRes, deptRes] = await Promise.all([
        roleApi.getUsers(),
        hrApi.getDepartments(),
      ]);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMySurveys(), fetchAllSurveys(), fetchDirectory()]);
    setLoading(false);
  }, [fetchMySurveys, fetchAllSurveys, fetchDirectory]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // -------------------------------------------------------------------------
  // Load survey results
  // -------------------------------------------------------------------------
  const loadResults = useCallback(async (id: string) => {
    if (!id) {
      setResults(null);
      return;
    }
    setResultsLoading(true);
    try {
      const res = await payrollApi.getSurveyResults(id);
      setResults(res.data as SurveyResults);
    } catch (err: any) {
      toast.error(err.message || "Failed to load survey results");
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "results" && selectedResultsId) {
      loadResults(selectedResultsId);
    }
  }, [activeTab, selectedResultsId, loadResults]);

  // -------------------------------------------------------------------------
  // New survey: question editor helpers
  // -------------------------------------------------------------------------
  const addQuestion = () => {
    setNewQuestions((prev) => [
      ...prev,
      { text: "", type: "single_choice", options: ["", ""], required: true },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setNewQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<SurveyQuestion>) => {
    setNewQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const updated = { ...q, ...patch };
        // Ensure options exist for choice types
        if (
          (updated.type === "single_choice" || updated.type === "multi_choice") &&
          (!updated.options || updated.options.length === 0)
        ) {
          updated.options = ["", ""];
        }
        return updated;
      }),
    );
  };

  const addOption = (qIdx: number) => {
    setNewQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: [...(q.options || []), ""] } : q,
      ),
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setNewQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: (q.options || []).filter((_, j) => j !== oIdx) }
          : q,
      ),
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setNewQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: (q.options || []).map((o, j) => (j === oIdx ? value : o)),
            }
          : q,
      ),
    );
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const resetNewModal = () => {
    setNewTitle("");
    setNewDescription("");
    setNewType("poll");
    setNewIsAnonymous(true);
    setNewAudience("all");
    setNewDepartmentId("");
    setNewEmployeeIds([]);
    setNewStartDate("");
    setNewEndDate("");
    setNewQuestions([{ text: "", type: "single_choice", options: ["", ""], required: true }]);
    setShowNewModal(false);
  };

  const handleCreateSurvey = async () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (newQuestions.length === 0) {
      toast.error("Please add at least one question");
      return;
    }
    for (let i = 0; i < newQuestions.length; i++) {
      const q = newQuestions[i];
      if (!q.text.trim()) {
        toast.error(`Question ${i + 1} is empty`);
        return;
      }
      if (
        (q.type === "single_choice" || q.type === "multi_choice") &&
        (!q.options || q.options.filter((o) => o.trim()).length < 2)
      ) {
        toast.error(`Question ${i + 1} needs at least 2 options`);
        return;
      }
    }
    if (newAudience === "department" && !newDepartmentId) {
      toast.error("Please select a department");
      return;
    }
    if (newAudience === "specific" && newEmployeeIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        type: newType,
        isAnonymous: newIsAnonymous,
        targetAudience: newAudience,
        questions: newQuestions.map((q) => ({
          text: q.text.trim(),
          type: q.type,
          options: q.options?.filter((o) => o.trim()).map((o) => o.trim()),
          required: !!q.required,
        })),
      };
      if (newAudience === "department") payload.targetDepartmentId = newDepartmentId;
      if (newAudience === "specific") payload.targetEmployeeIds = newEmployeeIds;
      if (newStartDate) payload.startDate = new Date(newStartDate).toISOString();
      if (newEndDate) payload.endDate = new Date(newEndDate).toISOString();

      await payrollApi.createSurvey(payload);
      toast.success("Survey created as draft");
      resetNewModal();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to create survey");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishSurvey = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.publishSurvey(id);
      toast.success("Survey published");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish survey");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseSurvey = async (id: string) => {
    if (!confirm("Close this survey? Respondents will no longer be able to submit.")) return;
    setActionLoading(id);
    try {
      await payrollApi.closeSurvey(id);
      toast.success("Survey closed");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to close survey");
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Respond modal
  // -------------------------------------------------------------------------
  const openRespondModal = (survey: Survey) => {
    setRespondSurvey(survey);
    setResponseAnswers({});
  };

  const closeRespondModal = () => {
    setRespondSurvey(null);
    setResponseAnswers({});
  };

  const handleSubmitResponse = async () => {
    if (!respondSurvey) return;

    // Validate required questions
    for (let i = 0; i < respondSurvey.questions.length; i++) {
      const q = respondSurvey.questions[i];
      const key = q._id || `q${i}`;
      if (q.required) {
        const val = responseAnswers[key];
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          toast.error(`Question ${i + 1} is required`);
          return;
        }
      }
    }

    setSubmittingResponse(true);
    try {
      const answers = respondSurvey.questions.map((q, i) => {
        const key = q._id || `q${i}`;
        return {
          questionId: q._id,
          questionIndex: i,
          answer: responseAnswers[key] ?? null,
        };
      });
      await payrollApi.submitSurveyResponse(respondSurvey._id, { answers });
      toast.success("Response submitted. Thank you!");
      closeRespondModal();
      await fetchMySurveys();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit response");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const answeredCount = useMemo(() => {
    if (!respondSurvey) return 0;
    return respondSurvey.questions.filter((q, i) => {
      const key = q._id || `q${i}`;
      const val = responseAnswers[key];
      return (
        val !== undefined &&
        val !== null &&
        val !== "" &&
        !(Array.isArray(val) && val.length === 0)
      );
    }).length;
  }, [respondSurvey, responseAnswers]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderBadge = (value: string, config: Record<string, { label: string; color: string }>) => {
    const cfg = config[value] || { label: value, color: "bg-gray-100 text-gray-600 border-gray-200" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  const renderQuestionInput = (q: SurveyQuestion, idx: number) => {
    const key = q._id || `q${idx}`;
    const val = responseAnswers[key];

    switch (q.type) {
      case "single_choice":
        return (
          <div className="space-y-1.5">
            {(q.options || []).map((opt, oIdx) => (
              <label
                key={oIdx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <input
                  type="radio"
                  name={key}
                  checked={val === opt}
                  onChange={() => setResponseAnswers((prev) => ({ ...prev, [key]: opt }))}
                  className="text-[#2E86C1] focus:ring-[#2E86C1]/30"
                />
                <span className="text-[13px] text-[#0F172A]">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "multi_choice":
        return (
          <div className="space-y-1.5">
            {(q.options || []).map((opt, oIdx) => {
              const arr: string[] = Array.isArray(val) ? val : [];
              const checked = arr.includes(opt);
              return (
                <label
                  key={oIdx}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...arr, opt]
                        : arr.filter((o) => o !== opt);
                      setResponseAnswers((prev) => ({ ...prev, [key]: next }));
                    }}
                    className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                  />
                  <span className="text-[13px] text-[#0F172A]">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      case "rating":
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setResponseAnswers((prev) => ({ ...prev, [key]: n }))}
                className={`w-10 h-10 rounded-lg border text-[16px] font-bold transition-colors ${
                  val === n
                    ? "bg-[#2E86C1] border-[#2E86C1] text-white"
                    : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      case "nps":
        return (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }).map((_, n) => (
              <button
                key={n}
                onClick={() => setResponseAnswers((prev) => ({ ...prev, [key]: n }))}
                className={`w-9 h-9 rounded-lg border text-[13px] font-bold transition-colors ${
                  val === n
                    ? "bg-[#2E86C1] border-[#2E86C1] text-white"
                    : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      case "scale":
        return (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  onClick={() => setResponseAnswers((prev) => ({ ...prev, [key]: n }))}
                  className={`w-9 h-9 rounded-lg border text-[13px] font-bold transition-colors ${
                    val === n
                      ? "bg-[#2E86C1] border-[#2E86C1] text-white"
                      : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        );
      case "yes_no":
        return (
          <div className="flex gap-2">
            {["yes", "no"].map((opt) => (
              <button
                key={opt}
                onClick={() => setResponseAnswers((prev) => ({ ...prev, [key]: opt }))}
                className={`px-6 py-2 rounded-lg border text-[13px] font-semibold transition-colors ${
                  val === opt
                    ? "bg-[#2E86C1] border-[#2E86C1] text-white"
                    : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {opt === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        );
      case "text":
      default:
        return (
          <textarea
            rows={3}
            placeholder="Your response..."
            value={val || ""}
            onChange={(e) =>
              setResponseAnswers((prev) => ({ ...prev, [key]: e.target.value }))
            }
            className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
          />
        );
    }
  };

  const renderResultBar = (label: string, count: number, total: number) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div key={label}>
        <div className="flex items-center justify-between text-[12px] mb-1">
          <span className="text-[#0F172A] font-medium">{label}</span>
          <span className="text-[#64748B]">
            {count} ({pct}%)
          </span>
        </div>
        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2E86C1] rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Auth gate
  // -------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E86C1]" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Surveys</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Share feedback and measure team sentiment
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowNewModal(true)}
              className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Survey
            </Button>
          )}
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* Tabs */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeTab === "my"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              My Surveys
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeTab === "all"
                      ? "bg-white text-[#0F172A] shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  All Surveys
                </button>
                <button
                  onClick={() => setActiveTab("results")}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeTab === "results"
                      ? "bg-white text-[#0F172A] shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  Results
                </button>
              </>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E86C1]" />
            </div>
          ) : (
            <>
              {/* My Surveys Tab */}
              {activeTab === "my" && (
                <div className="space-y-3 max-w-3xl">
                  {mySurveys.length === 0 ? (
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                      <div className="text-4xl mb-2">📋</div>
                      <p className="text-[14px] text-[#64748B]">
                        No surveys awaiting your response
                      </p>
                    </div>
                  ) : (
                    mySurveys.map((s) => {
                      const days = daysRemaining(s.endDate);
                      return (
                        <div
                          key={s._id}
                          className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {renderBadge(s.type, surveyTypeConfig)}
                                {s.isAnonymous && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                                    🔒 Anonymous
                                  </span>
                                )}
                              </div>
                              <h3 className="text-[15px] font-bold text-[#0F172A]">{s.title}</h3>
                              {s.description && (
                                <p className="text-[13px] text-[#64748B] mt-1">{s.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-3 text-[11px] text-[#94A3B8]">
                                <span>{s.questions?.length || 0} questions</span>
                                {days !== null && (
                                  <>
                                    <span>·</span>
                                    <span className={days <= 2 ? "text-red-600 font-semibold" : ""}>
                                      {days === 0 ? "Last day" : `${days} days remaining`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => openRespondModal(s)}
                              className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px] shrink-0"
                            >
                              Respond Now
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* All Surveys Tab */}
              {activeTab === "all" && isAdmin && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {allSurveys.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-4xl mb-2">📋</div>
                      <p className="text-[14px] text-[#64748B]">No surveys created yet</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr>
                          <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Title
                          </th>
                          <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Type
                          </th>
                          <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Status
                          </th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Responses
                          </th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Rate
                          </th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {allSurveys.map((s) => {
                          const rate =
                            s.targetCount && s.targetCount > 0
                              ? Math.round(((s.responseCount || 0) / s.targetCount) * 100)
                              : 0;
                          return (
                            <tr key={s._id} className="hover:bg-[#F8FAFC]">
                              <td className="px-5 py-3">
                                <div className="text-[13px] font-semibold text-[#0F172A]">{s.title}</div>
                                {s.description && (
                                  <div className="text-[11px] text-[#94A3B8] truncate max-w-xs">
                                    {s.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-3">{renderBadge(s.type, surveyTypeConfig)}</td>
                              <td className="px-5 py-3">{renderBadge(s.status, statusConfig)}</td>
                              <td className="px-5 py-3 text-right text-[13px] text-[#0F172A]">
                                {s.responseCount || 0}
                                {s.targetCount ? ` / ${s.targetCount}` : ""}
                              </td>
                              <td className="px-5 py-3 text-right text-[13px] text-[#0F172A]">
                                {s.targetCount ? `${rate}%` : "\u2014"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setActiveTab("results");
                                      setSelectedResultsId(s._id);
                                    }}
                                    className="px-2.5 py-1 text-[11px] rounded-md border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
                                  >
                                    Results
                                  </button>
                                  {s.status === "draft" && (
                                    <button
                                      onClick={() => handlePublishSurvey(s._id)}
                                      disabled={actionLoading === s._id}
                                      className="px-2.5 py-1 text-[11px] rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                    >
                                      Publish
                                    </button>
                                  )}
                                  {s.status === "active" && (
                                    <button
                                      onClick={() => handleCloseSurvey(s._id)}
                                      disabled={actionLoading === s._id}
                                      className="px-2.5 py-1 text-[11px] rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Close
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Results Tab */}
              {activeTab === "results" && isAdmin && (
                <div className="space-y-4 max-w-3xl">
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                    <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                      Select a survey
                    </label>
                    <select
                      value={selectedResultsId}
                      onChange={(e) => setSelectedResultsId(e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      <option value="">Choose a survey...</option>
                      {allSurveys.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.title} ({statusConfig[s.status]?.label || s.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {resultsLoading && (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E86C1]" />
                    </div>
                  )}

                  {!resultsLoading && results && (
                    <div className="space-y-4">
                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                              Total responses
                            </p>
                            <p className="text-[28px] font-bold text-[#0F172A] mt-0.5">
                              {results.totalResponses || 0}
                            </p>
                          </div>
                          {typeof results.responseRate === "number" && (
                            <div className="text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                                Response rate
                              </p>
                              <p className="text-[28px] font-bold text-[#2E86C1] mt-0.5">
                                {results.responseRate}%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {(results.questions || []).map((qr, qIdx) => (
                        <div
                          key={qIdx}
                          className="bg-white border border-[#E2E8F0] rounded-xl p-5"
                        >
                          <h3 className="text-[14px] font-bold text-[#0F172A] mb-3">
                            {qIdx + 1}. {qr.questionText}
                          </h3>

                          {(qr.questionType === "single_choice" ||
                            qr.questionType === "multi_choice" ||
                            qr.questionType === "yes_no") &&
                            qr.optionCounts && (
                              <div className="space-y-3">
                                {Object.entries(qr.optionCounts).map(([opt, count]) =>
                                  renderResultBar(opt, count, qr.totalResponses || 0),
                                )}
                              </div>
                            )}

                          {(qr.questionType === "rating" || qr.questionType === "scale") && (
                            <div className="space-y-3">
                              {typeof qr.average === "number" && (
                                <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-3">
                                  <p className="text-[11px] text-[#0369A1] font-semibold uppercase tracking-wider">
                                    Average
                                  </p>
                                  <p className="text-[24px] font-bold text-[#0F172A]">
                                    {qr.average.toFixed(2)}
                                  </p>
                                </div>
                              )}
                              {qr.distribution &&
                                Object.entries(qr.distribution).map(([k, count]) =>
                                  renderResultBar(k, count, qr.totalResponses || 0),
                                )}
                            </div>
                          )}

                          {qr.questionType === "nps" && (
                            <div className="space-y-3">
                              {typeof qr.npsScore === "number" && (
                                <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-3">
                                  <p className="text-[11px] text-[#0369A1] font-semibold uppercase tracking-wider">
                                    eNPS Score
                                  </p>
                                  <p className="text-[28px] font-bold text-[#0F172A]">
                                    {qr.npsScore}
                                  </p>
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                                  <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">
                                    Promoters
                                  </p>
                                  <p className="text-[18px] font-bold text-emerald-700">
                                    {qr.promoters || 0}
                                  </p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                  <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wider">
                                    Passives
                                  </p>
                                  <p className="text-[18px] font-bold text-amber-700">
                                    {qr.passives || 0}
                                  </p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                  <p className="text-[11px] text-red-700 font-semibold uppercase tracking-wider">
                                    Detractors
                                  </p>
                                  <p className="text-[18px] font-bold text-red-700">
                                    {qr.detractors || 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {qr.questionType === "text" && qr.responses && (
                            <div className="space-y-2">
                              {qr.responses.slice(0, 20).map((resp, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[13px] text-[#475569] italic"
                                >
                                  "{resp}"
                                </div>
                              ))}
                              {qr.responses.length > 20 && (
                                <p className="text-[11px] text-[#94A3B8] text-center">
                                  ... and {qr.responses.length - 20} more responses
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!resultsLoading && !results && selectedResultsId && (
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                      <p className="text-[14px] text-[#64748B]">No results available yet</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* New Survey Modal                                                     */}
      {/* ------------------------------------------------------------------- */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={resetNewModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
              <h2 className="text-[18px] font-bold text-[#0F172A]">New Survey</h2>
              <button
                onClick={resetNewModal}
                className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Q2 engagement pulse"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="What is this survey about?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>

              {/* Type + Anonymous */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    {SURVEY_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {surveyTypeConfig[t].label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 mt-6 rounded-lg border border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={newIsAnonymous}
                    onChange={(e) => setNewIsAnonymous(e.target.checked)}
                    className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                  />
                  <span className="text-[13px] text-[#374151]">Anonymous responses</span>
                </label>
              </div>

              {/* Audience */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                  Target audience
                </label>
                <div className="flex gap-2 mb-2">
                  {(["all", "department", "specific"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setNewAudience(opt)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                        newAudience === opt
                          ? "bg-[#EFF6FF] border-[#2E86C1] text-[#2E86C1]"
                          : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {opt === "all"
                        ? "Everyone"
                        : opt === "department"
                        ? "Department"
                        : "Specific employees"}
                    </button>
                  ))}
                </div>

                {newAudience === "department" && (
                  <select
                    value={newDepartmentId}
                    onChange={(e) => setNewDepartmentId(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    <option value="">Select department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}

                {newAudience === "specific" && (
                  <div className="border border-[#E2E8F0] rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                    {users.map((u) => {
                      const checked = newEmployeeIds.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F8FAFC] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewEmployeeIds((prev) => [...prev, u._id]);
                              } else {
                                setNewEmployeeIds((prev) =>
                                  prev.filter((id) => id !== u._id),
                                );
                              }
                            }}
                            className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                          />
                          <span className="text-[13px] text-[#0F172A]">
                            {u.firstName} {u.lastName}
                          </span>
                          <span className="text-[11px] text-[#94A3B8] ml-auto">{u.email}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                    End date
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  />
                </div>
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[13px] font-medium text-[#374151]">Questions</label>
                  <button
                    onClick={addQuestion}
                    className="text-[12px] font-semibold text-[#2E86C1] hover:text-[#2574A9]"
                  >
                    + Add question
                  </button>
                </div>
                <div className="space-y-3">
                  {newQuestions.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC] space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[12px] font-semibold text-[#94A3B8] mt-2 w-6">
                          Q{qIdx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="Question text"
                          value={q.text}
                          onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                          className="flex-1 border border-[#D1D5DB] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                        />
                        <button
                          onClick={() => removeQuestion(qIdx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pl-8">
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(qIdx, { type: e.target.value })}
                          className="border border-[#D1D5DB] rounded-lg px-2 py-1 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                        >
                          {QUESTION_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-[12px] text-[#64748B]">
                          <input
                            type="checkbox"
                            checked={!!q.required}
                            onChange={(e) => updateQuestion(qIdx, { required: e.target.checked })}
                            className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                          />
                          Required
                        </label>
                      </div>

                      {(q.type === "single_choice" || q.type === "multi_choice") && (
                        <div className="pl-8 space-y-1.5">
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder={`Option ${oIdx + 1}`}
                                value={opt}
                                onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                                className="flex-1 border border-[#D1D5DB] rounded-lg px-3 py-1.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                              />
                              {(q.options || []).length > 2 && (
                                <button
                                  onClick={() => removeOption(qIdx, oIdx)}
                                  className="text-[11px] text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(qIdx)}
                            className="text-[11px] font-semibold text-[#2E86C1] hover:text-[#2574A9]"
                          >
                            + Add option
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] sticky bottom-0 bg-white">
              <Button variant="outline" onClick={resetNewModal} className="h-9 text-[13px]">
                Cancel
              </Button>
              <Button
                onClick={handleCreateSurvey}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
              >
                {saving ? "Creating..." : "Create Survey"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Respond to Survey Modal                                              */}
      {/* ------------------------------------------------------------------- */}
      {respondSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeRespondModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-[18px] font-bold text-[#0F172A]">{respondSurvey.title}</h2>
                <p className="text-[12px] text-[#64748B] mt-0.5">
                  {answeredCount} of {respondSurvey.questions.length} answered
                </p>
              </div>
              <button
                onClick={closeRespondModal}
                className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[#F1F5F9]">
              <div
                className="h-full bg-[#2E86C1] transition-all"
                style={{
                  width: `${
                    (answeredCount / Math.max(respondSurvey.questions.length, 1)) * 100
                  }%`,
                }}
              />
            </div>

            <div className="px-6 py-5 space-y-5">
              {respondSurvey.isAnonymous && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span>🔒</span>
                  <p className="text-[12px] text-slate-700">
                    Your responses are anonymous and cannot be traced back to you.
                  </p>
                </div>
              )}

              {respondSurvey.description && (
                <p className="text-[13px] text-[#64748B]">{respondSurvey.description}</p>
              )}

              {respondSurvey.questions.map((q, qIdx) => (
                <div key={qIdx} className="space-y-2">
                  <label className="block text-[13px] font-semibold text-[#0F172A]">
                    {qIdx + 1}. {q.text}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderQuestionInput(q, qIdx)}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] sticky bottom-0 bg-white">
              <Button variant="outline" onClick={closeRespondModal} className="h-9 text-[13px]">
                Cancel
              </Button>
              <Button
                onClick={handleSubmitResponse}
                disabled={submittingResponse}
                className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
              >
                {submittingResponse ? "Submitting..." : "Submit Response"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
