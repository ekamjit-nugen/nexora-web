"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { moderationApi } from "@/lib/api";
import { toast } from "sonner";

type Severity = "info" | "warning" | "critical";
type Status = "pending" | "reviewed" | "dismissed" | "actioned";

interface FlaggedMessage {
  _id: string;
  content: string;
  senderId: string;
  senderName?: string;
  severity: Severity;
  status: Status;
  reason?: string;
  createdAt: string;
}

interface ModerationStats {
  total: number;
  pending: number;
  reviewed: number;
  dismissed: number;
  actioned: number;
}

const SEVERITY_COLORS: Record<Severity, { bg: string; text: string }> = {
  info: { bg: "bg-blue-50", text: "text-blue-700" },
  warning: { bg: "bg-amber-50", text: "text-amber-700" },
  critical: { bg: "bg-red-50", text: "text-red-700" },
};

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700" },
  reviewed: { bg: "bg-blue-50", text: "text-blue-700" },
  dismissed: { bg: "bg-gray-50", text: "text-gray-600" },
  actioned: { bg: "bg-green-50", text: "text-green-700" },
};

export default function ModerationPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"flagged" | "stats">("flagged");
  const [flagged, setFlagged] = useState<FlaggedMessage[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Review modal
  const [reviewItem, setReviewItem] = useState<FlaggedMessage | null>(null);
  const [reviewAction, setReviewAction] = useState<string>("dismissed");
  const [reviewing, setReviewing] = useState(false);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ["admin", "super_admin", "owner"].includes(r));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [flaggedRes, statsRes] = await Promise.all([
        moderationApi.getFlagged(),
        moderationApi.getStats(),
      ]);
      setFlagged(flaggedRes.data || []);
      setStats(statsRes.data || null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleReview = async () => {
    if (!reviewItem) return;
    setReviewing(true);
    try {
      await moderationApi.reviewFlagged(reviewItem._id, {
        status: reviewAction,
        action: reviewAction === "actioned" ? "manual_action" : undefined,
      });
      toast.success("Message reviewed successfully");
      setReviewItem(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to review message");
    } finally {
      setReviewing(false);
    }
  };

  const filteredMessages = flagged.filter((m) => {
    if (filterSeverity !== "all" && m.severity !== filterSeverity) return false;
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterDateFrom && new Date(m.createdAt) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(m.createdAt) > new Date(filterDateTo + "T23:59:59")) return false;
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const selectClass = inputClass + " bg-white appearance-none cursor-pointer";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">Content Moderation</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Review flagged messages and manage content moderation.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit">
        {(["flagged", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
            }`}
          >
            {t === "flagged" ? "Flagged Messages" : "Stats"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : tab === "flagged" ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Severity</label>
                <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className={selectClass}>
                  <option value="all">All</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="actioned">Actioned</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">From</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">To</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">No flagged messages found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase">Content</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase">Sender</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase">Severity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map((msg) => {
                    const sevColor = SEVERITY_COLORS[msg.severity] || SEVERITY_COLORS.info;
                    const statColor = STATUS_COLORS[msg.status] || STATUS_COLORS.pending;
                    return (
                      <tr key={msg._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 text-sm text-[#0F172A] max-w-[260px] truncate">{msg.content}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{msg.senderName || msg.senderId}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sevColor.bg} ${sevColor.text}`}>
                            {msg.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statColor.bg} ${statColor.text}`}>
                            {msg.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {msg.status === "pending" && (
                            <button
                              onClick={() => { setReviewItem(msg); setReviewAction("dismissed"); }}
                              className="text-xs font-medium text-[#2E86C1] hover:text-[#2471A3] transition-colors"
                            >
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* Stats Tab */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {stats && (
            <>
              {([
                { label: "Total", value: stats.total, color: "text-[#0F172A]", bg: "bg-[#F8FAFC]" },
                { label: "Pending", value: stats.pending, color: "text-yellow-700", bg: "bg-yellow-50" },
                { label: "Reviewed", value: stats.reviewed, color: "text-blue-700", bg: "bg-blue-50" },
                { label: "Dismissed", value: stats.dismissed, color: "text-gray-600", bg: "bg-gray-50" },
                { label: "Actioned", value: stats.actioned, color: "text-green-700", bg: "bg-green-50" },
              ]).map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl border border-[#E2E8F0] p-5 shadow-sm`}>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{s.label}</p>
                  <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReviewItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Review Flagged Message</h3>

            <div className="bg-[#F8FAFC] rounded-xl p-4 mb-4 border border-[#E2E8F0]">
              <p className="text-sm text-[#0F172A] break-words">{reviewItem.content}</p>
              <div className="flex gap-2 mt-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[reviewItem.severity].bg} ${SEVERITY_COLORS[reviewItem.severity].text}`}>
                  {reviewItem.severity}
                </span>
                {reviewItem.reason && (
                  <span className="text-xs text-[#64748B]">Reason: {reviewItem.reason}</span>
                )}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-[#334155] mb-2">Action</label>
              <div className="space-y-2">
                {([
                  { value: "dismissed", label: "Dismiss", desc: "Mark as non-issue" },
                  { value: "actioned", label: "Take Action", desc: "Flag and take action on this content" },
                ]).map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    reviewAction === opt.value ? "border-[#2E86C1] bg-[#EBF5FF]" : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
                  }`}>
                    <input
                      type="radio"
                      name="reviewAction"
                      value={opt.value}
                      checked={reviewAction === opt.value}
                      onChange={(e) => setReviewAction(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{opt.label}</p>
                      <p className="text-xs text-[#64748B]">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setReviewItem(null)} className="px-4 py-2 text-sm font-medium text-[#64748B] hover:text-[#334155] transition-colors">
                Cancel
              </button>
              <button onClick={handleReview} disabled={reviewing}
                className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
                {reviewing ? "Saving..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
