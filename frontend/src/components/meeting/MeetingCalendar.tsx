"use client";

import { useState, useEffect, useCallback } from "react";

interface CalendarMeeting {
  _id: string;
  meetingId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  hostName: string;
  status: string;
}

interface MeetingCalendarProps {
  onJoinMeeting: (meetingId: string) => void;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function MeetingCalendar({ onJoinMeeting }: MeetingCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://192.168.29.218:3005";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${API_BASE}/api/v1/meetings?limit=100`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = await res.json();
      setMeetings(data.data || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getMeetingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return meetings.filter(m => m.scheduledAt.startsWith(dateStr));
  };

  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectedMeetings = selectedDate ? getMeetingsForDate(selectedDate) : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <button onClick={goToPrev} className="p-1 hover:bg-slate-100 rounded text-slate-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-800">{MONTH_NAMES[month]} {year}</h3>
        <button onClick={goToNext} className="p-1 hover:bg-slate-100 rounded text-slate-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1.5">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}
        {days.map(day => {
          const dayMeetings = getMeetingsForDate(day);
          const isToday = day.getTime() === today.getTime();
          const isSelected = selectedDate?.getTime() === day.getTime();

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`h-10 flex flex-col items-center justify-center relative text-xs transition-colors
                ${isToday ? "font-bold text-blue-600" : "text-slate-700"}
                ${isSelected ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-slate-50"}
              `}
            >
              {day.getDate()}
              {dayMeetings.length > 0 && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day meetings */}
      {selectedDate && (
        <div className="border-t border-slate-200 px-4 py-2 max-h-40 overflow-y-auto">
          {selectedMeetings.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 text-center">No meetings</p>
          ) : (
            selectedMeetings.map(m => (
              <button
                key={m._id}
                onClick={() => onJoinMeeting(m.meetingId)}
                className="w-full flex items-center justify-between py-1.5 hover:bg-slate-50 rounded px-1 text-left"
              >
                <div>
                  <p className="text-xs font-medium text-slate-800">{m.title}</p>
                  <p className="text-[10px] text-slate-400">{formatTime(m.scheduledAt)} &middot; {m.durationMinutes}min</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  m.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                }`}>{m.status}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
