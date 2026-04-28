"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { attendanceApi, hrApi, policyApi, Attendance, Employee, Policy, Holiday } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AttendanceFilters } from "@/components/AttendanceFilters";
import { RouteGuard } from "@/components/route-guard";

interface TodayData {
  checkedIn: boolean;
  checkedOut: boolean;
  hasOpenSession?: boolean;
  record: Attendance | null;
  totalHoursToday?: number;
  sessionCount?: number;
}

export default function AttendancePage() {
  const { user, loading: authLoading, logout, orgRole } = useAuth();
  const router = useRouter();

  const [today, setToday] = useState<TodayData>({ checkedIn: false, checkedOut: false, record: null });
  const [history, setHistory] = useState<Attendance[]>([]);
  const [allRecords, setAllRecords] = useState<Attendance[]>([]);
  // Default-today filter for the "All" tab. Each change triggers a
  // dedicated re-fetch via the useEffect below — separate from the
  // initial bulk fetchData() so changing filters doesn't reload
  // approvals / employee map / stats.
  const [allFilters, setAllFilters] = useState<{
    startDate?: string; endDate?: string;
    status?: string; search?: string;
    departmentId?: string; managerId?: string;
  }>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  });
  const [pendingApprovals, setPendingApprovals] = useState<Attendance[]>([]);
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, wfh: 0, pendingApprovals: 0 });
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "all" | "approvals" | "holidays">("my");
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split("T")[0],
    checkInTime: "09:00",
    checkOutTime: "18:00",
    reason: "",
    reasonCategory: "forgot",
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Top-level platform roles vs per-tenant orgRole. Admin/owner at the
  // org level (or platform admin) drives "manage attendance, don't track
  // it" — so they get the approvals UI but no Clock In/Out card. HR is
  // a manager role too BUT we let HR clock in (they're individual
  // contributors that also approve), matching the backend's
  // EXCLUDED_ORG_ROLES which only lists admin + owner.
  const isAdmin =
    !!user?.roles?.some((r) => ["admin", "super_admin"].includes(r)) ||
    orgRole === "admin" ||
    orgRole === "owner";
  const isHR = !!user?.roles?.some((r) => ["hr"].includes(r)) || orgRole === "hr";
  const canManage = isAdmin || isHR;
  // Non-trackers manage attendance instead of clocking in. Used to hide
  // the personal clock-in card and the manual-entry CTA.
  const canClockIn = !isAdmin;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Live timer
  useEffect(() => {
    if (today.hasOpenSession && today.record?.checkInTime) {
      const tick = () => {
        const now = new Date();
        const checkIn = new Date(today.record!.checkInTime!);
        const diff = Math.floor((now.getTime() - checkIn.getTime()) / 1000);
        const h = String(Math.floor(diff / 3600)).padStart(2, "0");
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
        const s = String(diff % 60).padStart(2, "0");
        setElapsed(`${h}:${m}:${s}`);
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsed("00:00:00");
    }
  }, [today]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const promises: Promise<unknown>[] = [
        attendanceApi.getToday().catch(() => ({ data: null })),
        attendanceApi.getMy(),
        attendanceApi.getStats(),
        policyApi.getAll({ isTemplate: "false", isActive: "true" }).catch(() => ({ data: [] })),
      ];
      // Admin/HR: also fetch all records, pending approvals, and employee names
      if (canManage) {
        promises.push(attendanceApi.getAll());
        promises.push(attendanceApi.getPendingApprovals());
        promises.push(hrApi.getEmployees({ limit: "100" }));
      }

      const results = await Promise.all(promises);

      const todayData = (results[0] as { data: TodayData | null }).data;
      setToday(todayData || { checkedIn: false, checkedOut: false, record: null });
      setHistory(((results[1] as { data: Attendance[] }).data) || []);
      const statsData = (results[2] as { data: typeof stats }).data;
      if (statsData) setStats(statsData);

      // Get active policy (first non-template active policy)
      const policiesData = ((results[3] as { data: Policy[] }).data) || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workPolicy = policiesData.find((p: any) => p.type === "work_timing" || p.category === "working_hours") || policiesData[0] || null;
      setActivePolicy(workPolicy);

      if (canManage && results[4]) {
        // Initial load uses the default (today) filter via the
        // re-fetch effect below; this just seeds while that runs.
        setAllRecords(((results[4] as { data: Attendance[] }).data) || []);
      }
      if (canManage && results[5]) {
        setPendingApprovals(((results[5] as { data: Attendance[] }).data) || []);
      }
      if (canManage && results[6]) {
        const employees = ((results[6] as { data: Employee[] }).data) || [];
        const map: Record<string, string> = {};
        for (const emp of employees) {
          map[emp.userId] = `${emp.firstName} ${emp.lastName}`;
          map[emp._id] = `${emp.firstName} ${emp.lastName}`;
        }
        setEmployeeMap(map);
      }
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  // Set default tab for admin/HR
  useEffect(() => {
    if (canManage && !loading) {
      setActiveTab(isAdmin ? "all" : "my");
    }
  }, [canManage, isAdmin, loading]);

  // Best-effort browser geolocation. Wraps navigator.geolocation in a
  // promise with a hard 7-second cap — some browsers (especially
  // Firefox on hardware without GPS) hang the prompt indefinitely
  // while the permission dialog sits, so falling back to "no location"
  // after 7s keeps the clock-in interaction snappy. Resolves null on
  // any failure (permission denied, timeout, no support); the backend
  // stores nulls cleanly.
  const captureLocation = (): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 7000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 },
      );
    });
  };

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const location = await captureLocation();
      await attendanceApi.checkIn(location ? { location } : undefined);
      if (location) {
        toast.success(`Clocked in (location captured, ±${Math.round(location.accuracy || 0)}m)`);
      } else {
        toast.success("Clocked in (no location — permission denied or unavailable)");
      }
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Clock-in failed");
    } finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      const location = await captureLocation();
      await attendanceApi.checkOut(location ? { location } : undefined);

      // Check if total hours meet policy minimum
      const updatedToday = await attendanceApi.getToday().catch(() => ({ data: null }));
      const todayInfo = updatedToday.data as unknown as TodayData | null;
      const totalToday = todayInfo?.totalHoursToday || 0;

      if (totalToday < policyMinHours) {
        toast.error("Clocked out with " + totalToday.toFixed(1) + "h - below " + policyMinHours + "h policy minimum");
      } else {
        toast.success("Clocked out - " + totalToday.toFixed(1) + "h today");
      }
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Clock-out failed");
    } finally { setActionLoading(false); }
  };

  const handleManualEntry = async () => {
    if (!manualForm.date || !manualForm.checkInTime || !manualForm.checkOutTime) {
      toast.error("Please select date and times"); return;
    }
    const reason = manualForm.reason || manualForm.reasonCategory.replace("_", " ");
    try {
      setActionLoading(true);
      await attendanceApi.manualEntry({
        date: manualForm.date,
        checkInTime: manualForm.checkInTime,
        checkOutTime: manualForm.checkOutTime,
        reason,
      });
      toast.success("Manual entry submitted for approval");
      setShowManualEntry(false);
      setManualForm({ date: new Date().toISOString().split("T")[0], checkInTime: "09:00", checkOutTime: "18:00", reason: "", reasonCategory: "forgot" });
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally { setActionLoading(false); }
  };

  const handleApproval = async (id: string, approved: boolean) => {
    try {
      setActionLoading(true);
      await attendanceApi.approveEntry(id, { approved });
      toast.success(`Entry ${approved ? "approved" : "rejected"}`);
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally { setActionLoading(false); }
  };

  const manualHoursPreview = (() => {
    if (!manualForm.checkInTime || !manualForm.checkOutTime) return null;
    const [h1, m1] = manualForm.checkInTime.split(":").map(Number);
    const [h2, m2] = manualForm.checkOutTime.split(":").map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    return mins > 0 ? (mins / 60).toFixed(1) : null;
  })();

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const formatTime = (iso?: string) => !iso ? "--:--" : new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const formatHours = (h?: number) => h != null ? `${h.toFixed(1)}h` : "--";

  // Policy-derived thresholds (fallback to defaults if no policy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wt = (activePolicy as any)?.workTiming || {};
  const policyMinHours: number = wt.minWorkingHours || 8;
  const policyStartTime: string = wt.startTime || "09:00";
  const policyEndTime: string = wt.endTime || "18:00";
  const halfDayThreshold = policyMinHours / 2;

  const approvalColors: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  const tabs = [
    ...(!isAdmin ? [{ key: "my" as const, label: "My Attendance" }] : []),
    ...(canManage ? [
      { key: "all" as const, label: "All Employees" },
      { key: "approvals" as const, label: `Pending Approvals${stats.pendingApprovals > 0 ? ` (${stats.pendingApprovals})` : ""}` },
      // Holiday calendar is admin-write, open-read. Lives here as a tab
      // so it's one click from the attendance flow that consumes it.
      { key: "holidays" as const, label: "Holidays" },
    ] : []),
  ];

  // Re-fetch the "All" tab whenever filters change. Only fires when
  // the "all" tab is active to avoid wasted network on the "my" tab.
  useEffect(() => {
    if (!canManage || activeTab !== "all") return;
    const params: Record<string, string> = {};
    Object.entries(allFilters).forEach(([k, v]) => {
      if (v) params[k] = String(v);
    });
    let alive = true;
    attendanceApi.getAll(params).then((r: any) => {
      if (alive) setAllRecords(r?.data || []);
    }).catch(() => { /* swallowed; toast is too noisy on filter typing */ });
    return () => { alive = false; };
  }, [allFilters, activeTab, canManage]);

  const currentRecords = activeTab === "all" ? allRecords : activeTab === "approvals" ? pendingApprovals : history;
  const showEmployeeCol = activeTab === "all" || activeTab === "approvals";

  return (
    <RouteGuard minOrgRole="member">
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Attendance</h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              {canManage ? "Manage team attendance and approve manual entries" : "Track your daily clock-in and working hours"}
            </p>
          </div>
          {!isAdmin && (
            <Button onClick={() => setShowManualEntry(!showManualEntry)} variant="outline"
              className="h-10 border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] rounded-xl">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manual Entry
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <>
            {/* Clock-in card for non-admin */}
            {!isAdmin && (
              <Card className="border-0 shadow-sm mb-6">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${today.hasOpenSession ? "bg-emerald-50" : today.checkedIn ? "bg-blue-50" : "bg-gray-50"}`}>
                        {today.hasOpenSession ? (
                          <span className="text-base font-bold text-emerald-700 font-mono tabular-nums">{elapsed.slice(0, 5)}</span>
                        ) : (
                          <svg className={`w-6 h-6 ${today.checkedIn ? "text-blue-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {today.hasOpenSession && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Clocked In
                            </span>
                          )}
                          {today.checkedIn && !today.hasOpenSession && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">Clocked Out</span>
                          )}
                          {!today.checkedIn && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">Not clocked in</span>
                          )}
                          {(today.sessionCount || 0) > 1 && (
                            <span className="text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">{today.sessionCount} sessions</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[13px] text-[#64748B]">
                          <span>In: <span className="font-medium text-[#0F172A]">{formatTime(today.record?.checkInTime)}</span></span>
                          <span>Out: <span className="font-medium text-[#0F172A]">{formatTime(today.record?.checkOutTime)}</span></span>
                          <span>Total: <span className="font-medium text-[#0F172A]">{today.hasOpenSession ? elapsed : formatHours(today.totalHoursToday)}</span></span>
                          <span className="text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                            Policy: {policyStartTime}–{policyEndTime} · {policyMinHours}h min
                          </span>
                        </div>
                        {/* Overtime warning */}
                        {today.hasOpenSession && today.totalHoursToday && today.totalHoursToday > policyMinHours && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-[11px] font-medium text-amber-600">
                              Overtime: {((today.totalHoursToday || 0) - policyMinHours).toFixed(1)}h beyond {policyMinHours}h policy
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      {today.hasOpenSession ? (
                        <Button onClick={handleCheckOut} disabled={actionLoading} className="h-10 bg-red-500 hover:bg-red-600 text-white font-medium px-6 rounded-xl text-sm">
                          {actionLoading ? <Spinner /> : "Clock Out"}
                        </Button>
                      ) : (
                        <Button onClick={handleCheckIn} disabled={actionLoading} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 rounded-xl text-sm">
                          {actionLoading ? <Spinner /> : "Clock In"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Entry Form */}
            {showManualEntry && !isAdmin && (
              <Card className="border-0 shadow-sm mb-6 border-l-4 border-l-[#2E86C1]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A]">Add Manual Entry</h3>
                      <p className="text-xs text-[#94A3B8]">Requires HR/Admin approval</p>
                    </div>
                    <button onClick={() => setShowManualEntry(false)} className="text-[#94A3B8] hover:text-[#64748B]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">Date</Label>
                      <Input type="date" value={manualForm.date} max={new Date().toISOString().split("T")[0]}
                        onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0]" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">Clock In</Label>
                      <div className="flex items-center gap-1.5">
                        <Input type="time" value={manualForm.checkInTime} onChange={e => setManualForm(f => ({ ...f, checkInTime: e.target.value }))} className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0] flex-1" />
                        {["09:00", "09:30", "10:00"].map(t => (
                          <button key={t} onClick={() => setManualForm(f => ({ ...f, checkInTime: t }))}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${manualForm.checkInTime === t ? "bg-[#2E86C1] text-white border-[#2E86C1]" : "bg-white text-[#94A3B8] border-[#E2E8F0] hover:border-[#94A3B8]"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-[#475569]">Clock Out</Label>
                      <div className="flex items-center gap-1.5">
                        <Input type="time" value={manualForm.checkOutTime} onChange={e => setManualForm(f => ({ ...f, checkOutTime: e.target.value }))} className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0] flex-1" />
                        {["17:00", "18:00", "19:00"].map(t => (
                          <button key={t} onClick={() => setManualForm(f => ({ ...f, checkOutTime: t }))}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${manualForm.checkOutTime === t ? "bg-[#2E86C1] text-white border-[#2E86C1]" : "bg-white text-[#94A3B8] border-[#E2E8F0] hover:border-[#94A3B8]"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {manualHoursPreview && (
                    <div className="bg-[#F1F5F9] rounded-lg px-3 py-2 mb-4 text-sm text-[#334155]">
                      Total: <span className="font-semibold">{manualHoursPreview}h</span>
                      <span className="text-[#94A3B8] ml-2">({manualForm.checkInTime} → {manualForm.checkOutTime})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <select value={manualForm.reasonCategory} onChange={e => setManualForm(f => ({ ...f, reasonCategory: e.target.value }))}
                      className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]">
                      <option value="forgot">Forgot to clock in/out</option>
                      <option value="system_down">System was down</option>
                      <option value="network_issue">Network issue</option>
                      <option value="wfh">Worked from home</option>
                      <option value="other">Other</option>
                    </select>
                    <Input placeholder="Additional notes (optional)" value={manualForm.reason}
                      onChange={e => setManualForm(f => ({ ...f, reason: e.target.value }))} className="h-9 text-sm rounded-lg bg-[#F8FAFC] border-[#E2E8F0]" />
                  </div>
                  <Button onClick={handleManualEntry} disabled={actionLoading} className="h-9 bg-[#2E86C1] hover:bg-[#2471A3] text-white text-sm rounded-lg px-5">
                    {actionLoading ? "Submitting..." : "Submit for Approval"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Present", value: stats.present, colorName: "emerald", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "Late", value: stats.late, colorName: "amber", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "Absent", value: stats.absent, colorName: "red", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "WFH", value: stats.wfh, colorName: "blue", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
                { label: "Pending Approvals", value: stats.pendingApprovals, colorName: "violet", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
              ].map(s => (
                <Card key={s.label} className="border-0 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-${s.colorName}-50 rounded-bl-[60px] -mr-2 -mt-2`} />
                  <CardContent className="p-5 relative">
                    <div className={`w-8 h-8 rounded-lg bg-${s.colorName}-100 flex items-center justify-center mb-3`}>
                      <svg className={`w-4 h-4 text-${s.colorName}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-[#0F172A]">{s.value}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            {tabs.length > 1 && (
              <div className="flex gap-1 mb-4 bg-[#F1F5F9] rounded-lg p-1 w-fit">
                {tabs.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Holiday calendar tab — conditionally rendered before the
                records table to keep the table markup untouched. */}
            {activeTab === "holidays" && (
              <HolidayCalendarTab canWrite={!!canManage} />
            )}

            {/* Filter bar — only on the "All Records" tab for HR/admin/owner.
                Default = today; role-aware (privileged sees dept + manager). */}
            {activeTab === "all" && canManage && (
              <div className="mb-4">
                <AttendanceFilters
                  privileged={canManage}
                  value={allFilters}
                  onChange={(next) => setAllFilters(next)}
                />
              </div>
            )}

            {/* Records Table */}
            {activeTab !== "holidays" && (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] bg-[#FAFBFC]">
                      {showEmployeeCol && <TH>Employee</TH>}
                      <TH>Date</TH>
                      <TH>Clock In</TH>
                      <TH>Clock Out</TH>
                      <TH>Duration</TH>
                      <TH>Method</TH>
                      <TH>Source</TH>
                      <TH>Type</TH>
                      {activeTab === "approvals" ? <TH>Actions</TH> : <TH>Approval</TH>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.length === 0 ? (
                      <tr>
                        <td colSpan={showEmployeeCol ? 9 : 8} className="text-center py-12 text-[13px] text-[#94A3B8]">
                          {activeTab === "approvals" ? "No pending approvals" : "No attendance records"}
                        </td>
                      </tr>
                    ) : currentRecords.map((r) => {
                      const hrs = r.totalWorkingHours || 0;
                      const pct = Math.min((hrs / (policyMinHours + 1)) * 100, 100);
                      const barColor = hrs >= policyMinHours ? "bg-emerald-500" : hrs >= halfDayThreshold ? "bg-blue-500" : hrs > 0 ? "bg-amber-500" : "bg-gray-200";
                      const isOpen = r.checkInTime && !r.checkOutTime;
                      return (
                      <tr key={r._id} className="border-b border-[#F8FAFC] hover:bg-[#FAFBFC]">
                        {showEmployeeCol && (
                          <td className="px-4 py-3 text-[13px] text-[#334155] font-medium">
                            {employeeMap[r.employeeId] || r.employeeId?.slice(-6) || "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-[13px] font-medium text-[#0F172A]">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDate(r.date)}</span>
                            {/* Night-shift chip — resolved at clock-in
                                from the employee's applicable policy.
                                Silent until #9; surface it so the row
                                is visually distinct (matters for OT
                                premium clarity). */}
                            {r.isNightShift && (
                              <span title="This record is on a night shift — OT hours get the night multiplier" className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                🌙 Night
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#334155]">
                          <div className="flex items-center gap-1.5">
                            <span>{formatTime(r.checkInTime)}</span>
                            {r.isLateArrival && (r.lateByMinutes ?? 0) > 0 && (
                              <span title={`Late by ${r.lateByMinutes} min vs shift start`} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                +{r.lateByMinutes}m late
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#334155]">
                          {isOpen ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Active
                            </span>
                          ) : formatTime(r.checkOutTime)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono font-medium text-[#334155] w-10 text-right">{formatHours(hrs)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-[#64748B] capitalize">{r.checkInMethod || "web"}</span>
                        </td>
                        <td className="px-4 py-3">
                          {/* Source = IP + geolocation captured at clock-in.
                              IP comes from the gateway (always); location
                              from navigator.geolocation (only when the user
                              grants permission). The map pin links to a
                              Google Maps lookup when present, otherwise
                              we badge "no location" so admins can see who
                              declined to share. */}
                          <div className="flex flex-col gap-0.5">
                            {r.checkInIP ? (
                              <span title={`Check-in IP: ${r.checkInIP}`} className="text-[11px] font-mono text-[#64748B] truncate max-w-[120px]">{r.checkInIP}</span>
                            ) : (
                              <span className="text-[11px] text-[#CBD5E1]">—</span>
                            )}
                            {r.checkInLocation ? (
                              <a
                                href={`https://maps.google.com/?q=${r.checkInLocation.latitude},${r.checkInLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`${r.checkInLocation.latitude.toFixed(5)}, ${r.checkInLocation.longitude.toFixed(5)}${r.checkInLocation.accuracy ? ` (±${Math.round(r.checkInLocation.accuracy)}m)` : ""}`}
                                className="text-[10px] text-[#2E86C1] hover:underline flex items-center gap-0.5"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {r.checkInLocation.latitude.toFixed(3)}, {r.checkInLocation.longitude.toFixed(3)}
                              </a>
                            ) : (
                              <span title="Location not captured (permission denied or unavailable)" className="text-[10px] text-[#CBD5E1]">no location</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {r.entryType === "manual" ? (
                            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Manual</span>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">System</span>
                          )}
                          {r.notes && <p className="text-[10px] text-[#94A3B8] mt-0.5 truncate max-w-[120px]" title={r.notes}>{r.notes}</p>}
                        </td>
                        {activeTab === "approvals" ? (
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApproval(r._id, true)} disabled={actionLoading}
                                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleApproval(r._id, false)} disabled={actionLoading}
                                className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-md">
                                Reject
                              </Button>
                            </div>
                          </td>
                        ) : (
                          <td className="px-4 py-3">
                            {r.entryType === "manual" && r.approvalStatus ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${approvalColors[r.approvalStatus] || ""}`}>
                                {r.approvalStatus}
                              </span>
                            ) : (
                              <span className="text-xs text-[#CBD5E1]">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            )}
          </>
        )}
      </main>
    </div>
    </RouteGuard>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-4 py-3">{children}</th>;
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/**
 * HolidayCalendarTab — admin declares holidays that drive LOP + OT
 * classification downstream. Year picker filters; add-row inline;
 * delete is inline. Deliberately no bulk-import yet — most orgs declare
 * 8-12 holidays a year, so form friction isn't worth the complexity.
 */
function HolidayCalendarTab({ canWrite }: { canWrite: boolean }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ date: string; name: string; type: Holiday["type"]; description: string }>({
    date: "",
    name: "",
    type: "national",
    description: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.listHolidays(year);
      setHolidays((res?.data as Holiday[] | undefined) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load holidays";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const addHoliday = async () => {
    if (!form.date) { toast.error("Date is required"); return; }
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setCreating(true);
    try {
      await attendanceApi.createHoliday({
        date: form.date,
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
      });
      toast.success("Holiday added");
      setForm({ date: "", name: "", type: "national", description: "" });
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add holiday";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const deleteHoliday = async (h: Holiday) => {
    if (!window.confirm(`Delete holiday "${h.name}" on ${h.date.slice(0, 10)}?`)) return;
    try {
      await attendanceApi.deleteHoliday(h._id);
      toast.success("Holiday deleted");
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete holiday";
      toast.error(msg);
    }
  };

  // Year selector range: prior 2 → next 2 years. Covers planning + audit.
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const typeColor: Record<Holiday["type"], string> = {
    national: "bg-blue-50 text-blue-700 border-blue-200",
    regional: "bg-violet-50 text-violet-700 border-violet-200",
    optional: "bg-amber-50 text-amber-700 border-amber-200",
    bank: "bg-slate-50 text-slate-700 border-slate-200",
    other: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[#F1F5F9] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">Holiday calendar</h3>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            Declared holidays reclassify absent-on-holiday records as paid
            (no LOP) and route OT hours to the holiday multiplier.
          </p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[13px]"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {canWrite && (
        <div className="p-5 border-b border-[#F1F5F9] bg-[#FAFBFC]">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <label className="block text-[11px] text-[#64748B] mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full h-9 rounded-md border border-[#E2E8F0] bg-white px-2 text-[13px]"
              />
            </div>
            <div className="col-span-4">
              <label className="block text-[11px] text-[#64748B] mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Republic Day"
                className="w-full h-9 rounded-md border border-[#E2E8F0] bg-white px-2 text-[13px]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-[#64748B] mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Holiday["type"] }))}
                className="w-full h-9 rounded-md border border-[#E2E8F0] bg-white px-2 text-[13px]"
              >
                <option value="national">National</option>
                <option value="regional">Regional</option>
                <option value="optional">Optional</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-[#64748B] mb-1">Note (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                className="w-full h-9 rounded-md border border-[#E2E8F0] bg-white px-2 text-[13px]"
              />
            </div>
            <div className="col-span-1">
              <Button onClick={addHoliday} disabled={creating} className="h-9 w-full text-[13px] bg-[#2E86C1] hover:bg-[#2471A3]">
                {creating ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div>
        {loading ? (
          <div className="p-8 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : holidays.length === 0 ? (
          <div className="p-8 text-center text-[#94A3B8] text-[13px]">
            No holidays declared for {year}.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#FAFBFC]">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Date</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Day</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Name</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Type</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Note</th>
                {canWrite && <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Action</th>}
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => {
                const d = new Date(h.date);
                const dayOfWeek = d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
                const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
                return (
                  <tr key={h._id} className="border-b border-[#F8FAFC] hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3 font-medium text-[#0F172A]">{dateStr}</td>
                    <td className="px-5 py-3 text-[#64748B]">{dayOfWeek}</td>
                    <td className="px-5 py-3 text-[#0F172A]">{h.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${typeColor[h.type]}`}>
                        {h.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#64748B]">{h.description || "—"}</td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteHoliday(h)}
                          className="text-[12px] font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </Card>
  );
}
