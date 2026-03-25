"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { OrgSwitcher } from "@/components/org-switcher";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/lib/api";

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  iconFill?: boolean;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
  roles?: string[];
}

const navSections: NavSection[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { label: "Calendar", href: "/calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Chat", href: "/messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
      { label: "Calls", href: "/calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    ],
  },
  {
    title: "TIME & ATTENDANCE",
    items: [
      { label: "Attendance", href: "/attendance", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Leaves", href: "/leaves", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
    ],
  },
  {
    title: "PEOPLE",
    items: [
      { label: "Directory", href: "/directory", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { label: "Departments", href: "/departments", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", roles: ["admin", "super_admin", "hr"] },
    ],
  },
  {
    title: "FINANCE",
    roles: ["admin", "super_admin", "hr", "manager"],
    items: [
      { label: "Invoices", href: "/invoices", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
      { label: "Expenses", href: "#", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
      { label: "Clients", href: "/clients", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    ],
  },
  {
    title: "ADMIN",
    roles: ["admin", "super_admin"],
    items: [
      { label: "Roles", href: "/roles", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { label: "Policies", href: "/policies", icon: "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2", roles: ["admin", "super_admin", "hr"] },
    ],
  },
];

function hasRequiredRole(userRoles: string[], requiredRoles?: string[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return userRoles.some((r) => requiredRoles.includes(r));
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { currentOrg, organizations, switchOrg } = useAuth();
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const userRoles = user.roles || [];

  // Filter sections and items based on user roles
  const visibleSections = navSections
    .filter((section) => hasRequiredRole(userRoles, section.roles))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasRequiredRole(userRoles, item.roles)),
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
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-[var(--sidebar-section-text,#94A3B8)] uppercase tracking-wider">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
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
                  </Link>
                );
              })}
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
