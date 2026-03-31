"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import type { OrgFeatures } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

interface OrgMember {
  _id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: string;
}

interface OrgDetail {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  isActive: boolean;
  industry?: string;
  size?: string;
  domain?: string;
  memberCount?: number;
  members?: OrgMember[];
  settings?: { timezone?: string; currency?: string; dateFormat?: string };
  features?: OrgFeatures;
  onboardingCompleted?: boolean;
  createdAt: string;
  createdBy?: string;
}

const ALL_FEATURES: { key: keyof OrgFeatures; label: string; description: string }[] = [
  { key: "projects",   label: "Projects",    description: "Project boards and planning" },
  { key: "tasks",      label: "Tasks",       description: "Task management and tracking" },
  { key: "sprints",    label: "Sprints",     description: "Agile sprint planning" },
  { key: "timesheets", label: "Timesheets",  description: "Time tracking and logging" },
  { key: "attendance", label: "Attendance",  description: "Attendance and check-in/out" },
  { key: "leaves",     label: "Leaves",      description: "Leave requests and approvals" },
  { key: "clients",    label: "Clients",     description: "Client management" },
  { key: "invoices",   label: "Invoices",    description: "Invoicing and billing" },
  { key: "reports",    label: "Reports",     description: "Analytics and reporting" },
  { key: "chat",       label: "Chat",        description: "Team messaging" },
  { key: "calls",      label: "Calls",       description: "Audio and video calls" },
  { key: "ai",         label: "AI Features", description: "AI-powered tools and suggestions" },
];

const PLANS = ["free", "starter", "professional", "enterprise"];

export default function PlatformOrganizationDetailPage() {
  const { user, loading, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "activate" | null>(null);
  const [planDropdown, setPlanDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "features">("overview");
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featureDraft, setFeatureDraft] = useState<Record<string, boolean>>({});

  const fetchOrg = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await platformApi.getOrganization(orgId);
      setOrg((res.data || null) as OrgDetail | null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load organization");
    } finally {
      setDataLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !isPlatformAdmin) router.push("/dashboard");
  }, [user, loading, isPlatformAdmin, router]);

  useEffect(() => {
    if (user && isPlatformAdmin && orgId) fetchOrg();
  }, [user, isPlatformAdmin, orgId, fetchOrg]);

  const handleToggleStatus = async () => {
    if (!confirmAction || !org) return;
    try {
      if (confirmAction === "suspend") {
        await platformApi.suspendOrganization(org._id);
        toast.success("Organization suspended");
      } else {
        await platformApi.activateOrganization(org._id);
        toast.success("Organization activated");
      }
      setConfirmAction(null);
      fetchOrg();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleChangePlan = async (plan: string) => {
    if (!org) return;
    try {
      await platformApi.updateOrganizationPlan(org._id, plan);
      toast.success(`Plan updated to ${plan}`);
      setPlanDropdown(false);
      fetchOrg();
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    }
  };

  // Initialize featureDraft when org loads
  useEffect(() => {
    if (!org) return;
    const draft: Record<string, boolean> = {};
    for (const { key } of ALL_FEATURES) {
      draft[key] = org.features?.[key]?.enabled ?? true;
    }
    setFeatureDraft(draft);
  }, [org]);

  const handleSaveFeatures = async () => {
    if (!org) return;
    setFeaturesLoading(true);
    try {
      const features: Record<string, { enabled: boolean }> = {};
      for (const [key, enabled] of Object.entries(featureDraft)) {
        features[key] = { enabled };
      }
      await platformApi.updateOrganizationFeatures(org._id, features);
      toast.success("Feature flags updated");
      fetchOrg();
    } catch (err: any) {
      toast.error(err.message || "Failed to update features");
    } finally {
      setFeaturesLoading(false);
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

  const isSuspended = org?.status === "suspended" || org?.isActive === false;

  return (
    <RouteGuard requirePlatformAdmin>
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/platform/organizations" className="text-[#64748B] hover:text-[#2E86C1] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#0F172A]">Organization Detail</h1>
        </div>

        {/* Tabs */}
        {!dataLoading && org && (
          <div className="flex gap-1 mb-6 border-b border-[#E2E8F0]">
            {(["overview", "features"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-[#2E86C1] text-[#2E86C1]"
                    : "border-transparent text-[#64748B] hover:text-[#334155]"
                }`}
              >
                {tab === "features" ? "Feature Flags" : "Overview"}
              </button>
            ))}
          </div>
        )}

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
        ) : !org ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-[#64748B]">Organization not found.</p>
            </CardContent>
          </Card>
        ) : activeTab === "features" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-[#0F172A]">Feature Flags</CardTitle>
                  <Button size="sm" onClick={handleSaveFeatures} disabled={featuresLoading}>
                    {featuresLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[#64748B] mb-4">Enable or disable features for this organization. Changes take effect immediately.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ALL_FEATURES.map(({ key, label, description }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]"
                    >
                      <div>
                        <p className="text-[13px] font-medium text-[#0F172A]">{label}</p>
                        <p className="text-[11px] text-[#94A3B8]">{description}</p>
                      </div>
                      <button
                        onClick={() => setFeatureDraft((d) => ({ ...d, [key]: !d[key] }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          featureDraft[key] ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"
                        }`}
                        role="switch"
                        aria-checked={featureDraft[key]}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            featureDraft[key] ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-[#0F172A]">{org.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {isSuspended ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">Suspended</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Plan</p>
                    <p className="text-sm font-medium text-[#0F172A] capitalize">{org.plan || "free"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Industry</p>
                    <p className="text-sm font-medium text-[#0F172A] capitalize">{org.industry || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Size</p>
                    <p className="text-sm font-medium text-[#0F172A]">{org.size || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Members</p>
                    <p className="text-sm font-medium text-[#0F172A]">{org.memberCount ?? org.members?.length ?? "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Slug</p>
                    <p className="text-sm font-medium text-[#0F172A]">{org.slug}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Domain</p>
                    <p className="text-sm font-medium text-[#0F172A]">{org.domain || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Onboarding</p>
                    <p className="text-sm font-medium text-[#0F172A]">{org.onboardingCompleted ? "Complete" : "Pending"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Created</p>
                    <p className="text-sm font-medium text-[#0F172A]">
                      {new Date(org.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
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
                  {isSuspended ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setConfirmAction("activate")}
                    >
                      Activate Organization
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmAction("suspend")}
                    >
                      Suspend Organization
                    </Button>
                  )}

                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlanDropdown(!planDropdown)}
                    >
                      Change Plan
                      <svg className="w-3.5 h-3.5 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                    {planDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg border border-[#E2E8F0] shadow-lg z-10 py-1">
                        {PLANS.map((plan) => (
                          <button
                            key={plan}
                            className={`w-full text-left px-4 py-2 text-sm capitalize hover:bg-[#F8FAFC] transition-colors ${
                              org.plan === plan ? "text-[#2E86C1] font-medium" : "text-[#334155]"
                            }`}
                            onClick={() => handleChangePlan(plan)}
                          >
                            {plan}
                            {org.plan === plan && " (current)"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#0F172A]">
                  Members {org.members ? `(${org.members.length})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!org.members || org.members.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-[#64748B]">No member data available.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Name</th>
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Email</th>
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Role</th>
                          <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {org.members.map((member) => (
                          <tr key={member._id || member.userId} className="border-b border-[#F1F5F9]">
                            <td className="px-5 py-3 text-[13px] font-medium text-[#0F172A]">
                              {member.firstName || ""} {member.lastName || ""}
                              {!member.firstName && !member.lastName && <span className="text-[#94A3B8]">--</span>}
                            </td>
                            <td className="px-5 py-3 text-[13px] text-[#334155]">{member.email}</td>
                            <td className="px-5 py-3">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                                {member.role}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                member.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-600 border border-gray-200"
                              }`}>
                                {member.status || "active"}
                              </span>
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
                {confirmAction === "suspend" ? "Suspend Organization?" : "Activate Organization?"}
              </h3>
              <p className="text-sm text-[#64748B] mb-5">
                {confirmAction === "suspend"
                  ? "This will prevent all members from accessing this organization. You can reactivate it later."
                  : "This will restore access for all members of this organization."}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={confirmAction === "suspend" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
                  onClick={handleToggleStatus}
                >
                  {confirmAction === "suspend" ? "Suspend" : "Activate"}
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
