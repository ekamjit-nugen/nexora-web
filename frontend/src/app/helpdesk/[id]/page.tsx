"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { helpdeskApi, Ticket, TicketComment } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = { critical: "bg-[#FEE2E2] text-[#991B1B]", high: "bg-[#FEF3C7] text-[#92400E]", medium: "bg-[#DBEAFE] text-[#1E40AF]", low: "bg-[#F3F4F6] text-[#374151]" };
const STATUS_COLORS: Record<string, string> = { open: "bg-[#DBEAFE] text-[#1E40AF]", assigned: "bg-[#E0E7FF] text-[#3730A3]", in_progress: "bg-[#FEF3C7] text-[#92400E]", waiting_on_requester: "bg-[#FFF7ED] text-[#9A3412]", resolved: "bg-[#D1FAE5] text-[#065F46]", closed: "bg-[#F3F4F6] text-[#374151]", cancelled: "bg-[#F3F4F6] text-[#6B7280]" };
const CATEGORY_LABELS: Record<string, string> = { it_support: "IT Support", hr: "HR", finance: "Finance", facilities: "Facilities", admin: "Admin", other: "Other" };

export default function TicketDetailPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  const isManager = hasOrgRole("manager");
  const userId = (user as any)?._id || (user as any)?.userId;
  const isRequester = ticket?.requesterId === userId;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ticketRes, commentsRes] = await Promise.all([
        helpdeskApi.getTicket(ticketId),
        helpdeskApi.getComments(ticketId),
      ]);
      setTicket(ticketRes.data as any);
      setComments(Array.isArray(commentsRes.data) ? commentsRes.data : []);
    } catch { toast.error("Failed to load ticket"); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) return null;

  const handleStatusChange = async (status: string) => {
    try {
      await helpdeskApi.updateTicket(ticketId, { status });
      toast.success(`Ticket ${status.replace(/_/g, " ")}`);
      fetchData();
    } catch { toast.error("Failed"); }
  };

  const handleClose = async () => {
    try { await helpdeskApi.closeTicket(ticketId); toast.success("Ticket closed"); fetchData(); }
    catch { toast.error("Failed"); }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    try {
      await helpdeskApi.addComment(ticketId, { content: comment, isInternal });
      setComment(""); setIsInternal(false);
      toast.success("Comment added");
      fetchData();
    } catch { toast.error("Failed"); }
  };

  const handleRate = async () => {
    if (rating < 1) { toast.error("Select a rating"); return; }
    try {
      await helpdeskApi.rateTicket(ticketId, { rating, ratingComment });
      toast.success("Thank you for your feedback!");
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const timeAgo = (d: string) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><Sidebar user={user} onLogout={logout} /><main className="md:ml-[260px] p-8 text-center py-20 text-[#94A3B8]">Loading...</main></div>;
  if (!ticket) return <div className="min-h-screen bg-[#F8FAFC]"><Sidebar user={user} onLogout={logout} /><main className="md:ml-[260px] p-8 text-center py-20 text-[#94A3B8]">Ticket not found</main></div>;

  const now = new Date();
  const slaResponseOk = !ticket.slaResponseBreached && (!ticket.slaResponseDue || ticket.firstRespondedAt || new Date(ticket.slaResponseDue) > now);
  const slaResolutionOk = !ticket.slaResolutionBreached && (!ticket.slaResolutionDue || ticket.resolvedAt || new Date(ticket.slaResolutionDue) > now);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.push("/helpdesk")} className="text-xs text-[#64748B] hover:text-[#2E86C1] mb-4 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Tickets
          </button>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-[#94A3B8]">{ticket.ticketNumber}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority.toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace(/_/g, " ").toUpperCase()}</span>
                <span className="px-2 py-0.5 bg-[#F1F5F9] text-[#475569] rounded text-[10px] font-medium">{CATEGORY_LABELS[ticket.category]}</span>
              </div>
              <h1 className="text-xl font-bold text-[#0F172A]">{ticket.title}</h1>
            </div>
            {/* Status Actions */}
            <div className="flex gap-2 shrink-0">
              {ticket.status === "open" && isManager && <Button onClick={() => handleStatusChange("in_progress")} className="bg-[#F59E0B] text-white text-xs h-8">Start Working</Button>}
              {ticket.status === "assigned" && isManager && <Button onClick={() => handleStatusChange("in_progress")} className="bg-[#F59E0B] text-white text-xs h-8">Start Working</Button>}
              {ticket.status === "in_progress" && isManager && <>
                <Button onClick={() => handleStatusChange("waiting_on_requester")} className="bg-[#F1F5F9] text-[#334155] text-xs h-8">Waiting on Requester</Button>
                <Button onClick={() => handleStatusChange("resolved")} className="bg-[#10B981] text-white text-xs h-8">Resolve</Button>
              </>}
              {ticket.status === "waiting_on_requester" && isManager && <Button onClick={() => handleStatusChange("in_progress")} className="bg-[#F59E0B] text-white text-xs h-8">Resume</Button>}
              {ticket.status === "resolved" && <>
                {isRequester && <Button onClick={() => handleStatusChange("open")} className="bg-[#F1F5F9] text-[#334155] text-xs h-8">Reopen</Button>}
                <Button onClick={handleClose} className="bg-[#6B7280] text-white text-xs h-8">Close</Button>
              </>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Description + Comments */}
            <div className="lg:col-span-2 space-y-4">
              {/* Description */}
              {ticket.description && (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                  <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Description</h3>
                  <p className="text-sm text-[#334155] whitespace-pre-wrap">{ticket.description}</p>
                </div>
              )}

              {/* Comments */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-4">Comments ({comments.length})</h3>
                {comments.length === 0 ? (
                  <p className="text-sm text-[#94A3B8] text-center py-4">No comments yet</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map(c => (
                      <div key={c._id} className={`p-3 rounded-lg ${c.isInternal ? "bg-[#FEF9C3] border border-[#FDE68A]" : "bg-[#F8FAFC]"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-[#2E86C1] text-white flex items-center justify-center text-[9px] font-bold">
                            {c.authorName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                          </div>
                          <span className="text-xs font-medium text-[#0F172A]">{c.authorName}</span>
                          {c.isInternal && <span className="px-1.5 py-0.5 bg-[#FDE68A] text-[#92400E] rounded text-[8px] font-bold">INTERNAL NOTE</span>}
                          <span className="text-[10px] text-[#94A3B8] ml-auto">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-[#334155] ml-8">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment */}
                {!["closed", "cancelled"].includes(ticket.status) && (
                  <div className="border-t border-[#E2E8F0] pt-4">
                    <textarea value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Add a comment..." rows={3}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]" />
                    <div className="flex items-center justify-between mt-2">
                      {isManager && (
                        <label className="flex items-center gap-2 text-xs text-[#64748B]">
                          <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                          Internal note (not visible to requester)
                        </label>
                      )}
                      {!isManager && <div />}
                      <Button onClick={handleAddComment} disabled={!comment.trim()} className="bg-[#2E86C1] text-white text-xs h-8">Add Comment</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rating */}
              {isRequester && ["resolved", "closed"].includes(ticket.status) && !ticket.rating && (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                  <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-3">Rate this support experience</h3>
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRating(star)} className={`text-2xl ${star <= rating ? "text-[#F59E0B]" : "text-[#E2E8F0]"} hover:text-[#F59E0B] transition-colors`}>
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                    placeholder="Any additional feedback? (optional)" rows={2}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1] mb-2" />
                  <Button onClick={handleRate} className="bg-[#F59E0B] text-white text-xs">Submit Rating</Button>
                </div>
              )}

              {ticket.rating && (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                  <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Rating</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-[#F59E0B]">{"★".repeat(ticket.rating)}{"☆".repeat(5 - ticket.rating)}</span>
                    {ticket.ratingComment && <span className="text-xs text-[#64748B]">— {ticket.ratingComment}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-3">Details</h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    ["Requester", ticket.requesterName || ticket.requesterEmail],
                    ["Assignee", ticket.assigneeName || "Unassigned"],
                    ["Created", formatDate(ticket.createdAt)],
                    ["Updated", formatDate(ticket.updatedAt)],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-[#64748B] text-xs">{label}</span>
                      <span className="text-xs font-medium text-[#0F172A]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLA */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-3">SLA Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748B]">Response</span>
                    <span className={`text-xs font-bold ${slaResponseOk ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                      {ticket.firstRespondedAt ? "Responded" : slaResponseOk ? "On Track" : "BREACHED"}
                    </span>
                  </div>
                  {ticket.slaResponseDue && (
                    <p className="text-[10px] text-[#94A3B8]">Due: {formatDate(ticket.slaResponseDue)}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748B]">Resolution</span>
                    <span className={`text-xs font-bold ${slaResolutionOk ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                      {ticket.resolvedAt ? "Resolved" : slaResolutionOk ? "On Track" : "BREACHED"}
                    </span>
                  </div>
                  {ticket.slaResolutionDue && (
                    <p className="text-[10px] text-[#94A3B8]">Due: {formatDate(ticket.slaResolutionDue)}</p>
                  )}
                </div>
              </div>

              {ticket.tags?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                  <h3 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map(t => <span key={t} className="px-2 py-0.5 bg-[#F1F5F9] text-[#334155] rounded text-[10px]">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
