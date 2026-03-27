"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { chatApi, hrApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface FlaggedMessage {
  _id: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  reason: string;
  severity: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface ModerationStats {
  total: number;
  pending: number;
  reviewed: number;
  dismissed: number;
  actioned: number;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessage[]>([]);
  const [moderationStats, setModerationStats] = useState<ModerationStats | null>(null);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [moderationLoading, setModerationLoading] = useState(false);

  const canManage = user && (
    user.role === "admin" ||
    user.role === "super_admin" ||
    (user.roles && (user.roles.includes("admin") || user.roles.includes("super_admin") || user.roles.includes("hr")))
  );

  const fetchModerationData = useCallback(async () => {
    if (!canManage) return;
    setModerationLoading(true);
    try {
      const [flaggedRes, statsRes, empRes] = await Promise.all([
        chatApi.getFlagged(),
        chatApi.getModerationStats(),
        hrApi.getEmployees().catch(() => ({ data: [] })),
      ]);

      const messages = (flaggedRes.data || []) as FlaggedMessage[];
      setFlaggedMessages(messages);
      setModerationStats((statsRes.data || null) as ModerationStats | null);

      // Build employee map for name resolution
      const employees = (empRes.data || []) as Array<{ userId?: string; _id: string; firstName: string; lastName: string }>;
      const map: Record<string, string> = {};
      for (const emp of employees) {
        if (emp.userId) map[emp.userId] = `${emp.firstName} ${emp.lastName}`;
        map[emp._id] = `${emp.firstName} ${emp.lastName}`;
      }
      setEmployeeMap(map);
    } catch {
      // silently fail — moderation data is optional
    } finally {
      setModerationLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && canManage) {
      fetchModerationData();
    }
  }, [user, canManage, fetchModerationData]);

  const handleReview = async (id: string, status: string) => {
    try {
      await chatApi.reviewFlagged(id, { status });
      // Refresh data
      await fetchModerationData();
    } catch {
      // silent fail
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[#64748B]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const resolveName = (senderId: string, senderName?: string) => {
    if (employeeMap[senderId]) return employeeMap[senderId];
    if (senderName && senderName !== senderId) return senderName;
    return senderId.slice(0, 8) + "...";
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const thisWeekCount = flaggedMessages.filter((m) => {
    const created = new Date(m.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created >= weekAgo;
  }).length;

  const severityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      info: "bg-blue-50 text-blue-700 border border-blue-200",
      warning: "bg-amber-50 text-amber-700 border border-amber-200",
      critical: "bg-red-50 text-red-700 border border-red-200",
    };
    return styles[severity] || styles.info;
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border border-amber-200",
      reviewed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dismissed: "bg-gray-50 text-gray-600 border border-gray-200",
      actioned: "bg-blue-50 text-blue-700 border border-blue-200",
    };
    return styles[status] || styles.pending;
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      {/* Main content */}
      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">
              {greeting}, {user.firstName}!
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Here&apos;s what&apos;s happening in your workspace today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="text-[#64748B]">
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
            </Button>
            <Avatar className="h-9 w-9 bg-[#2E86C1]">
              <AvatarFallback className="bg-[#2E86C1] text-white text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">1</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Team Members</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">0</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Pending Approvals</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">0</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Active Projects</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">0</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Tasks Due Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Main content cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Profile Card */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="h-16 w-16 bg-[#2E86C1]">
                  <AvatarFallback className="bg-[#2E86C1] text-white text-xl font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-[#0F172A]">{user.firstName} {user.lastName}</p>
                  <p className="text-[13px] text-[#64748B]">{user.email}</p>
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#EBF5FF] text-[#2E86C1] capitalize">
                    {["super_admin", "admin", "hr", "manager", "developer", "designer", "employee", "user"]
                      .find(r => user.roles?.includes(r)) || user.role || "member"}
                  </span>
                </div>
              </div>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex justify-between py-2 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">MFA Status</span>
                  <span className={`font-medium ${user.mfaEnabled ? "text-emerald-600" : "text-amber-600"}`}>
                    {user.mfaEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Account Status</span>
                  <span className="font-medium text-emerald-600">Active</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[#64748B]">Member Since</span>
                  <span className="font-medium text-[#334155]">
                    {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Add Team Member", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", color: "text-violet-600 bg-violet-50" },
                { label: "View Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color: "text-amber-600 bg-amber-50" },
              ].map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#F1F5F9] transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-lg ${action.color} flex items-center justify-center`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
                  </div>
                  <span className="text-[13px] font-medium text-[#334155]">{action.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-[#334155]">No activity yet</p>
                <p className="text-xs text-[#94A3B8] mt-1">Your recent actions will appear here</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Moderation — Admin/HR only */}
        {canManage && (
          <div className="mt-5">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    </div>
                    <CardTitle className="text-sm font-semibold text-[#0F172A]">Flagged Messages</CardTitle>
                  </div>
                  <button className="text-[11px] text-[#2E86C1] font-medium hover:underline">
                    View All
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Stats row */}
                {moderationStats && (
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-[#0F172A]">{moderationStats.total}</p>
                      <p className="text-[11px] text-[#64748B]">Total Flagged</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{moderationStats.pending}</p>
                      <p className="text-[11px] text-[#64748B]">Pending Review</p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-[#0F172A]">{thisWeekCount}</p>
                      <p className="text-[11px] text-[#64748B]">This Week</p>
                    </div>
                  </div>
                )}

                {/* Flagged messages list */}
                {moderationLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <svg className="animate-spin h-5 w-5 text-[#2E86C1]" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : flaggedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-medium text-[#334155]">No flagged messages</p>
                    <p className="text-xs text-[#94A3B8] mt-1">All conversations are clean</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {flaggedMessages.slice(0, 5).map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] border-l-[3px] ${
                          msg.severity === "critical" ? "border-l-red-500" : msg.severity === "warning" ? "border-l-amber-500" : "border-l-blue-400"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-medium text-[#0F172A]">
                              {resolveName(msg.senderId, msg.senderName)}
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${severityBadge(msg.severity)}`}>
                              {msg.severity}
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusBadge(msg.status)}`}>
                              {msg.status}
                            </span>
                          </div>
                          <p className="text-[12px] text-red-700 bg-red-50 rounded px-2 py-1 truncate max-w-[500px]">
                            {msg.content.length > 120 ? msg.content.slice(0, 120) + "..." : msg.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-[#94A3B8]">{msg.reason}</span>
                            <span className="text-[11px] text-[#94A3B8]">{timeAgo(msg.createdAt)}</span>
                          </div>
                        </div>
                        {msg.status === "pending" && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleReview(msg._id, "reviewed")}
                              className="text-[11px] text-[#2E86C1] font-medium hover:underline px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleReview(msg._id, "dismissed")}
                              className="text-[11px] text-[#94A3B8] font-medium hover:underline px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
