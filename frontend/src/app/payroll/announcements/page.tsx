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
// Category configuration
// ---------------------------------------------------------------------------
const categoryConfig: Record<string, { label: string; color: string; icon: string }> = {
  general: { label: "General", color: "bg-gray-100 text-gray-700 border-gray-200", icon: "📢" },
  policy: { label: "Policy", color: "bg-blue-50 text-blue-700 border-blue-200", icon: "📋" },
  event: { label: "Event", color: "bg-purple-50 text-purple-700 border-purple-200", icon: "🎉" },
  celebration: { label: "Celebration", color: "bg-pink-50 text-pink-700 border-pink-200", icon: "🎊" },
  company_update: { label: "Company", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🏢" },
  urgent: { label: "Urgent", color: "bg-red-50 text-red-700 border-red-200", icon: "🚨" },
};

const CATEGORY_OPTIONS = ["general", "policy", "event", "celebration", "company_update", "urgent"] as const;

// ---------------------------------------------------------------------------
// Priority configuration
// ---------------------------------------------------------------------------
const priorityConfig: Record<string, { label: string; border: string }> = {
  low: { label: "Low", border: "border-l-gray-300" },
  normal: { label: "Normal", border: "border-l-blue-400" },
  high: { label: "High", border: "border-l-amber-500" },
  critical: { label: "Critical", border: "border-l-red-600" },
};

const PRIORITY_OPTIONS = ["low", "normal", "high", "critical"] as const;

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "🔥"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Reaction {
  userId: string;
  emoji: string;
}

interface Announcement {
  _id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  isPinned?: boolean;
  publishedAt?: string;
  createdAt?: string;
  expiresAt?: string;
  authorId?: string;
  authorName?: string;
  // Backend returns `createdBy` (userId string); the author's name is
  // not joined server-side. Surfaced here so the author-resolution
  // helper below can look it up client-side against the directory.
  createdBy?: string;
  targetAudience?: string;
  targetDepartmentId?: string;
  targetEmployeeIds?: string[];
  reactions?: Reaction[];
  // Backend stores `readBy` as `{ userId, readAt }[]` — old frontend
  // modelled it as `string[]`. The `readByEntry` helper below handles
  // both legacy string arrays and the current object shape.
  readBy?: Array<string | { userId?: string; readAt?: string }>;
}

const readByEntry = (
  entry: string | { userId?: string; readAt?: string } | undefined,
): string | undefined => {
  if (!entry) return undefined;
  return typeof entry === "string" ? entry : entry.userId;
};

const hasReadAnnouncement = (a: Announcement, userId?: string): boolean => {
  if (!userId) return false;
  return (a.readBy || []).some((e) => readByEntry(e) === userId);
};

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

const formatRelative = (dateStr?: string) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AnnouncementsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isManager = hasOrgRole("manager") || hasOrgRole("hr") || hasOrgRole("admin");

  // Data state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pinned, setPinned] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // New announcement modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>("general");
  const [newPriority, setNewPriority] = useState<string>("normal");
  const [newAudience, setNewAudience] = useState<"all" | "department" | "specific">("all");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newEmployeeIds, setNewEmployeeIds] = useState<string[]>([]);
  const [newPinned, setNewPinned] = useState(false);
  const [newPublishNow, setNewPublishNow] = useState(true);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Directory state for target audience selection
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  // Backend list endpoint returns `{ items, total, page, limit }` inside
  // `data`; pinned returns a bare array. Old `.announcements` alias never
  // existed — the fallback `[]` hid the bug so the page silently rendered
  // empty. Accept all historical shapes.
  const unwrapList = (res: any): Announcement[] => {
    const d = res?.data;
    if (Array.isArray(d)) return d as Announcement[];
    if (Array.isArray(d?.items)) return d.items as Announcement[];
    if (Array.isArray(d?.records)) return d.records as Announcement[];
    if (Array.isArray(d?.announcements)) return d.announcements as Announcement[];
    return [];
  };

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.listAnnouncements({ status: "published" });
      setAnnouncements(unwrapList(res));
    } catch (err: any) {
      toast.error(err.message || "Failed to load announcements");
    }
  }, [user]);

  const fetchPinned = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getPinnedAnnouncements();
      setPinned(unwrapList(res));
    } catch {
      // pinned is optional, ignore errors
    }
  }, [user]);

  const fetchDirectory = useCallback(async () => {
    if (!isManager) return;
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
  }, [isManager]);

  // Lookup keyed by auth user _id so `renderCard` can resolve an
  // announcement's `createdBy`/`authorId` to a first/last name without
  // an extra request per row.
  const directoryById = useMemo(() => {
    const map: Record<string, { firstName?: string; lastName?: string }> = {};
    for (const u of users) {
      const id = (u as any)?._id;
      if (id) map[id] = u as any;
    }
    return map;
  }, [users]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAnnouncements(), fetchPinned(), fetchDirectory()]);
    setLoading(false);
  }, [fetchAnnouncements, fetchPinned, fetchDirectory]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // -------------------------------------------------------------------------
  // Sort feed by date desc, excluding pinned
  // -------------------------------------------------------------------------
  const feed = useMemo(() => {
    const pinnedIds = new Set(pinned.map((p) => p._id));
    return [...announcements]
      .filter((a) => !pinnedIds.has(a._id))
      .sort((a, b) => {
        const aDate = new Date(a.publishedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.publishedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });
  }, [announcements, pinned]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const resetNewModal = () => {
    setNewTitle("");
    setNewContent("");
    setNewCategory("general");
    setNewPriority("normal");
    setNewAudience("all");
    setNewDepartmentId("");
    setNewEmployeeIds([]);
    setNewPinned(false);
    setNewPublishNow(true);
    setNewExpiresAt("");
    setShowNewModal(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!newContent.trim()) {
      toast.error("Please enter some content");
      return;
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
        content: newContent.trim(),
        category: newCategory,
        priority: newPriority,
        targetAudience: newAudience,
        isPinned: newPinned,
        status: newPublishNow ? "published" : "draft",
      };
      if (newAudience === "department") payload.targetDepartmentId = newDepartmentId;
      if (newAudience === "specific") payload.targetEmployeeIds = newEmployeeIds;
      if (newExpiresAt) payload.expiresAt = new Date(newExpiresAt).toISOString();

      await payrollApi.createAnnouncement(payload);
      toast.success(newPublishNow ? "Announcement published" : "Draft saved");
      resetNewModal();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to create announcement");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.publishAnnouncement(id);
      toast.success("Announcement published");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    setActionLoading(id);
    try {
      await payrollApi.deleteAnnouncement(id);
      toast.success("Announcement deleted");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await payrollApi.markAnnouncementRead(id);
      // Optimistic update: push a `{userId, readAt}` entry matching the
      // backend schema instead of a raw string (which would corrupt the
      // local cache and flash the "unread" dot back up on refresh).
      const readEntry = { userId: user?._id || "", readAt: new Date().toISOString() };
      setAnnouncements((prev) =>
        prev.map((a) =>
          a._id === id
            ? { ...a, readBy: [...(a.readBy || []), readEntry] }
            : a,
        ),
      );
      setPinned((prev) =>
        prev.map((a) =>
          a._id === id
            ? { ...a, readBy: [...(a.readBy || []), readEntry] }
            : a,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to mark as read");
    }
  };

  const handleReact = async (id: string, emoji: string) => {
    try {
      await payrollApi.reactToAnnouncement(id, emoji);
      await fetchAnnouncements();
      await fetchPinned();
    } catch (err: any) {
      toast.error(err.message || "Failed to react");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderReactions = (announcement: Announcement) => {
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of announcement.reactions || []) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.userId === user?._id) mine.add(r.emoji);
    }
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {REACTION_EMOJIS.map((emoji) => {
          const count = counts[emoji] || 0;
          const isMine = mine.has(emoji);
          return (
            <button
              key={emoji}
              onClick={() => handleReact(announcement._id, emoji)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[12px] transition-colors ${
                isMine
                  ? "bg-[#EFF6FF] border-[#2E86C1] text-[#2E86C1]"
                  : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="font-semibold">{count}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  const renderCard = (announcement: Announcement, pinnedVariant = false) => {
    const cat = categoryConfig[announcement.category] || categoryConfig.general;
    const pri = priorityConfig[announcement.priority] || priorityConfig.normal;
    const isExpanded = expandedIds.has(announcement._id);
    const isRead = hasReadAnnouncement(announcement, user?._id);
    const isDraft = announcement.status === "draft";

    return (
      <div
        key={announcement._id}
        className={`bg-white rounded-xl border border-[#E2E8F0] border-l-4 ${pri.border} shadow-sm ${
          pinnedVariant ? "border-t-2 border-t-red-500" : ""
        }`}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {pinnedVariant && <span className="text-[14px]">📌</span>}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cat.color}`}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </span>
              {isDraft && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  DRAFT
                </span>
              )}
              {announcement.priority === "critical" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  CRITICAL
                </span>
              )}
            </div>

            {isManager && (
              <div className="relative">
                <button
                  onClick={() =>
                    setOpenMenuId(openMenuId === announcement._id ? null : announcement._id)
                  }
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                </button>
                {openMenuId === announcement._id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-20 py-1">
                      {isDraft && (
                        <button
                          onClick={() => handlePublish(announcement._id)}
                          disabled={actionLoading === announcement._id}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(announcement._id)}
                        disabled={actionLoading === announcement._id}
                        className="w-full text-left px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <h3 className="text-[16px] font-bold text-[#0F172A] mb-1.5">{announcement.title}</h3>

          <p
            className={`text-[13px] text-[#475569] leading-relaxed whitespace-pre-wrap ${
              isExpanded ? "" : "line-clamp-3"
            }`}
          >
            {announcement.content}
          </p>

          {announcement.content.length > 240 && (
            <button
              onClick={() => toggleExpand(announcement._id)}
              className="mt-1 text-[12px] font-semibold text-[#2E86C1] hover:text-[#2574A9]"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}

          <div className="flex items-center gap-3 mt-4 text-[11px] text-[#94A3B8]">
            <span>{formatRelative(announcement.publishedAt || announcement.createdAt)}</span>
            {(() => {
              // Backend only returns `createdBy` (userId). The author
              // name isn't joined server-side, so we resolve via the
              // directory lookup if it's loaded. Falls back silently
              // (no "by undefined") when the lookup misses.
              const explicit = announcement.authorName;
              const viaLookup = (announcement.authorId || announcement.createdBy)
                ? directoryById[announcement.authorId || announcement.createdBy || ""]
                : undefined;
              const label =
                explicit ||
                (viaLookup
                  ? `${viaLookup.firstName || ""} ${viaLookup.lastName || ""}`.trim()
                  : undefined);
              if (!label) return null;
              return (
                <>
                  <span>·</span>
                  <span>by {label}</span>
                </>
              );
            })()}
            {announcement.expiresAt && (
              <>
                <span>·</span>
                <span>expires {formatDate(announcement.expiresAt)}</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F1F5F9]">
            {renderReactions(announcement)}
            {isRead ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Read
              </span>
            ) : (
              <button
                onClick={() => handleMarkRead(announcement._id)}
                className="text-[11px] font-semibold text-[#2E86C1] hover:text-[#2574A9]"
              >
                Mark as read
              </button>
            )}
          </div>
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
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Announcements</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Stay up to date with company-wide news and updates
            </p>
          </div>
          {isManager && (
            <Button
              onClick={() => setShowNewModal(true)}
              className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Announcement
            </Button>
          )}
        </div>

        <div className="flex-1 p-8 space-y-6 max-w-4xl w-full mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E86C1]" />
            </div>
          ) : (
            <>
              {/* Pinned section */}
              {pinned.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[14px]">📌</span>
                    <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Pinned
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {pinned.map((a) => renderCard(a, true))}
                  </div>
                </section>
              )}

              {/* Feed */}
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
                  Feed
                </h2>
                {feed.length === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-[14px] text-[#64748B]">No announcements yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">{feed.map((a) => renderCard(a))}</div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* New Announcement Modal                                               */}
      {/* ------------------------------------------------------------------- */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={resetNewModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
              <h2 className="text-[18px] font-bold text-[#0F172A]">New Announcement</h2>
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
                  placeholder="e.g. Quarterly town hall"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Content</label>
                <textarea
                  rows={6}
                  placeholder="Write your announcement..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">{newContent.length} characters</p>
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {categoryConfig[c].icon} {categoryConfig[c].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {priorityConfig[p].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Audience */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Target audience</label>
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
                      {opt === "all" ? "Everyone" : opt === "department" ? "Department" : "Specific employees"}
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
                  <div className="border border-[#E2E8F0] rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                    {users.length === 0 && (
                      <p className="text-[12px] text-[#94A3B8] text-center py-2">No employees found</p>
                    )}
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
                                setNewEmployeeIds((prev) => prev.filter((id) => id !== u._id));
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

              {/* Pinned + Publish now */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={newPinned}
                    onChange={(e) => setNewPinned(e.target.checked)}
                    className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                  />
                  <span className="text-[13px] text-[#374151]">📌 Pin to top</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={newPublishNow}
                    onChange={(e) => setNewPublishNow(e.target.checked)}
                    className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                  />
                  <span className="text-[13px] text-[#374151]">Publish now</span>
                </label>
              </div>

              {/* Expires at */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                  Expires at (optional)
                </label>
                <input
                  type="date"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] sticky bottom-0 bg-white">
              <Button variant="outline" onClick={resetNewModal} className="h-9 text-[13px]">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
              >
                {saving ? "Saving..." : newPublishNow ? "Publish" : "Save Draft"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
