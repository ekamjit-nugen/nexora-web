"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, roleApi } from "@/lib/api";
import type { User } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Type configuration
// ---------------------------------------------------------------------------
const kudosTypeConfig: Record<string, { label: string; icon: string; color: string }> = {
  teamwork: { label: "Teamwork", icon: "🤝", color: "bg-blue-50 text-blue-700" },
  innovation: { label: "Innovation", icon: "💡", color: "bg-amber-50 text-amber-700" },
  leadership: { label: "Leadership", icon: "🎯", color: "bg-purple-50 text-purple-700" },
  customer_first: { label: "Customer First", icon: "❤️", color: "bg-pink-50 text-pink-700" },
  above_and_beyond: { label: "Above & Beyond", icon: "🚀", color: "bg-indigo-50 text-indigo-700" },
  problem_solving: { label: "Problem Solving", icon: "🔧", color: "bg-cyan-50 text-cyan-700" },
  mentorship: { label: "Mentorship", icon: "🌱", color: "bg-emerald-50 text-emerald-700" },
  reliability: { label: "Reliability", icon: "🛡️", color: "bg-slate-50 text-slate-700" },
  positivity: { label: "Positivity", icon: "☀️", color: "bg-yellow-50 text-yellow-700" },
  learning: { label: "Learning", icon: "📚", color: "bg-orange-50 text-orange-700" },
};

const KUDOS_TYPE_OPTIONS = Object.keys(kudosTypeConfig);

const REACTION_EMOJIS = [
  { key: "clap", emoji: "👏", label: "Clap" },
  { key: "heart", emoji: "❤️", label: "Love" },
  { key: "fire", emoji: "🔥", label: "Fire" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface KudosReaction {
  userId: string;
  emoji: string;
}

interface KudosUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatar?: string;
}

interface Kudos {
  _id: string;
  fromUserId: string;
  fromUser?: KudosUser;
  fromName?: string;
  toUserIds: string[];
  toUsers?: KudosUser[];
  toNames?: string[];
  type: string;
  message: string;
  visibility: string;
  points?: number;
  reactions?: KudosReaction[];
  createdAt?: string;
}

interface LeaderboardEntry {
  userId: string;
  rank: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatar?: string;
  kudosCount: number;
  points: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (firstName?: string, lastName?: string, fallback?: string) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return (fallback?.[0] || "?").toUpperCase();
};

const getDisplayName = (u?: KudosUser) => {
  if (!u) return "Unknown";
  if (u.firstName || u.lastName) return `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return u.name || "Unknown";
};

type TabKey = "feed" | "received" | "given" | "leaderboard";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function KudosPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("feed");
  const [feed, setFeed] = useState<Kudos[]>([]);
  const [received, setReceived] = useState<Kudos[]>([]);
  const [given, setGiven] = useState<Kudos[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Give kudos modal
  const [showGiveModal, setShowGiveModal] = useState(false);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [newType, setNewType] = useState<string>("teamwork");
  const [newMessage, setNewMessage] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "team" | "private">("public");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  // Backend returns `{ items, total, page, limit }` for all kudos list
  // endpoints and a bare array for the leaderboard. The old
  // `.kudos`/`.leaderboard` aliases never existed on the server —
  // fallbacks silently rendered empty tabs. Accept historical shapes.
  const unwrapList = <T,>(res: any, arrayAlias?: string): T[] => {
    const d = res?.data;
    if (Array.isArray(d)) return d as T[];
    if (Array.isArray(d?.items)) return d.items as T[];
    if (Array.isArray(d?.records)) return d.records as T[];
    if (arrayAlias && Array.isArray(d?.[arrayAlias])) return d[arrayAlias] as T[];
    return [];
  };

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.listKudos();
      setFeed(unwrapList<Kudos>(res, "kudos"));
    } catch (err: any) {
      toast.error(err.message || "Failed to load kudos feed");
    }
  }, [user]);

  const fetchReceived = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getMyReceivedKudos();
      setReceived(unwrapList<Kudos>(res, "kudos"));
    } catch {
      // ignore
    }
  }, [user]);

  const fetchGiven = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getMyGivenKudos();
      setGiven(unwrapList<Kudos>(res, "kudos"));
    } catch {
      // ignore
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    if (!user) return;
    try {
      const res = await payrollApi.getKudosLeaderboard(10);
      setLeaderboard(unwrapList<LeaderboardEntry>(res, "leaderboard"));
    } catch {
      // ignore
    }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await roleApi.getUsers();
      const data = Array.isArray(res.data) ? res.data : [];
      setUsers(data.filter((u) => u._id !== user?._id));
    } catch {
      // ignore
    }
  }, [user?._id]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchFeed(),
      fetchReceived(),
      fetchGiven(),
      fetchLeaderboard(),
      fetchUsers(),
    ]);
    setLoading(false);
  }, [fetchFeed, fetchReceived, fetchGiven, fetchLeaderboard, fetchUsers]);

  useEffect(() => {
    if (user) fetchAll();
  }, [fetchAll, user]);

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------
  const receivedStats = useMemo(() => {
    const totalPoints = received.reduce((sum, k) => sum + (k.points || 10), 0);
    return {
      count: received.length,
      totalPoints,
    };
  }, [received]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const resetGiveModal = () => {
    setRecipientIds([]);
    setNewType("teamwork");
    setNewMessage("");
    setNewVisibility("public");
    setSearchQuery("");
    setShowGiveModal(false);
  };

  const handleGiveKudos = async () => {
    if (recipientIds.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    if (!newMessage.trim()) {
      toast.error("Please write a message");
      return;
    }

    setSaving(true);
    try {
      await payrollApi.giveKudos({
        toUserIds: recipientIds,
        type: newType,
        message: newMessage.trim(),
        visibility: newVisibility,
      });
      toast.success("Kudos delivered!");
      resetGiveModal();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to give kudos");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKudos = async (id: string) => {
    if (!confirm("Delete this kudos?")) return;
    setActionLoading(id);
    try {
      await payrollApi.deleteKudos(id);
      toast.success("Kudos deleted");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setActionLoading(null);
    }
  };

  const canDeleteKudos = (k: Kudos): boolean => {
    if (!k.createdAt) return false;
    const diff = Date.now() - new Date(k.createdAt).getTime();
    return diff < 24 * 60 * 60 * 1000;
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderAvatar = (u?: KudosUser, size: "sm" | "md" = "md") => {
    const cls = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-[11px]";
    return (
      <Avatar className={`${cls} bg-[#2E86C1]`}>
        <AvatarFallback className="bg-[#2E86C1] text-white font-semibold">
          {getInitials(u?.firstName, u?.lastName, u?.name)}
        </AvatarFallback>
      </Avatar>
    );
  };

  const renderKudosCard = (k: Kudos, showDelete = false) => {
    const cfg = kudosTypeConfig[k.type] || kudosTypeConfig.teamwork;
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of k.reactions || []) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.userId === user?._id) mine.add(r.emoji);
    }

    const fromUser = k.fromUser || { firstName: k.fromName, name: k.fromName };
    const recipients: KudosUser[] =
      k.toUsers && k.toUsers.length > 0
        ? k.toUsers
        : (k.toNames || []).map((n) => ({ _id: "", name: n }));

    return (
      <div key={k._id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
        <div className="flex items-start gap-3">
          {renderAvatar(fromUser)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
              <span className="font-semibold text-[#0F172A]">{getDisplayName(fromUser)}</span>
              <span className="text-[#64748B]">gave kudos to</span>
              <div className="flex items-center gap-1 flex-wrap">
                {recipients.slice(0, 3).map((r, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1">
                    {renderAvatar(r, "sm")}
                    <span className="font-semibold text-[#0F172A]">{getDisplayName(r)}</span>
                  </div>
                ))}
                {recipients.length > 3 && (
                  <span className="text-[12px] text-[#64748B]">+{recipients.length - 3} more</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}
              >
                <span>{cfg.icon}</span>
                {cfg.label}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                +{k.points || 10} pts
              </span>
              <span className="text-[11px] text-[#94A3B8]">{formatRelative(k.createdAt)}</span>
            </div>

            <p className="mt-3 text-[14px] text-[#475569] leading-relaxed italic">"{k.message}"</p>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1F5F9]">
              <div className="flex items-center gap-1.5">
                {REACTION_EMOJIS.map((r) => {
                  const count = counts[r.emoji] || 0;
                  const isMine = mine.has(r.emoji);
                  return (
                    <button
                      key={r.key}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[12px] transition-colors ${
                        isMine
                          ? "bg-[#EFF6FF] border-[#2E86C1] text-[#2E86C1]"
                          : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span>{r.emoji}</span>
                      {count > 0 && <span className="font-semibold">{count}</span>}
                    </button>
                  );
                })}
              </div>
              {showDelete && canDeleteKudos(k) && (
                <button
                  onClick={() => handleDeleteKudos(k._id)}
                  disabled={actionLoading === k._id}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const medalFor = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  // Exclude the current user from the recipient picker — backend
  // rejects self-kudos with a 400, this stops the UX dead-end.
  const filteredUsers = useMemo(() => {
    const me = user?._id;
    const base = me ? users.filter((u) => (u as any)?._id !== me) : users;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (u) =>
        `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, searchQuery, user]);

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
            <h1 className="text-[20px] font-bold text-[#0F172A]">Kudos & Recognition</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Celebrate your teammates and their achievements
            </p>
          </div>
          <Button
            onClick={() => setShowGiveModal(true)}
            className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
          >
            <span>🎉</span>
            Give Kudos
          </Button>
        </div>

        <div className="flex-1 p-8 space-y-6 max-w-4xl w-full mx-auto">
          {/* Tabs */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex">
            {([
              { key: "feed", label: "Feed" },
              { key: "received", label: "Received" },
              { key: "given", label: "Given" },
              { key: "leaderboard", label: "Leaderboard" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === t.key
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E86C1]" />
            </div>
          ) : (
            <>
              {/* Feed Tab */}
              {activeTab === "feed" && (
                <div className="space-y-3">
                  {feed.length === 0 ? (
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                      <div className="text-4xl mb-2">🎉</div>
                      <p className="text-[14px] text-[#64748B]">
                        No kudos yet. Be the first to recognize a teammate!
                      </p>
                    </div>
                  ) : (
                    feed.map((k) => renderKudosCard(k))
                  )}
                </div>
              )}

              {/* Received Tab */}
              {activeTab === "received" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                      <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wider">
                        Total Points
                      </p>
                      <p className="text-[24px] font-bold text-[#0F172A] mt-1">
                        {receivedStats.totalPoints}
                      </p>
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                      <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wider">
                        Kudos Received
                      </p>
                      <p className="text-[24px] font-bold text-[#0F172A] mt-1">
                        {receivedStats.count}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {received.length === 0 ? (
                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                        <div className="text-4xl mb-2">🌟</div>
                        <p className="text-[14px] text-[#64748B]">
                          You haven't received any kudos yet
                        </p>
                      </div>
                    ) : (
                      received.map((k) => renderKudosCard(k))
                    )}
                  </div>
                </div>
              )}

              {/* Given Tab */}
              {activeTab === "given" && (
                <div className="space-y-3">
                  {given.length === 0 ? (
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                      <div className="text-4xl mb-2">💝</div>
                      <p className="text-[14px] text-[#64748B]">
                        You haven't given any kudos yet
                      </p>
                    </div>
                  ) : (
                    given.map((k) => renderKudosCard(k, true))
                  )}
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === "leaderboard" && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#F1F5F9]">
                    <h3 className="text-[15px] font-bold text-[#0F172A]">Top performers this month</h3>
                    <p className="text-[12px] text-[#64748B] mt-0.5">
                      Based on kudos received
                    </p>
                  </div>
                  {leaderboard.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-4xl mb-2">🏆</div>
                      <p className="text-[14px] text-[#64748B]">No leaderboard data yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F1F5F9]">
                      <div className="grid grid-cols-12 gap-4 px-5 py-2 bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                        <div className="col-span-1">Rank</div>
                        <div className="col-span-6">Name</div>
                        <div className="col-span-2 text-right">Kudos</div>
                        <div className="col-span-3 text-right">Points</div>
                      </div>
                      {leaderboard.map((entry, idx) => {
                        const rank = entry.rank || idx + 1;
                        const medal = medalFor(rank);
                        // Backend leaderboard returns only `{userId, totalPoints, kudosCount}`;
                        // name/avatar are not joined server-side. Resolve
                        // against the already-loaded `users[]` directory so
                        // the table shows real names instead of "Unknown".
                        const hydrated = users.find((u) => (u as any)?._id === entry.userId);
                        const firstName = entry.firstName ?? hydrated?.firstName;
                        const lastName = entry.lastName ?? hydrated?.lastName;
                        const displayName =
                          firstName || lastName
                            ? `${firstName || ""} ${lastName || ""}`.trim()
                            : entry.name || hydrated?.email || "Unknown";
                        return (
                          <div
                            key={entry.userId}
                            className={`grid grid-cols-12 gap-4 px-5 py-4 items-center ${
                              rank <= 3 ? "bg-amber-50/30" : ""
                            }`}
                          >
                            <div className="col-span-1 text-[16px] font-bold text-[#0F172A]">
                              {medal || `#${rank}`}
                            </div>
                            <div className="col-span-6 flex items-center gap-3">
                              <Avatar className="h-9 w-9 bg-[#2E86C1]">
                                <AvatarFallback className="bg-[#2E86C1] text-white text-[11px] font-semibold">
                                  {getInitials(firstName, lastName, entry.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[14px] font-semibold text-[#0F172A]">
                                {displayName}
                              </span>
                            </div>
                            <div className="col-span-2 text-right text-[14px] font-semibold text-[#64748B]">
                              {entry.kudosCount}
                            </div>
                            <div className="col-span-3 text-right text-[14px] font-bold text-amber-700">
                              {entry.points} pts
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* Give Kudos Modal                                                    */}
      {/* ------------------------------------------------------------------- */}
      {showGiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={resetGiveModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
              <h2 className="text-[18px] font-bold text-[#0F172A]">Give Kudos</h2>
              <button
                onClick={resetGiveModal}
                className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Recipients */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                  Recipients ({recipientIds.length})
                </label>
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1] mb-2"
                />
                <div className="border border-[#E2E8F0] rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {filteredUsers.length === 0 && (
                    <p className="text-[12px] text-[#94A3B8] text-center py-3">No users found</p>
                  )}
                  {filteredUsers.map((u) => {
                    const checked = recipientIds.includes(u._id);
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
                              setRecipientIds((prev) => [...prev, u._id]);
                            } else {
                              setRecipientIds((prev) => prev.filter((id) => id !== u._id));
                            }
                          }}
                          className="rounded border-[#D1D5DB] text-[#2E86C1] focus:ring-[#2E86C1]/30"
                        />
                        <Avatar className="h-6 w-6 bg-[#2E86C1]">
                          <AvatarFallback className="bg-[#2E86C1] text-white text-[9px] font-semibold">
                            {getInitials(u.firstName, u.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[13px] text-[#0F172A]">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="text-[11px] text-[#94A3B8] ml-auto">{u.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {KUDOS_TYPE_OPTIONS.map((t) => {
                    const cfg = kudosTypeConfig[t];
                    const selected = newType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setNewType(t)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors ${
                          selected
                            ? "bg-[#EFF6FF] border-[#2E86C1] text-[#2E86C1]"
                            : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Message</label>
                <textarea
                  rows={4}
                  placeholder="What did they do that was awesome?"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">{newMessage.length} characters</p>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Visibility</label>
                <select
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value as "public" | "team" | "private")}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                >
                  <option value="public">Public — visible to everyone</option>
                  <option value="team">Team — visible to your team</option>
                  <option value="private">Private — only the recipient(s)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] sticky bottom-0 bg-white">
              <Button variant="outline" onClick={resetGiveModal} className="h-9 text-[13px]">
                Cancel
              </Button>
              <Button
                onClick={handleGiveKudos}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 text-[13px]"
              >
                {saving ? "Sending..." : "Give Kudos"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
