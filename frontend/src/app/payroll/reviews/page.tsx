"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------
const reviewStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600 border-gray-200" },
  self_review_pending: { label: "Self Review Pending", color: "bg-blue-50 text-blue-700 border-blue-200" },
  peer_review_pending: { label: "Peer Review Pending", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  manager_review_pending: { label: "Manager Review Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
  calibration: { label: "Calibration", color: "bg-purple-50 text-purple-700 border-purple-200" },
  finalized: { label: "Finalized", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  acknowledged: { label: "Acknowledged", color: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CompetencyRating {
  competency: string;
  rating: number;
  comments?: string;
}

interface ReviewSection {
  rating?: number;
  strengths?: string;
  improvements?: string;
  achievements?: string;
  challenges?: string;
  comments?: string;
  competencies?: CompetencyRating[];
  submittedAt?: string;
  submittedBy?: string;
}

interface Review {
  _id: string;
  cycleId?: string;
  cycleName?: string;
  period?: string;
  periodStart?: string;
  periodEnd?: string;
  status: string;
  finalRating?: number;
  selfReview?: ReviewSection;
  peerReview?: ReviewSection;
  managerReview?: ReviewSection & {
    goalAchievement?: string;
    developmentPlan?: string;
    promotionRecommendation?: boolean;
    salaryRecommendation?: string;
  };
  employeeName?: string;
  reviewerType?: "self" | "peer" | "manager";
  anonymous?: boolean;
}

const DEFAULT_COMPETENCIES = [
  "Communication",
  "Collaboration",
  "Ownership",
  "Technical Skills",
  "Problem Solving",
];

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

const sectionsComplete = (review: Review): number => {
  let done = 0;
  if (review.selfReview?.submittedAt) done++;
  if (review.peerReview?.submittedAt) done++;
  if (review.managerReview?.submittedAt) done++;
  if (review.status === "finalized" || review.status === "acknowledged") done++;
  return done;
};

type TabKey = "my" | "pending";
type ReviewMode = "self" | "peer" | "manager";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReviewsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Active review detail
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("self");
  const [saving, setSaving] = useState(false);

  // Form state
  const [formRating, setFormRating] = useState<number>(3);
  const [formStrengths, setFormStrengths] = useState("");
  const [formImprovements, setFormImprovements] = useState("");
  const [formAchievements, setFormAchievements] = useState("");
  const [formChallenges, setFormChallenges] = useState("");
  const [formAnonymous, setFormAnonymous] = useState(false);
  const [formCompetencies, setFormCompetencies] = useState<CompetencyRating[]>(
    DEFAULT_COMPETENCIES.map((c) => ({ competency: c, rating: 3 }))
  );
  const [formGoalAchievement, setFormGoalAchievement] = useState("");
  const [formDevelopmentPlan, setFormDevelopmentPlan] = useState("");
  const [formPromotion, setFormPromotion] = useState(false);
  const [formSalaryRec, setFormSalaryRec] = useState("no_change");

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchMyReviews = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getMyReviews();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.reviews ?? [];
      setMyReviews(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load your reviews");
    }
  }, [user]);

  const fetchPendingReviews = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getPendingReviews();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.reviews ?? [];
      setPendingReviews(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load pending reviews");
    }
  }, [user]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMyReviews(), fetchPendingReviews()]);
    setLoading(false);
  }, [fetchMyReviews, fetchPendingReviews]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // ---------------------------------------------------------------------------
  // Current cycle banner data
  // ---------------------------------------------------------------------------
  const currentCycle = useMemo(() => {
    const inProgress = myReviews.find(
      (r) => !["finalized", "acknowledged", "cancelled"].includes(r.status),
    );
    return inProgress || myReviews[0] || null;
  }, [myReviews]);

  const activeReviews = activeTab === "my" ? myReviews : pendingReviews;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const resetForm = () => {
    setFormRating(3);
    setFormStrengths("");
    setFormImprovements("");
    setFormAchievements("");
    setFormChallenges("");
    setFormAnonymous(false);
    setFormCompetencies(DEFAULT_COMPETENCIES.map((c) => ({ competency: c, rating: 3 })));
    setFormGoalAchievement("");
    setFormDevelopmentPlan("");
    setFormPromotion(false);
    setFormSalaryRec("no_change");
  };

  const handleOpenReview = (review: Review, mode: ReviewMode) => {
    setActiveReview(review);
    setReviewMode(mode);
    resetForm();

    // Pre-populate from existing data if available
    if (mode === "self" && review.selfReview) {
      setFormRating(review.selfReview.rating || 3);
      setFormStrengths(review.selfReview.strengths || "");
      setFormImprovements(review.selfReview.improvements || "");
      setFormAchievements(review.selfReview.achievements || "");
      setFormChallenges(review.selfReview.challenges || "");
      if (review.selfReview.competencies && review.selfReview.competencies.length > 0) {
        setFormCompetencies(review.selfReview.competencies);
      }
    } else if (mode === "peer" && review.peerReview) {
      setFormRating(review.peerReview.rating || 3);
      setFormStrengths(review.peerReview.strengths || "");
      setFormImprovements(review.peerReview.improvements || "");
      setFormAnonymous(review.anonymous || false);
    } else if (mode === "manager" && review.managerReview) {
      setFormRating(review.managerReview.rating || 3);
      setFormStrengths(review.managerReview.strengths || "");
      setFormImprovements(review.managerReview.improvements || "");
      setFormGoalAchievement(review.managerReview.goalAchievement || "");
      setFormDevelopmentPlan(review.managerReview.developmentPlan || "");
      setFormPromotion(review.managerReview.promotionRecommendation || false);
      setFormSalaryRec(review.managerReview.salaryRecommendation || "no_change");
    }
  };

  const handleCloseReview = () => {
    setActiveReview(null);
    resetForm();
  };

  const handleCompetencyChange = (idx: number, rating: number) => {
    const updated = [...formCompetencies];
    updated[idx] = { ...updated[idx], rating };
    setFormCompetencies(updated);
  };

  const handleSubmitReview = async () => {
    if (!activeReview) return;

    if (formRating < 1 || formRating > 5) {
      toast.error("Rating must be between 1 and 5");
      return;
    }
    if (!formStrengths.trim()) {
      toast.error("Please provide strengths");
      return;
    }

    setSaving(true);
    try {
      if (reviewMode === "self") {
        await payrollApi.submitSelfReview(activeReview._id, {
          rating: formRating,
          strengths: formStrengths.trim(),
          improvements: formImprovements.trim() || undefined,
          achievements: formAchievements.trim() || undefined,
          challenges: formChallenges.trim() || undefined,
          competencies: formCompetencies,
        });
      } else if (reviewMode === "peer") {
        await payrollApi.submitPeerReview(activeReview._id, {
          rating: formRating,
          strengths: formStrengths.trim(),
          improvements: formImprovements.trim() || undefined,
          anonymous: formAnonymous,
        });
      } else if (reviewMode === "manager") {
        await payrollApi.submitManagerReview(activeReview._id, {
          rating: formRating,
          strengths: formStrengths.trim(),
          improvements: formImprovements.trim() || undefined,
          goalAchievement: formGoalAchievement.trim() || undefined,
          developmentPlan: formDevelopmentPlan.trim() || undefined,
          promotionRecommendation: formPromotion,
          salaryRecommendation: formSalaryRec,
        });
      }
      toast.success("Review submitted successfully");
      handleCloseReview();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderBadge = (value: string, config: Record<string, { label: string; color: string }>) => {
    const cfg = config[value] || { label: value.replace(/_/g, " "), color: "bg-gray-100 text-gray-600 border-gray-200" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  const modeForMyReview = (review: Review): ReviewMode => {
    if (review.status === "self_review_pending") return "self";
    if (review.status === "peer_review_pending") return "peer";
    if (review.status === "manager_review_pending") return "manager";
    return "self";
  };

  // ---------------------------------------------------------------------------
  // Auth gate
  // ---------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E86C1]" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 sticky top-0 z-20">
          <h1 className="text-[20px] font-bold text-[#0F172A]">Performance Reviews</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Participate in reviews and track your performance</p>
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* Current cycle banner */}
          {currentCycle && (
            <Card className="rounded-xl border border-l-4 border-l-[#2E86C1] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Current Cycle</p>
                    <h3 className="text-[16px] font-bold text-[#0F172A] mt-1">{currentCycle.cycleName || "Performance Review"}</h3>
                    <p className="text-[12px] text-[#64748B] mt-0.5">
                      {currentCycle.period ||
                        (currentCycle.periodStart && currentCycle.periodEnd
                          ? `${formatDate(currentCycle.periodStart)} - ${formatDate(currentCycle.periodEnd)}`
                          : "")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderBadge(currentCycle.status, reviewStatusConfig)}
                    {currentCycle.finalRating && (
                      <div className="text-right">
                        <p className="text-[11px] text-[#64748B]">Final Rating</p>
                        <p className="text-[18px] font-bold text-[#0F172A]">{currentCycle.finalRating} / 5</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeTab === "my" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              My Reviews
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeTab === "pending" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Reviews to Submit
              {pendingReviews.length > 0 && (
                <span className="ml-2 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {pendingReviews.length}
                </span>
              )}
            </button>
          </div>

          {/* Reviews list */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-2 bg-gray-200 rounded-full w-full" />
                </div>
              ))}
            </div>
          ) : activeReviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-[#64748B] mt-3 text-[14px]">
                {activeTab === "my"
                  ? "You have no performance reviews yet."
                  : "You have no pending reviews to submit."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeReviews.map((review) => {
                const complete = sectionsComplete(review);
                const total = 4;
                const mode = activeTab === "my" ? modeForMyReview(review) : (review.reviewerType || "peer");

                return (
                  <div key={review._id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">
                            {review.cycleName || "Performance Review"}
                          </h3>
                          {renderBadge(review.status, reviewStatusConfig)}
                        </div>

                        {activeTab === "pending" && review.employeeName && (
                          <p className="text-[12px] text-[#64748B] mb-2">
                            Reviewing: <span className="font-medium text-[#334155]">{review.employeeName}</span>
                            {review.reviewerType && (
                              <span className="ml-2 capitalize">({review.reviewerType} review)</span>
                            )}
                          </p>
                        )}

                        <p className="text-[12px] text-[#64748B] mb-3">
                          {review.period ||
                            (review.periodStart && review.periodEnd
                              ? `${formatDate(review.periodStart)} - ${formatDate(review.periodEnd)}`
                              : "")}
                        </p>

                        {activeTab === "my" && (
                          <div className="w-full max-w-md">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-[#64748B] font-medium">Sections</span>
                              <span className="text-[11px] font-semibold text-[#0F172A]">
                                {complete} of {total} complete
                              </span>
                            </div>
                            <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-[#2E86C1] transition-all"
                                style={{ width: `${(complete / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {review.finalRating && review.status === "finalized" && (
                          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">Final Rating</span>
                            <span className="text-[14px] font-bold text-emerald-700">{review.finalRating} / 5</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {!["finalized", "acknowledged", "cancelled"].includes(review.status) && (
                          <Button
                            onClick={() => handleOpenReview(review, mode)}
                            className="bg-[#2E86C1] hover:bg-[#2574A9] h-8 text-[12px]"
                          >
                            Continue Review
                          </Button>
                        )}
                        {["finalized", "acknowledged"].includes(review.status) && (
                          <Button
                            variant="outline"
                            onClick={() => handleOpenReview(review, "self")}
                            className="h-8 text-[12px]"
                          >
                            View Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Review Modal */}
      {activeReview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-[18px] font-bold text-[#0F172A] capitalize">{reviewMode} Review</h2>
                <p className="text-[12px] text-[#64748B] mt-0.5">{activeReview.cycleName}</p>
              </div>
              <button
                onClick={handleCloseReview}
                className="p-1.5 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Rating selector */}
              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-2">Overall Rating *</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRating(r)}
                      className={`flex-1 py-3 rounded-lg border-2 font-semibold text-[14px] transition-all ${
                        formRating === r
                          ? "border-[#2E86C1] bg-[#2E86C1]/5 text-[#2E86C1]"
                          : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[#94A3B8]">
                  <span>Needs Improvement</span>
                  <span>Outstanding</span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">Strengths *</label>
                <textarea
                  value={formStrengths}
                  onChange={(e) => setFormStrengths(e.target.value)}
                  rows={3}
                  placeholder="What went well during this period?"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">Areas for Improvement</label>
                <textarea
                  value={formImprovements}
                  onChange={(e) => setFormImprovements(e.target.value)}
                  rows={3}
                  placeholder="What could be improved?"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                />
              </div>

              {/* Self review specific */}
              {reviewMode === "self" && (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#334155] mb-1">Key Achievements</label>
                    <textarea
                      value={formAchievements}
                      onChange={(e) => setFormAchievements(e.target.value)}
                      rows={3}
                      placeholder="What are you most proud of this period?"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#334155] mb-1">Challenges Faced</label>
                    <textarea
                      value={formChallenges}
                      onChange={(e) => setFormChallenges(e.target.value)}
                      rows={3}
                      placeholder="What challenges did you encounter?"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#334155] mb-2">Competency Ratings</label>
                    <div className="space-y-2">
                      {formCompetencies.map((c, idx) => (
                        <div key={c.competency} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 flex items-center justify-between gap-3">
                          <span className="text-[13px] font-medium text-[#334155]">{c.competency}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => handleCompetencyChange(idx, r)}
                                className={`w-8 h-8 rounded-md border text-[12px] font-semibold ${
                                  c.rating === r
                                    ? "bg-[#2E86C1] border-[#2E86C1] text-white"
                                    : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Peer review specific */}
              {reviewMode === "peer" && (
                <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                  <input
                    type="checkbox"
                    id="anonymous"
                    checked={formAnonymous}
                    onChange={(e) => setFormAnonymous(e.target.checked)}
                    className="w-4 h-4 accent-[#2E86C1]"
                  />
                  <label htmlFor="anonymous" className="text-[13px] text-[#334155] cursor-pointer">
                    Submit anonymously
                  </label>
                </div>
              )}

              {/* Manager review specific */}
              {reviewMode === "manager" && (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#334155] mb-1">Goal Achievement</label>
                    <textarea
                      value={formGoalAchievement}
                      onChange={(e) => setFormGoalAchievement(e.target.value)}
                      rows={3}
                      placeholder="Assessment of goal completion"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#334155] mb-1">Development Plan</label>
                    <textarea
                      value={formDevelopmentPlan}
                      onChange={(e) => setFormDevelopmentPlan(e.target.value)}
                      rows={3}
                      placeholder="Plan for growth and development"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPromotion}
                          onChange={(e) => setFormPromotion(e.target.checked)}
                          className="w-4 h-4 accent-[#2E86C1]"
                        />
                        <span className="text-[13px] font-medium text-[#334155]">Recommend for Promotion</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#334155] mb-1">Salary Recommendation</label>
                      <select
                        value={formSalaryRec}
                        onChange={(e) => setFormSalaryRec(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
                      >
                        <option value="no_change">No Change</option>
                        <option value="minor_increase">Minor Increase</option>
                        <option value="standard_increase">Standard Increase</option>
                        <option value="significant_increase">Significant Increase</option>
                        <option value="exceptional_increase">Exceptional Increase</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-[#E2E8F0] flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={handleCloseReview} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9]"
              >
                {saving ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
