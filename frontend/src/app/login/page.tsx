"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { authApi, orgApi, hrApi } from "@/lib/api";
import type { Organization, Employee } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type LoginPhase = "email" | "verify" | "orgs" | "welcome-splash" | "profile" | "org-setup" | "team-setup" | "setting-up";

const TEAM_ROLES: { role: string; label: string; desc: string; icon: string; color: string; bgColor: string }[] = [
  { role: "hr", label: "HR", desc: "Manage people, attendance & leaves", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "text-violet-600", bgColor: "bg-violet-50 border-violet-100" },
  { role: "manager", label: "Manager", desc: "Oversee projects & teams", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-100" },
  { role: "developer", label: "Developer", desc: "Build & ship features", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-100" },
  { role: "designer", label: "Designer", desc: "Design & prototype", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", color: "text-pink-600", bgColor: "bg-pink-50 border-pink-100" },
  { role: "employee", label: "Sales", desc: "Drive revenue & client relations", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-100" },
  { role: "employee", label: "Finance", desc: "Invoices, expenses & payroll", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-cyan-600", bgColor: "bg-cyan-50 border-cyan-100" },
];

function SetupChecklist() {
  const [completed, setCompleted] = useState<number[]>([]);
  const items = [
    "Creating your dashboard",
    "Setting up default roles",
    "Configuring workspace policies",
    "Preparing team management",
    "Finalizing your account",
  ];

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    items.forEach((_, i) => {
      timers.push(setTimeout(() => setCompleted(prev => [...prev, i]), 600 * (i + 1)));
    });
    timers.push(setTimeout(() => {
      window.location.href = "/dashboard";
    }, 600 * items.length + 800));
    return () => timers.forEach(t => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 w-full max-w-xs">
      {items.map((item, i) => {
        const done = completed.includes(i);
        const active = !done && (i === 0 || completed.includes(i - 1));
        return (
          <div key={item} className={`flex items-center gap-3 transition-all duration-300 ${done ? "opacity-100" : active ? "opacity-100" : "opacity-40"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
              done ? "bg-emerald-500 text-white scale-100" : active ? "bg-[#2E86C1]/20 scale-100" : "bg-[#E2E8F0] scale-90"
            }`}>
              {done ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : active ? (
                <svg className="w-3.5 h-3.5 text-[#2E86C1] animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-[#CBD5E1]" />
              )}
            </div>
            <span className={`text-sm transition-colors duration-300 ${done ? "text-emerald-700 font-medium" : active ? "text-[#0F172A] font-medium" : "text-[#94A3B8]"}`}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function LoginPage() {
  const [phase, setPhase] = useState<LoginPhase>("email");

  // Email
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // OTP
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Orgs
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // Profile (new user)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Org setup (new user)
  const [orgName, setOrgName] = useState("");
  const [orgIndustry, setOrgIndustry] = useState("");
  const [orgSize, setOrgSize] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
    }
  }, [resendCooldown]);

  // Auto-transition from welcome-splash to profile
  useEffect(() => {
    if (phase === "welcome-splash") {
      const timer = setTimeout(() => transitionTo("profile"), 2500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const Spinner = () => (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  // Team setup (new user) — each member has email + first/last name
  const [teamMembers, setTeamMembers] = useState<Record<string, { email: string; firstName: string; lastName: string }>>({});
  const [teamLoading, setTeamLoading] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  const updateTeamMember = (key: string, field: "email" | "firstName" | "lastName", value: string) => {
    setTeamMembers((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { email: "", firstName: "", lastName: "" }), [field]: value },
    }));
  };

  const clearTeamMember = (key: string) => {
    setTeamMembers((prev) => ({ ...prev, [key]: { email: "", firstName: "", lastName: "" } }));
  };

  // Fade animation
  const [fadeIn, setFadeIn] = useState(true);

  // Org name uniqueness
  const [orgNameError, setOrgNameError] = useState("");

  const transitionTo = (nextPhase: LoginPhase) => {
    setFadeIn(false);
    setTimeout(() => {
      setPhase(nextPhase);
      setFadeIn(true);
    }, 300);
  };

  const isNewUserFlow = phase === "welcome-splash" || phase === "profile" || phase === "org-setup" || phase === "team-setup" || phase === "setting-up";

  // ── Phase 1: Send OTP ──
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailLoading(true);
    try {
      await authApi.sendOtp(email);
      toast.success("OTP sent to your email");
      toast.info("DEV: Use 000000 as OTP");
      setPhase("verify");
      setResendCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";
      toast.error(message);
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Phase 2: Verify OTP ──
  const handleOtpVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Please enter a 6-digit OTP"); return; }
    setOtpLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otp);
      const data = res.data as { tokens?: { accessToken: string; refreshToken: string }; orgs?: Organization[]; isNewUser?: boolean } | undefined;

      if (data?.tokens) {
        localStorage.setItem("accessToken", data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.tokens.refreshToken);
      }

      const userOrgs: Organization[] = data?.orgs || [];

      if (data?.isNewUser) {
        toast.success("Welcome! Let's get you set up.");
        setPhase("welcome-splash");
        return;
      }

      toast.success("Login successful!");
      if (userOrgs.length > 1) {
        setOrgs(userOrgs);
        setPhase("orgs");
      } else if (userOrgs.length === 1) {
        localStorage.setItem("currentOrgId", userOrgs[0]._id);
        window.location.href = "/dashboard";
      } else {
        setPhase("org-setup");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await authApi.sendOtp(email);
      toast.success("OTP resent");
      toast.info("DEV: Use 000000 as OTP");
      setResendCooldown(60);
      setOtp("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend OTP");
    }
  };

  // ── Phase 3: Select org ──
  const handleSelectOrg = async (org: Organization) => {
    try {
      const res = await orgApi.switchOrg(org._id);
      if (res.data) {
        localStorage.setItem("accessToken", res.data.accessToken);
        localStorage.setItem("refreshToken", res.data.refreshToken);
      }
    } catch { /* continue */ }
    localStorage.setItem("currentOrgId", org._id);
    window.location.href = "/dashboard";
  };

  // ── Phase 4: Complete profile ──
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { toast.error("Please enter your name"); return; }
    setProfileLoading(true);
    try {
      await authApi.completeProfile({ firstName, lastName, password: "" });
      // completeProfile also claims pending org invitations on the backend.
      // Check if the user now belongs to any orgs (from invitations).
      try {
        const orgsRes = await orgApi.getMyOrgs();
        const userOrgs = (orgsRes.data || []) as Organization[];
        if (userOrgs.length > 0) {
          // User was invited to org(s) — join the first one and go to dashboard
          const org = userOrgs[0];
          // If status is 'invited', accept the invitation first
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((org as any).memberStatus === "invited") {
            try { await orgApi.join(org._id); } catch { /* may already be active */ }
          }
          // Switch to org to get proper tokens
          try {
            const switchRes = await orgApi.switchOrg(org._id);
            if (switchRes.data) {
              localStorage.setItem("accessToken", switchRes.data.accessToken);
              localStorage.setItem("refreshToken", switchRes.data.refreshToken);
            }
          } catch { /* continue */ }
          localStorage.setItem("currentOrgId", org._id);
          toast.success("Welcome to " + org.name + "!");
          transitionTo("setting-up");
          return;
        }
      } catch { /* no orgs — proceed to org setup */ }

      toast.success("Profile saved!");
      transitionTo("org-setup");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Phase 5: Create org ──
  const handleOrgSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) { toast.error("Organization name is required"); return; }
    setOrgLoading(true);
    try {
      const domain = email.split("@")[1];
      const safeD = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain) ? undefined : domain;
      const res = await orgApi.create({ name: orgName, industry: orgIndustry || undefined, size: orgSize || undefined, domain: safeD });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = res.data as any;
      const newOrgId = d?.organization?._id || d?._id;
      if (newOrgId) {
        setCreatedOrgId(newOrgId);
        localStorage.setItem("currentOrgId", newOrgId);

        // Switch to the new org to get tokens with organizationId
        try {
          const switchRes = await orgApi.switchOrg(newOrgId);
          if (switchRes.data) {
            localStorage.setItem("accessToken", switchRes.data.accessToken);
            localStorage.setItem("refreshToken", switchRes.data.refreshToken);
          }
        } catch {
          // Continue even if switch fails
        }

        // Create an employee record for the admin (themselves)
        try {
          await hrApi.createEmployee({
            firstName,
            lastName,
            email,
            joiningDate: new Date().toISOString().split("T")[0],
          } as Partial<Employee>);
        } catch (empErr) { console.warn("Admin employee creation failed:", empErr); }
      }
      toast.success("Organization created!");
      transitionTo("team-setup");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create organization";
      if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("conflict")) {
        setOrgNameError("An organization with this name already exists. Please choose a different name.");
      }
      toast.error(message);
    } finally {
      setOrgLoading(false);
    }
  };

  // ── Phase 6: Invite team ──
  const handleTeamSubmit = async () => {
    const entries = Object.entries(teamMembers).filter(([, m]) => m.email.trim() && m.email.includes("@"));
    if (entries.length === 0) {
      transitionTo("setting-up");
      return;
    }
    setTeamLoading(true);
    const orgId = createdOrgId || localStorage.getItem("currentOrgId") || "";
    let invited = 0;
    // Map team function roles to org membership access roles
    const roleToMembershipRole: Record<string, string> = {
      hr: "admin",         // HR needs admin-level access to people data
      manager: "manager",
      developer: "member",
      designer: "member",
      employee: "member",
    };
    for (const [key, member] of entries) {
      const teamRole = key.split("-")[0]; // extract role from "role-Label" key
      const membershipRole = roleToMembershipRole[teamRole] || "member";
      try {
        await orgApi.invite(orgId, {
          email: member.email.trim(),
          role: membershipRole,
          firstName: member.firstName.trim() || member.email.split("@")[0],
          lastName: member.lastName.trim() || "",
        });
        // Also create employee in HR service with name
        try {
          await hrApi.createEmployee({
            firstName: member.firstName.trim() || member.email.split("@")[0],
            lastName: member.lastName.trim() || "",
            email: member.email.trim(),
            joiningDate: new Date().toISOString().split("T")[0],
          } as Partial<Employee>);
        } catch (empErr) { console.warn("Employee creation failed for", member.email, empErr); }
        invited++;
      } catch {
        // silently skip failures
      }
    }
    if (invited > 0) toast.success(`${invited} invitation${invited > 1 ? "s" : ""} sent!`);

    // ── Auto-create departments based on which team roles were filled ──
    try {
      const roleToDepartment: Record<string, { name: string; code: string; description: string }> = {
        hr: { name: "Human Resources", code: "HR", description: "People operations, recruitment, and employee welfare" },
        manager: { name: "Management", code: "MGMT", description: "Leadership, strategy, and team coordination" },
        developer: { name: "Engineering", code: "ENG", description: "Software development and technical operations" },
        designer: { name: "Design", code: "DESIGN", description: "UI/UX design, branding, and creative assets" },
        employee: { name: "Sales", code: "SALES", description: "Sales, business development, and client relations" },
      };

      // Collect which roles were filled
      const filledRoles = new Set(entries.map(([key]) => key.split("-")[0]));

      // Always create "General" department
      const deptMap: Record<string, string> = {}; // role -> departmentId
      try {
        const genRes = await hrApi.createDepartment({ name: "General", code: "GEN", description: "General department for all employees" });
        if (genRes.data?._id) deptMap["general"] = genRes.data._id;
      } catch (e) { console.warn("Failed to create General department", e); }

      // Create departments for each filled role
      for (const [role, dept] of Object.entries(roleToDepartment)) {
        if (filledRoles.has(role)) {
          try {
            const res = await hrApi.createDepartment(dept);
            if (res.data?._id) deptMap[role] = res.data._id;
          } catch (e) { console.warn(`Failed to create ${dept.name} department`, e); }
        }
      }

      // Assign employees to their respective departments
      if (Object.keys(deptMap).length > 0) {
        // Fetch all employees to find the ones we just created
        try {
          const empRes = await hrApi.getEmployees();
          const employees = empRes.data || [];
          for (const [key, member] of entries) {
            const teamRole = key.split("-")[0];
            const departmentId = deptMap[teamRole] || deptMap["general"];
            if (!departmentId) continue;
            const emp = employees.find((e: Employee) => e.email === member.email.trim());
            if (emp?._id) {
              try {
                await hrApi.updateEmployee(emp._id, { departmentId } as Partial<Employee>);
              } catch (e) { console.warn(`Failed to assign department to ${member.email}`, e); }
            }
          }
        } catch (e) { console.warn("Failed to fetch employees for department assignment", e); }
      }
    } catch (e) {
      console.warn("Department auto-creation failed (non-blocking)", e);
    }

    toast.success("You're all set!");
    transitionTo("setting-up");
  };

  // ════════════════════════════════════════════
  //  NEW USER ONBOARDING FLOW (profile + org)
  // ════════════════════════════════════════════
  if (isNewUserFlow) {
    const onboardingSteps = [
      { id: "profile", num: 1, label: "About You", desc: "Personal details" },
      { id: "org-setup", num: 2, label: "Organization", desc: "Your workspace" },
      { id: "team-setup", num: 3, label: "Your Team", desc: "Invite members" },
    ];
    const currentStepIdx = phase === "profile" ? 0 : phase === "org-setup" ? 1 : 2;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-[#E2E8F0]/60 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg">N</div>
            <span className="text-xl font-bold text-[#0F172A] tracking-tight">Nexora</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span className="font-medium text-[#64748B]">{email}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className={`w-full ${phase === "team-setup" ? "max-w-[720px]" : "max-w-[560px]"} transition-all duration-300`}>
            {/* Stepper — only for profile, org-setup, team-setup */}
            {(phase === "profile" || phase === "org-setup" || phase === "team-setup") && (
              <div className="mb-10">
                <div className="flex items-center justify-center gap-0">
                  {onboardingSteps.map((step, i) => {
                    const isActive = i === currentStepIdx;
                    const isDone = i < currentStepIdx;
                    return (
                      <div key={step.id} className="flex items-center">
                        <div className="flex items-center gap-3">
                          {/* Circle */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                            isDone
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                              : isActive
                                ? "bg-[#2E86C1] text-white shadow-lg shadow-[#2E86C1]/25 ring-4 ring-[#2E86C1]/10"
                                : "bg-[#F1F5F9] text-[#94A3B8] border-2 border-[#E2E8F0]"
                          }`}>
                            {isDone ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : step.num}
                          </div>
                          {/* Label */}
                          <div className="hidden sm:block">
                            <p className={`text-sm font-semibold transition-colors ${isActive || isDone ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
                              {step.label}
                            </p>
                            <p className={`text-xs transition-colors ${isActive || isDone ? "text-[#64748B]" : "text-[#CBD5E1]"}`}>
                              {step.desc}
                            </p>
                          </div>
                        </div>
                        {/* Connector */}
                        {i < onboardingSteps.length - 1 && (
                          <div className={`w-16 sm:w-24 h-[2px] mx-4 rounded-full transition-colors duration-300 ${isDone ? "bg-emerald-500" : "bg-[#E2E8F0]"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Progress bar */}
                <div className="mt-6 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-500 ease-out"
                    style={{ width: phase === "profile" ? "17%" : phase === "org-setup" ? "50%" : "83%" }}
                  />
                </div>
              </div>
            )}

            {/* Fade wrapper for step content */}
            <div className={`transition-opacity duration-300 ${fadeIn ? "opacity-100" : "opacity-0"}`}>

            {/* ── Welcome Splash ── */}
            {phase === "welcome-splash" && (
              <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                {/* Animated logo */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-[#2E86C1]/30 mb-8 animate-bounce">
                  N
                </div>
                <h1 className="text-3xl font-bold text-[#0F172A] mb-3 text-center">Welcome to Nexora!</h1>
                <p className="text-[#64748B] text-center max-w-sm mb-8">
                  Let&apos;s set up your account in just a few steps. It only takes a minute.
                </p>
                {/* Animated dots */}
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#2E86C1] animate-pulse" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#2E86C1] animate-pulse" style={{ animationDelay: "200ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#2E86C1] animate-pulse" style={{ animationDelay: "400ms" }} />
                </div>
              </div>
            )}

            {/* ── Step 1: Profile ── */}
            {phase === "profile" && (
              <div className="bg-white rounded-2xl shadow-xl shadow-black/[0.04] border border-[#E2E8F0]/60 overflow-hidden">
                {/* Header with illustration */}
                <div className="bg-gradient-to-r from-[#2E86C1]/5 via-[#2E86C1]/[0.02] to-transparent px-8 pt-8 pb-6 border-b border-[#E2E8F0]/60">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#2E86C1]/10 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Tell us about yourself</h2>
                      <p className="text-sm text-[#64748B] mt-1">This helps your team recognize you across Nexora.</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="px-8 py-6 space-y-5">
                  {/* Avatar preview */}
                  <div className="flex justify-center mb-2">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-[#2E86C1]/20 transition-all duration-300">
                      {firstName && lastName
                        ? `${firstName[0]}${lastName[0]}`.toUpperCase()
                        : (
                          <svg className="w-8 h-8 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                          </svg>
                        )
                      }
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-[#475569]">First name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-[#475569]">Last name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                    disabled={profileLoading || !firstName.trim() || !lastName.trim()}
                  >
                    {profileLoading ? (
                      <span className="flex items-center gap-2"><Spinner /> Saving...</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Continue
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* ── Step 2: Organization ── */}
            {phase === "org-setup" && (
              <div className="bg-white rounded-2xl shadow-xl shadow-black/[0.04] border border-[#E2E8F0]/60 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-500/5 via-violet-500/[0.02] to-transparent px-8 pt-8 pb-6 border-b border-[#E2E8F0]/60">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Create your organization</h2>
                      <p className="text-sm text-[#64748B] mt-1">This is your team&apos;s shared workspace. You can invite members later.</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleOrgSubmit} className="px-8 py-6 space-y-5">
                  {/* Org preview card */}
                  <div className="flex items-center gap-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]/80">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0 transition-all duration-300">
                      {orgName ? orgName[0].toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">
                        {orgName || "Your Organization"}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {firstName} {lastName} &middot; Admin
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#475569]">Organization name</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => { setOrgName(e.target.value); setOrgNameError(""); }}
                      placeholder="Acme Inc."
                      className={`h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 rounded-xl px-4 ${orgNameError ? "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/20" : ""}`}
                      autoFocus
                      required
                    />
                    {orgNameError && (
                      <p className="text-xs text-red-500 mt-1">{orgNameError}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#475569]">Industry</Label>
                      <select
                        value={orgIndustry}
                        onChange={(e) => setOrgIndustry(e.target.value)}
                        className="w-full h-12 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20 transition-all"
                      >
                        <option value="">Select industry</option>
                        {[
                          { value: "it_company", label: "IT / Technology" },
                          { value: "agency", label: "Digital Agency" },
                          { value: "startup", label: "Startup" },
                          { value: "enterprise", label: "Enterprise" },
                          { value: "healthcare", label: "Healthcare" },
                          { value: "finance", label: "Finance" },
                          { value: "education", label: "Education" },
                          { value: "nonprofit", label: "Nonprofit" },
                          { value: "other", label: "Other" },
                        ].map((ind) => (
                          <option key={ind.value} value={ind.value}>{ind.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#475569]">Company size</Label>
                      <select
                        value={orgSize}
                        onChange={(e) => setOrgSize(e.target.value)}
                        className="w-full h-12 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20 transition-all"
                      >
                        <option value="">Select size</option>
                        {["1-10", "11-50", "51-200", "201-500", "500+"].map((s) => (
                          <option key={s} value={s}>{s} employees</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => transitionTo("profile")}
                      className="h-12 px-6 border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#334155] rounded-xl transition-all"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={orgLoading || !orgName.trim()}
                      className="flex-1 h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                    >
                      {orgLoading ? (
                        <span className="flex items-center gap-2"><Spinner /> Creating...</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Get Started
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Step 3: Team Setup ── */}
            {phase === "team-setup" && (
              <div className="bg-white rounded-2xl shadow-xl shadow-black/[0.04] border border-[#E2E8F0]/60 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500/5 via-emerald-500/[0.02] to-transparent px-8 pt-8 pb-6 border-b border-[#E2E8F0]/60">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Invite your team</h2>
                      <p className="text-sm text-[#64748B] mt-1">Add key people by role. Just type their email — they&apos;ll get an invite. You can skip any role.</p>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-6">
                  {/* Role cards — 2 column grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {TEAM_ROLES.map((r) => {
                      const key = r.role + "-" + r.label;
                      const member = teamMembers[key] || { email: "", firstName: "", lastName: "" };
                      const filled = member.email.trim().length > 0;
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-4 transition-all duration-200 ${
                            filled ? r.bgColor + " shadow-sm" : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]"
                          }`}
                        >
                          {/* Role header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                filled ? "bg-white/70" : "bg-white border border-[#E2E8F0]"
                              }`}>
                                <svg className={`w-[18px] h-[18px] ${filled ? r.color : "text-[#94A3B8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d={r.icon} />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[13px] font-semibold leading-tight ${filled ? "text-[#0F172A]" : "text-[#475569]"}`}>{r.label}</p>
                                <p className="text-[11px] text-[#94A3B8] leading-tight">{r.desc}</p>
                              </div>
                            </div>
                            {filled && (
                              <button
                                type="button"
                                onClick={() => clearTeamMember(key)}
                                className="p-1 text-[#94A3B8] hover:text-red-400 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {/* Name fields */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <Input
                              type="text"
                              placeholder="First name"
                              value={member.firstName}
                              onChange={(e) => updateTeamMember(key, "firstName", e.target.value)}
                              className="h-9 text-[13px] bg-white border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-lg px-3"
                            />
                            <Input
                              type="text"
                              placeholder="Last name"
                              value={member.lastName}
                              onChange={(e) => updateTeamMember(key, "lastName", e.target.value)}
                              className="h-9 text-[13px] bg-white border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-lg px-3"
                            />
                          </div>
                          {/* Email input */}
                          <Input
                            type="email"
                            placeholder={`${r.label.toLowerCase()}@company.com`}
                            value={member.email}
                            onChange={(e) => updateTeamMember(key, "email", e.target.value)}
                            className="w-full h-9 text-[13px] bg-white border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-lg px-3"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  {Object.values(teamMembers).filter((m) => m.email.trim() && m.email.includes("@")).length > 0 && (
                    <div className="mt-5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                      <p className="text-sm text-emerald-700 font-medium">
                        {Object.values(teamMembers).filter((m) => m.email.trim() && m.email.includes("@")).length} invitation{Object.values(teamMembers).filter((m) => m.email.trim() && m.email.includes("@")).length > 1 ? "s" : ""} will be sent
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => transitionTo("org-setup")}
                      className="h-12 px-6 border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#334155] rounded-xl transition-all"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleTeamSubmit}
                      disabled={teamLoading}
                      className="flex-1 h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                    >
                      {teamLoading ? (
                        <span className="flex items-center gap-2"><Spinner /> Sending invites...</span>
                      ) : Object.values(teamMembers).filter((m) => m.email.trim() && m.email.includes("@")).length > 0 ? (
                        <span className="flex items-center gap-2">
                          Invite & Continue
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Skip & Go to Dashboard
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Setting Up Screen ── */}
            {phase === "setting-up" && (
              <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
                {/* Spinning logo */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-[#2E86C1]/25 mb-8">
                  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Setting up your workspace</h2>
                <p className="text-sm text-[#64748B] mb-8">We&apos;re preparing everything for you...</p>
                {/* Animated checklist */}
                <SetupChecklist />
              </div>
            )}

            </div>{/* End fade wrapper */}

            <p className="text-center text-xs text-[#CBD5E1] mt-6">
              By continuing, you agree to our{" "}
              <span className="underline cursor-pointer hover:text-[#94A3B8]">Terms</span> &{" "}
              <span className="underline cursor-pointer hover:text-[#94A3B8]">Privacy Policy</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  //  EXISTING USER / LOGIN FLOW
  // ════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel -- branding */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] bg-gradient-to-br from-[#0B1D33] via-[#143D65] to-[#2478B3] items-center justify-center px-10 xl:px-20 py-16 relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-16 -left-16 w-80 h-80 bg-white/[0.03] rounded-full blur-2xl" />
          <div className="absolute bottom-20 right-0 w-96 h-96 bg-[#5DADE2]/[0.07] rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-white/[0.02] rounded-full" />
          <div className="absolute bottom-16 left-24 w-24 h-24 border border-white/[0.08] rounded-2xl rotate-12" />
          <div className="absolute top-20 right-16 w-20 h-20 border border-white/[0.06] rounded-xl -rotate-12" />
        </div>

        <div className="max-w-lg text-white relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg shadow-black/10 border border-white/10">N</div>
            <span className="text-[26px] font-bold tracking-tight">Nexora</span>
          </div>

          <h1 className="text-[46px] xl:text-[52px] font-extrabold leading-[1.05] mb-6 tracking-tight">
            One platform.<br />
            <span className="text-[#85C1E9]">Every workflow.</span><br />
            Every team.
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-md mb-14">
            Replace 10+ fragmented SaaS tools with one unified platform purpose-built for IT companies.
          </p>

          {/* Dashboard mockup */}
          <div className="relative mb-14">
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl border border-white/[0.1] p-5 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
                <div className="ml-4 h-5 w-40 bg-white/10 rounded-md" />
              </div>
              <div className="flex gap-4">
                <div className="w-[72px] space-y-3 shrink-0">
                  <div className="h-8 w-full bg-white/10 rounded-lg" />
                  <div className="h-6 w-full bg-[#2E86C1]/40 rounded-lg" />
                  <div className="h-6 w-full bg-white/[0.06] rounded-lg" />
                  <div className="h-6 w-full bg-white/[0.06] rounded-lg" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 h-[52px] bg-gradient-to-r from-[#2E86C1]/30 to-[#2E86C1]/10 rounded-xl p-3">
                      <div className="h-2.5 w-16 bg-white/20 rounded mb-1.5" />
                      <div className="h-4 w-10 bg-white/30 rounded" />
                    </div>
                    <div className="flex-1 h-[52px] bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 rounded-xl p-3">
                      <div className="h-2.5 w-14 bg-white/20 rounded mb-1.5" />
                      <div className="h-4 w-8 bg-white/30 rounded" />
                    </div>
                    <div className="flex-1 h-[52px] bg-gradient-to-r from-violet-500/20 to-violet-500/5 rounded-xl p-3">
                      <div className="h-2.5 w-12 bg-white/20 rounded mb-1.5" />
                      <div className="h-4 w-10 bg-white/30 rounded" />
                    </div>
                  </div>
                  <div className="h-20 bg-white/[0.05] rounded-xl border border-white/[0.06] p-3">
                    <div className="h-2 w-24 bg-white/15 rounded mb-2" />
                    <div className="flex gap-2">
                      <div className="h-10 flex-1 bg-white/[0.06] rounded-lg" />
                      <div className="h-10 flex-1 bg-white/[0.06] rounded-lg" />
                      <div className="h-10 flex-1 bg-white/[0.06] rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-3 bg-emerald-500/90 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg shadow-emerald-500/30 backdrop-blur-sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Live Dashboard
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              { label: "Project Management", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" },
              { label: "HR & Payroll", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { label: "CRM & Invoicing", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
              { label: "AI Analytics", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.08] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <svg className="w-[18px] h-[18px] text-[#85C1E9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                </div>
                <span className="text-[15px] font-medium text-white/80">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-14 pt-7 border-t border-white/[0.08]">
            <div className="flex items-center gap-8 text-sm text-white/35">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                256-bit SSL
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                SOC 2 Compliant
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                99.9% Uptime
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel -- login form */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-6 bg-[#F8FAFC]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-lg font-bold">N</div>
            <span className="text-xl font-bold text-[#0F172A]">Nexora</span>
          </div>

          {/* Email phase */}
          {phase === "email" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-6">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Welcome back</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">Enter your email to sign in or create an account</CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-6">
                <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-[#475569]">Email</Label>
                    <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4" autoComplete="email" autoFocus required />
                  </div>
                  <Button type="submit" className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl" disabled={emailLoading || !email.trim()}>
                    {emailLoading ? <span className="flex items-center gap-2"><Spinner />Sending OTP...</span> : "Continue with Email"}
                  </Button>
                </form>

                <div className="relative my-5">
                  <Separator className="bg-[#F1F5F9]" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs text-[#94A3B8] uppercase tracking-widest font-medium">or</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-10 text-sm border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all rounded-xl" type="button">
                    <svg className="w-5 h-5 mr-2.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </Button>
                  <Button variant="outline" className="h-10 text-sm border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all rounded-xl" type="button">
                    <svg className="w-5 h-5 mr-2.5" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>
                    Microsoft
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OTP phase */}
          {phase === "verify" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-6">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Verify your email</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">
                  Enter the 6-digit code sent to <span className="font-medium text-[#64748B]">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-6">
                <form onSubmit={handleOtpVerifySubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="otpCode" className="text-sm font-medium text-[#475569]">Verification code</Label>
                    <Input id="otpCode" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4" autoFocus required />
                  </div>
                  <Button type="submit" className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl" disabled={otpLoading || otp.length !== 6}>
                    {otpLoading ? <span className="flex items-center gap-2"><Spinner />Verifying...</span> : "Verify"}
                  </Button>
                </form>
                <div className="text-center mt-4">
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-[#94A3B8]">Resend in <span className="font-semibold text-[#64748B]">{resendCooldown}s</span></p>
                  ) : (
                    <button onClick={handleResendOtp} className="text-sm text-[#2E86C1] font-semibold hover:text-[#1A5276] transition-colors">Resend Code</button>
                  )}
                </div>
                <button onClick={() => { setPhase("email"); setOtp(""); }} className="w-full text-center text-sm text-[#94A3B8] mt-3 hover:text-[#64748B] transition-colors">Use a different email</button>
              </CardContent>
            </Card>
          )}

          {/* Org selection phase */}
          {phase === "orgs" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-6">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Select Organization</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">Choose an organization to continue</CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-6">
                <div className="space-y-3 mt-4 mb-4">
                  {orgs.map((org) => (
                    <div key={org._id} className="flex items-center justify-between p-4 border border-[#E2E8F0] rounded-xl hover:border-[#CBD5E1] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white font-bold">{org.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{org.name}</p>
                          {org.industry && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{org.industry}</span>}
                        </div>
                      </div>
                      <Button onClick={() => handleSelectOrg(org)} className="h-8 px-4 bg-[#2E86C1] hover:bg-[#2471A3] text-white text-xs font-semibold rounded-lg">Open</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-center text-xs text-[#CBD5E1] mt-4">
            By signing in, you agree to our{" "}
            <span className="underline cursor-pointer hover:text-[#94A3B8]">Terms</span> &{" "}
            <span className="underline cursor-pointer hover:text-[#94A3B8]">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
