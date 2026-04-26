"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { chatApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface AnalyticsData {
  overview: {
    totalMessages: number;
    totalConversations: number;
    activeUsers: number;
    threadEngagementRate: number;
  };
  messageVolume: Array<{ _id: string; count: number }>;
  messagesByType: Array<{ type: string; count: number }>;
  activeChannels: Array<{ conversationId: string; name: string; messageCount: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function AnalyticsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);

  const isAuthorized = user && (
    user.role === "manager" || user.role === "admin" || user.role === "owner" ||
    user.role === "super_admin" ||
    (user.roles && (
      user.roles.includes("manager") || user.roles.includes("admin") ||
      user.roles.includes("owner") || user.roles.includes("super_admin")
    ))
  );

  const fetchAnalytics = useCallback(async () => {
    if (!isAuthorized) return;
    setFetching(true);
    setError(null);
    try {
      const res = await chatApi.getAnalytics(fromDate, toDate);
      setData(res.data || null);
    } catch {
      setError("Failed to load analytics data.");
    } finally {
      setFetching(false);
    }
  }, [fromDate, toDate, isAuthorized]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && isAuthorized) {
      fetchAnalytics();
    } else if (user && !isAuthorized) {
      setFetching(false);
    }
  }, [user, isAuthorized, fetchAnalytics]);

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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-8">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Access Denied</h2>
            <p className="text-sm text-[#64748B]">You need manager, admin, or owner role to view analytics.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 min-w-0 md:ml-[260px] p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Chat Analytics</h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Message activity and engagement insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-[#E2E8F0] px-3 py-2">
              <label className="text-[12px] text-[#64748B]">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-[13px] text-[#0F172A] border-0 outline-none bg-transparent"
              />
              <span className="text-[#CBD5E1]">|</span>
              <label className="text-[12px] text-[#64748B]">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-[13px] text-[#0F172A] border-0 outline-none bg-transparent"
              />
            </div>
            <button
              onClick={() => router.push("/messages")}
              className="px-3 py-2 text-[13px] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              Back to Chat
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {fetching ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-4 bg-[#E2E8F0] rounded w-24 mb-3" />
                  <div className="h-8 bg-[#E2E8F0] rounded w-16" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-4 bg-[#E2E8F0] rounded w-32 mb-4" />
                  <div className="h-[250px] bg-[#F1F5F9] rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-3 px-4 py-2 text-sm text-[#2E86C1] hover:bg-[#EBF5FF] rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wide">Total Messages</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{data.overview.totalMessages.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wide">Active Users</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{data.overview.activeUsers.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wide">Total Conversations</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{data.overview.totalConversations.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wide">Thread Engagement</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{(data.overview.threadEngagementRate * 100).toFixed(1)}%</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Message Volume Over Time */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Message Volume</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.messageVolume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="_id"
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    />
                    <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Messages by Type */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Messages by Type</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.messagesByType}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(props: any) => `${props.name || ''} (${((props.percent || 0) * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: "#94A3B8" }}
                    >
                      {data.messagesByType.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Active Channels */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Top 10 Active Channels</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.activeChannels.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      width={120}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                    <Bar dataKey="messageCount" fill={CHART_COLORS[4]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Peak Hours */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Peak Hours</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      tickFormatter={(h) => `${h}:00`}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                      labelFormatter={(h) => `${h}:00 - ${h}:59`}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={CHART_COLORS[6]}
                      fill={CHART_COLORS[6]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
