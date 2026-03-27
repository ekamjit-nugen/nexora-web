"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Analytics {
  totalOrganizations: number;
  totalUsers: number;
  activeOrganizations: number;
  newOrganizationsThisMonth: number;
  newUsersThisMonth: number;
  organizationsByPlan: Record<string, number>;
  organizationsByStatus: Record<string, number>;
}

interface AuditLog {
  _id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  performedBy: string;
  performedByName?: string;
  ipAddress?: string;
  details?: string;
  createdAt: string;
}

export default function PlatformDashboardPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [analyticsRes, logsRes] = await Promise.all([
        platformApi.getAnalytics(),
        platformApi.getAuditLogs({ limit: 10 }),
      ]);
      setAnalytics((analyticsRes.data || null) as Analytics | null);
      setAuditLogs((logsRes.data || []) as AuditLog[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load platform data");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user && !isPlatformAdmin) {
      router.push("/dashboard");
    }
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin) {
      fetchData();
    }
  }, [user, isPlatformAdmin, fetchData]);

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

  if (!user || !isPlatformAdmin) return null;

  const stats = [
    {
      title: "Total Organizations",
      value: analytics?.totalOrganizations ?? "--",
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Total Users",
      value: analytics?.totalUsers ?? "--",
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Active Organizations",
      value: analytics?.activeOrganizations ?? "--",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "text-violet-600 bg-violet-50",
    },
    {
      title: "New This Month",
      value: analytics?.newOrganizationsThisMonth ?? "--",
      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
      color: "text-amber-600 bg-amber-50",
    },
  ];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const actionBadge = (action: string) => {
    const styles: Record<string, string> = {
      create: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      update: "bg-blue-50 text-blue-700 border border-blue-200",
      delete: "bg-red-50 text-red-700 border border-red-200",
      suspend: "bg-amber-50 text-amber-700 border border-amber-200",
      activate: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      disable: "bg-red-50 text-red-700 border border-red-200",
      enable: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
    return styles[action] || "bg-gray-50 text-gray-600 border border-gray-200";
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[#0F172A]">Platform Administration</h1>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">Super Admin</span>
          </div>
          <p className="text-[13px] text-[#64748B]">
            Manage all organizations, users, and platform-wide settings.
          </p>
        </div>

        {/* Stats Cards */}
        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-8 bg-gray-200 rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-medium text-[#64748B]">{stat.title}</p>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Link href="/platform/organizations">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Manage Organizations</p>
                  <p className="text-xs text-[#64748B]">View, suspend, change plans</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/users">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Manage Users</p>
                  <p className="text-xs text-[#64748B]">View, disable, reset auth</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/audit-logs">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Audit Logs</p>
                  <p className="text-xs text-[#64748B]">Track all platform activity</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Plan Distribution */}
        {analytics?.organizationsByPlan && Object.keys(analytics.organizationsByPlan).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Organizations by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(analytics.organizationsByPlan).map(([plan, count]) => (
                  <div key={plan} className="text-center p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-2xl font-bold text-[#0F172A]">{count}</p>
                    <p className="text-xs text-[#64748B] capitalize mt-1">{plan}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Audit Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Recent Activity</CardTitle>
            <Link href="/platform/audit-logs" className="text-xs text-[#2E86C1] hover:underline font-medium">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="h-4 bg-gray-200 rounded w-20" />
                    <div className="h-4 bg-gray-200 rounded w-40" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                  </div>
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log._id} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${actionBadge(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-[13px] text-[#334155] flex-1">
                      <span className="font-medium">{log.performedByName || log.performedBy?.slice(0, 8)}</span>
                      {" "}
                      {log.action}d {log.targetType}
                      {log.targetName && <span className="font-medium"> &quot;{log.targetName}&quot;</span>}
                    </span>
                    <span className="text-xs text-[#94A3B8] whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
