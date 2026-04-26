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

interface PlatformOrganization {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  isActive: boolean;
  industry?: string;
  size?: string;
  // Org logo URL — uploaded via Settings → Branding. Shown in the
  // list as a 32px avatar with initials fallback for orgs that
  // haven't set one yet (most fresh tenants).
  logo?: string | null;
  // Active seats (for billing) — matches the legacy single-number value.
  memberCount?: number;
  // Detailed breakdown (added April 2026): active/inactive/total. The
  // list table renders "active / total" so platform admins can spot
  // tenants with abnormal exited-employee ratios at a glance.
  members?: { active: number; inactive: number; total: number };
  createdAt: string;
}

// Deterministic color picker for the initials fallback. Hashing the
// org name produces a stable color so refreshing the page doesn't
// reshuffle the palette and disorient the platform admin's pattern-
// recognition.
const ORG_AVATAR_TONES = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];
function avatarToneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ORG_AVATAR_TONES[Math.abs(h) % ORG_AVATAR_TONES.length];
}

function OrgAvatar({ org, size = 36 }: { org: { logo?: string | null; name: string }; size?: number }) {
  const initials = org.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
  const tone = avatarToneFor(org.name);
  const px = `${size}px`;
  if (org.logo) {
    return (
      <img
        src={org.logo}
        alt={org.name}
        className="rounded-lg object-cover border border-[#E2E8F0] shrink-0"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className={`${tone.bg} ${tone.text} rounded-lg flex items-center justify-center font-bold shrink-0`}
      style={{ width: px, height: px, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export default function PlatformOrganizationsPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "suspend" | "activate" } | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await platformApi.getOrganizations(params);
      setOrganizations((res.data || []) as PlatformOrganization[]);
      if (res.pagination) {
        setTotalPages(res.pagination.pages || 1);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load organizations");
    } finally {
      setDataLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !isPlatformAdmin) router.push("/dashboard");
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin) fetchOrganizations();
  }, [user, isPlatformAdmin, fetchOrganizations]);

  const handleToggleStatus = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.action === "suspend") {
        await platformApi.suspendOrganization(confirmAction.id);
        toast.success("Organization suspended");
      } else {
        await platformApi.activateOrganization(confirmAction.id);
        toast.success("Organization activated");
      }
      setConfirmAction(null);
      fetchOrganizations();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrganizations();
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

  const statusBadge = (org: PlatformOrganization) => {
    if (org.status === "suspended" || org.isActive === false) {
      return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">Suspended</span>;
    }
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
  };

  const planBadge = (plan: string) => {
    const styles: Record<string, string> = {
      free: "bg-gray-50 text-gray-600 border-gray-200",
      starter: "bg-blue-50 text-blue-700 border-blue-200",
      professional: "bg-violet-50 text-violet-700 border-violet-200",
      enterprise: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${styles[plan] || styles.free}`}>
        {plan || "free"}
      </span>
    );
  };

  return (
    <RouteGuard requirePlatformAdmin>
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/platform" className="text-[#64748B] hover:text-[#2E86C1] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-[#0F172A]">Organizations</h1>
            </div>
            <p className="text-[13px] text-[#64748B]">Manage all organizations on the platform.</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex gap-3 items-center">
              <div className="flex-1">
                <Input
                  placeholder="Search organizations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 rounded-md border border-[#E2E8F0] text-sm text-[#334155] bg-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
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
            ) : organizations.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[#64748B]">No organizations found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Name</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Plan</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3" title="Active seats / total members (active+exited)">Seats</th>
                      <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Created</th>
                      <th className="text-right text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => (
                      <tr
                        key={org._id}
                        className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        onClick={() => router.push(`/platform/organizations/${org._id}`)}
                      >
                        <td className="px-5 py-3.5">
                          {/* Avatar + identity column. The logo (or
                              initials fallback) anchors the row
                              visually so platform admins scanning a
                              long list can pattern-match tenants
                              without reading every name. */}
                          <div className="flex items-center gap-3 min-w-0">
                            <OrgAvatar org={org} size={36} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#0F172A] truncate">{org.name}</p>
                              {org.industry && <p className="text-xs text-[#94A3B8] mt-0.5 capitalize truncate">{org.industry}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">{planBadge(org.plan)}</td>
                        <td className="px-5 py-3.5">{statusBadge(org)}</td>
                        <td className="px-5 py-3.5">
                          {/* Vertical stack avoids wrapping in narrow
                              columns. Active count is the headline,
                              total + inactive sit in a smaller second
                              line. Tooltip carries the full breakdown
                              for screen readers and hover. */}
                          {org.members ? (
                            <div
                              className="leading-tight whitespace-nowrap"
                              title={`${org.members.active} active · ${org.members.inactive} inactive · ${org.members.total} total`}
                            >
                              <div className="text-[15px] font-semibold text-[#0F172A]">{org.members.active}</div>
                              <div className="text-[10px] text-[#94A3B8] mt-0.5">
                                of {org.members.total}
                                {org.members.inactive > 0 && (
                                  <span className="ml-1">· {org.members.inactive} inactive</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[13px] text-[#334155]">{org.memberCount ?? "--"}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B]">
                          {new Date(org.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/platform/organizations/${org._id}`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                View
                              </Button>
                            </Link>
                            {org.status === "suspended" || org.isActive === false ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => setConfirmAction({ id: org._id, action: "activate" })}
                              >
                                Activate
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setConfirmAction({ id: org._id, action: "suspend" })}
                              >
                                Suspend
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
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <span className="text-sm text-[#64748B]">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                {confirmAction.action === "suspend" ? "Suspend Organization?" : "Activate Organization?"}
              </h3>
              <p className="text-sm text-[#64748B] mb-5">
                {confirmAction.action === "suspend"
                  ? "This will prevent all members from accessing this organization. You can reactivate it later."
                  : "This will restore access for all members of this organization."}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={confirmAction.action === "suspend" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
                  onClick={handleToggleStatus}
                >
                  {confirmAction.action === "suspend" ? "Suspend" : "Activate"}
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
