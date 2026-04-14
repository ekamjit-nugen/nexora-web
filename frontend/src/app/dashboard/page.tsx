"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  chatApi, hrApi, projectApi, taskApi, attendanceApi, leaveApi,
  meetingApi, standupApi, benchApi, assetApi, payrollApi,
  wikiBookmarkApi,
} from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { SetupCompletenessWidget } from "@/components/setup-completeness-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FlaggedMessage {
  _id: string; messageId: string; conversationId: string; senderId: string;
  senderName?: string; content: string; reason: string; severity: string;
  status: string; createdAt: string;
}

interface ModerationStats { total: number; pending: number; reviewed: number; dismissed: number; actioned: number; }

interface ActionItem {
  id: string; label: string; count: number; href: string;
  color: string; icon: string; priority: number;
}

export default function DashboardPage() {
  const { user, loading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  // Stat cards (real data)
  const [teamCount, setTeamCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [activeProjects, setActiveProjects] = useState(0);
  const [tasksDueToday, setTasksDueToday] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Attendance
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockedOut, setClockedOut] = useState(false);
  const [workingHours, setWorkingHours] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  // Today's meetings
  const [todayMeetings, setTodayMeetings] = useState<any[]>([]);

  // Standups
  const [pendingStandups, setPendingStandups] = useState<any[]>([]);

  // P1: Quick Insights
  const [insights, setInsights] = useState<{ label: string; value: string; sub?: string; color?: string; href?: string }[]>([]);

  // P1: Announcements
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // P1: Recent Activity
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // P2: My Assets, Wiki Bookmarks, Standup Status
  const [myAssets, setMyAssets] = useState<any[]>([]);
  const [wikiBookmarks, setWikiBookmarks] = useState<any[]>([]);

  // Moderation (existing)
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessage[]>([]);
  const [moderationStats, setModerationStats] = useState<ModerationStats | null>(null);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [moderationLoading, setModerationLoading] = useState(false);

  const isManager = hasOrgRole("manager");
  const canManage = user && (
    user.role === "admin" || user.role === "super_admin" ||
    (user.roles && (user.roles.includes("admin") || user.roles.includes("super_admin") || user.roles.includes("hr")))
  );

  // ── Fetch all dashboard data ──
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    setAttendanceLoading(true);

    const results = await Promise.allSettled([
      // Stats
      hrApi.getEmployees({ limit: "1" }).catch(() => ({ pagination: { total: 0 } })),
      projectApi.getAll({ status: "active" }).catch(() => ({ data: [] })),
      taskApi.getMyWork().catch(() => ({ data: {} })),
      // Attendance
      attendanceApi.getToday().catch(() => ({ data: null })),
      // Meetings today
      meetingApi.list().catch(() => ({ data: [] })),
      // Standups
      standupApi.getAll().catch(() => ({ data: [] })),
      // Leaves pending (managers)
      isManager ? leaveApi.getAll({ status: "pending" }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]);

    // 1. Team count
    if (results[0].status === "fulfilled") {
      const r = results[0].value as any;
      setTeamCount(r.pagination?.total || (Array.isArray(r.data) ? r.data.length : 0));
    }

    // 2. Active projects
    if (results[1].status === "fulfilled") {
      const r = results[1].value as any;
      setActiveProjects(Array.isArray(r.data) ? r.data.length : 0);
    }

    // 3. Tasks
    const actions: ActionItem[] = [];
    if (results[2].status === "fulfilled") {
      const myWork = (results[2].value as any)?.data || {};
      const overdue = myWork.overdue || [];
      const dueToday = myWork.dueToday || [];
      const inProgress = myWork.inProgress || [];
      setTasksDueToday(dueToday.length);

      if (overdue.length > 0) actions.push({ id: "overdue", label: "Overdue tasks", count: overdue.length, href: "/my-work", color: "text-[#EF4444]", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", priority: 1 });
      if (dueToday.length > 0) actions.push({ id: "due-today", label: "Tasks due today", count: dueToday.length, href: "/my-work", color: "text-[#F59E0B]", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", priority: 2 });
      if (inProgress.length > 0) actions.push({ id: "in-progress", label: "Tasks in progress", count: inProgress.length, href: "/my-work", color: "text-[#3B82F6]", icon: "M13 10V3L4 14h7v7l9-11h-7z", priority: 5 });
    }

    // 4. Attendance
    if (results[3].status === "fulfilled") {
      const att = (results[3].value as any)?.data;
      const today = Array.isArray(att) ? att[0] : att;
      if (today) {
        const checkIn = today.checkIn || today.checkInTime;
        const checkOut = today.checkOut || today.checkOutTime;
        if (checkIn) {
          setClockedIn(true);
          setClockInTime(checkIn);
          if (checkOut) {
            setClockedOut(true);
            const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setWorkingHours(`${h}h ${m}m`);
          } else {
            const diff = Date.now() - new Date(checkIn).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setWorkingHours(`${h}h ${m}m`);
          }
        }
      }
    }
    setAttendanceLoading(false);

    // 5. Today's meetings
    if (results[4].status === "fulfilled") {
      const meetings = Array.isArray((results[4].value as any)?.data) ? (results[4].value as any).data : [];
      const today = new Date().toDateString();
      const todayMtgs = meetings.filter((m: any) => new Date(m.scheduledAt).toDateString() === today && m.status !== "cancelled");
      setTodayMeetings(todayMtgs);
      if (todayMtgs.length > 0) actions.push({ id: "meetings", label: "Meetings today", count: todayMtgs.length, href: "/meetings", color: "text-[#8B5CF6]", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z", priority: 3 });
    }

    // 6. Pending standups
    if (results[5].status === "fulfilled") {
      const standups = Array.isArray((results[5].value as any)?.data) ? (results[5].value as any).data : [];
      // Check status for each
      const pending: any[] = [];
      for (const s of standups.slice(0, 5)) {
        try {
          const status = await standupApi.getMyStatus(s._id);
          if (!(status.data as any)?.submitted) pending.push(s);
        } catch { /* skip */ }
      }
      setPendingStandups(pending);
      if (pending.length > 0) actions.push({ id: "standups", label: "Standups pending", count: pending.length, href: "/standups", color: "text-[#06B6D4]", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", priority: 2 });
    }

    // 7. Leave approvals (managers)
    let totalPendingApprovals = 0;
    if (results[6].status === "fulfilled") {
      const leaves = Array.isArray((results[6].value as any)?.data) ? (results[6].value as any).data : [];
      const pendingLeaves = leaves.filter((l: any) => l.status === "pending");
      if (pendingLeaves.length > 0) {
        totalPendingApprovals += pendingLeaves.length;
        actions.push({ id: "leaves", label: "Leave requests to approve", count: pendingLeaves.length, href: "/leaves", color: "text-[#10B981]", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", priority: 1 });
      }
    }
    setPendingApprovals(totalPendingApprovals);

    // Sort actions by priority
    actions.sort((a, b) => a.priority - b.priority);
    setActionItems(actions);
    setStatsLoading(false);

    // ── P1: Quick Insights (non-blocking) ──
    const insightItems: { label: string; value: string; sub?: string; color?: string; href?: string }[] = [];
    const p1Results = await Promise.allSettled([
      isManager ? benchApi.getOverview().catch(() => null) : Promise.resolve(null),
      assetApi.getStats().catch(() => null),
      leaveApi.getBalance().catch(() => null),
      payrollApi.listAnnouncements({ limit: "5", sort: "-createdAt" }).catch(() => ({ data: [] })),
    ]);

    // Bench insights (managers)
    if (p1Results[0].status === "fulfilled" && p1Results[0].value) {
      const bench = (p1Results[0].value as any)?.data;
      if (bench && bench.benchCount > 0) {
        const dailyCost = bench.benchCostDaily || 0;
        const formatted = dailyCost > 0 ? `₹${(dailyCost / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "₹0";
        insightItems.push({ label: "Bench", value: `${bench.benchCount} people`, sub: `${formatted}/day burn`, color: "text-[#EF4444]", href: "/bench" });
      }
    }

    // Asset insights
    if (p1Results[1].status === "fulfilled" && p1Results[1].value) {
      const stats = (p1Results[1].value as any)?.data;
      if (stats) {
        if (stats.warrantyExpiringIn30Days > 0) {
          insightItems.push({ label: "Warranty Alerts", value: `${stats.warrantyExpiringIn30Days} assets`, sub: "expiring in 30 days", color: "text-[#F59E0B]", href: "/assets/dashboard" });
        }
        insightItems.push({ label: "IT Assets", value: `${stats.totalAssets || 0} total`, sub: `${stats.assigned || 0} assigned`, href: "/assets" });
      }
    }

    // Leave balance (employees)
    if (p1Results[2].status === "fulfilled" && p1Results[2].value) {
      const balance = (p1Results[2].value as any)?.data;
      if (balance) {
        const balances = Array.isArray(balance) ? balance : balance.balances || [];
        const totalRemaining = balances.reduce((sum: number, b: any) => sum + (b.remaining || b.balance || 0), 0);
        insightItems.push({ label: "Leave Balance", value: `${totalRemaining} days`, sub: "remaining this year", color: "text-[#3B82F6]", href: "/leaves" });
      }
    }

    setInsights(insightItems);

    // Announcements
    if (p1Results[3].status === "fulfilled") {
      const annData = (p1Results[3].value as any)?.data;
      setAnnouncements(Array.isArray(annData) ? annData.slice(0, 3) : []);
    }

    // Recent Activity (from task activity logs)
    try {
      // Get activity from the user's projects
      const projRes = await projectApi.getAll({ status: "active" }).catch(() => ({ data: [] }));
      const projs = Array.isArray((projRes as any).data) ? (projRes as any).data : [];
      const activities: any[] = [];
      for (const proj of projs.slice(0, 3)) {
        try {
          const actRes = await taskApi.getProjectActivity(proj._id, 5);
          const acts = Array.isArray((actRes as any).data) ? (actRes as any).data : [];
          activities.push(...acts.map((a: any) => ({ ...a, projectName: proj.projectName })));
        } catch { /* skip */ }
      }
      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentActivity(activities.slice(0, 8));
    } catch { /* silent */ }

    // ── P2: My Assets, Wiki Bookmarks ──
    const p2Results = await Promise.allSettled([
      assetApi.getEmployeeAssets((user as any)._id || (user as any).userId || '').catch(() => ({ data: [] })),
      wikiBookmarkApi.getAll().catch(() => ({ data: [] })),
    ]);

    if (p2Results[0].status === "fulfilled") {
      const assets = (p2Results[0].value as any)?.data;
      setMyAssets(Array.isArray(assets) ? assets.slice(0, 5) : []);
    }

    if (p2Results[1].status === "fulfilled") {
      const bms = (p2Results[1].value as any)?.data;
      setWikiBookmarks(Array.isArray(bms) ? bms.slice(0, 4) : []);
    }
  }, [user, isManager]);

  // Moderation data (existing)
  const fetchModerationData = useCallback(async () => {
    if (!canManage) return;
    setModerationLoading(true);
    try {
      const [flaggedRes, statsRes, empRes] = await Promise.all([
        chatApi.getFlagged(),
        chatApi.getModerationStats(),
        hrApi.getEmployees().catch(() => ({ data: [] })),
      ]);
      setFlaggedMessages((flaggedRes.data || []) as FlaggedMessage[]);
      setModerationStats((statsRes.data || null) as ModerationStats | null);
      const employees = (empRes.data || []) as Array<{ userId?: string; _id: string; firstName: string; lastName: string }>;
      const map: Record<string, string> = {};
      for (const emp of employees) {
        if (emp.userId) map[emp.userId] = `${emp.firstName} ${emp.lastName}`;
        map[emp._id] = `${emp.firstName} ${emp.lastName}`;
      }
      setEmployeeMap(map);
    } catch { /* silent */ }
    finally { setModerationLoading(false); }
  }, [canManage]);

  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);
  useEffect(() => { if (user) fetchDashboardData(); }, [user, fetchDashboardData]);
  useEffect(() => { if (user && canManage) fetchModerationData(); }, [user, canManage, fetchModerationData]);

  const handleClockIn = async () => {
    try {
      await attendanceApi.checkIn();
      toast.success("Clocked in!");
      setClockedIn(true);
      setClockInTime(new Date().toISOString());
    } catch (e: any) { toast.error(e.message || "Failed to clock in"); }
  };

  const handleClockOut = async () => {
    try {
      await attendanceApi.checkOut();
      toast.success("Clocked out!");
      setClockedOut(true);
      fetchDashboardData();
    } catch (e: any) { toast.error(e.message || "Failed to clock out"); }
  };

  const handleReview = async (id: string, status: string) => {
    try { await chatApi.reviewFlagged(id, { status }); await fetchModerationData(); } catch { /* silent */ }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <p className="text-sm text-[#64748B]">Loading...</p>
      </div>
    </div>
  );

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const hour = new Date().getHours();
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
    return `${Math.floor(hours / 24)}d ago`;
  };

  const thisWeekCount = flaggedMessages.filter(m => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(m.createdAt) >= weekAgo;
  }).length;

  const severityBadge = (s: string) => ({ info: "bg-blue-50 text-blue-700 border border-blue-200", warning: "bg-amber-50 text-amber-700 border border-amber-200", critical: "bg-red-50 text-red-700 border border-red-200" }[s] || "bg-blue-50 text-blue-700 border border-blue-200");
  const statusBadge = (s: string) => ({ pending: "bg-amber-50 text-amber-700 border border-amber-200", reviewed: "bg-emerald-50 text-emerald-700 border border-emerald-200", dismissed: "bg-gray-50 text-gray-600 border border-gray-200", actioned: "bg-blue-50 text-blue-700 border border-blue-200" }[s] || "bg-amber-50 text-amber-700 border border-amber-200");

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{greeting}, {user.firstName}!</h1>
            <p className="text-[13px] text-[#64748B] mt-1">Here&apos;s what&apos;s happening in your workspace today.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="text-[#64748B]" onClick={() => router.push("/notifications")}>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              Notifications
            </Button>
            <Avatar className="h-9 w-9 bg-[#2E86C1]">
              <AvatarFallback className="bg-[#2E86C1] text-white text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Setup Completeness */}
        <SetupCompletenessWidget />

        {/* ── Stat Cards (REAL DATA) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {/* Attendance */}
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              {attendanceLoading ? (
                <div className="h-8 w-20 bg-[#E2E8F0] rounded animate-pulse" />
              ) : clockedOut ? (
                <>
                  <p className="text-lg font-bold text-[#10B981]">{workingHours}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Done for today</p>
                </>
              ) : clockedIn ? (
                <>
                  <p className="text-lg font-bold text-[#10B981]">{workingHours}</p>
                  <p className="text-[10px] text-[#94A3B8]">Since {new Date(clockInTime!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                  <button onClick={handleClockOut} className="mt-2 text-[10px] font-medium text-[#EF4444] hover:underline">Clock Out</button>
                </>
              ) : (
                <>
                  <button onClick={handleClockIn} className="text-sm font-bold text-white bg-[#10B981] hover:bg-[#059669] px-3 py-1.5 rounded-lg transition-colors">Clock In</button>
                  <p className="text-[11px] text-[#94A3B8] mt-1">Not clocked in</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card className="border-0 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/directory")}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{statsLoading ? <span className="inline-block h-7 w-10 bg-[#E2E8F0] rounded animate-pulse" /> : teamCount}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Team Members</p>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card className="border-0 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/leaves")}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className={`text-2xl font-bold ${pendingApprovals > 0 ? "text-[#F59E0B]" : "text-[#0F172A]"}`}>{statsLoading ? <span className="inline-block h-7 w-10 bg-[#E2E8F0] rounded animate-pulse" /> : pendingApprovals}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Pending Approvals</p>
            </CardContent>
          </Card>

          {/* Active Projects */}
          <Card className="border-0 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/projects")}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{statsLoading ? <span className="inline-block h-7 w-10 bg-[#E2E8F0] rounded animate-pulse" /> : activeProjects}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Active Projects</p>
            </CardContent>
          </Card>

          {/* Tasks Due Today */}
          <Card className="border-0 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/my-work")}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-bl-[60px] -mr-2 -mt-2" />
            <CardContent className="p-5 relative">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className={`text-2xl font-bold ${tasksDueToday > 0 ? "text-[#EF4444]" : "text-[#0F172A]"}`}>{statsLoading ? <span className="inline-block h-7 w-10 bg-[#E2E8F0] rounded animate-pulse" /> : tasksDueToday}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Tasks Due Today</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

          {/* Action Items (needs attention) */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                <CardTitle className="text-sm font-semibold text-[#0F172A]">Needs Your Attention</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-[#F1F5F9] rounded-lg animate-pulse" />)}</div>
              ) : actionItems.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#334155]">All caught up!</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Nothing needs your attention right now</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {actionItems.map(item => (
                    <button key={item.id} onClick={() => router.push(item.href)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors text-left group">
                      <div className={`w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center shrink-0 ${item.color}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#334155] group-hover:text-[#2E86C1]">{item.count} {item.label}</p>
                      </div>
                      <svg className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0F172A]">Today&apos;s Schedule</CardTitle>
                <button onClick={() => router.push("/meetings")} className="text-[11px] text-[#2E86C1] font-medium hover:underline">View All</button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Pending Standups */}
              {pendingStandups.length > 0 && (
                <div className="mb-3">
                  {pendingStandups.map(s => (
                    <button key={s._id} onClick={() => router.push(`/standups/${s._id}`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] mb-1.5 text-left hover:bg-[#FFEDD5] transition-colors">
                      <div className="w-1.5 h-8 rounded-full bg-[#F59E0B] shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#92400E]">{s.name}</p>
                        <p className="text-[10px] text-[#B45309]">Standup pending — submit now</p>
                      </div>
                      <span className="text-[10px] text-[#B45309]">{s.schedule?.time || "09:00"}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Meetings */}
              {todayMeetings.length === 0 && pendingStandups.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#334155]">No events today</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Your calendar is clear</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {todayMeetings.map(m => (
                    <button key={m._id} onClick={() => router.push(`/meeting/${m._id}`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors text-left group">
                      <div className={`w-1.5 h-8 rounded-full shrink-0 ${m.status === "active" ? "bg-[#10B981]" : "bg-[#3B82F6]"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#334155] truncate">{m.title}</p>
                        <p className="text-[10px] text-[#94A3B8]">{m.durationMinutes} min · {m.participantIds?.length || 0} participants</p>
                      </div>
                      <span className="text-xs font-medium text-[#64748B] shrink-0">
                        {new Date(m.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions + Profile */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { label: "My Work", href: "/my-work", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", color: "text-blue-600 bg-blue-50" },
                { label: "Apply Leave", href: "/leaves", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", color: "text-emerald-600 bg-emerald-50" },
                { label: "Log Time", href: "/timesheets", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-amber-600 bg-amber-50" },
                { label: "Team Chat", href: "/messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", color: "text-purple-600 bg-purple-50" },
                { label: "View Payslip", href: "/payroll/payslips", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z", color: "text-rose-600 bg-rose-50" },
                { label: "Knowledge Base", href: "/wiki", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "text-cyan-600 bg-cyan-50" },
              ].map(action => (
                <button key={action.label} onClick={() => router.push(action.href)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center shrink-0`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={action.icon} /></svg>
                  </div>
                  <span className="text-[13px] font-medium text-[#334155]">{action.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── P1: Quick Insights + Recent Activity + Announcements ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Quick Insights */}
          {insights.length > 0 && (
            <Card className="lg:col-span-1 border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#0F172A]">Quick Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((item, i) => (
                  <div key={i} onClick={() => item.href && router.push(item.href)}
                    className={`flex items-center justify-between p-3 rounded-lg bg-[#F8FAFC] ${item.href ? "cursor-pointer hover:bg-[#F1F5F9]" : ""} transition-colors`}>
                    <div>
                      <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider">{item.label}</p>
                      <p className={`text-sm font-bold ${item.color || "text-[#0F172A]"}`}>{item.value}</p>
                    </div>
                    {item.sub && <p className="text-[10px] text-[#94A3B8] text-right">{item.sub}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card className={`border-0 shadow-sm ${insights.length > 0 ? "lg:col-span-1" : "lg:col-span-2"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#334155]">No recent activity</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Activity from your projects will appear here</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentActivity.map((act, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#F8FAFC] last:border-0">
                      <div className="w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#334155]">
                          <span className="font-medium">{act.description || act.action || "Activity"}</span>
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
                          {act.projectName && <span>{act.projectName} · </span>}
                          {timeAgo(act.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  <CardTitle className="text-sm font-semibold text-[#0F172A]">Announcements</CardTitle>
                </div>
                <button onClick={() => router.push("/payroll/announcements")} className="text-[11px] text-[#2E86C1] font-medium hover:underline">View All</button>
              </div>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#334155]">No announcements</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Company updates will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.map((ann, i) => {
                    const priorityColors: Record<string, string> = {
                      critical: "border-l-[#EF4444] bg-[#FEF2F2]",
                      high: "border-l-[#F59E0B] bg-[#FFFBEB]",
                      normal: "border-l-[#3B82F6] bg-[#F8FAFC]",
                      low: "border-l-[#94A3B8] bg-[#F8FAFC]",
                    };
                    const style = priorityColors[ann.priority] || priorityColors.normal;
                    return (
                      <div key={ann._id || i} onClick={() => router.push("/payroll/announcements")}
                        className={`p-3 rounded-lg border-l-[3px] cursor-pointer hover:shadow-sm transition-shadow ${style}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {ann.priority === "critical" && <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />}
                          <span className="text-[10px] font-bold uppercase text-[#94A3B8]">{ann.category || "General"}</span>
                        </div>
                        <p className="text-[13px] font-medium text-[#0F172A] line-clamp-2">{ann.title}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-1">
                          {ann.createdAt ? timeAgo(ann.createdAt) : ""}
                          {ann.readCount !== undefined && ` · ${ann.readCount} read`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── P2: Standup Status + My Assets + Wiki Bookmarks ── */}
        {(pendingStandups.length > 0 || myAssets.length > 0 || wikiBookmarks.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {/* Standup Status */}
            {pendingStandups.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    <CardTitle className="text-sm font-semibold text-[#0F172A]">Standup Status</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingStandups.map(s => (
                    <button key={s._id} onClick={() => router.push(`/standups/${s._id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] text-left hover:bg-[#FFEDD5] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#F59E0B] text-white flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#92400E] truncate">{s.name}</p>
                        <p className="text-[10px] text-[#B45309]">Due at {s.schedule?.time || "09:00"} — submit now</p>
                      </div>
                      <svg className="w-4 h-4 text-[#D97706] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* My Assets */}
            {myAssets.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-[#0F172A]">My Assets</CardTitle>
                    <button onClick={() => router.push("/assets/my")} className="text-[11px] text-[#2E86C1] font-medium hover:underline">View All</button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {myAssets.map((asset, i) => (
                    <div key={asset._id || i} onClick={() => router.push(`/assets/${asset._id}`)}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#06B6D4] bg-opacity-10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#334155] truncate">{asset.name}</p>
                        <p className="text-[10px] text-[#94A3B8]">{asset.assetTag}{asset.serialNumber ? ` · ${asset.serialNumber}` : ""}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${asset.condition === "good" || asset.condition === "new" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                        {(asset.condition || "good").toUpperCase()}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Wiki Bookmarks */}
            {wikiBookmarks.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-[#0F172A]">Bookmarked Pages</CardTitle>
                    <button onClick={() => router.push("/wiki/bookmarks")} className="text-[11px] text-[#2E86C1] font-medium hover:underline">View All</button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {wikiBookmarks.map((bm, i) => {
                    const page = bm.page || bm;
                    return (
                      <button key={bm._id || i} onClick={() => router.push(`/wiki/${bm.spaceId}/${bm.pageId}`)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors text-left">
                        <span className="text-lg shrink-0">{page.icon || "📄"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-[#334155] truncate">{page.title || "Untitled"}</p>
                          {page.excerpt && <p className="text-[10px] text-[#94A3B8] truncate">{page.excerpt}</p>}
                        </div>
                        <svg className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Content Moderation — Admin/HR only ── */}
        {canManage && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  </div>
                  <CardTitle className="text-sm font-semibold text-[#0F172A]">Flagged Messages</CardTitle>
                </div>
                <button className="text-[11px] text-[#2E86C1] font-medium hover:underline">View All</button>
              </div>
            </CardHeader>
            <CardContent>
              {moderationStats && (
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="bg-[#F8FAFC] rounded-lg p-3 text-center"><p className="text-lg font-bold text-[#0F172A]">{moderationStats.total}</p><p className="text-[11px] text-[#64748B]">Total Flagged</p></div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-lg font-bold text-amber-700">{moderationStats.pending}</p><p className="text-[11px] text-[#64748B]">Pending Review</p></div>
                  <div className="bg-[#F8FAFC] rounded-lg p-3 text-center"><p className="text-lg font-bold text-[#0F172A]">{thisWeekCount}</p><p className="text-[11px] text-[#64748B]">This Week</p></div>
                </div>
              )}
              {moderationLoading ? (
                <div className="flex items-center justify-center py-6"><svg className="animate-spin h-5 w-5 text-[#2E86C1]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
              ) : flaggedMessages.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2"><svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  <p className="text-[13px] font-medium text-[#334155]">No flagged messages</p>
                  <p className="text-xs text-[#94A3B8] mt-1">All conversations are clean</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {flaggedMessages.slice(0, 5).map(msg => (
                    <div key={msg._id} className={`flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] border-l-[3px] ${msg.severity === "critical" ? "border-l-red-500" : msg.severity === "warning" ? "border-l-amber-500" : "border-l-blue-400"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-[#0F172A]">{resolveName(msg.senderId, msg.senderName)}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${severityBadge(msg.severity)}`}>{msg.severity}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusBadge(msg.status)}`}>{msg.status}</span>
                        </div>
                        <p className="text-[12px] text-red-700 bg-red-50 rounded px-2 py-1 truncate max-w-[500px]">{msg.content.length > 120 ? msg.content.slice(0, 120) + "..." : msg.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] text-[#94A3B8]">{msg.reason}</span>
                          <span className="text-[11px] text-[#94A3B8]">{timeAgo(msg.createdAt)}</span>
                        </div>
                      </div>
                      {msg.status === "pending" && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => handleReview(msg._id, "reviewed")} className="text-[11px] text-[#2E86C1] font-medium hover:underline px-2 py-1 rounded hover:bg-blue-50 transition-colors">Review</button>
                          <button onClick={() => handleReview(msg._id, "dismissed")} className="text-[11px] text-[#94A3B8] font-medium hover:underline px-2 py-1 rounded hover:bg-gray-100 transition-colors">Dismiss</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
