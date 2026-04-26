"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { AdvancedFilter, FilterCondition } from "@/components/advanced-filter";

interface PlatformOrganization {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  isActive: boolean;
  industry?: string;
  size?: string;
  memberCount?: number;
  createdAt: string;
}

export default function EnhancedOrganizationsPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "suspend" | "activate" } | null>(null);
  const [bulkAction, setBulkAction] = useState<{ action: "suspend" | "activate" | "delete"; ids: string[] } | null>(null);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);

  const bulkSelection = useBulkSelection({
    items: organizations,
    onSelectionChange: (selected) => {
      // Optional: Track selection changes
    },
  });

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
      bulkSelection.clearSelection();
      fetchOrganizations();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || bulkAction.ids.length === 0) return;

    try {
      for (const id of bulkAction.ids) {
        if (bulkAction.action === "suspend") {
          await platformApi.suspendOrganization(id);
        } else if (bulkAction.action === "activate") {
          await platformApi.activateOrganization(id);
        }
      }
      toast.success(`${bulkAction.ids.length} organizations ${bulkAction.action}ed successfully`);
      setBulkAction(null);
      bulkSelection.clearSelection();
      fetchOrganizations();
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed");
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
          {/* Header with Bulk Selection Info */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/platform" className="text-[#64748B] hover:text-[#2E86C1] transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <h1 className="text-xl font-bold text-[#0F172A]">Organizations</h1>
                {bulkSelection.count > 0 && (
                  <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {bulkSelection.count} selected
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#64748B]">Manage all organizations on the platform.</p>
            </div>
          </div>

          {/* Bulk Actions Toolbar */}
          {bulkSelection.count > 0 && (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    {bulkSelection.count} organization{bulkSelection.count !== 1 ? "s" : ""} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBulkAction({ action: "suspend", ids: bulkSelection.selected })}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                    >
                      Suspend Selected
                    </button>
                    <button
                      onClick={() => setBulkAction({ action: "activate", ids: bulkSelection.selected })}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                    >
                      Activate Selected
                    </button>
                    <button
                      onClick={() => bulkSelection.clearSelection()}
                      className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Filter */}
          <AdvancedFilter
            availableFields={[
              { name: "name", label: "Name", type: "text" },
              { name: "status", label: "Status", type: "select", options: [
                { label: "Active", value: "active" },
                { label: "Suspended", value: "suspended" },
              ]},
              { name: "plan", label: "Plan", type: "select", options: [
                { label: "Free", value: "free" },
                { label: "Starter", value: "starter" },
                { label: "Professional", value: "professional" },
                { label: "Enterprise", value: "enterprise" },
              ]},
              { name: "memberCount", label: "Member Count", type: "number" },
            ]}
            onApplyFilter={(filters) => {
              setAppliedFilters(filters);
              setPage(1);
              // TODO: Implement advanced filter API call
              toast.info(`Applied ${filters.length} filter${filters.length !== 1 ? "s" : ""}`);
            }}
            onClear={() => {
              setAppliedFilters([]);
              setPage(1);
              fetchOrganizations();
            }}
            isOpen={showAdvancedFilter}
            onToggle={() => setShowAdvancedFilter(!showAdvancedFilter)}
          />

          {/* Search & Filter Controls */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <form onSubmit={handleSearch} className="flex gap-3 items-center flex-wrap">
                <Input
                  type="text"
                  placeholder="Search organizations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <Button type="submit" className="bg-[#2E86C1] hover:bg-[#1e5a96]">
                  Search
                </Button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Advanced Filter
                </button>
              </form>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {dataLoading ? (
                <div className="text-center py-8 text-gray-500">Loading organizations...</div>
              ) : organizations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No organizations found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={bulkSelection.isAllSelected()}
                            ref={(el) => {
                              if (el) el.indeterminate = bulkSelection.isIndeterminate();
                            }}
                            onChange={() => bulkSelection.toggleAll()}
                            className="rounded"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Plan</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Members</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {organizations.map((org) => (
                        <tr key={org._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={bulkSelection.isSelected(org._id)}
                              onChange={() => bulkSelection.toggleItem(org._id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <Link href={`/platform/organizations/${org._id}`} className="font-medium text-blue-600 hover:text-blue-800">
                              {org.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4">{statusBadge(org)}</td>
                          <td className="px-6 py-4">{planBadge(org.plan)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{org.memberCount || 0}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(org.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  id: org._id,
                                  action: org.status === "suspended" ? "activate" : "suspend",
                                })
                              }
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                org.status === "suspended"
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              {org.status === "suspended" ? "Activate" : "Suspend"}
                            </button>
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
            <div className="flex justify-between items-center mt-6">
              <Button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="bg-[#2E86C1] hover:bg-[#1e5a96] disabled:opacity-50"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="bg-[#2E86C1] hover:bg-[#1e5a96] disabled:opacity-50"
              >
                Next
              </Button>
            </div>
          )}

          {/* Confirmation Modal */}
          {confirmAction && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle>Confirm Action</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    Are you sure you want to {confirmAction.action} this organization?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleToggleStatus}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      {confirmAction.action === "suspend" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Bulk Action Confirmation Modal */}
          {bulkAction && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle>Confirm Bulk Action</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    Are you sure you want to {bulkAction.action} {bulkAction.ids.length} organization{bulkAction.ids.length !== 1 ? "s" : ""}?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleBulkAction}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      {bulkAction.action === "suspend" ? "Suspend All" : "Activate All"}
                    </button>
                    <button
                      onClick={() => setBulkAction(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}
