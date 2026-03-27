"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

const ACTION_TYPES = ["create", "update", "delete", "suspend", "activate", "disable", "enable", "reset-auth", "login", "logout"];
const TARGET_TYPES = ["organization", "user", "role", "policy", "system"];

export default function PlatformAuditLogsPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 25 };
      if (actionFilter) params.action = actionFilter;
      if (targetTypeFilter) params.targetType = targetTypeFilter;
      const res = await platformApi.getAuditLogs(params);
      setLogs((res.data || []) as AuditLog[]);
      if (res.pagination) {
        setTotalPages(res.pagination.pages || 1);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load audit logs");
    } finally {
      setDataLoading(false);
    }
  }, [page, actionFilter, targetTypeFilter]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !isPlatformAdmin) router.push("/dashboard");
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin) fetchLogs();
  }, [user, isPlatformAdmin, fetchLogs]);

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

  const actionBadge = (action: string) => {
    const styles: Record<string, string> = {
      create: "bg-emerald-50 text-emerald-700 border-emerald-200",
      update: "bg-blue-50 text-blue-700 border-blue-200",
      delete: "bg-red-50 text-red-700 border-red-200",
      suspend: "bg-amber-50 text-amber-700 border-amber-200",
      activate: "bg-emerald-50 text-emerald-700 border-emerald-200",
      disable: "bg-red-50 text-red-700 border-red-200",
      enable: "bg-emerald-50 text-emerald-700 border-emerald-200",
      "reset-auth": "bg-amber-50 text-amber-700 border-amber-200",
      login: "bg-blue-50 text-blue-700 border-blue-200",
      logout: "bg-gray-50 text-gray-600 border-gray-200",
    };
    return styles[action] || "bg-gray-50 text-gray-600 border-gray-200";
  };

  return (
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
              <h1 className="text-xl font-bold text-[#0F172A]">Audit Logs</h1>
            </div>
            <p className="text-[13px] text-[#64748B]">Track all platform activity and changes.</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3 items-center">
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 rounded-md border border-[#E2E8F0] text-sm text-[#334155] bg-white"
              >
                <option value="">All Actions</option>
                {ACTION_TYPES.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <select
                value={targetTypeFilter}
                onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 rounded-md border border-[#E2E8F0] text-sm text-[#334155] bg-white"
              >
                <option value="">All Target Types</option>
                {TARGET_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {(actionFilter || targetTypeFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => { setActionFilter(""); setTargetTypeFilter(""); setPage(1); }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {dataLoading ? (
              <div className="p-8 text-center">
                <svg className="animate-spin h-6 w-6 text-[#2E86C1] mx-auto" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[#64748B]">No audit logs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Timestamp</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Action</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Target</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Performed By</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}{" "}
                          {new Date(log.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${actionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] text-[#0F172A]">
                            <span className="text-[#94A3B8] capitalize">{log.targetType}</span>
                            {log.targetName && (
                              <span className="font-medium ml-1">{log.targetName}</span>
                            )}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#334155]">
                          {log.performedByName || log.performedBy?.slice(0, 12) || "--"}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B] font-mono">
                          {log.ipAddress || "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 text-xs">
              Previous
            </Button>
            <span className="text-sm text-[#64748B]">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 text-xs">
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
