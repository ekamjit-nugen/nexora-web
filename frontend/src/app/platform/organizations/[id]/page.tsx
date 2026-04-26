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

// Cross-tenant stats hydrated by the platform admin endpoint. Every
// number is best-effort — a missing collection or a fresh tenant
// returns zeroes. The frontend renders cards even when zero so the
// layout stays consistent (and tells the admin "yes, we checked, and
// there's nothing here yet").
interface OrgStats {
  employees: { total: number; active: number; exited: number; onLeave: number; probation: number; onNotice: number };
  designations: number;
  departments: number;
  clients: number;
  invoices: { total: number; draft: number; sent: number; paid: number; overdue: number; outstanding: number };
  attendance: { total: number; last30Days: number };
  holidays: number;
  tasks: { total: number; todo: number; inProgress: number; done: number; blocked: number };
}

interface OrgAdmin {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: string;
  lastLogin: string | null;
}

// Full member roster — same shape as OrgAdmin plus status/joinedAt.
// Every membership in the org is included (active + inactive),
// capped at 200 by the backend. The Members panel filters this
// list client-side for the typical case of <200 members; very
// large tenants will need a paginated route later.
interface OrgMemberRow {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
  lastLogin: string | null;
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
  logo?: string | null;
  memberCount?: number;
  // Backend now returns either an object (new shape) or an array (legacy
  // for flag-history view). The page only consumes the object form.
  members?: { active: number; inactive: number; total: number };
  // Full member roster (active + inactive, capped at 200 backend-side).
  memberList?: OrgMemberRow[];
  admins?: OrgAdmin[];
  stats?: OrgStats;
  settings?: { timezone?: string; currency?: string; dateFormat?: string };
  features?: OrgFeatures;
  onboardingCompleted?: boolean;
  createdAt: string;
  createdBy?: string;
}

// Initials-fallback avatar for orgs that haven't uploaded a logo.
// Color is hashed deterministically off the name so the same org
// always gets the same shade — helps platform admins pattern-match
// across the list and detail pages.
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

function OrgAvatar({ org, size = 56 }: { org: { logo?: string | null; name: string }; size?: number }) {
  const initials = org.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
  const tone = avatarToneFor(org.name);
  if (org.logo) {
    return (
      <img
        src={org.logo}
        alt={org.name}
        className="rounded-xl object-cover border border-[#E2E8F0] shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`${tone.bg} ${tone.text} rounded-xl flex items-center justify-center font-bold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// Activity-snapshot card with a colored top border. Used in the
// Overview tab's stats grid. Tones match the rest of the platform
// admin styling — red is reserved for "needs attention" (overdue),
// emerald for healthy/positive, amber for informational.
function StatCard(props: {
  label: string;
  value: string;
  sub: string;
  tone: 'blue' | 'violet' | 'red' | 'emerald' | 'amber' | 'slate';
}) {
  const TONES: Record<string, { bg: string; text: string; bar: string }> = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-500' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  bar: 'bg-violet-500' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     bar: 'bg-red-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-500' },
    slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   bar: 'bg-slate-500' },
  };
  const t = TONES[props.tone];
  return (
    <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
      <div className={`h-1 ${t.bar}`} />
      <div className="p-3">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${t.text}`}>{props.label}</div>
        <div className="text-2xl font-bold text-[#0F172A] mt-0.5">{props.value}</div>
        <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate" title={props.sub}>{props.sub}</div>
      </div>
    </div>
  );
}

// Every gateable feature in the platform. Order maps to the order they
// render in the org features tab — kept loosely grouped (work → people →
// payroll → ops → ai). Adding a new flag here requires (a) a matching
// key in IOrganizationFeatures (auth-service), (b) the OrgFeatures
// interface in api.ts, and (c) a `feature:` reference somewhere in
// sidebar.tsx so the toggle actually hides something.
const ALL_FEATURES: { key: keyof OrgFeatures; label: string; description: string }[] = [
  // Work
  { key: "projects",   label: "Projects",    description: "Project boards and planning" },
  { key: "tasks",      label: "Tasks",       description: "Task management and tracking" },
  { key: "sprints",    label: "Sprints",     description: "Agile sprint planning" },
  { key: "timesheets", label: "Timesheets",  description: "Time tracking and logging" },
  // Time
  { key: "attendance", label: "Attendance",  description: "Attendance and check-in/out" },
  { key: "leaves",     label: "Leaves",      description: "Leave requests and approvals" },
  // Finance
  { key: "clients",    label: "Clients",     description: "Client management" },
  { key: "invoices",   label: "Invoices",    description: "Invoicing and billing" },
  { key: "reports",    label: "Reports",     description: "Analytics and reporting" },
  // Communication
  { key: "chat",       label: "Chat",        description: "Team messaging, standups, announcements" },
  { key: "calls",      label: "Calls",       description: "Audio and video calls + meetings" },
  // Section-level gates (added for tenant-scoped rollouts)
  { key: "payroll",     label: "Payroll & HR",   description: "Payroll runs, payslips, statutory reports, onboarding/offboarding" },
  { key: "performance", label: "Performance",    description: "Goals, OKRs, reviews, kudos, surveys, learning" },
  { key: "helpdesk",    label: "Helpdesk",       description: "Internal IT/HR ticketing" },
  { key: "knowledge",   label: "Knowledge / Wiki", description: "Wiki, bookmarks, search" },
  { key: "assetManagement",  label: "IT Assets",      description: "Asset directory, categories, dashboard" },
  { key: "expenseManagement", label: "Expenses",       description: "Expense claims and reimbursements" },
  { key: "recruitment",      label: "Recruitment",     description: "Jobs, candidates, hiring pipeline" },
  // AI
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
  // Members panel filters. Three discrete states for the status pill —
  // 'all' shows everyone, 'active' is the default useful view, 'inactive'
  // surfaces ex-employees for audit. Search is a free-text contains-match
  // on name + email; trimmed lowercased on input so the UX matches what
  // platform admins type (e.g. "varun" hits "Varun Sharma").
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [memberSearch, setMemberSearch] = useState("");

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

      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
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
            {/* Overview — header now leads with the org avatar so a
                platform admin landing on a tenant page gets visual
                anchoring before they read the metadata grid. */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <OrgAvatar org={org} size={56} />
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold text-[#0F172A] truncate">{org.name}</CardTitle>
                      <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{org.slug}{org.industry ? ` · ${org.industry}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                    <p className="text-xs text-[#94A3B8] mb-1" title="Active seats / total members. Active counts toward billing.">Seats</p>
                    {/* Stack: big number on top, "of N" sub-line. Same
                        pattern as the list table for consistency.
                        Inactive count moves to a second line so it
                        never wraps the primary figure. */}
                    {org.members ? (
                      <div className="leading-tight">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-semibold text-[#0F172A]">{org.members.active}</span>
                          <span className="text-xs text-[#94A3B8]">of {org.members.total}</span>
                        </div>
                        {org.members.inactive > 0 && (
                          <div className="text-[10px] text-[#94A3B8] mt-0.5">{org.members.inactive} inactive</div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-[#0F172A]">{org.memberCount ?? "--"}</p>
                    )}
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

            {/* People — members breakdown + admins panel.
                The legacy "Members" table here was always empty
                (the platform admin endpoint never returned a member
                list). We replace it with what platform admins actually
                want to see at a glance: current admin/owner roster and
                a clear active-vs-exited count. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-[#0F172A]">People</CardTitle>
                </CardHeader>
                <CardContent>
                  {org.members ? (
                    <>
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-[#0F172A]">{org.members.active}</span>
                        <span className="text-sm text-[#64748B]">active seats</span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-1">
                        out of {org.members.total} total members
                        {org.members.inactive > 0 && ` · ${org.members.inactive} inactive`}
                      </div>
                      {/* Employee status breakdown — visual proportion
                          bar + colored-dot legend rows. Replaces the
                          older two-column flex-justify-between layout
                          that wrapped awkwardly when totals went above
                          two digits. The bar segment widths are
                          % of total non-zero buckets, so a tenant
                          with 0 exited still gets a clean bar. */}
                      {org.stats?.employees && org.stats.employees.total > 0 && (() => {
                        const e = org.stats.employees;
                        const buckets = [
                          { key: 'active',    label: 'Active',     count: e.active,    bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
                          { key: 'probation', label: 'Probation',  count: e.probation, bar: 'bg-amber-500',   dot: 'bg-amber-500' },
                          { key: 'onLeave',   label: 'On leave',   count: e.onLeave,   bar: 'bg-blue-500',    dot: 'bg-blue-500' },
                          { key: 'onNotice',  label: 'On notice',  count: e.onNotice,  bar: 'bg-rose-500',    dot: 'bg-rose-500' },
                          { key: 'exited',    label: 'Exited',     count: e.exited,    bar: 'bg-slate-400',   dot: 'bg-slate-400' },
                        ].filter(b => b.count > 0);
                        const total = e.total || 1;
                        return (
                          <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                            {/* Stacked proportion bar */}
                            <div className="flex h-2 rounded-full overflow-hidden bg-[#F1F5F9]">
                              {buckets.map(b => (
                                <div
                                  key={b.key}
                                  className={b.bar}
                                  style={{ width: `${(b.count / total) * 100}%` }}
                                  title={`${b.label}: ${b.count} (${Math.round((b.count / total) * 100)}%)`}
                                />
                              ))}
                            </div>
                            {/* Legend — one row per non-zero bucket.
                                Single-column flow keeps each label
                                next to its dot at any breakpoint. */}
                            <ul className="mt-3 space-y-1.5">
                              {buckets.map(b => (
                                <li key={b.key} className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-2 text-[#64748B]">
                                    <span className={`w-2 h-2 rounded-full ${b.dot}`} />
                                    {b.label}
                                  </span>
                                  <span className="font-semibold text-[#0F172A] tabular-nums">{b.count}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-sm text-[#64748B]">No member data.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-[#0F172A]">
                    Admins {org.admins && org.admins.length > 0 ? `(${org.admins.length})` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!org.admins || org.admins.length === 0 ? (
                    <p className="text-sm text-[#64748B]">No admins configured.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {org.admins.map((a) => (
                        <div key={a.userId} className="flex items-center gap-3">
                          {a.avatar ? (
                            <img src={a.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#EBF5FB] text-[#2E86C1] text-xs font-semibold flex items-center justify-center">
                              {(a.firstName?.[0] || a.email?.[0] || "?").toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-[#0F172A] truncate">
                              {a.firstName || ""} {a.lastName || ""}
                              {!a.firstName && !a.lastName && <span className="text-[#94A3B8]">{a.email}</span>}
                            </div>
                            <div className="text-[11px] text-[#94A3B8] truncate">{a.email}</div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                            a.role === "owner" ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : a.role === "admin" ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-violet-50 text-violet-700 border border-violet-200"
                          }`}>
                            {a.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Activity stats — cross-tenant snapshot. Each card maps
                to one Nexora subsystem (HR, attendance, tasks, finance).
                Numbers default to zero rather than dashes so platform
                admins can quickly visually scan multiple tenant detail
                pages without "is this missing or just zero?" ambiguity. */}
            {org.stats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-[#0F172A]">Activity & Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      label="Attendance"
                      value={org.stats.attendance.total.toLocaleString()}
                      sub={`${org.stats.attendance.last30Days} in last 30d`}
                      tone="blue"
                    />
                    <StatCard
                      label="Tasks"
                      value={org.stats.tasks.total.toLocaleString()}
                      sub={`${org.stats.tasks.todo} todo · ${org.stats.tasks.done} done${org.stats.tasks.blocked > 0 ? ` · ${org.stats.tasks.blocked} blocked` : ""}`}
                      tone="violet"
                    />
                    <StatCard
                      label="Invoices"
                      value={org.stats.invoices.total.toLocaleString()}
                      sub={`${org.stats.invoices.overdue} overdue · ₹${org.stats.invoices.outstanding.toLocaleString("en-IN")} outstanding`}
                      tone={org.stats.invoices.overdue > 0 ? "red" : "emerald"}
                    />
                    <StatCard
                      label="Clients"
                      value={org.stats.clients.toLocaleString()}
                      sub="active relationships"
                      tone="emerald"
                    />
                    <StatCard
                      label="Holidays"
                      value={org.stats.holidays.toLocaleString()}
                      sub="declared"
                      tone="amber"
                    />
                    <StatCard
                      label="Designations"
                      value={org.stats.designations.toLocaleString()}
                      sub={`${org.stats.departments} departments`}
                      tone="slate"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Members — full roster (active + inactive). Filter
                pills (All / Active / Inactive) + free-text search.
                Lives on the Overview tab so platform admins can audit
                the org's people without a dedicated members route. */}
            {org.memberList && org.memberList.length > 0 && (() => {
              const list = org.memberList;
              const counts = {
                all: list.length,
                active: list.filter((m) => m.status === 'active').length,
                inactive: list.filter((m) => m.status === 'inactive').length,
              };
              const q = memberSearch.trim().toLowerCase();
              const filtered = list.filter((m) => {
                if (memberStatusFilter !== 'all' && m.status !== memberStatusFilter) return false;
                if (q) {
                  const haystack = `${m.firstName || ''} ${m.lastName || ''} ${m.email || ''}`.toLowerCase();
                  if (!haystack.includes(q)) return false;
                }
                return true;
              });
              const ROLE_TONES: Record<string, string> = {
                owner:    'bg-amber-50 text-amber-700 border-amber-200',
                admin:    'bg-blue-50 text-blue-700 border-blue-200',
                hr:       'bg-violet-50 text-violet-700 border-violet-200',
                manager:  'bg-cyan-50 text-cyan-700 border-cyan-200',
                employee: 'bg-slate-50 text-slate-700 border-slate-200',
              };
              return (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <CardTitle className="text-sm font-semibold text-[#0F172A]">
                        All members <span className="text-[#94A3B8] font-normal">({list.length})</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-1 justify-end max-w-md">
                        {/* Status filter pills */}
                        <div className="inline-flex rounded-lg border border-[#E2E8F0] p-0.5 bg-[#F8FAFC]">
                          {(['all', 'active', 'inactive'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setMemberStatusFilter(s)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                memberStatusFilter === s
                                  ? 'bg-white text-[#0F172A] shadow-sm'
                                  : 'text-[#64748B] hover:text-[#0F172A]'
                              }`}
                            >
                              <span className="capitalize">{s}</span>
                              <span className="ml-1 text-[10px] text-[#94A3B8]">{counts[s]}</span>
                            </button>
                          ))}
                        </div>
                        {/* Search */}
                        <input
                          type="search"
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder="Search name or email"
                          className="flex-1 min-w-[140px] h-7 px-2.5 text-[12px] rounded-md border border-[#E2E8F0] bg-white focus:outline-none focus:ring-1 focus:ring-[#2E86C1] focus:border-[#2E86C1]"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filtered.length === 0 ? (
                      <div className="p-6 text-center text-[13px] text-[#94A3B8]">
                        No members match this filter.
                      </div>
                    ) : (
                      <div className="max-h-[480px] overflow-y-auto border-t border-[#F1F5F9]">
                        <ul className="divide-y divide-[#F1F5F9]">
                          {filtered.map((m) => {
                            const initials = (m.firstName?.[0] || m.email?.[0] || '?').toUpperCase()
                              + (m.lastName?.[0] || '').toUpperCase();
                            const isActive = m.status === 'active';
                            return (
                              <li key={m.userId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#F8FAFC]">
                                {m.avatar ? (
                                  <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                                    isActive ? 'bg-[#EBF5FB] text-[#2E86C1]' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {initials || '?'}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[13px] truncate ${isActive ? 'font-medium text-[#0F172A]' : 'text-[#64748B]'}`}>
                                    {m.firstName || ''} {m.lastName || ''}
                                    {!m.firstName && !m.lastName && <span className="italic">{m.email}</span>}
                                  </div>
                                  <div className="text-[11px] text-[#94A3B8] truncate">{m.email}</div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize border ${ROLE_TONES[m.role] || ROLE_TONES.employee}`}>
                                  {m.role}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                  {m.status}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {filtered.length > 0 && filtered.length < list.length && (
                      <div className="px-5 py-2 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8]">
                        Showing {filtered.length} of {list.length}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
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
