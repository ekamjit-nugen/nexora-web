"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { projectApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type MarginStatus = "healthy" | "warning" | "critical" | "loss";

interface CostBreakdown {
  labor: number;
  expenses: number;
  infrastructure: number;
  overhead: number;
}

interface RevenueBreakdown {
  billed: number;
  unbilled: number;
}

interface ProjectPnL {
  projectId: string;
  name: string;
  key: string;
  clientName?: string;
  billingModel?: "fixed_price" | "time_and_materials" | "retainer";
  status: MarginStatus;
  budget: number;
  budgetUsedPercent: number;
  revenue: number;
  revenueBreakdown: RevenueBreakdown;
  cost: number;
  costBreakdown: CostBreakdown;
  margin: number;
  marginPercent: number;
  burnRate: number;
  daysElapsed: number;
  projectedFinalMargin: number;
  projectedFinalMarginPercent: number;
}

interface PortfolioSummary {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  avgMarginPercent: number;
  revenueTrendPercent?: number;
  costTrendPercent?: number;
  distribution: { healthy: number; warning: number; critical: number; loss: number };
  projects: ProjectPnL[];
  lastCalculatedAt?: string;
  trend?: Array<{ date: string; revenue: number; cost: number; margin: number }>;
}

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------
const marginStatusConfig: Record<
  MarginStatus,
  { label: string; color: string; dot: string; hex: string; rank: number }
> = {
  loss: {
    label: "LOSS",
    color: "bg-red-50 text-red-700 border-red-300",
    dot: "bg-red-600",
    hex: "#B91C1C",
    rank: 0,
  },
  critical: {
    label: "Critical",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    hex: "#F97316",
    rank: 1,
  },
  warning: {
    label: "Warning",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    hex: "#F59E0B",
    rank: 2,
  },
  healthy: {
    label: "Healthy",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    hex: "#10B981",
    rank: 3,
  },
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
const formatCurrency = (paise: number) => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90";
  const rupees = paise / 100;
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);
  if (abs >= 10000000) return `${sign}\u20B9${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}\u20B9${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}\u20B9${(abs / 1000).toFixed(1)}K`;
  return `${sign}\u20B9${abs.toFixed(0)}`;
};

const formatCurrencyFull = (paise: number) => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90.00";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

const formatPercent = (value: number) => {
  if (typeof value !== "number" || isNaN(value)) return "0.0%";
  return `${value >= 0 ? "" : ""}${value.toFixed(1)}%`;
};

const classifyMargin = (marginPercent: number): MarginStatus => {
  if (marginPercent < 0) return "loss";
  if (marginPercent < 10) return "critical";
  if (marginPercent < 20) return "warning";
  return "healthy";
};

const formatRelativeTime = (isoDate?: string) => {
  if (!isoDate) return "just now";
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60 * 1000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(isoDate).toLocaleString("en-IN");
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProjectProfitabilityPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [alertingProjectId, setAlertingProjectId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Auth gate
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasOrgRole("manager")) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, hasOrgRole, router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const res = await projectApi.getPortfolioProfitability();
      const payload: PortfolioSummary = res.data || res;

      // Normalise in case backend omits fields
      const projects: ProjectPnL[] = (payload?.projects || []).map((p: any) => {
        const marginPercent =
          typeof p.marginPercent === "number"
            ? p.marginPercent
            : p.revenue > 0
            ? ((p.revenue - p.cost) / p.revenue) * 100
            : 0;
        return {
          ...p,
          marginPercent,
          status: p.status || classifyMargin(marginPercent),
          revenueBreakdown: p.revenueBreakdown || { billed: p.revenue || 0, unbilled: 0 },
          costBreakdown: p.costBreakdown || {
            labor: p.cost || 0,
            expenses: 0,
            infrastructure: 0,
            overhead: 0,
          },
        };
      });

      setData({ ...payload, projects });
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error(err?.message || "Failed to load profitability");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !hasOrgRole("manager")) return;
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData, user, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const sortedProjects = useMemo(() => {
    if (!data?.projects) return [];
    return [...data.projects].sort((a, b) => {
      const rankDiff = marginStatusConfig[a.status].rank - marginStatusConfig[b.status].rank;
      if (rankDiff !== 0) return rankDiff;
      return a.marginPercent - b.marginPercent;
    });
  }, [data?.projects]);

  const distributionData = useMemo(() => {
    const dist = data?.distribution || { healthy: 0, warning: 0, critical: 0, loss: 0 };
    return [
      { name: "Healthy", value: dist.healthy, color: marginStatusConfig.healthy.hex },
      { name: "Warning", value: dist.warning, color: marginStatusConfig.warning.hex },
      { name: "Critical", value: dist.critical, color: marginStatusConfig.critical.hex },
      { name: "Loss", value: dist.loss, color: marginStatusConfig.loss.hex },
    ].filter((d) => d.value > 0);
  }, [data?.distribution]);

  const marginChartData = useMemo(() => {
    return sortedProjects.slice(0, 10).map((p) => ({
      name: p.key || p.name.slice(0, 12),
      margin: Math.round(p.margin / 100),
      marginPercent: Number(p.marginPercent.toFixed(1)),
      status: p.status,
    }));
  }, [sortedProjects]);

  const criticalProjects = useMemo(
    () => sortedProjects.filter((p) => p.status === "critical" || p.status === "loss"),
    [sortedProjects],
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const handleRefresh = () => fetchData();

  const handleScrollToCritical = () => {
    const el = document.getElementById("critical-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleViewDetails = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleSlackAlert = async (project: ProjectPnL) => {
    try {
      setAlertingProjectId(project.projectId);
      await projectApi.slackAlertProject(
        project.projectId,
        `Profitability alert for ${project.name}: margin ${project.marginPercent.toFixed(1)}%`,
      );
      toast.success(`Alert sent to ${project.name} team`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send Slack alert");
    } finally {
      setAlertingProjectId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E86C1]" />
      </div>
    );
  }

  const isEmpty = !loading && (!data?.projects || data.projects.length === 0);

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-[#0F172A]">Project Profitability</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                  Real-time
                </span>
              </div>
            </div>
            <p className="text-[13px] text-[#64748B] mt-1">
              Every project&apos;s P&amp;L, updated continuously from unified data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-[#94A3B8] font-semibold">
                Last calculated
              </div>
              <div className="text-[12px] text-[#475569] font-medium">
                {formatRelativeTime(lastRefreshed.toISOString())}
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E86C1]" />
            </div>
          ) : isEmpty ? (
            <EmptyState />
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                <SummaryCard
                  label="Total Portfolio Revenue"
                  value={formatCurrency(data!.totalRevenue)}
                  fullValue={formatCurrencyFull(data!.totalRevenue)}
                  trend={data!.revenueTrendPercent}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  }
                  iconColor="#2E86C1"
                />
                <SummaryCard
                  label="Total Portfolio Cost"
                  value={formatCurrency(data!.totalCost)}
                  fullValue={formatCurrencyFull(data!.totalCost)}
                  trend={data!.costTrendPercent}
                  trendInverted
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"
                    />
                  }
                  iconColor="#8B5CF6"
                />
                <SummaryCard
                  label="Gross Margin"
                  value={formatCurrency(data!.totalMargin)}
                  subValue={`(${formatPercent(data!.avgMarginPercent)})`}
                  fullValue={formatCurrencyFull(data!.totalMargin)}
                  valueColor={data!.totalMargin >= 0 ? "#059669" : "#DC2626"}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  }
                  iconColor={data!.totalMargin >= 0 ? "#10B981" : "#DC2626"}
                />
                <SummaryCard
                  label="Avg Margin %"
                  value={formatPercent(data!.avgMarginPercent)}
                  valueColor={
                    data!.avgMarginPercent >= 20
                      ? "#059669"
                      : data!.avgMarginPercent >= 10
                      ? "#D97706"
                      : data!.avgMarginPercent >= 0
                      ? "#EA580C"
                      : "#DC2626"
                  }
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  }
                  iconColor="#F59E0B"
                />
              </div>

              {/* Alert banner */}
              {criticalProjects.length > 0 && (
                <button
                  type="button"
                  onClick={handleScrollToCritical}
                  className="w-full text-left bg-gradient-to-r from-red-50 via-red-50 to-orange-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[15px] font-bold text-red-900">
                        {criticalProjects.length} project
                        {criticalProjects.length === 1 ? " is" : "s are"} critical or in loss.
                        Review immediately.
                      </div>
                      <div className="text-[12px] text-red-700 mt-0.5">
                        Combined margin impact:{" "}
                        {formatCurrency(
                          criticalProjects.reduce((sum, p) => sum + p.margin, 0),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[12px] font-semibold text-red-700 flex items-center gap-1.5">
                    Jump to critical
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </button>
              )}

              {/* Charts row */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Distribution donut */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Health Distribution
                      </h3>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Projects grouped by margin status
                      </p>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] font-medium">
                      {data!.projects.length} total
                    </span>
                  </div>
                  {distributionData.length === 0 ? (
                    <div className="h-[240px] flex items-center justify-center text-[13px] text-[#94A3B8]">
                      No data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={distributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #E2E8F0",
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Margin by project */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 xl:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Margin by Project
                      </h3>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Top 10 projects, worst margins first
                      </p>
                    </div>
                  </div>
                  {marginChartData.length === 0 ? (
                    <div className="h-[240px] flex items-center justify-center text-[13px] text-[#94A3B8]">
                      No data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={marginChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748B" }}
                          tickFormatter={(v) => `${v}%`}
                          dataKey="marginPercent"
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #E2E8F0",
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === "marginPercent") return [`${value}%`, "Margin"];
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="marginPercent" radius={[6, 6, 0, 0]}>
                          {marginChartData.map((entry, index) => (
                            <Cell
                              key={`bar-${index}`}
                              fill={marginStatusConfig[entry.status as MarginStatus].hex}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Trend chart (if present) */}
              {Array.isArray(data!.trend) && data!.trend.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Portfolio Trend
                      </h3>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Revenue vs cost over time
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={data!.trend.map((t) => ({
                        ...t,
                        revenue: Math.round(t.revenue / 100),
                        cost: Math.round(t.cost / 100),
                        margin: Math.round(t.margin / 100),
                      }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E2E8F0",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#2E86C1"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="margin"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Projects Table */}
              <div
                id="critical-section"
                className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      All Projects &mdash; Worst First
                    </h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Losses and critical projects surface to the top
                    </p>
                  </div>
                  <span className="text-[11px] text-[#94A3B8]">
                    {sortedProjects.length} projects
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-6 py-3">
                          Project
                        </th>
                        <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Status
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Budget
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Revenue
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Cost
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Margin
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Burn Rate
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3">
                          Projected Final
                        </th>
                        <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wide px-6 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProjects.map((project) => (
                        <ProjectRow
                          key={project.projectId}
                          project={project}
                          onViewDetails={handleViewDetails}
                          onSlackAlert={handleSlackAlert}
                          alertingProjectId={alertingProjectId}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Methodology footer */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#0F172A] mb-1">
                      Calculation methodology
                    </div>
                    <p className="text-[12px] text-[#64748B] leading-relaxed">
                      <strong>Revenue</strong> = invoiced + unbilled work (T&amp;M) or budget
                      (fixed-price). <strong>Cost</strong> = labor (hours &times; hourly rate) +
                      approved expenses + infrastructure + 10% overhead.{" "}
                      <strong>Margin</strong> = (Revenue &minus; Cost) / Revenue.{" "}
                      <strong>Burn rate</strong> = Total cost / days elapsed.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------
interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  fullValue?: string;
  trend?: number;
  trendInverted?: boolean;
  valueColor?: string;
  icon: React.ReactNode;
  iconColor: string;
}

function SummaryCard({
  label,
  value,
  subValue,
  fullValue,
  trend,
  trendInverted,
  valueColor,
  icon,
  iconColor,
}: SummaryCardProps) {
  const showTrend = typeof trend === "number" && !isNaN(trend);
  const isPositive = showTrend ? (trendInverted ? trend! < 0 : trend! > 0) : false;
  const trendColor = isPositive ? "text-emerald-600" : "text-red-600";

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke={iconColor}
            strokeWidth={2}
          >
            {icon}
          </svg>
        </div>
        {showTrend && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${trendColor}`}>
            <svg
              className={`w-3 h-3 ${trend! < 0 ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {Math.abs(trend!).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className="text-[26px] font-bold tracking-tight leading-tight"
        style={{ color: valueColor || "#0F172A" }}
        title={fullValue}
      >
        {value}
        {subValue && (
          <span className="text-[15px] font-semibold ml-1.5" style={{ color: valueColor || "#64748B" }}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Row (with hover breakdowns)
// ---------------------------------------------------------------------------
interface ProjectRowProps {
  project: ProjectPnL;
  onViewDetails: (id: string) => void;
  onSlackAlert: (project: ProjectPnL) => void;
  alertingProjectId: string | null;
}

function ProjectRow({ project, onViewDetails, onSlackAlert, alertingProjectId }: ProjectRowProps) {
  const statusCfg = marginStatusConfig[project.status];
  const marginColor =
    project.marginPercent >= 20
      ? "#059669"
      : project.marginPercent >= 10
      ? "#D97706"
      : project.marginPercent >= 0
      ? "#EA580C"
      : "#DC2626";
  const burnRateIsHigh =
    project.budget > 0 && project.burnRate * 30 > project.budget * 0.15;

  return (
    <tr className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
      {/* Project */}
      <td className="px-6 py-4">
        <button
          type="button"
          onClick={() => onViewDetails(project.projectId)}
          className="text-left group"
        >
          <div className="text-[13px] font-semibold text-[#0F172A] group-hover:text-[#2E86C1] transition-colors">
            {project.name}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {project.key}
            {project.clientName && <span> &middot; {project.clientName}</span>}
          </div>
        </button>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusCfg.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </td>

      {/* Budget + progress bar */}
      <td className="px-4 py-4 text-right">
        <div className="text-[13px] font-semibold text-[#0F172A]">
          {formatCurrency(project.budget)}
        </div>
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                project.budgetUsedPercent >= 100
                  ? "bg-red-500"
                  : project.budgetUsedPercent >= 85
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, project.budgetUsedPercent || 0))}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-[#64748B] w-10 text-right">
            {Math.round(project.budgetUsedPercent || 0)}%
          </span>
        </div>
      </td>

      {/* Revenue with hover breakdown */}
      <td className="px-4 py-4 text-right group relative">
        <div className="text-[13px] font-semibold text-[#0F172A]">
          {formatCurrency(project.revenue)}
        </div>
        <div className="absolute right-4 top-full mt-1 hidden group-hover:block z-30 bg-[#0F172A] text-white rounded-lg shadow-lg px-3 py-2 text-left min-w-[180px]">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
            Revenue breakdown
          </div>
          <div className="flex justify-between text-[11px] py-0.5">
            <span className="text-slate-300">Billed</span>
            <span className="font-semibold">{formatCurrency(project.revenueBreakdown.billed)}</span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5">
            <span className="text-slate-300">Unbilled</span>
            <span className="font-semibold">{formatCurrency(project.revenueBreakdown.unbilled)}</span>
          </div>
        </div>
      </td>

      {/* Cost with hover breakdown */}
      <td className="px-4 py-4 text-right group relative">
        <div className="text-[13px] font-semibold text-[#0F172A]">
          {formatCurrency(project.cost)}
        </div>
        <div className="absolute right-4 top-full mt-1 hidden group-hover:block z-30 bg-[#0F172A] text-white rounded-lg shadow-lg px-3 py-2 text-left min-w-[200px]">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
            Cost breakdown
          </div>
          <div className="flex justify-between text-[11px] py-0.5">
            <span className="text-slate-300">Labor</span>
            <span className="font-semibold">{formatCurrency(project.costBreakdown.labor)}</span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5">
            <span className="text-slate-300">Expenses</span>
            <span className="font-semibold">{formatCurrency(project.costBreakdown.expenses)}</span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5">
            <span className="text-slate-300">Infrastructure</span>
            <span className="font-semibold">
              {formatCurrency(project.costBreakdown.infrastructure)}
            </span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5 pt-1 border-t border-slate-700 mt-1">
            <span className="text-slate-300">Overhead (10%)</span>
            <span className="font-semibold">{formatCurrency(project.costBreakdown.overhead)}</span>
          </div>
        </div>
      </td>

      {/* Margin */}
      <td className="px-4 py-4 text-right">
        <div className="text-[15px] font-bold" style={{ color: marginColor }}>
          {formatCurrency(project.margin)}
        </div>
        <div className="text-[11px] font-semibold mt-0.5" style={{ color: marginColor }}>
          {formatPercent(project.marginPercent)}
        </div>
      </td>

      {/* Burn rate */}
      <td className="px-4 py-4 text-right">
        <div
          className={`text-[13px] font-semibold ${
            burnRateIsHigh ? "text-red-600" : "text-[#0F172A]"
          }`}
        >
          {formatCurrency(project.burnRate)}
          <span className="text-[10px] text-[#94A3B8] font-normal">/day</span>
        </div>
        {burnRateIsHigh && (
          <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mt-0.5">
            High
          </div>
        )}
      </td>

      {/* Projected final margin */}
      <td className="px-4 py-4 text-right">
        <div
          className="text-[13px] font-semibold"
          style={{
            color:
              project.projectedFinalMarginPercent >= 20
                ? "#059669"
                : project.projectedFinalMarginPercent >= 10
                ? "#D97706"
                : project.projectedFinalMarginPercent >= 0
                ? "#EA580C"
                : "#DC2626",
          }}
        >
          {formatCurrency(project.projectedFinalMargin)}
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">
          {formatPercent(project.projectedFinalMarginPercent)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onViewDetails(project.projectId)}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-[#2E86C1] hover:bg-blue-50 rounded-md transition-colors"
          >
            View
          </button>
          <button
            type="button"
            onClick={() => onSlackAlert(project)}
            disabled={alertingProjectId === project.projectId}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-[#64748B] hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
            title="Alert team on Slack"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            Alert
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 px-6 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-[#2E86C1]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <h3 className="text-[16px] font-bold text-[#0F172A] mb-1">No active projects yet</h3>
      <p className="text-[13px] text-[#64748B] max-w-md">
        Create a project and log timesheets to see real-time profitability.
      </p>
    </div>
  );
}
