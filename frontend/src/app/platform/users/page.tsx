"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

interface PlatformUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  isPlatformAdmin?: boolean;
  organizationCount?: number;
  organizations?: Array<{ _id: string; name: string; role: string }>;
  lastLogin?: string;
  createdAt: string;
}

export default function PlatformUsersPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "disable" | "enable" } | null>(null);

  const fetchUsers = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await platformApi.getUsers(params);
      setUsers((res.data || []) as PlatformUser[]);
      if (res.pagination) {
        setTotalPages(res.pagination.pages || 1);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setDataLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !isPlatformAdmin) router.push("/dashboard");
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin) fetchUsers();
  }, [user, isPlatformAdmin, fetchUsers]);

  const handleToggleStatus = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.action === "disable") {
        await platformApi.disableUser(confirmAction.id);
        toast.success("User disabled");
      } else {
        await platformApi.enableUser(confirmAction.id);
        toast.success("User enabled");
      }
      setConfirmAction(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

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
              <h1 className="text-xl font-bold text-[#0F172A]">All Users</h1>
            </div>
            <p className="text-[13px] text-[#64748B]">Manage all users across the platform.</p>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex gap-3 items-center">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="h-9 bg-[#2E86C1] hover:bg-[#2573A7]">
                Search
              </Button>
            </form>
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
            ) : users.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[#64748B]">No users found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Name</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Email</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Organizations</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Last Login</th>
                      <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u._id}
                        className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        onClick={() => router.push(`/platform/users/${u._id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-semibold text-[#0F172A]">
                            {u.firstName} {u.lastName}
                            {u.isPlatformAdmin && (
                              <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">PLATFORM ADMIN</span>
                            )}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#334155]">{u.email}</td>
                        <td className="px-5 py-3.5">
                          {u.isActive ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">Disabled</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#334155]">{u.organizationCount ?? u.organizations?.length ?? "--"}</td>
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B]">
                          {u.lastLogin
                            ? new Date(u.lastLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "--"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/platform/users/${u._id}`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                View
                              </Button>
                            </Link>
                            {u.isActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setConfirmAction({ id: u._id, action: "disable" })}
                              >
                                Disable
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => setConfirmAction({ id: u._id, action: "enable" })}
                              >
                                Enable
                              </Button>
                            )}
                          </div>
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

        {/* Confirm Dialog */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                {confirmAction.action === "disable" ? "Disable User?" : "Enable User?"}
              </h3>
              <p className="text-sm text-[#64748B] mb-5">
                {confirmAction.action === "disable"
                  ? "This will prevent the user from logging in to any organization. You can re-enable them later."
                  : "This will restore the user's ability to log in."}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={confirmAction.action === "disable" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
                  onClick={handleToggleStatus}
                >
                  {confirmAction.action === "disable" ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </RouteGuard>
  );
}
