"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { leaveApi, attendanceApi } from "@/lib/api";
import type { Leave, Attendance } from "@/lib/api";

// ── Types ──

type ViewMode = "month" | "week";
type FilterMode = "all" | "leaves" | "attendance";

interface CalendarEvent {
  id: string;
  type: "leave" | "attendance";
  title: string;
  date: string;
  color: string;
  bgColor: string;
  raw: Leave | Attendance;
}

interface DayCell {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
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
  // Monday=0, Sunday=6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  // Previous month trailing days
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    cells.push({
      date: d,
      dayNumber: prevMonthDays - i,
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      events: [],
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({
      date: d,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: isSameDay(d, today),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      events: [],
    });
  }

  // Next month leading days to fill grid (always 6 rows = 42 cells)
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month + 1, day);
    cells.push({
      date: d,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      events: [],
    });
  }

  return cells;
}

function getWeekDays(year: number, month: number, weekStart: Date): DayCell[] {
  const today = new Date();
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    cells.push({
      date: d,
      dayNumber: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: isSameDay(d, today),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      events: [],
    });
  }
  return cells;
}

function getWeekStartForDate(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
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
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch data when month/year changes
  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [leavesRes, attendanceRes] = await Promise.allSettled([
        leaveApi.getMy(),
        attendanceApi.getToday(),
      ]);

      if (leavesRes.status === "fulfilled" && leavesRes.value.data) {
        setLeaves(Array.isArray(leavesRes.value.data) ? leavesRes.value.data : []);
      }
      if (attendanceRes.status === "fulfilled" && attendanceRes.value.data) {
        setTodayAttendance(attendanceRes.value.data as Attendance);
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

    // Leaves — expand each leave across its date range
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

    // Today's attendance
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

    return result;
  }, [tasks, leaves, todayAttendance, filter]);

  // Map events onto calendar grid
  const grid = useMemo(() => {
    const cells = view === "month" ? getMonthGrid(year, month) : getWeekDays(year, month, weekStart);

    // Group events by date key
    const eventsMap = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const key = ev.date;
      if (!eventsMap.has(key)) eventsMap.set(key, []);
      eventsMap.get(key)!.push(ev);
    });

    cells.forEach((cell) => {
      const key = formatDateKey(cell.date);
      cell.events = eventsMap.get(key) || [];
    });

    return cells;
  }, [year, month, view, weekStart, events]);

  // Navigation
  function goToPrev() {
    if (view === "month") {
      if (month === 0) { setMonth(11); setYear(year - 1); }
      else setMonth(month - 1);
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
      if (month === 11) { setMonth(0); setYear(year + 1); }
      else setMonth(month + 1);
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

  // Title
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

      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Calendar</h1>
            <p className="text-[13px] text-[#64748B] mt-1">View your tasks, leaves, and attendance at a glance.</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-5">
          {/* Month/Year navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrev}
              className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-[15px] font-semibold text-[#0F172A] min-w-[200px] text-center">{headerTitle}</h2>
            <button
              onClick={goToNext}
              className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="ml-1 px-3 h-8 rounded-lg border border-[#E2E8F0] text-[13px] font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-[#F1F5F9] rounded-lg p-0.5">
              {(["month", "week"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    if (v === "week") setWeekStart(getWeekStartForDate(new Date(year, month, 1)));
                  }}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    view === v ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
                  }`}
                >
                  {v === "month" ? "Month" : "Week"}
                </button>
              ))}
            </div>

            {/* Filter */}
            <div className="flex items-center bg-[#F1F5F9] rounded-lg p-0.5">
              {([
                { key: "all", label: "All" },
                { key: "leaves", label: "Leaves" },
                { key: "attendance", label: "Attendance" },
              ] as { key: FilterMode; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    filter === f.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
          {/* Day header row */}
          <div className="grid grid-cols-7 bg-[#F8FAFC]">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-3 py-2.5 text-xs font-semibold text-[#64748B] text-center border-b border-[#E2E8F0]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {grid.map((cell, idx) => {
              const visibleEvents = cell.events.slice(0, MAX_VISIBLE_EVENTS);
              const overflowCount = cell.events.length - MAX_VISIBLE_EVENTS;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(cell)}
                  className={`${view === "month" ? "min-h-[100px]" : "min-h-[180px]"} p-1.5 text-left border-r border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC] ${
                    cell.isWeekend ? "bg-[#FAFBFC]" : "bg-white"
                  } ${!cell.isCurrentMonth ? "opacity-40" : ""} ${
                    idx % 7 === 6 ? "border-r-0" : ""
                  }`}
                >
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={`inline-flex items-center justify-center text-[13px] ${
                        cell.isToday
                          ? "w-7 h-7 rounded-full bg-[#2E86C1] text-white font-semibold"
                          : "w-7 h-7 font-medium text-[#334155]"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {visibleEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md truncate ${ev.bgColor} ${ev.color} font-medium`}
                      >
                        {ev.type === "attendance" ? (
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${ev.title === "Present" ? "bg-emerald-500" : "bg-red-500"}`} />
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

        {/* Loading overlay */}
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
            <span className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
            <span className="text-xs text-[#64748B]">Tasks</span>
          </div>
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
        </div>
      </main>

      {/* Day detail popover/panel */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  {selectedDay.date.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {selectedDay.events.length} event{selectedDay.events.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
              {selectedDay.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#334155]">No events</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Nothing scheduled for this day</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDay.events.map((ev) => (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-lg border ${
                        ev.type === "task"
                          ? "border-blue-200 bg-blue-50"
                          : ev.type === "leave"
                          ? "border-emerald-200 bg-emerald-50"
                          : ev.title === "Present"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            ev.type === "task"
                              ? "bg-blue-100 text-blue-600"
                              : ev.type === "leave"
                              ? "bg-emerald-100 text-emerald-600"
                              : ev.title === "Present"
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {ev.type === "task" && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#0F172A] truncate">{ev.title}</p>
                          <p className="text-xs text-[#64748B] mt-0.5 capitalize">
                            {ev.type === "task" && `Priority: ${(ev.raw as Task).priority} | Status: ${(ev.raw as Task).status}`}
                            {ev.type === "leave" && `${(ev.raw as Leave).totalDays} day(s) | ${(ev.raw as Leave).status}`}
                            {ev.type === "attendance" && (
                              (ev.raw as Attendance).checkInTime
                                ? `Checked in: ${new Date((ev.raw as Attendance).checkInTime!).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                : "No check-in recorded"
                            )}
                          </p>
                        </div>

                        {/* Type badge */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                            ev.type === "task"
                              ? "bg-blue-100 text-blue-700"
                              : ev.type === "leave"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {ev.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
