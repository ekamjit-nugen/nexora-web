"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { timesheetApi, Timesheet } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  revision_requested: { label: "Revision Needed", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

const categoryColors: Record<string, string> = {
  development: "bg-blue-50 text-blue-700",
  design: "bg-purple-50 text-purple-700",
  meeting: "bg-amber-50 text-amber-700",
  review: "bg-teal-50 text-teal-700",
  testing: "bg-green-50 text-green-700",
  documentation: "bg-gray-100 text-gray-700",
  admin: "bg-orange-50 text-orange-700",
  training: "bg-indigo-50 text-indigo-700",
  other: "bg-gray-50 text-gray-600",
};

function getWeekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function TimesheetsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"my" | "pending" | "all">("my");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createStart, setCreateStart] = useState(getWeekBounds(new Date()).start);
  const [createEnd, setCreateEnd] = useState(getWeekBounds(new Date()).end);
  const [creating, setCreating] = useState(false);
  const [populating, setPopulating] = useState<string | null>(null);

  // Review form
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchTimesheets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tsRes, statsRes] = await Promise.all([
        activeTab === "my"
          ? timesheetApi.getMyTimesheets()
          : activeTab === "pending"
          ? timesheetApi.getPendingTimesheets()
          : timesheetApi.getAll(),
        timesheetApi.getStats(),
      ]);
      setTimesheets(Array.isArray(tsRes.data) ? tsRes.data : []);
      setStats(statsRes.data || null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user) fetchTimesheets();
  }, [fetchTimesheets, user]);

  const handleCreate = async () => {
    if (!createStart || !createEnd) { toast.error("Select period dates"); return; }
    setCreating(true);
    try {
      await timesheetApi.create({ period: { startDate: createStart, endDate: createEnd, type: "weekly" } });
      toast.success("Timesheet created");
      setShowCreate(false);
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to create timesheet");
    } finally {
      setCreating(false);
    }
  };

  const handleAutoPopulate = async (ts: Timesheet) => {
    setPopulating(ts._id);
    try {
      const res = await timesheetApi.autoPopulate({ startDate: ts.period.startDate, endDate: ts.period.endDate });
      const entries = Array.isArray(res.data) ? res.data : [];
      await timesheetApi.update(ts._id, { entries: [...(ts.entries || []), ...entries] } as any);
      toast.success(`${entries.length} entries added`);
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-populate");
    } finally {
      setPopulating(null);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await timesheetApi.submit(id);
      toast.success("Timesheet submitted for review");
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    }
  };

  const handleReview = async (id: string, status: string) => {
    setSubmittingReview(true);
    try {
      await timesheetApi.review(id, { status, reviewComment: reviewComment || undefined });
      toast.success(`Timesheet ${status}`);
      setReviewingId(null);
      setReviewComment("");
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Failed to review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;
  }

  const isManager = user.roles?.some((r) => ["admin", "super_admin", "manager", "hr"].includes(r));

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Timesheets</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Track and manage time entries</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Timesheet
          </Button>
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: stats.total ?? "-", color: "text-[#0F172A]" },
                { label: "Pending Review", value: stats.pending ?? "-", color: "text-blue-600" },
                { label: "Approved", value: stats.approved ?? "-", color: "text-emerald-600" },
                { label: "Hours This Week", value: stats.hoursThisWeek != null ? `${stats.hoursThisWeek}h` : "-", color: "text-[#2E86C1]" },
              ].map((s) => (
                <Card key={s.label} className="border-[#E2E8F0]">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <Card className="border-[#E2E8F0] bg-white">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Create Timesheet</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Start Date</label>
                    <Input type="date" value={createStart} onChange={(e) => setCreateStart(e.target.value)} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">End Date</label>
                    <Input type="date" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreate(false)} className="h-9 border-[#E2E8F0]">Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9">
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit">
            {[
              { key: "my", label: "My Timesheets" },
              ...(isManager ? [{ key: "pending", label: "Pending Review" }] : []),
              ...(isManager ? [{ key: "all", label: "All Timesheets" }] : []),
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === t.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Timesheet list */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-[14px] font-semibold text-[#64748B]">No timesheets yet</p>
              <p className="text-[12px] text-[#94A3B8] mt-1">Create your first timesheet to start tracking time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timesheets.map((ts) => {
                const sc = statusConfig[ts.status] || statusConfig.draft;
                const isExpanded = expandedId === ts._id;
                const isReviewing = reviewingId === ts._id;
                return (
                  <Card key={ts._id} className="border-[#E2E8F0] bg-white overflow-hidden">
                    <CardContent className="p-0">
                      {/* Row header */}
                      <div
                        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : ts._id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#0F172A]">
                              {new Date(ts.period.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(ts.period.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <p className="text-[12px] text-[#64748B] mt-0.5">{ts.entries?.length || 0} entries · {ts.totalHours || 0}h logged{ts.expectedHours ? ` / ${ts.expectedHours}h expected` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ts.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-[12px] border-[#E2E8F0] gap-1"
                                onClick={(e) => { e.stopPropagation(); handleAutoPopulate(ts); }}
                                disabled={populating === ts._id}
                              >
                                {populating === ts._id ? "Populating..." : "Auto-Populate"}
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-[12px] bg-[#2E86C1] hover:bg-[#2471A3]"
                                onClick={(e) => { e.stopPropagation(); handleSubmit(ts._id); }}
                              >
                                Submit for Review
                              </Button>
                            </>
                          )}
                          {ts.status === "submitted" && activeTab !== "my" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[12px] border-[#E2E8F0]"
                              onClick={(e) => { e.stopPropagation(); setReviewingId(ts._id); setExpandedId(ts._id); }}
                            >
                              Review
                            </Button>
                          )}
                          {ts.status === "rejected" || ts.status === "revision_requested" ? (
                            <span className="text-[11px] text-[#94A3B8]">Revert to edit above</span>
                          ) : null}
                          <svg className={`w-4 h-4 text-[#94A3B8] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>

                      {/* Review comment */}
                      {ts.reviewComment && (
                        <div className="mx-5 mb-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-[11px] font-semibold text-amber-700 mb-1">Review Comment</p>
                          <p className="text-[12px] text-amber-800">{ts.reviewComment}</p>
                        </div>
                      )}

                      {/* Expanded entries */}
                      {isExpanded && (
                        <div className="px-5 pb-5">
                          {(ts.entries || []).length === 0 ? (
                            <p className="text-[13px] text-[#94A3B8] py-4 text-center">No entries yet. Use Auto-Populate or log time on tasks.</p>
                          ) : (
                            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                              <table className="w-full text-[12px]">
                                <thead>
                                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Date</th>
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Task</th>
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Category</th>
                                    <th className="text-left px-4 py-3 font-semibold text-[#475569]">Description</th>
                                    <th className="text-right px-4 py-3 font-semibold text-[#475569]">Hours</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F1F5F9]">
                                  {ts.entries.map((e, i) => (
                                    <tr key={i} className="hover:bg-[#F8FAFC]">
                                      <td className="px-4 py-3 text-[#64748B]">{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                                      <td className="px-4 py-3">
                                        <p className="font-medium text-[#0F172A]">{e.taskKey && <span className="text-[#94A3B8] mr-1">{e.taskKey}</span>}{e.taskTitle || "—"}</p>
                                        {e.projectName && <p className="text-[11px] text-[#94A3B8]">{e.projectName}</p>}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColors[e.category || "other"] || categoryColors.other}`}>
                                          {e.category || "other"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-[#64748B] max-w-[200px] truncate">{e.description || "—"}</td>
                                      <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">{e.hours}h</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-[#475569]">Total</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#0F172A]">{ts.totalHours || 0}h</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}

                          {/* Review form */}
                          {isReviewing && (
                            <div className="mt-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
                              <p className="text-[13px] font-semibold text-[#0F172A]">Review Timesheet</p>
                              <Input
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Optional comment..."
                                className="h-10 text-sm bg-white border-[#E2E8F0]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleReview(ts._id, "approved")}
                                  disabled={submittingReview}
                                  className="bg-emerald-600 hover:bg-emerald-700 h-9"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReview(ts._id, "revision_requested")}
                                  disabled={submittingReview}
                                  className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50"
                                >
                                  Request Revision
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReview(ts._id, "rejected")}
                                  disabled={submittingReview}
                                  className="h-9 border-red-300 text-red-600 hover:bg-red-50"
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setReviewingId(null); setReviewComment(""); }}
                                  className="h-9 border-[#E2E8F0] ml-auto"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
