"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { assetApi, AssetStats, Asset } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const STATUS_CHART_COLORS: Record<string, string> = {
  available: "#10B981", assigned: "#3B82F6", maintenance: "#F59E0B", retired: "#6B7280", lost: "#EF4444", disposed: "#94A3B8",
};
const CATEGORY_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

function formatCurrency(paise: number) {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}K`;
  return `₹${r.toFixed(0)}`;
}

export default function AssetDashboardPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [warrantyAssets, setWarrantyAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasOrgRole("manager")) { router.push("/dashboard"); return; }

    (async () => {
      try {
        setLoading(true);
        const [statsRes, warrantyRes] = await Promise.all([
          assetApi.getStats(),
          assetApi.getWarrantyExpiring(90),
        ]);
        setStats(statsRes.data as any);
        setWarrantyAssets(Array.isArray(warrantyRes.data) ? warrantyRes.data : []);
      } catch { toast.error("Failed to load dashboard"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const statusData = stats ? [
    { name: "Available", value: stats.available, color: STATUS_CHART_COLORS.available },
    { name: "Assigned", value: stats.assigned, color: STATUS_CHART_COLORS.assigned },
    { name: "Maintenance", value: stats.inMaintenance, color: STATUS_CHART_COLORS.maintenance },
    { name: "Retired", value: stats.retired, color: STATUS_CHART_COLORS.retired },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Asset Dashboard</h1>
        <p className="text-sm text-[#64748B] mb-8">Overview of all IT assets across the organization</p>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse">
                <div className="h-3 bg-[#E2E8F0] rounded w-20 mb-3" />
                <div className="h-7 bg-[#E2E8F0] rounded w-14" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Total Assets</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{stats.totalAssets}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Assigned</p>
                <p className="text-2xl font-bold text-[#3B82F6] mt-1">{stats.assigned}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Available</p>
                <p className="text-2xl font-bold text-[#10B981] mt-1">{stats.available}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">In Maintenance</p>
                <p className="text-2xl font-bold text-[#F59E0B] mt-1">{stats.inMaintenance}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Warranty Expiring (30d)</p>
                <p className="text-2xl font-bold text-[#EF4444] mt-1">{stats.warrantyExpiringIn30Days}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Warranty Expiring (90d)</p>
                <p className="text-2xl font-bold text-[#F59E0B] mt-1">{stats.warrantyExpiringIn90Days}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Total Asset Value</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{formatCurrency(stats.totalAssetValue)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                <p className="text-xs font-medium text-[#64748B] uppercase">Book Value</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{formatCurrency(stats.totalDepreciatedValue)}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Status Distribution */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Assets by Status</h3>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}>
                        {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No data</div>}
              </div>

              {/* By Category */}
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Assets by Category</h3>
                {stats.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.byCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="categoryName" tick={{ fontSize: 11, fill: "#64748B" }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                      <Bar dataKey="count" name="Assets" radius={[4, 4, 0, 0]}>
                        {stats.byCategory.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No data</div>}
              </div>
            </div>

            {/* Warranty Expiring */}
            {warrantyAssets.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Warranty Expiring Soon</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0]">
                        <th className="text-left px-4 py-2 font-medium text-[#64748B]">Asset Tag</th>
                        <th className="text-left px-4 py-2 font-medium text-[#64748B]">Name</th>
                        <th className="text-left px-4 py-2 font-medium text-[#64748B]">Warranty Expires</th>
                        <th className="text-left px-4 py-2 font-medium text-[#64748B]">Provider</th>
                        <th className="text-left px-4 py-2 font-medium text-[#64748B]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warrantyAssets.slice(0, 20).map(a => {
                        const daysLeft = Math.ceil((new Date(a.warrantyEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <tr key={a._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer" onClick={() => router.push(`/assets/${a._id}`)}>
                            <td className="px-4 py-2 font-mono text-xs text-[#64748B]">{a.assetTag}</td>
                            <td className="px-4 py-2 font-medium text-[#0F172A]">{a.name}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs font-medium ${daysLeft <= 30 ? "text-[#EF4444]" : "text-[#F59E0B]"}`}>
                                {new Date(a.warrantyEndDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ({daysLeft}d)
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[#64748B]">{a.warrantyProvider || "-"}</td>
                            <td className="px-4 py-2 text-xs">{a.status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
