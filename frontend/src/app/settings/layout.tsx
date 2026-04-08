"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";

interface SettingsNavItem {
  label: string;
  href: string;
  icon: string;
  ownerOnly?: boolean;
}

interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
  roles?: string[];
}

const settingsSections: SettingsNavSection[] = [
  {
    title: "ACCOUNT",
    items: [
      { label: "Profile", href: "/settings/profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
      { label: "Security", href: "/settings/security", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
      { label: "Appearance", href: "/settings/appearance", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
      { label: "Chat Appearance", href: "/settings/chat-appearance", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    ],
  },
  {
    title: "ORGANIZATION",
    roles: ["admin", "super_admin", "hr", "owner"],
    items: [
      { label: "General", href: "/settings/organization", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { label: "Business & Legal", href: "/settings/business", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Work Preferences", href: "/settings/work-preferences", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Departments", href: "/settings/departments", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
      { label: "Members", href: "/settings/members", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { label: "Notifications", href: "/settings/notifications", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    ],
  },
  {
    title: "ADVANCED",
    roles: ["admin", "super_admin", "owner"],
    items: [
      { label: "Payroll", href: "/settings/payroll", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "Branding", href: "/settings/branding", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
      { label: "Features", href: "/settings/features", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
      { label: "Integrations", href: "/settings/integrations", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
      { label: "Billing", href: "/settings/billing", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
      { label: "Billing Rates", href: "/settings/billing-rates", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
    ],
  },
  {
    title: "CHAT ADMIN",
    roles: ["admin", "super_admin", "owner"],
    items: [
      { label: "Moderation", href: "/settings/moderation", icon: "M12 9v2m0 4h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" },
      { label: "Compliance", href: "/settings/compliance", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { label: "Chat Analytics", href: "/settings/analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
      { label: "Webhooks", href: "/settings/webhooks", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
    ],
  },
  {
    title: "",
    roles: ["owner"],
    items: [
      { label: "Danger Zone", href: "/settings/danger-zone", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    ],
  },
];

function hasRequiredRole(userRoles: string[], orgRole: string, requiredRoles?: string[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  const allRoles = [...userRoles, orgRole];
  return allRoles.some((r) => requiredRoles.includes(r));
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, orgRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [settingsNavOpen, setSettingsNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

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

  if (!user) return null;

  const userRoles = user.roles || [];

  const visibleSections = settingsSections.filter((section) =>
    hasRequiredRole(userRoles, orgRole, section.roles)
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 md:ml-[260px] p-4 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          {/* Mobile hamburger for settings nav */}
          <button
            onClick={() => setSettingsNavOpen(!settingsNavOpen)}
            className="md:hidden p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] transition-colors -ml-1"
            aria-label="Toggle settings menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-[#0F172A]">Settings</h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Manage your account settings and preferences.
            </p>
          </div>
        </div>

        <div className="flex gap-6 relative">
          {/* Settings sub-navigation */}
          <nav className={`${settingsNavOpen ? 'block' : 'hidden'} md:block absolute md:relative z-30 bg-white md:bg-transparent rounded-xl md:rounded-none shadow-xl md:shadow-none p-4 md:p-0 left-0 top-0 w-[260px] md:w-[220px] shrink-0 border md:border-0 border-[#E2E8F0]`}>
            <div className="space-y-5">
              {visibleSections.map((section, sectionIndex) => (
                <div key={section.title || `section-${sectionIndex}`}>
                  {section.title === "" && (
                    <hr className="border-[#E2E8F0] my-3" />
                  )}
                  {section.title && (
                    <p className="px-3 mb-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      {section.title}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = pathname === item.href;
                      const isDangerZone = item.label === "Danger Zone";
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setSettingsNavOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                            isDangerZone
                              ? active
                                ? "bg-red-50 text-red-500"
                                : "text-red-500 hover:bg-red-50 hover:text-red-600"
                              : active
                                ? "bg-[#EBF5FF] text-[#2E86C1]"
                                : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#334155]"
                          }`}
                        >
                          <svg
                            className="w-[18px] h-[18px] shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Content area - full width on mobile, add horizontal scroll for tables */}
          <div className="flex-1 min-w-0 overflow-x-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
