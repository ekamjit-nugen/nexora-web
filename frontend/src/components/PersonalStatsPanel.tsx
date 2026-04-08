"use client";

import { useEffect, useState } from "react";
import { taskApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

type PersonalStats = NonNullable<
  Awaited<ReturnType<typeof taskApi.getMyStats>>["data"]
>;

function TrendBadge({
  value,
  invertColor = false,
}: {
  value: number;
  invertColor?: boolean;
}) {
  if (value === 0) return null;
  const isPositive = value > 0;
  // For cycle time, lower is better so invert the color logic
  const isGood = invertColor ? !isPositive : isPositive;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        isGood
          ? "bg-emerald-50 text-emerald-600"
          : "bg-red-50 text-red-600"
      }`}
    >
      {isPositive ? "\u2191" : "\u2193"}
      {Math.abs(value)}%
    </span>
  );
}

function StreakDots({ stats }: { stats: PersonalStats }) {
  // Generate last 10 workdays visual
  const dots: boolean[] = [];
  const now = new Date();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  while (count < 10) {
    if (date.getDay() >= 1 && date.getDay() <= 5) {
      // A workday - check if within streak range
      // We approximate: the streak.currentDays most recent workdays are active
      dots.unshift(count < stats.streak.currentDays);
      count++;
    }
    date.setDate(date.getDate() - 1);
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      {dots.map((active, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${
            active ? "bg-emerald-400" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function CircularProgress({
  percentage,
  size = 56,
}: {
  percentage: number;
  size?: number;
}) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#2E86C1"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

function WeeklyPulse({ stats }: { stats: PersonalStats }) {
  const parts: string[] = [];
  const tw = stats.thisWeek;
  const trends = stats.trends;

  if (tw.tasksCompleted > 0) {
    let msg = `You closed ${tw.tasksCompleted} task${tw.tasksCompleted !== 1 ? "s" : ""} this week`;
    if (trends.tasksCompletedChange !== 0) {
      msg += ` (${trends.tasksCompletedChange > 0 ? "up" : "down"} ${Math.abs(trends.tasksCompletedChange)}%)`;
    }
    parts.push(msg);
  } else {
    parts.push("No tasks closed this week yet");
  }

  if (tw.avgCycleTimeDays > 0) {
    parts.push(
      `Your avg cycle time ${trends.cycleTimeChange < 0 ? "improved" : "is"} ${tw.avgCycleTimeDays} day${tw.avgCycleTimeDays !== 1 ? "s" : ""}`
    );
  }

  if (tw.hoursLogged > 0) {
    parts.push(`You logged ${tw.hoursLogged}h`);
  }

  return (
    <p className="text-[12px] text-[#64748B] leading-relaxed">
      {parts.join(". ")}.
    </p>
  );
}

export default function PersonalStatsPanel() {
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Read preference from localStorage
    const pref = localStorage.getItem("nexora-show-stats");
    if (pref === "false") setVisible(false);
    const collPref = localStorage.getItem("nexora-stats-collapsed");
    if (collPref === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    taskApi
      .getMyStats()
      .then((res) => setStats(res.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleVisible = () => {
    const next = !visible;
    setVisible(next);
    localStorage.setItem("nexora-show-stats", String(next));
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("nexora-stats-collapsed", String(next));
  };

  // Always render the toggle button
  return (
    <div className="mb-6">
      {/* Toggle bar */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-[13px] font-semibold text-[#0F172A] hover:text-[#2E86C1] transition-colors"
        >
          <svg
            className="w-4 h-4 text-[#2E86C1]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          My Stats
          <svg
            className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={toggleVisible}
          className="text-[11px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
        >
          {visible ? "Hide Stats" : "Show Stats"}
        </button>
      </div>

      {/* Stats content */}
      {visible && !collapsed && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-0 shadow-sm animate-pulse">
                  <CardContent className="p-5">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                    <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !stats ? null : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Weekly Summary Card */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">This Week</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#64748B]">Tasks closed</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-bold text-[#0F172A]">{stats.thisWeek.tasksCompleted}</span>
                        <TrendBadge value={stats.trends.tasksCompletedChange} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#64748B]">Points</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-bold text-[#0F172A]">{stats.thisWeek.storyPointsDelivered}</span>
                        <TrendBadge value={stats.trends.pointsDeliveredChange} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#64748B]">Hours logged</span>
                      <span className="text-[14px] font-bold text-[#0F172A]">{stats.thisWeek.hoursLogged}h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#64748B]">Avg cycle time</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-bold text-[#0F172A]">{stats.thisWeek.avgCycleTimeDays}d</span>
                        <TrendBadge value={stats.trends.cycleTimeChange} invertColor />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Streak Card */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Streak</span>
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-bold text-[#0F172A]">{stats.streak.currentDays}</span>
                    <span className="text-[12px] text-[#64748B]">day{stats.streak.currentDays !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    Best: {stats.streak.longestDays} day{stats.streak.longestDays !== 1 ? "s" : ""}
                  </p>
                  <StreakDots stats={stats} />
                </CardContent>
              </Card>

              {/* Sprint Progress Card */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Sprint</span>
                  </div>

                  {stats.thisSprint.assignedTasks > 0 ? (
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <CircularProgress percentage={stats.thisSprint.completionRate} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-[#0F172A]">{stats.thisSprint.completionRate}%</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[12px] text-[#475569]">
                          <span className="font-bold text-[#0F172A]">{stats.thisSprint.completedTasks}</span>/{stats.thisSprint.assignedTasks} tasks
                        </p>
                        <p className="text-[12px] text-[#475569]">
                          <span className="font-bold text-[#0F172A]">{stats.thisSprint.completedPoints}</span>/{stats.thisSprint.assignedPoints} pts
                        </p>
                        {stats.thisSprint.sprintName && (
                          <p className="text-[10px] text-[#94A3B8] truncate max-w-[120px]" title={stats.thisSprint.sprintName}>
                            {stats.thisSprint.sprintName}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#94A3B8]">No active sprint</p>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Pulse Card */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Weekly Pulse</span>
                  </div>

                  <WeeklyPulse stats={stats} />

                  <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#94A3B8]">All-time tasks</span>
                      <span className="font-bold text-[#0F172A]">{stats.allTime.totalTasksCompleted}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-[#94A3B8]">All-time points</span>
                      <span className="font-bold text-[#0F172A]">{stats.allTime.totalPointsDelivered}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-[#94A3B8]">Total hours</span>
                      <span className="font-bold text-[#0F172A]">{stats.allTime.totalHoursLogged}h</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
