"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DashboardMetrics {
  totalEmployees: number;
  monthlyPayrollCost: number;
  attritionRate: number;
  attritionTrend?: number;
  pendingApprovals: number;
}

interface HeadcountPoint {
  month: string;
  year: number;
  label?: string;
  total: number;
  joiners: number;
  exits: number;
}

interface AttritionPoint {
  month: string;
  year: number;
  label?: string;
  rate: number;
}

interface CostPoint {
  month: string;
  year: number;
  label?: string;
  totalCost: number;
}

interface AttendancePoint {
  month: string;
  year: number;
  label?: string;
  avgAttendance: number;
  avgLate: number;
  avgOvertime: number;
}

interface ForecastMonth {
  month: string;
  year: number;
  label?: string;
  projected: number;
  change: number;
}

interface HeadcountForecast {
  currentHeadcount: number;
  upcomingExits: number;
  projections: ForecastMonth[];
}

interface AttritionPrediction {
  employeeId: string;
  employeeName?: string;
  riskScore: number;
  topFactors: string[];
  predictedAt: string;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
const formatCurrency = (paise: number): string => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90.00";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

const formatCompactINR = (paise: number): string => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90";
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) {
    return `\u20B9${(rupees / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (rupees >= 1_00_000) {
    return `\u20B9${(rupees / 1_00_000).toFixed(1)}L`;
  }
  if (rupees >= 1_000) {
    return `\u20B9${(rupees / 1_000).toFixed(1)}K`;
  }
  return `\u20B9${rupees.toFixed(0)}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const buildLabel = (item: { month?: string; year?: number; label?: string }): string => {
  if (item.label) return item.label;
  if (item.month && item.year) return `${item.month} ${item.year}`;
  return "";
};

// ---------------------------------------------------------------------------
// Reusable empty state
// ---------------------------------------------------------------------------
function EmptyChart({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#94A3B8]">
      <svg
        className="w-12 h-12 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart wrapper card
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  children,
  isEmpty,
}: {
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
      <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">{title}</h3>
      <div className="h-[300px]">
        {isEmpty ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk score bar
// ---------------------------------------------------------------------------
function RiskBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  let color = "#10B981"; // green
  if (clamped >= 60) color = "#EF4444"; // red
  else if (clamped >= 30) color = "#F59E0B"; // amber

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium text-[#475569] w-10 text-right">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend arrow
// ---------------------------------------------------------------------------
function TrendArrow({ value, inverted = false }: { value: number; inverted?: boolean }) {
  if (value === 0) return null;
  const isPositive = inverted ? value < 0 : value > 0;
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${
        isPositive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {value > 0 ? (
        <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for charts
// ---------------------------------------------------------------------------
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (v: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-[#0F172A] mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#64748B]">{entry.name}:</span>
          <span className="font-medium text-[#0F172A]">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function HRAnalyticsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  // Data state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [headcountTrends, setHeadcountTrends] = useState<HeadcountPoint[]>([]);
  const [attritionTrends, setAttritionTrends] = useState<AttritionPoint[]>([]);
  const [costData, setCostData] = useState<CostPoint[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendancePoint[]>([]);
  const [forecast, setForecast] = useState<HeadcountForecast | null>(null);
  const [predictions, setPredictions] = useState<AttritionPrediction[]>([]);
  const [livePredictions, setLivePredictions] = useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !hasOrgRole("admin") && !hasOrgRole("hr")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Data fetching — all 6 endpoints in parallel
  // ---------------------------------------------------------------------------
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        metricsRes,
        headcountRes,
        attritionRes,
        costRes,
        attendanceRes,
        forecastRes,
        predictionsRes,
      ] = await Promise.all([
        payrollApi.getDashboardMetrics(),
        payrollApi.getHeadcountTrends(),
        payrollApi.getAttritionTrends(),
        payrollApi.getCostAnalytics(),
        payrollApi.getAttendanceTrends(),
        payrollApi.getHeadcountForecast(),
        payrollApi.getAttritionPredictions(),
      ]);

      // Metrics
      if (metricsRes.data) {
        const d = metricsRes.data as Record<string, unknown>;
        setMetrics({
          totalEmployees: (d.totalEmployees as number) ?? 0,
          monthlyPayrollCost: (d.monthlyPayrollCost as number) ?? 0,
          attritionRate: (d.attritionRate as number) ?? 0,
          attritionTrend: (d.attritionTrend as number) ?? 0,
          pendingApprovals: (d.pendingApprovals as number) ?? 0,
        });
      }

      // Headcount
      const hcRaw = (headcountRes.data as unknown) ?? [];
      setHeadcountTrends(
        Array.isArray(hcRaw)
          ? hcRaw.map((p: any) => ({
              month: String(p.month ?? ""),
              year: Number(p.year ?? 0),
              label: buildLabel(p as HeadcountPoint),
              total: Number(p.total ?? p.totalHeadcount ?? 0),
              joiners: Number(p.joiners ?? p.newJoiners ?? 0),
              exits: Number(p.exits ?? 0),
            }))
          : []
      );

      // Attrition
      const atRaw = (attritionRes.data as unknown) ?? [];
      setAttritionTrends(
        Array.isArray(atRaw)
          ? atRaw.map((p: any) => ({
              month: String(p.month ?? ""),
              year: Number(p.year ?? 0),
              label: buildLabel(p as AttritionPoint),
              rate: Number(p.rate ?? p.attritionRate ?? 0),
            }))
          : []
      );

      // Cost
      const costRaw = (costRes.data as unknown) ?? [];
      setCostData(
        Array.isArray(costRaw)
          ? costRaw.map((p: any) => ({
              month: String(p.month ?? ""),
              year: Number(p.year ?? 0),
              label: buildLabel(p as CostPoint),
              totalCost: Number(p.totalCost ?? p.totalPayrollCost ?? 0),
            }))
          : []
      );

      // Attendance
      const attRaw = (attendanceRes.data as unknown) ?? [];
      setAttendanceData(
        Array.isArray(attRaw)
          ? attRaw.map((p: any) => ({
              month: String(p.month ?? ""),
              year: Number(p.year ?? 0),
              label: buildLabel(p as AttendancePoint),
              avgAttendance: Number(p.avgAttendance ?? 0),
              avgLate: Number(p.avgLate ?? 0),
              avgOvertime: Number(p.avgOvertime ?? 0),
            }))
          : []
      );

      // Forecast
      const fcRaw = forecastRes.data as Record<string, unknown> | undefined;
      if (fcRaw) {
        const projRaw = (fcRaw.projections as unknown[]) ?? [];
        setForecast({
          currentHeadcount: Number(fcRaw.currentHeadcount ?? 0),
          upcomingExits: Number(fcRaw.upcomingExits ?? 0),
          projections: Array.isArray(projRaw)
            ? projRaw.map((p: any) => ({
                month: String(p.month ?? ""),
                year: Number(p.year ?? 0),
                label: buildLabel(p as ForecastMonth),
                projected: Number(p.projected ?? p.projectedHeadcount ?? 0),
                change: Number(p.change ?? 0),
              }))
            : [],
        });
      }

      // Predictions
      const predRaw = (predictionsRes.data as unknown) ?? [];
      setPredictions(
        Array.isArray(predRaw)
          ? predRaw.map((p: any) => ({
              employeeId: String(p.employeeId ?? ""),
              employeeName: p.employeeName ? String(p.employeeName) : undefined,
              riskScore: Number(p.riskScore ?? 0),
              topFactors: Array.isArray(p.topFactors)
                ? (p.topFactors as string[])
                : [],
              predictedAt: String(p.predictedAt ?? ""),
            }))
          : []
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load analytics data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ---------------------------------------------------------------------------
  // Live ML attrition predictions (independently refreshable)
  // ---------------------------------------------------------------------------
  const fetchLivePredictions = useCallback(async () => {
    setLoadingPredictions(true);
    try {
      const res = await payrollApi.getLiveAttritionPredictions();
      setLivePredictions(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Fall back silently — use the snapshot predictions if live fails
    } finally {
      setLoadingPredictions(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePredictions();
  }, [fetchLivePredictions]);

  // ---------------------------------------------------------------------------
  // Generate snapshot
  // ---------------------------------------------------------------------------
  const handleGenerateSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      await payrollApi.generateSnapshot();
      toast.success("Snapshot generated successfully");
      fetchAllData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate snapshot";
      toast.error(message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / auth guard renders
  // ---------------------------------------------------------------------------
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]" />
      </div>
    );
  }

  if (!hasOrgRole("admin") && !hasOrgRole("hr")) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user!} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-8">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">HR Analytics</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Organization insights and trends
            </p>
          </div>
          <button
            onClick={handleGenerateSnapshot}
            disabled={snapshotLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {snapshotLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            )}
            Generate Snapshot
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Overview cards                                                     */}
        {/* ----------------------------------------------------------------- */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm animate-pulse"
              >
                <div className="h-4 w-24 bg-[#E2E8F0] rounded mb-3" />
                <div className="h-8 w-32 bg-[#E2E8F0] rounded" />
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {/* Total Employees */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">
                Total Employees
              </p>
              <p className="text-2xl font-bold text-[#0F172A]">
                {metrics.totalEmployees.toLocaleString("en-IN")}
              </p>
            </div>

            {/* Monthly Payroll Cost */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">
                Monthly Payroll Cost
              </p>
              <p className="text-2xl font-bold text-[#0F172A]">
                {formatCurrency(metrics.monthlyPayrollCost)}
              </p>
            </div>

            {/* Attrition Rate */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">
                Attrition Rate
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-[#0F172A]">
                  {formatPercent(metrics.attritionRate)}
                </p>
                {metrics.attritionTrend !== undefined && (
                  <TrendArrow value={metrics.attritionTrend} inverted />
                )}
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">
                Pending Approvals
              </p>
              <p className="text-2xl font-bold text-[#0F172A]">
                {metrics.pendingApprovals.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        ) : null}

        {/* ----------------------------------------------------------------- */}
        {/* Charts grid (2x2)                                                  */}
        {/* ----------------------------------------------------------------- */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm animate-pulse"
              >
                <div className="h-4 w-40 bg-[#E2E8F0] rounded mb-4" />
                <div className="h-[300px] bg-[#F1F5F9] rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Chart 1: Headcount Trends */}
            <ChartCard title="Headcount Trends" isEmpty={headcountTrends.length === 0}>
              <LineChart data={headcountTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip active={active} payload={payload as never} label={String(label ?? "")} />
                  )}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total Headcount"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#3B82F6" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="joiners"
                  name="New Joiners"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10B981" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="exits"
                  name="Exits"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#EF4444" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartCard>

            {/* Chart 2: Attrition Trends */}
            <ChartCard title="Attrition Trends" isEmpty={attritionTrends.length === 0}>
              <AreaChart data={attritionTrends}>
                <defs>
                  <linearGradient id="attritionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatPercent(v)}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as never}
                      label={String(label ?? "")}
                      formatter={(v: number) => formatPercent(v)}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  name="Attrition Rate"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fill="url(#attritionGrad)"
                  dot={{ r: 3, fill: "#EF4444" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ChartCard>

            {/* Chart 3: Cost Analytics */}
            <ChartCard title="Cost Analytics" isEmpty={costData.length === 0}>
              <BarChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCompactINR(v)}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as never}
                      label={String(label ?? "")}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                  )}
                />
                <Bar
                  dataKey="totalCost"
                  name="Total Payroll"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartCard>

            {/* Chart 4: Attendance Trends */}
            <ChartCard title="Attendance Trends" isEmpty={attendanceData.length === 0}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as never}
                      label={String(label ?? "")}
                      formatter={(v: number, name: string) =>
                        name.includes("Overtime") ? `${v.toFixed(1)}h` : formatPercent(v)
                      }
                    />
                  )}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Line
                  type="monotone"
                  dataKey="avgAttendance"
                  name="Avg Attendance %"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10B981" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgLate"
                  name="Avg Late %"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#F59E0B" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgOvertime"
                  name="Avg Overtime (hrs)"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#8B5CF6" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartCard>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Headcount Forecast                                                 */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm mb-8">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">
            Headcount Forecast
          </h3>
          {loading ? (
            <div className="flex gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-1 h-24 bg-[#F1F5F9] rounded-lg" />
              ))}
            </div>
          ) : forecast ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Current headcount */}
              <div className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] p-4">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">
                  Current
                </p>
                <p className="text-xl font-bold text-[#0F172A]">
                  {forecast.currentHeadcount.toLocaleString("en-IN")}
                </p>
              </div>

              {/* Projections for next 3 months */}
              {forecast.projections.slice(0, 3).map((proj, idx) => (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] p-4"
                >
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">
                    {proj.label || `Month +${idx + 1}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-[#0F172A]">
                      {proj.projected.toLocaleString("en-IN")}
                    </p>
                    <TrendArrow value={proj.change} />
                  </div>
                </div>
              ))}

              {/* Upcoming exits */}
              <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">
                  Known Upcoming Exits
                </p>
                <p className="text-xl font-bold text-red-700">
                  {forecast.upcomingExits}
                </p>
              </div>
            </div>
          ) : (
            <EmptyChart message="No forecast data available" />
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* AI Attrition Risk Analysis                                         */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">AI Attrition Risk Analysis</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  ML Powered
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                6-factor weighted model analyzing tenure, compensation, attendance, and performance
              </p>
            </div>
            <Button
              onClick={fetchLivePredictions}
              disabled={loadingPredictions}
              variant="outline"
              className="h-8 text-[12px]"
            >
              {loadingPredictions ? "Analyzing..." : "Refresh Analysis"}
            </Button>
          </div>

          {/* Risk distribution stats */}
          <div className="grid grid-cols-4 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
            <div className="bg-white p-4">
              <p className="text-[11px] text-[#64748B] uppercase font-medium">Total Analyzed</p>
              <p className="text-[20px] font-bold text-[#0F172A] mt-1">{livePredictions.length}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[11px] text-[#64748B] uppercase font-medium">High Risk (60+)</p>
              <p className="text-[20px] font-bold text-red-600 mt-1">
                {livePredictions.filter(p => p.riskScore >= 60).length}
              </p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[11px] text-[#64748B] uppercase font-medium">Medium Risk (30-59)</p>
              <p className="text-[20px] font-bold text-amber-600 mt-1">
                {livePredictions.filter(p => p.riskScore >= 30 && p.riskScore < 60).length}
              </p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[11px] text-[#64748B] uppercase font-medium">Low Risk (&lt;30)</p>
              <p className="text-[20px] font-bold text-emerald-600 mt-1">
                {livePredictions.filter(p => p.riskScore < 30).length}
              </p>
            </div>
          </div>

          {/* Predictions table */}
          {livePredictions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-5 py-3 font-semibold text-[#475569]">Employee ID</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#475569]">Risk Score</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#475569]">Risk Factors</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#475569]">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {livePredictions.slice(0, 20).map((pred, idx) => (
                    <tr key={pred.employeeId || idx} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-[#0F172A]">{pred.employeeId?.slice(-8) || "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pred.riskScore >= 60 ? "bg-red-500" :
                                pred.riskScore >= 30 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${pred.riskScore}%` }}
                            />
                          </div>
                          <span className={`text-[13px] font-semibold ${
                            pred.riskScore >= 60 ? "text-red-600" :
                            pred.riskScore >= 30 ? "text-amber-600" : "text-emerald-600"
                          }`}>
                            {pred.riskScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(pred.factors || []).map((factor: string, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[#64748B]">
                        {pred.confidence ? `${Math.round(pred.confidence * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loadingPredictions ? (
            <div className="text-center py-12 text-[#64748B]">
              <div className="inline-block w-8 h-8 border-2 border-[#E2E8F0] border-t-[#2E86C1] rounded-full animate-spin mb-3" />
              <p className="text-[13px]">Analyzing workforce patterns...</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-[#E2E8F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-[13px] text-[#64748B] mt-3">No attrition data available</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">Run analysis to generate predictions</p>
            </div>
          )}

          {/* Methodology footer */}
          <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <p className="text-[11px] text-[#64748B]">
              <strong>Model:</strong> Weighted scoring — Salary Gap (25%), Tenure (20%), Leave Frequency (15%),
              Attendance (15%), Performance (15%), Team Attrition (10%). Scores are indicative, not definitive.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
