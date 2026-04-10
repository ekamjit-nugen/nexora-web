"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { OrgSwitcher } from "@/components/org-switcher";
import { useAuth } from "@/lib/auth-context";
import { projectApi, taskApi } from "@/lib/api";
import type { User, Project, OrgFeatures } from "@/lib/api";

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  iconFill?: boolean;
  minRole?: string;
  feature?: keyof OrgFeatures;
}

interface NavSection {
  title: string;
  items: NavItem[];
  minRole?: string;
  feature?: keyof OrgFeatures;
}

const navSections: NavSection[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { label: "My Work", href: "/my-work", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { label: "Manager", href: "/manager", minRole: "manager", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Calendar", href: "/calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Team Chat", href: "/messages", feature: "chat", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
      { label: "Calls", href: "/calls", minRole: "member", feature: "calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    ],
  },
  {
    title: "WORK",
    minRole: "member",
    items: [
      { label: "Projects", href: "/projects", feature: "projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
      { label: "Profitability", href: "/projects/profitability", minRole: "manager", feature: "projects", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
      { label: "Tasks", href: "/tasks", feature: "tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Timesheets", href: "/timesheets", feature: "timesheets", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    ],
  },
  {
    title: "TIME & ATTENDANCE",
    minRole: "member",
    items: [
      { label: "Attendance", href: "/attendance", feature: "attendance", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Leaves", href: "/leaves", feature: "leaves", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
    ],
  },
  {
    title: "PEOPLE",
    items: [
      { label: "Directory", href: "/directory", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { label: "Org Chart", href: "/org-chart", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
      { label: "Departments", href: "/departments", minRole: "admin", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    ],
  },
  {
    title: "PAYROLL",
    items: [
      { label: "Payroll Runs", href: "/payroll", minRole: "manager", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "My Payslips", href: "/payroll/payslips", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
      { label: "Salary Structure", href: "/payroll/salary", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Declarations", href: "/payroll/declarations", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Statutory Reports", href: "/payroll/statutory-reports", minRole: "manager", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Expenses", href: "/payroll/expenses", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
      { label: "Onboarding", href: "/payroll/onboarding", minRole: "manager", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      { label: "Offboarding", href: "/payroll/offboarding", minRole: "manager", icon: "M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" },
      { label: "Loans", href: "/payroll/loans", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "Goals & OKRs", href: "/payroll/goals", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { label: "Reviews", href: "/payroll/reviews", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Review Cycles", href: "/payroll/performance-cycles", minRole: "manager", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Recruitment", href: "/payroll/recruitment", minRole: "manager", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      { label: "Analytics", href: "/payroll/analytics", minRole: "manager", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    title: "ENGAGEMENT",
    items: [
      { label: "Announcements", href: "/payroll/announcements", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
      { label: "Kudos", href: "/payroll/kudos", icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Surveys", href: "/payroll/surveys", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Learning", href: "/payroll/learning", icon: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" },
    ],
  },
  {
    title: "FINANCE",
    minRole: "manager",
    items: [
      { label: "Clients", href: "/clients", feature: "clients", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { label: "Invoices", href: "/invoices", feature: "invoices", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
      { label: "Reports", href: "/reports", feature: "reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    title: "ADMIN",
    minRole: "admin",
    items: [
      { label: "Roles", href: "/roles", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { label: "Policies", href: "/policies", icon: "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" },
      { label: "Custom Fields", href: "/settings/custom-fields", minRole: "manager", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
      { label: "Automations", href: "/settings/automation-rules", minRole: "manager", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    ],
  },
];


const platformSection: NavSection = {
  title: "PLATFORM",
  items: [
    { label: "Platform Dashboard", href: "/platform", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" },
    { label: "Organizations", href: "/platform/organizations", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    { label: "All Users", href: "/platform/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { label: "Analytics", href: "/platform/analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { label: "Audit Logs", href: "/platform/audit-logs", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  ],
};

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { currentOrg, organizations, switchOrg, isPlatformAdmin, hasOrgRole, isFeatureEnabled } = useAuth();
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  // Fetch all projects for board shortcuts
  const [projects, setProjects] = useState<Project[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    projectApi.getAll().then((res) => {
      setProjects(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
    taskApi.getMyWork().then((res) => {
      setOverdueCount(res.data?.overdue?.length || 0);
    }).catch(() => {});
  }, []);

  // Filter sections and items based on org role hierarchy and feature flags
  const visibleSections = navSections
    .filter((section) => !section.minRole || hasOrgRole(section.minRole))
    .filter((section) => !section.feature || isFeatureEnabled(section.feature))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.minRole && !hasOrgRole(item.minRole)) return false;
        if (item.feature && !isFeatureEnabled(item.feature)) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="sidebar-themed fixed left-0 top-0 bottom-0 w-[260px] bg-[var(--sidebar-bg,#FFFFFF)] border-r border-[var(--sidebar-border,#E2E8F0)] flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[var(--sidebar-border,#E2E8F0)]">
        <div className="w-9 h-9 rounded-lg bg-[var(--primary-hex,#2E86C1)] flex items-center justify-center text-white font-bold text-lg">
          N
        </div>
        <span className="text-xl font-bold text-[var(--sidebar-text-active,#0F172A)] tracking-tight">Nexora</span>
      </div>

      {/* Org Switcher */}
      {organizations.length > 0 && (
        <div className="pt-3">
          <OrgSwitcher
            currentOrg={currentOrg}
            organizations={organizations}
            onSwitch={switchOrg}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Platform Admin Section */}
        {isPlatformAdmin && (
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              {platformSection.title}
              <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>
            </p>
            <div className="space-y-0.5">
              {platformSection.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/platform" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "text-[var(--sidebar-text,#64748B)] hover:bg-amber-50/50 hover:text-amber-700 dark:hover:bg-amber-900/20"
                    }`}
                  >
                    <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 mb-1 border-b border-[var(--sidebar-border,#E2E8F0)]" />
          </div>
        )}
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-[var(--sidebar-section-text,#94A3B8)] uppercase tracking-wider">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href === "/projects" && pathname.startsWith("/projects"));
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active,#2E86C1)]"
                        : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"
                    }`}
                  >
                    <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                    {item.label === "My Work" && overdueCount > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {overdueCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              {/* Project Boards */}
              {section.title === "WORK" && projects.length > 0 && (
                <>
                  <p className="px-3 mt-3 mb-1 text-[9px] font-semibold text-[var(--sidebar-section-text,#94A3B8)] uppercase tracking-wider">Boards</p>
                  {projects.slice(0, 3).map((proj) => {
                    const active = pathname === `/projects/${proj._id}`;
                    return (
                      <Link
                        key={proj._id}
                        href={`/projects/${proj._id}`}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                          active
                            ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active,#2E86C1)]"
                            : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          active ? "bg-[var(--primary-hex,#2E86C1)] text-white" : "bg-[var(--sidebar-hover,#F1F5F9)] text-[var(--sidebar-text,#64748B)]"
                        }`}>
                          {proj.projectKey?.slice(0, 2) || proj.projectName?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="truncate">{proj.projectName}</span>
                      </Link>
                    );
                  })}
                  {projects.length > 3 && (
                    <Link
                      href="/projects"
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)] transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      View all ({projects.length})
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      {/* Settings & Logout */}
      <div className="px-3 py-2">
        <Link
          href="/settings"
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active,#2E86C1)]"
              : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"
          }`}
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      </div>

      {/* User card */}
      <div className="p-3 border-t border-[var(--sidebar-border,#E2E8F0)]">
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-9 w-9 bg-[var(--primary-hex,#2E86C1)]">
            <AvatarFallback className="bg-[var(--primary-hex,#2E86C1)] text-white text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--sidebar-text-active,#0F172A)] truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-[var(--sidebar-section-text,#94A3B8)] truncate capitalize">{
              ["super_admin", "admin", "hr", "manager", "developer", "designer", "employee", "user"]
                .find(r => user.roles?.includes(r)) || user.role || "Member"
            }</p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-md text-[var(--sidebar-text,#94A3B8)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Logout"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
