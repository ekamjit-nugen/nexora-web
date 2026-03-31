"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

interface Analytics {
  totalOrganizations: number;
  totalUsers: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  newOrganizationsThisMonth: number;
  newUsersThisMonth: number;
  activeUsers: number;
  disabledUsers: number;
  organizationsByPlan: Record<string, number>;
  organizationsByStatus: Record<string, number>;
  usersByMfa: { enabled: number; disabled: number };
  averageMembersPerOrg: number;
}

export default function PlatformAnalyticsPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await platformApi.getAnalytics();
      setAnalytics((res.data || null) as Analytics | null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load analytics");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !isPlatformAdmin) router.push("/dashboard");
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin) fetchAnalytics();
  }, [user, isPlatformAdmin, fetchAnalytics]);

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

  const statCards = [
    { title: "Total Organizations", value: analytics?.totalOrganizations ?? "--", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "text-blue-600 bg-blue-50" },
    { title: "Active Organizations", value: analytics?.activeOrganizations ?? "--", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-emerald-600 bg-emerald-50" },
    { title: "Suspended Organizations", value: analytics?.suspendedOrganizations ?? "--", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636", color: "text-red-600 bg-red-50" },
    { title: "New Orgs This Month", value: analytics?.newOrganizationsThisMonth ?? "--", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-violet-600 bg-violet-50" },
    { title: "Total Users", value: analytics?.totalUsers ?? "--", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", color: "text-blue-600 bg-blue-50" },
    { title: "Active Users", value: analytics?.activeUsers ?? "--", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", color: "text-emerald-600 bg-emerald-50" },
    { title: "Disabled Users", value: analytics?.disabledUsers ?? "--", icon: "M13 7a4 4 0 11-8 0 4 4 0 018 0zM9.049 16.94l-2.122 2.122M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-red-600 bg-red-50" },
    { title: "New Users This Month", value: analytics?.newUsersThisMonth ?? "--", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <RouteGuard requirePlatformAdmin>
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/platform" className="text-[#64748B] hover:text-[#2E86C1] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-[#0F172A]">Platform Analytics</h1>
            </div>
            <p className="text-[13px] text-[#64748B]">Overview of platform metrics and usage.</p>
          </div>
        </div>

        {/* Stats Grid */}
        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
            {statCards.map((stat) => (
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

        {/* Plan Breakdown */}
        {analytics?.organizationsByPlan && Object.keys(analytics.organizationsByPlan).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Organizations by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(analytics.organizationsByPlan).map(([plan, count]) => {
                  const total = analytics.totalOrganizations || 1;
                  const pct = Math.round((count / total) * 100);
                  const planColors: Record<string, string> = {
                    free: "bg-gray-100 border-gray-300",
                    starter: "bg-blue-50 border-blue-300",
                    professional: "bg-violet-50 border-violet-300",
                    enterprise: "bg-amber-50 border-amber-300",
                  };
                  return (
                    <div key={plan} className={`text-center p-5 rounded-lg border-2 ${planColors[plan] || "bg-gray-50 border-gray-200"}`}>
                      <p className="text-3xl font-bold text-[#0F172A]">{count}</p>
                      <p className="text-xs text-[#64748B] capitalize mt-1">{plan}</p>
                      <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2E86C1] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-1">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MFA Adoption */}
          {analytics?.usersByMfa && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#0F172A]">MFA Adoption</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="text-center flex-1 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-2xl font-bold text-emerald-700">{analytics.usersByMfa.enabled}</p>
                    <p className="text-xs text-emerald-600 mt-1">MFA Enabled</p>
                  </div>
                  <div className="text-center flex-1 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-2xl font-bold text-gray-700">{analytics.usersByMfa.disabled}</p>
                    <p className="text-xs text-gray-600 mt-1">MFA Disabled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avg Members */}
          {analytics?.averageMembersPerOrg != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#0F172A]">Organization Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6">
                  <p className="text-4xl font-bold text-[#2E86C1]">{analytics.averageMembersPerOrg.toFixed(1)}</p>
                  <p className="text-sm text-[#64748B] mt-2">Average members per organization</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
    </RouteGuard>
  );
}
