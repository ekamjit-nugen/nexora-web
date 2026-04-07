"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { chatAnalyticsApi } from "@/lib/api";
import { toast } from "sonner";

interface Insights {
  totalMessages: number;
  activeUsers: number;
  messagesToday: number;
  threadEngagementRate?: number;
  messagesByDay?: { date: string; count: number }[];
  messagesByType?: { type: string; count: number }[];
  mostActiveChannels?: { name: string; channelId: string; count: number }[];
  peakHours?: { hour: number; count: number }[];
}

export default function ChatAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insights | null>(null);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const userRoles = user?.roles || [];
  const hasAccess = userRoles.some((r) => ["manager", "admin", "super_admin", "owner"].includes(r));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatAnalyticsApi.getInsights(dateFrom, dateTo);
      setInsights(res.data || null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (hasAccess) loadData();
  }, [hasAccess, loadData]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";

  const maxByDay = Math.max(...(insights?.messagesByDay?.map((d) => d.count) || [1]));
  const maxByType = Math.max(...(insights?.messagesByType?.map((t) => t.count) || [1]));
  const totalByType = (insights?.messagesByType || []).reduce((a, b) => a + b.count, 0) || 1;
  const maxChannel = Math.max(...(insights?.mostActiveChannels?.map((c) => c.count) || [1]));
  const maxHour = Math.max(...(insights?.peakHours?.map((h) => h.count) || [1]));

  const TYPE_COLORS: Record<string, string> = {
    text: "bg-[#2E86C1]",
    file: "bg-[#8B5CF6]",
    image: "bg-[#10B981]",
    poll: "bg-[#F59E0B]",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">Chat Analytics</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Monitor messaging activity and engagement across your organization.</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </div>
          <button onClick={loadData} disabled={loading}
            className="bg-[#2E86C1] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 shrink-0">
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : insights ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {([
              { label: "Total Messages", value: insights.totalMessages?.toLocaleString() || "0", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
              { label: "Active Users", value: insights.activeUsers?.toLocaleString() || "0", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { label: "Messages Today", value: insights.messagesToday?.toLocaleString() || "0", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { label: "Thread Engagement", value: insights.threadEngagementRate != null ? `${(insights.threadEngagementRate * 100).toFixed(1)}%` : "N/A", icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" },
            ]).map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#EBF5FF] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{card.label}</p>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Message Volume by Day */}
          {insights.messagesByDay && insights.messagesByDay.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Message Volume (Last 30 Days)</h3>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {insights.messagesByDay.map((d) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="text-xs text-[#64748B] w-20 shrink-0 font-mono">{d.date.slice(5)}</span>
                    <div className="flex-1 h-5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2E86C1] rounded-full transition-all"
                        style={{ width: `${(d.count / maxByDay) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#64748B] w-12 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages by Type */}
          {insights.messagesByType && insights.messagesByType.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Messages by Type</h3>
              <div className="space-y-3">
                {insights.messagesByType.map((t) => {
                  const pct = ((t.count / totalByType) * 100).toFixed(1);
                  return (
                    <div key={t.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[#334155] capitalize">{t.type}</span>
                        <span className="text-xs text-[#64748B]">{t.count.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="h-4 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${TYPE_COLORS[t.type] || "bg-[#94A3B8]"}`}
                          style={{ width: `${(t.count / maxByType) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Most Active Channels */}
            {insights.mostActiveChannels && insights.mostActiveChannels.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Most Active Channels (Top 10)</h3>
                <div className="space-y-2.5">
                  {insights.mostActiveChannels.slice(0, 10).map((ch, i) => (
                    <div key={ch.channelId} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#94A3B8] w-5 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm text-[#0F172A] truncate">{ch.name || ch.channelId}</span>
                          <span className="text-xs text-[#64748B] shrink-0 ml-2">{ch.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2E86C1] rounded-full" style={{ width: `${(ch.count / maxChannel) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Peak Activity Hours */}
            {insights.peakHours && insights.peakHours.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Peak Activity Hours</h3>
                <div className="flex items-end gap-1 h-[200px]">
                  {Array.from({ length: 24 }, (_, h) => {
                    const entry = insights.peakHours!.find((p) => p.hour === h);
                    const count = entry?.count || 0;
                    const height = maxHour > 0 ? (count / maxHour) * 100 : 0;
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className="w-full bg-[#2E86C1] rounded-t transition-all hover:bg-[#2471A3] min-h-[2px]"
                          style={{ height: `${Math.max(height, 1)}%` }}
                        />
                        <span className="text-[9px] text-[#94A3B8] mt-1">{h}</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#0F172A] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                          {h}:00 - {count} msgs
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium">No analytics data available</p>
        </div>
      )}
    </div>
  );
}
