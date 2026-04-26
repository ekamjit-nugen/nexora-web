"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

interface UserOrg {
  _id: string;
  name: string;
  role: string;
  status?: string;
}

interface UserDetail {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  isPlatformAdmin?: boolean;
  organizations?: UserOrg[];
  lastLogin?: string;
  createdAt: string;
  phoneNumber?: string;
  avatar?: string;
}

export default function PlatformUserDetailPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const [targetUser, setTargetUser] = useState<UserDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"disable" | "enable" | "reset-auth" | null>(null);

  const fetchUser = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await platformApi.getUser(userId);
      setTargetUser((res.data || null) as UserDetail | null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load user");
    } finally {
      setDataLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !isPlatformAdmin) router.push("/dashboard");
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin && userId) fetchUser();
  }, [user, isPlatformAdmin, userId, fetchUser]);

  const handleAction = async () => {
    if (!confirmAction || !targetUser) return;
    try {
      if (confirmAction === "disable") {
        await platformApi.disableUser(targetUser._id);
        toast.success("User disabled");
      } else if (confirmAction === "enable") {
        await platformApi.enableUser(targetUser._id);
        toast.success("User enabled");
      } else if (confirmAction === "reset-auth") {
        await platformApi.resetUserAuth(targetUser._id);
        toast.success("User auth reset successfully");
      }
      setConfirmAction(null);
      fetchUser();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
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

  const confirmMessages: Record<string, { title: string; desc: string; btnText: string; btnClass: string }> = {
    disable: {
      title: "Disable User?",
      desc: "This will prevent the user from logging in to any organization. You can re-enable them later.",
      btnText: "Disable",
      btnClass: "bg-red-600 hover:bg-red-700",
    },
    enable: {
      title: "Enable User?",
      desc: "This will restore the user's ability to log in.",
      btnText: "Enable",
      btnClass: "bg-emerald-600 hover:bg-emerald-700",
    },
    "reset-auth": {
      title: "Reset User Auth?",
      desc: "This will reset the user's password, MFA settings, and active sessions. They will need to set up their account again.",
      btnText: "Reset Auth",
      btnClass: "bg-amber-600 hover:bg-amber-700",
    },
  };

  return (
    <RouteGuard requirePlatformAdmin>
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/platform/users" className="text-[#64748B] hover:text-[#2E86C1] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#0F172A]">User Detail</h1>
        </div>

        {dataLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !targetUser ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-[#64748B]">User not found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-[#0F172A]">
                    {targetUser.firstName} {targetUser.lastName}
                    {targetUser.isPlatformAdmin && (
                      <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">PLATFORM ADMIN</span>
                    )}
                  </CardTitle>
                  {targetUser.isActive ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">Disabled</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Email</p>
                    <p className="text-sm font-medium text-[#0F172A]">{targetUser.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Phone</p>
                    <p className="text-sm font-medium text-[#0F172A]">{targetUser.phoneNumber || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">MFA Status</p>
                    <p className="text-sm font-medium text-[#0F172A]">{targetUser.mfaEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Last Login</p>
                    <p className="text-sm font-medium text-[#0F172A]">
                      {targetUser.lastLogin
                        ? new Date(targetUser.lastLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Registered</p>
                    <p className="text-sm font-medium text-[#0F172A]">
                      {new Date(targetUser.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Organizations</p>
                    <p className="text-sm font-medium text-[#0F172A]">{targetUser.organizations?.length ?? "--"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#0F172A]">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {targetUser.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmAction("disable")}
                    >
                      Disable User
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setConfirmAction("enable")}
                    >
                      Enable User
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => setConfirmAction("reset-auth")}
                  >
                    Reset Auth
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Organizations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#0F172A]">
                  Organizations {targetUser.organizations ? `(${targetUser.organizations.length})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!targetUser.organizations || targetUser.organizations.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-[#64748B]">This user does not belong to any organization.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Organization</th>
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Role</th>
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Status</th>
                          <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetUser.organizations.map((org) => (
                          <tr key={org._id} className="border-b border-[#F1F5F9]">
                            <td className="px-5 py-3 text-[13px] font-medium text-[#0F172A]">{org.name}</td>
                            <td className="px-5 py-3">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                                {org.role}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {org.status || "active"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Link href={`/platform/organizations/${org._id}`}>
                                <Button variant="outline" size="sm" className="h-7 text-xs">
                                  View Org
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                {confirmMessages[confirmAction].title}
              </h3>
              <p className="text-sm text-[#64748B] mb-5">
                {confirmMessages[confirmAction].desc}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={confirmMessages[confirmAction].btnClass}
                  onClick={handleAction}
                >
                  {confirmMessages[confirmAction].btnText}
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
