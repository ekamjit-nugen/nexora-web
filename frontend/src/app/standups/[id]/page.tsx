"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { standupApi, StandupConfig, StandupResponse, StandupSummary } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function StandupDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const standupId = params.id as string;

  const [standup, setStandup] = useState<StandupConfig | null>(null);
  const [responses, setResponses] = useState<StandupResponse[]>([]);
  const [mySubmitted, setMySubmitted] = useState(false);
  const [summary, setSummary] = useState<StandupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // Answer form
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string }>>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [standupRes, statusRes] = await Promise.all([
        standupApi.get(standupId),
        standupApi.getMyStatus(standupId),
      ]);

      const s = standupRes.data as any;
      setStandup(s);
      setMySubmitted((statusRes.data as any)?.submitted || false);

      // Initialize empty answers from questions
      if (s?.questions && !(statusRes.data as any)?.submitted) {
        setAnswers(s.questions.map((q: string) => ({ question: q, answer: "" })));
      }

      // Fetch today's responses or selected date
      await fetchResponses(selectedDate);
    } catch { toast.error("Failed to load standup"); }
    finally { setLoading(false); }
  }, [standupId]);

  const fetchResponses = async (date: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = date === today
        ? await standupApi.getTodayResponses(standupId)
        : await standupApi.getResponses(standupId, { date });
      setResponses(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  useEffect(() => {
    if (!loading) fetchResponses(selectedDate);
  }, [selectedDate]);

  if (authLoading || !user) return null;

  const handleSubmit = async () => {
    const hasEmpty = answers.some(a => !a.answer.trim());
    if (hasEmpty) { toast.error("Please answer all questions"); return; }

    try {
      setSubmitting(true);
      await standupApi.submitResponse(standupId, { answers });
      toast.success("Standup submitted");
      setMySubmitted(true);
      fetchResponses(selectedDate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const handleGetSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await standupApi.getSummary(standupId);
      setSummary(res.data as any);
    } catch { toast.error("Failed to generate summary"); }
    finally { setLoadingSummary(false); }
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        <div className="max-w-3xl mx-auto">
          {/* Back */}
          <button onClick={() => router.push("/standups")} className="text-xs text-[#64748B] hover:text-[#2E86C1] mb-4 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Standups
          </button>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 animate-pulse"><div className="h-5 bg-[#E2E8F0] rounded w-48" /></div>)}
            </div>
          ) : standup ? (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#0F172A]">{standup.name}</h1>
                  <p className="text-sm text-[#64748B] mt-1">
                    {standup.schedule?.frequency} at {standup.schedule?.time} · {standup.participants?.length || 0} participants · {standup.questions?.length || 3} questions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-sm w-40" />
                  {isToday && (
                    <Button onClick={handleGetSummary} disabled={loadingSummary}
                      className="bg-[#8B5CF6] text-white text-xs h-8">
                      {loadingSummary ? "..." : "AI Summary"}
                    </Button>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              {summary && (
                <div className="bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] p-5 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🤖</span>
                    <h3 className="text-sm font-semibold text-[#5B21B6]">AI Summary</h3>
                    <span className="text-[10px] text-[#7C3AED]">{summary.responseCount} of {summary.totalParticipants || "?"} responded</span>
                  </div>
                  <div className="text-sm text-[#4C1D95] prose prose-sm prose-purple max-w-none" dangerouslySetInnerHTML={{ __html: summary.summary.replace(/\n/g, "<br/>") }} />
                </div>
              )}

              {/* Response Form (if not submitted today and viewing today) */}
              {isToday && !mySubmitted && (
                <div className="bg-white rounded-xl shadow-sm border-2 border-[#2E86C1] p-6 mb-6">
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    Your Turn — Answer Today&apos;s Standup
                  </h3>
                  <div className="space-y-4">
                    {answers.map((a, i) => (
                      <div key={i}>
                        <label className="text-xs font-medium text-[#334155] mb-1.5 block">{a.question}</label>
                        <textarea
                          value={a.answer}
                          onChange={e => {
                            const updated = [...answers];
                            updated[i] = { ...updated[i], answer: e.target.value };
                            setAnswers(updated);
                          }}
                          placeholder="Type your answer..."
                          className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] resize-none min-h-[80px]"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleSubmit} disabled={submitting} className="bg-[#10B981] text-white text-sm">
                      {submitting ? "Submitting..." : "Submit Standup"}
                    </Button>
                  </div>
                </div>
              )}

              {isToday && mySubmitted && (
                <div className="bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] p-4 mb-6 flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#10B981] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-[#065F46] font-medium">You&apos;ve submitted today&apos;s standup</span>
                </div>
              )}

              {/* Team Feed */}
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3">
                  {isToday ? "Today's" : new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" })}{" "}
                  Responses ({responses.length})
                </h3>

                {responses.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 text-center text-[#94A3B8] text-sm">
                    {isToday ? "No responses yet today. Be the first!" : "No responses for this date."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {responses.map(resp => (
                      <div key={resp._id} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-[#2E86C1] text-white flex items-center justify-center text-xs font-bold">
                            {resp.userName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0F172A]">{resp.userName}</p>
                            <p className="text-[10px] text-[#94A3B8]">
                              {new Date(resp.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </p>
                          </div>
                          {resp.linkedTaskIds?.length > 0 && (
                            <div className="ml-auto flex gap-1">
                              {resp.linkedTaskIds.map(t => (
                                <span key={t} className="px-1.5 py-0.5 bg-[#DBEAFE] text-[#1E40AF] rounded text-[9px] font-mono">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          {resp.answers.map((a, i) => (
                            <div key={i}>
                              <p className="text-[11px] font-medium text-[#64748B]">{a.question}</p>
                              <p className="text-sm text-[#334155] mt-0.5">{a.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-[#94A3B8]">Standup not found</div>
          )}
        </div>
      </main>
    </div>
  );
}
