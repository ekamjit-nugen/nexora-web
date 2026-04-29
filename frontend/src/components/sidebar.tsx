"use client";

import { useState, useEffect, useRef } from "react";
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
  defaultOpen?: boolean;
}

const navSections: NavSection[] = [
  {
    title: "MAIN",
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { label: "My Work", href: "/my-work", feature: "tasks", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      // My Tasks — personal todos. Independent of /tasks (project index)
      // and /my-work (assigned work across projects). For lightweight
      // personal use; doesn't require setting up a project.
      { label: "My Tasks", href: "/my-tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Manager", href: "/manager", minRole: "manager", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Calendar", href: "/calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    ],
  },
  {
    title: "COMMUNICATION",
    defaultOpen: true,
    items: [
      { label: "Team Chat", href: "/messages", feature: "chat", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
      { label: "Calls", href: "/calls", minRole: "member", feature: "calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
      { label: "Meetings", href: "/meetings", minRole: "member", feature: "calls", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
      { label: "Standups", href: "/standups", feature: "chat", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Announcements", href: "/payroll/announcements", feature: "chat", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
      { label: "Chat Analytics", href: "/messages/analytics", minRole: "manager", feature: "chat", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    title: "WORK",
    minRole: "member",
    defaultOpen: true,
    items: [
      { label: "Projects", href: "/projects", feature: "projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
      { label: "Roadmap", href: "/projects/roadmap", minRole: "manager", feature: "projects", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
      { label: "Profitability", href: "/projects/profitability", minRole: "manager", feature: "projects", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
      { label: "Bench", href: "/bench", minRole: "manager", feature: "projects", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "Tasks", href: "/tasks", feature: "tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Timesheets", href: "/timesheets", feature: "timesheets", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Reports", href: "/projects/reports", minRole: "manager", feature: "projects", icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
      { label: "Templates", href: "/projects/templates", minRole: "manager", feature: "projects", icon: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" },
    ],
  },
  {
    title: "PEOPLE",
    items: [
      { label: "Directory", href: "/directory", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      // Org Chart hidden from sidebar pending design + content review.
      // Route still exists at /org-chart for direct access; add back here
      // when ready by un-commenting the line below.
      // { label: "Org Chart", href: "/org-chart", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
      { label: "Departments", href: "/departments", minRole: "admin", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
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
    title: "PAYROLL & HR",
    feature: "payroll",
    items: [
      { label: "Payroll Runs", href: "/payroll", minRole: "manager", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "My Payslips", href: "/payroll/payslips", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
      { label: "Salary Structure", href: "/payroll/salary", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Declarations", href: "/payroll/declarations", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Expenses", href: "/payroll/expenses", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
      { label: "Loans", href: "/payroll/loans", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "Statutory Reports", href: "/payroll/statutory-reports", minRole: "manager", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Onboarding", href: "/payroll/onboarding", minRole: "manager", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      { label: "Offboarding", href: "/payroll/offboarding", minRole: "manager", icon: "M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" },
      { label: "Recruitment", href: "/payroll/recruitment", minRole: "manager", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      { label: "Analytics", href: "/payroll/analytics", minRole: "manager", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    title: "PERFORMANCE",
    feature: "performance",
    items: [
      { label: "Goals & OKRs", href: "/payroll/goals", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { label: "OKR Alignment", href: "/okr-alignment", minRole: "manager", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" },
      { label: "Reviews", href: "/payroll/reviews", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { label: "Review Cycles", href: "/payroll/performance-cycles", minRole: "manager", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Kudos", href: "/payroll/kudos", icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label: "Surveys", href: "/payroll/surveys", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { label: "Learning", href: "/payroll/learning", icon: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" },
    ],
  },
  {
    title: "HELPDESK",
    feature: "helpdesk",
    items: [
      { label: "My Tickets", href: "/helpdesk", icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" },
      { label: "All Tickets", href: "/helpdesk/all", minRole: "manager", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
      { label: "Teams", href: "/helpdesk/teams", minRole: "manager", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
      { label: "Dashboard", href: "/helpdesk/dashboard", minRole: "manager", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    title: "IT ASSETS",
    minRole: "member",
    feature: "assetManagement",
    items: [
      { label: "All Assets", href: "/assets", icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" },
      { label: "My Assets", href: "/assets/my", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
      { label: "Categories", href: "/assets/categories", minRole: "admin", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
      { label: "Asset Dashboard", href: "/assets/dashboard", minRole: "manager", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    title: "KNOWLEDGE",
    feature: "knowledge",
    items: [
      { label: "Wiki", href: "/wiki", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
      { label: "Bookmarks", href: "/wiki/bookmarks", icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" },
      { label: "Search", href: "/wiki/search", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
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
      // Custom Fields + Automations are gated by per-tenant feature flags
      // (default OFF). Super admins flip them on per organisation from
      // /platform/organizations/[id] when a tenant is ready for these
      // capabilities. Existing tenants get them off until explicitly enabled.
      { label: "Custom Fields", href: "/settings/custom-fields", minRole: "manager", feature: "customFields", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
      { label: "Automations", href: "/settings/automation-rules", minRole: "manager", feature: "automations", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
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

  // Persist sidebar scroll position
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = sessionStorage.getItem("sidebar-scroll");
    if (saved) nav.scrollTop = parseInt(saved, 10);
    const onScroll = () => sessionStorage.setItem("sidebar-scroll", String(nav.scrollTop));
    nav.addEventListener("scroll", onScroll, { passive: true });
    return () => nav.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile off-canvas state. Closed by default; opens via the hamburger
  // button. Auto-closes when the route changes so navigating from a sidebar
  // link doesn't leave the panel covering the page you just went to.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  // Lock page scroll behind the off-canvas drawer while it's open on mobile.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  // Search
  const [search, setSearch] = useState("");

  // Collapsible sections — store EXPANDED sections (default: only active section open)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(["MAIN"]);
    try {
      const saved = sessionStorage.getItem("sidebar-expanded");
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* fall through */ }
    // Default: only MAIN is open, active section will be auto-opened below
    return new Set(["MAIN"]);
  });

  // Auto-expand the section containing the active page
  useEffect(() => {
    const activeSection = navSections.find(section =>
      section.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"))
    );
    if (activeSection && !expanded.has(activeSection.title)) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.add(activeSection.title);
        sessionStorage.setItem("sidebar-expanded", JSON.stringify(Array.from(next)));
        return next;
      });
    }
  }, [pathname]);

  const toggleSection = (title: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      sessionStorage.setItem("sidebar-expanded", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Fetch projects for board shortcuts
  const [projects, setProjects] = useState<Project[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    projectApi.getAll().then((res) => setProjects(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    taskApi.getMyWork().then((res) => setOverdueCount(res.data?.overdue?.length || 0)).catch(() => {});
  }, []);

  // Filter sections by role, features, and search
  const visibleSections = navSections
    .filter((section) => !section.minRole || hasOrgRole(section.minRole))
    .filter((section) => !section.feature || isFeatureEnabled(section.feature))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.minRole && !hasOrgRole(item.minRole)) return false;
        if (item.feature && !isFeatureEnabled(item.feature)) return false;
        if (search) return item.label.toLowerCase().includes(search.toLowerCase());
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  // Check if any section has active item (for auto-expanding)
  const hasActiveItem = (section: NavSection) => {
    return section.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"));
  };

  const isSearching = search.length > 0;

  return (
    <>
      {/* Mobile drawer toggle — panel-collapsed icon is clearer than the
          generic 3-line hamburger: it depicts a rectangular workspace with
          a filled sidebar column on the left, signalling "reveal panel". */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed top-3 left-3 z-40 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] shadow-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors ${mobileOpen ? 'invisible pointer-events-none' : ''}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          {/* Outer rectangle */}
          <rect x="3" y="4" width="18" height="16" rx="2" />
          {/* Sidebar divider — filled rail on the left to hint "panel" */}
          <line x1="9" y1="4" x2="9" y2="20" />
          <path d="M5 8h2M5 12h2M5 16h2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Backdrop — taps on the dim layer close the drawer */}
      <div
        className={`md:hidden fixed inset-0 bg-[#0F172A]/40 z-40 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar-themed fixed left-0 top-0 bottom-0 w-[260px] bg-[var(--sidebar-bg,#FFFFFF)] border-r border-[var(--sidebar-border,#E2E8F0)] flex flex-col z-50 transition-transform duration-200 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-[var(--sidebar-border,#E2E8F0)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary-hex,#2E86C1)] flex items-center justify-center text-white font-bold text-base">
          N
        </div>
        <span className="text-lg font-bold text-[var(--sidebar-text-active,#0F172A)] tracking-tight">Nexora</span>
      </div>

      {/* Org Switcher */}
      {organizations.length > 0 && (
        <div className="pt-2 px-1">
          <OrgSwitcher currentOrg={currentOrg} organizations={organizations} onSwitch={switchOrg} />
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pages..."
            className="w-full pl-8 pr-8 py-1.5 text-[12px] rounded-lg border border-[var(--sidebar-border,#E2E8F0)] bg-[var(--sidebar-hover,#F8FAFC)] text-[var(--sidebar-text-active,#0F172A)] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[var(--primary-hex,#2E86C1)] focus:border-[var(--primary-hex,#2E86C1)]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-1">
        {/* Platform Admin Section */}
        {isPlatformAdmin && !isSearching && (
          <div className="mb-2">
            <button onClick={() => toggleSection("PLATFORM")} className="w-full flex items-center justify-between px-2 py-1 group">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                {platformSection.title}
                <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-bold">ADMIN</span>
              </p>
              <svg className={`w-3 h-3 text-[#94A3B8] transition-transform duration-200 ${!expanded.has("PLATFORM") ? "-rotate-90" : "rotate-0"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${!expanded.has("PLATFORM") ? "max-h-0 opacity-0" : "max-h-[400px] opacity-100"}`}>
              <div className="space-y-0.5 mt-1">
                {platformSection.items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/platform" && pathname.startsWith(item.href));
                  return (
                    <Link key={item.label} href={item.href}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${active ? "bg-amber-50 text-amber-700" : "text-[var(--sidebar-text,#64748B)] hover:bg-amber-50/50 hover:text-amber-700"}`}>
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 mb-1 border-b border-[var(--sidebar-border,#E2E8F0)]" />
          </div>
        )}

        {/* Main Sections */}
        {visibleSections.map((section) => {
          const isCollapsed = !isSearching && !expanded.has(section.title);
          const sectionHasActive = hasActiveItem(section);

          return (
            <div key={section.title} className={`mb-1 rounded-lg transition-colors duration-200 ${sectionHasActive ? "bg-[var(--sidebar-active-bg,#EFF6FF)]/40" : ""}`}>
              {/* Section Header — clickable to collapse */}
              <button
                onClick={() => !isSearching && toggleSection(section.title)}
                className="w-full flex items-center justify-between px-2 py-1.5 group rounded-md hover:bg-[var(--sidebar-hover,#F1F5F9)] transition-colors"
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${sectionHasActive ? "text-[var(--primary-hex,#2E86C1)]" : "text-[var(--sidebar-section-text,#94A3B8)]"}`}>
                  {sectionHasActive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-hex,#2E86C1)] animate-pulse" />}
                  {section.title}
                  {isCollapsed && sectionHasActive && (
                    <span className="w-4 h-4 rounded-full bg-[var(--primary-hex,#2E86C1)] text-white text-[7px] font-bold flex items-center justify-center">
                      {section.items.filter(item => pathname === item.href || pathname.startsWith(item.href + "/")).length || ""}
                    </span>
                  )}
                </p>
                {!isSearching && (
                  <svg className={`w-3 h-3 text-[#CBD5E1] group-hover:text-[#64748B] transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                )}
              </button>

              {/* Section Items — animated */}
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100"}`}>
                <div className="space-y-0.5 mt-0.5 pb-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href ||
                      (item.href === "/projects" && pathname.startsWith("/projects")) ||
                      (item.href !== "/" && item.href.length > 1 && pathname.startsWith(item.href + "/"));
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                          active
                            ? "bg-[var(--sidebar-active-bg,#EFF6FF)] text-[var(--sidebar-text-active,#2E86C1)]"
                            : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"
                        }`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        <span className="truncate">{item.label}</span>
                        {item.label === "My Work" && overdueCount > 0 && (
                          <span className="ml-auto text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                            {overdueCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  {/* Project Boards under WORK */}
                  {section.title === "WORK" && projects.length > 0 && !isSearching && (
                    <>
                      <p className="px-2.5 mt-2 mb-0.5 text-[9px] font-semibold text-[var(--sidebar-section-text,#94A3B8)] uppercase tracking-wider">Boards</p>
                      {projects.slice(0, 3).map((proj) => {
                        const active = pathname === `/projects/${proj._id}`;
                        return (
                          <Link key={proj._id} href={`/projects/${proj._id}`}
                            className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${active ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active,#2E86C1)]" : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${active ? "bg-[var(--primary-hex,#2E86C1)] text-white" : "bg-[var(--sidebar-hover,#F1F5F9)] text-[var(--sidebar-text,#64748B)]"}`}>
                              {proj.projectKey?.slice(0, 2) || proj.projectName?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="truncate">{proj.projectName}</span>
                          </Link>
                        );
                      })}
                      {projects.length > 3 && (
                        <Link href="/projects" className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-medium text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          View all ({projects.length})
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* No results */}
        {isSearching && visibleSections.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-[#94A3B8]">No pages match &quot;{search}&quot;</p>
          </div>
        )}
      </nav>

      {/* Bottom: Tutorials + Settings */}
      <div className="border-t border-[var(--sidebar-border,#E2E8F0)] px-3 py-1.5 space-y-0.5">
        <Link href="/tutorials"
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${pathname.startsWith("/tutorials") ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active,#2E86C1)]" : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
          Tutorials
        </Link>
        <Link href="/settings"
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${pathname.startsWith("/settings") ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active,#2E86C1)]" : "text-[var(--sidebar-text,#64748B)] hover:bg-[var(--sidebar-hover,#F1F5F9)] hover:text-[var(--sidebar-text-active,#334155)]"}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      </div>

      {/* "Preview all features" toggle — only visible to owner / admin /
          platform admin. By default, even an owner sees the same sidebar
          their employees see (i.e. with disabled features hidden). This
          toggle lets them temporarily un-hide everything so they can
          configure modules that are flagged off. Persists in localStorage
          across reloads. */}
      <PreviewFeaturesToggle visibleTo={isPlatformAdmin || hasOrgRole("admin")} />

      {/* User Card */}
      <div className="p-3 border-t border-[var(--sidebar-border,#E2E8F0)]">
        <div className="flex items-center gap-2.5 p-1.5">
          <Avatar className="h-8 w-8 bg-[var(--primary-hex,#2E86C1)]">
            <AvatarFallback className="bg-[var(--primary-hex,#2E86C1)] text-white text-[10px] font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[var(--sidebar-text-active,#0F172A)] truncate">{user.firstName} {user.lastName}</p>
            <p className="text-[10px] text-[var(--sidebar-section-text,#94A3B8)] truncate capitalize">{
              ["super_admin", "admin", "hr", "manager", "developer", "designer", "employee", "user"]
                .find(r => user.roles?.includes(r)) || user.role || "Member"
            }</p>
          </div>
          <button onClick={onLogout} className="p-1.5 rounded-md text-[var(--sidebar-text,#94A3B8)] hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Logout">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}

/**
 * Sidebar toggle for owners/admins/platform admins to flip between
 * "see what end users see" (default — feature flags respected) and
 * "preview all" (every module visible regardless of flag — useful for
 * configuration moments).
 *
 * The toggle persists via localStorage key `nexora.previewAllFeatures`.
 * `useAuth().isFeatureEnabled` reads the same key, so the next render
 * already shows the new state.
 */
function PreviewFeaturesToggle({ visibleTo }: { visibleTo: boolean }) {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(localStorage.getItem("nexora.previewAllFeatures") === "true");
  }, []);

  if (!visibleTo) return null;

  const flip = () => {
    const next = !enabled;
    setEnabled(next);
    if (typeof window !== "undefined") {
      if (next) localStorage.setItem("nexora.previewAllFeatures", "true");
      else localStorage.removeItem("nexora.previewAllFeatures");
    }
    // Force a soft re-render so isFeatureEnabled re-reads localStorage.
    // useAuth's previewAllFeatures is read on every render via a fresh
    // localStorage call, so a route change OR React state nudge picks
    // it up. Use a hash flip — cheap, no full reload.
    window.dispatchEvent(new Event("nexora:features-preview-changed"));
    setTimeout(() => window.location.reload(), 0);
  };

  return (
    <div className="mx-3 mt-2 mb-1 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] font-semibold text-amber-900 leading-tight">
            {enabled ? "Previewing all features" : "Showing live features only"}
          </div>
          <div className="mt-0.5 text-[10px] text-amber-700/90 leading-snug">
            {enabled
              ? "You're seeing modules that are disabled for your team."
              : "Only modules enabled for your team are visible."}
          </div>
          <button
            onClick={flip}
            className="mt-1.5 text-[10.5px] font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {enabled ? "← Back to live view" : "Show disabled features →"}
          </button>
        </div>
      </div>
    </div>
  );
}
