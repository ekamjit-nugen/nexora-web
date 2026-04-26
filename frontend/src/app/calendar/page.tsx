"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { leaveApi, attendanceApi, meetingApi, hrApi, Meeting } from "@/lib/api";
import type { Leave, Attendance, Employee } from "@/lib/api";
import { toast } from "sonner";

// ── Types ──

type ViewMode = "month" | "week";
type FilterMode = "all" | "leaves" | "attendance" | "meetings";

interface CalendarEvent {
  id: string;
  type: "leave" | "attendance" | "meeting";
  title: string;
  date: string;
  color: string;
  bgColor: string;
  raw: Leave | Attendance | Meeting;
}

interface DayCell {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
}

interface ScheduleForm {
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  participantIds: string[];
  recordingEnabled: boolean;
}

// ── Helpers ──

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEAVE_LABELS: Record<string, string> = {
  casual_leave: "CL",
  sick_leave: "SL",
  earned_leave: "EL",
  maternity_leave: "ML",
  paternity_leave: "PL",
  bereavement_leave: "BL",
  comp_off: "CO",
  lop: "LOP",
  wfh: "WFH",
};

function getLeaveLabel(leaveType: string): string {
  return LEAVE_LABELS[leaveType] || leaveType.slice(0, 2).toUpperCase();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number): DayCell[] {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    cells.push({ date: d, dayNumber: prevMonthDays - i, isCurrentMonth: false, isToday: isSameDay(d, today), isWeekend: d.getDay() === 0 || d.getDay() === 6, events: [] });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, dayNumber: day, isCurrentMonth: true, isToday: isSameDay(d, today), isWeekend: d.getDay() === 0 || d.getDay() === 6, events: [] });
  }

  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month + 1, day);
    cells.push({ date: d, dayNumber: day, isCurrentMonth: false, isToday: isSameDay(d, today), isWeekend: d.getDay() === 0 || d.getDay() === 6, events: [] });
  }

  return cells;
}

function getWeekDays(year: number, month: number, weekStart: Date): DayCell[] {
  const today = new Date();
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    cells.push({ date: d, dayNumber: d.getDate(), isCurrentMonth: d.getMonth() === month, isToday: isSameDay(d, today), isWeekend: d.getDay() === 0 || d.getDay() === 6, events: [] });
  }
  return cells;
}

function getWeekStartForDate(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// ── Component ──

export default function CalendarPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<ViewMode>("month");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [weekStart, setWeekStart] = useState(() => getWeekStartForDate(today));

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  // Schedule meeting modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    title: "",
    description: "",
    date: "",
    time: "10:00",
    durationMinutes: 60,
    participantIds: [],
    recordingEnabled: false,
  });
  const [participantSearch, setParticipantSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [leavesRes, attendanceRes, meetingsRes, employeesRes] = await Promise.allSettled([
        leaveApi.getMy(),
        attendanceApi.getToday(),
        meetingApi.list(),
        hrApi.getEmployees(),
      ]);

      if (leavesRes.status === "fulfilled" && leavesRes.value.data) {
        setLeaves(Array.isArray(leavesRes.value.data) ? leavesRes.value.data : []);
      }
      if (attendanceRes.status === "fulfilled" && attendanceRes.value.data) {
        setTodayAttendance(attendanceRes.value.data as Attendance);
      }
      if (meetingsRes.status === "fulfilled" && meetingsRes.value.data) {
        setMeetings(Array.isArray(meetingsRes.value.data) ? meetingsRes.value.data : []);
      }
      if (employeesRes.status === "fulfilled" && employeesRes.value.data) {
        setEmployees(Array.isArray(employeesRes.value.data) ? employeesRes.value.data : []);
      }
    } catch {
      // silently handle
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Build events from data
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    if (filter === "all" || filter === "leaves") {
      leaves.forEach((leave) => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const current = new Date(start);
        while (current <= end) {
          result.push({
            id: `leave-${leave._id}-${formatDateKey(current)}`,
            type: "leave",
            title: `${getLeaveLabel(leave.leaveType)} - ${leave.status}`,
            date: formatDateKey(current),
            color: "text-emerald-700",
            bgColor: "bg-emerald-50",
            raw: leave,
          });
          current.setDate(current.getDate() + 1);
        }
      });
    }

    if (filter === "all" || filter === "attendance") {
      if (todayAttendance) {
        const status = todayAttendance.status?.toLowerCase();
        const isPresent = status === "present" || status === "checked_in" || !!todayAttendance.checkInTime;
        result.push({
          id: `att-${todayAttendance._id}`,
          type: "attendance",
          title: isPresent ? "Present" : "Absent",
          date: todayAttendance.date?.split("T")[0] || formatDateKey(today),
          color: isPresent ? "text-emerald-700" : "text-red-700",
          bgColor: isPresent ? "bg-emerald-50" : "bg-red-50",
          raw: todayAttendance,
        });
      }
    }

    if (filter === "all" || filter === "meetings") {
      meetings.forEach((meeting) => {
        const date = new Date(meeting.scheduledAt);
        result.push({
          id: `meeting-${meeting._id}`,
          type: "meeting",
          title: meeting.title,
          date: formatDateKey(date),
          color: "text-violet-700",
          bgColor: "bg-violet-50",
          raw: meeting,
        });
      });
    }

    return result;
  }, [leaves, todayAttendance, meetings, filter, today]);

  // Map events onto calendar grid
  const grid = useMemo(() => {
    const cells = view === "month" ? getMonthGrid(year, month) : getWeekDays(year, month, weekStart);
    const eventsMap = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      if (!eventsMap.has(ev.date)) eventsMap.set(ev.date, []);
      eventsMap.get(ev.date)!.push(ev);
    });
    cells.forEach((cell) => {
      cell.events = eventsMap.get(formatDateKey(cell.date)) || [];
    });
    return cells;
  }, [year, month, view, weekStart, events]);

  // Navigation
  function goToPrev() {
    if (view === "month") {
      if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
    } else {
      const prev = new Date(weekStart);
      prev.setDate(prev.getDate() - 7);
      setWeekStart(prev);
      setMonth(prev.getMonth());
      setYear(prev.getFullYear());
    }
  }

  function goToNext() {
    if (view === "month") {
      if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
    } else {
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      setWeekStart(next);
      setMonth(next.getMonth());
      setYear(next.getFullYear());
    }
  }

  function goToToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setWeekStart(getWeekStartForDate(now));
  }

  // Open schedule meeting modal
  function openScheduleModal(date?: Date) {
    const d = date || new Date();
    setScheduleDate(d);
    setScheduleForm({
      title: "",
      description: "",
      date: formatDateKey(d),
      time: "10:00",
      durationMinutes: 60,
      participantIds: [],
      recordingEnabled: false,
    });
    setParticipantSearch("");
    setSelectedDay(null);
    setShowScheduleModal(true);
  }

  async function submitSchedule() {
    if (!scheduleForm.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }
    setScheduleLoading(true);
    try {
      const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}:00`);
      const meeting = await meetingApi.schedule({
        title: scheduleForm.title,
        description: scheduleForm.description || undefined,
        scheduledAt,
        durationMinutes: scheduleForm.durationMinutes,
        participantIds: scheduleForm.participantIds,
        recordingEnabled: scheduleForm.recordingEnabled,
      });
      toast.success("Meeting scheduled!");
      setShowScheduleModal(false);
      if (meeting.data) setMeetings((prev) => [...prev, meeting.data!]);
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule meeting");
    } finally {
      setScheduleLoading(false);
    }
  }

  // Jump to meeting room
  function joinMeeting(meetingId: string) {
    router.push(`/meeting/${meetingId}`);
  }

  async function startAndJoinMeeting(m: Meeting) {
    try {
      if (m.status === "scheduled" && m.hostId === user?._id) {
        await meetingApi.start(m.meetingId);
      }
      router.push(`/meeting/${m.meetingId}`);
    } catch {
      router.push(`/meeting/${m.meetingId}`);
    }
  }

  const headerTitle = view === "month"
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const end = new Date(weekStart);
        end.setDate(weekStart.getDate() + 6);
        if (weekStart.getMonth() === end.getMonth()) {
          return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} - ${end.getDate()}, ${year}`;
        }
        return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${year}`;
      })();

  // Employee search for participant picker
  const filteredEmployees = useMemo(() => {
    if (!participantSearch.trim()) return employees.slice(0, 10);
    const q = participantSearch.toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [employees, participantSearch]);

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

  const MAX_VISIBLE_EVENTS = view === "month" ? 3 : 6;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Calendar</h1>
            <p className="text-[13px] text-[#64748B] mt-1">View leaves, attendance, and meetings. Click a date to schedule.</p>
          </div>
          <button
            onClick={() => openScheduleModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574a9] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Schedule Meeting
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={goToPrev} className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-[15px] font-semibold text-[#0F172A] min-w-[200px] text-center">{headerTitle}</h2>
            <button onClick={goToNext} className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button onClick={goToToday} className="ml-1 px-3 h-8 rounded-lg border border-[#E2E8F0] text-[13px] font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#F1F5F9] rounded-lg p-0.5">
              {(["month", "week"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); if (v === "week") setWeekStart(getWeekStartForDate(new Date(year, month, 1))); }}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${view === v ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                >
                  {v === "month" ? "Month" : "Week"}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-[#F1F5F9] rounded-lg p-0.5">
              {([
                { key: "all", label: "All" },
                { key: "leaves", label: "Leaves" },
                { key: "attendance", label: "Attendance" },
                { key: "meetings", label: "Meetings" },
              ] as { key: FilterMode; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${filter === f.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
          <div className="grid grid-cols-7 bg-[#F8FAFC]">
            {DAYS.map((day) => (
              <div key={day} className="px-3 py-2.5 text-xs font-semibold text-[#64748B] text-center border-b border-[#E2E8F0]">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((cell, idx) => {
              const visibleEvents = cell.events.slice(0, MAX_VISIBLE_EVENTS);
              const overflowCount = cell.events.length - MAX_VISIBLE_EVENTS;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(cell)}
                  className={`${view === "month" ? "min-h-[100px]" : "min-h-[180px]"} p-1.5 text-left border-r border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC] ${cell.isWeekend ? "bg-[#FAFBFC]" : "bg-white"} ${!cell.isCurrentMonth ? "opacity-40" : ""} ${idx % 7 === 6 ? "border-r-0" : ""}`}
                >
                  <div className="flex justify-end mb-1">
                    <span className={`inline-flex items-center justify-center text-[13px] ${cell.isToday ? "w-7 h-7 rounded-full bg-[#2E86C1] text-white font-semibold" : "w-7 h-7 font-medium text-[#334155]"}`}>
                      {cell.dayNumber}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {visibleEvents.map((ev) => (
                      <div key={ev.id} className={`text-[10px] px-1.5 py-0.5 rounded-md truncate ${ev.bgColor} ${ev.color} font-medium`}>
                        {ev.type === "attendance" ? (
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${ev.title === "Present" ? "bg-emerald-500" : "bg-red-500"}`} />
                            {ev.title}
                          </span>
                        ) : ev.type === "meeting" ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                            {ev.title}
                          </span>
                        ) : (
                          ev.title
                        )}
                      </div>
                    ))}
                    {overflowCount > 0 && (
                      <div className="text-[10px] px-1.5 py-0.5 text-[#64748B] font-medium">
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {dataLoading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-5 w-5 text-[#2E86C1]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-5 mt-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
            <span className="text-xs text-[#64748B]">Leaves</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-[#64748B]">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-[#64748B]">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-violet-50 border border-violet-200" />
            <span className="text-xs text-[#64748B]">Meeting</span>
          </div>
        </div>
      </main>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setSelectedDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  {selectedDay.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {selectedDay.events.length} event{selectedDay.events.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openScheduleModal(selectedDay.date)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E86C1] text-white text-xs font-medium hover:bg-[#2574a9] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Schedule Meeting
                </button>
                <button onClick={() => setSelectedDay(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
              {selectedDay.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#334155]">No events</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Click "Schedule Meeting" to add one</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDay.events.map((ev) => {
                    const isMeeting = ev.type === "meeting";
                    const meeting = isMeeting ? (ev.raw as Meeting) : null;
                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-lg border ${
                          isMeeting
                            ? "border-violet-200 bg-violet-50"
                            : ev.type === "leave"
                            ? "border-emerald-200 bg-emerald-50"
                            : ev.title === "Present"
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMeeting ? "bg-violet-100 text-violet-600" : ev.type === "leave" ? "bg-emerald-100 text-emerald-600" : ev.title === "Present" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                            {isMeeting && (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                            {ev.type === "leave" && (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                            )}
                            {ev.type === "attendance" && (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#0F172A] truncate">{ev.title}</p>
                            <p className="text-xs text-[#64748B] mt-0.5">
                              {isMeeting && meeting && (
                                <>
                                  {new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  {" · "}{meeting.durationMinutes}min
                                  {" · "}Hosted by {meeting.hostName}
                                </>
                              )}
                              {ev.type === "leave" && `${(ev.raw as Leave).totalDays} day(s) | ${(ev.raw as Leave).status}`}
                              {ev.type === "attendance" && (
                                (ev.raw as Attendance).checkInTime
                                  ? `Checked in: ${new Date((ev.raw as Attendance).checkInTime!).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                  : "No check-in recorded"
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMeeting && meeting && (
                              <button
                                onClick={() => startAndJoinMeeting(meeting)}
                                className="text-xs px-2.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 font-medium transition-colors whitespace-nowrap"
                              >
                                {meeting.status === "active" ? "Join" : meeting.hostId === user?._id ? "Start" : "Join"}
                              </button>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0 ${isMeeting ? "bg-violet-100 text-violet-700" : ev.type === "leave" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                              {ev.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Schedule Meeting</h3>
              <button onClick={() => setShowScheduleModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[500px] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Title *</label>
                <input
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Meeting title"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2E86C1]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Description</label>
                <textarea
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2E86C1] resize-none"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2E86C1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Time *</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2E86C1]"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Duration</label>
                <select
                  value={scheduleForm.durationMinutes}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2E86C1]"
                >
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>
                  ))}
                </select>
              </div>

              {/* Participants */}
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                  Invite participants ({scheduleForm.participantIds.length} selected)
                </label>
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2E86C1] mb-2"
                />
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {filteredEmployees.map((emp) => {
                    const selected = scheduleForm.participantIds.includes(emp.userId);
                    return (
                      <button
                        key={emp._id}
                        type="button"
                        onClick={() =>
                          setScheduleForm((f) => ({
                            ...f,
                            participantIds: selected
                              ? f.participantIds.filter((id) => id !== emp.userId)
                              : [...f.participantIds, emp.userId],
                          }))
                        }
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${selected ? "bg-[#EBF5FB] border border-[#2E86C1]/30" : "hover:bg-[#F8FAFC]"}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-[#64748B] truncate">{emp.email}</p>
                        </div>
                        {selected && (
                          <svg className="w-4 h-4 text-[#2E86C1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recording */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">Enable recording</p>
                  <p className="text-xs text-[#64748B]">Participants can toggle recording during the meeting</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleForm((f) => ({ ...f, recordingEnabled: !f.recordingEnabled }))}
                  className={`relative inline-flex items-center w-10 h-6 rounded-full transition-colors flex-shrink-0 ${scheduleForm.recordingEnabled ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}
                >
                  <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform ${scheduleForm.recordingEnabled ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#F1F5F9] flex items-center justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                Cancel
              </button>
              <button
                onClick={submitSchedule}
                disabled={scheduleLoading || !scheduleForm.title.trim()}
                className="px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574a9] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {scheduleLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
