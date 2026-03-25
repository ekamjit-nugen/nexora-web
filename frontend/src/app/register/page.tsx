"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authApi, orgApi } from "@/lib/api";
import type { Organization } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type RegPhase = "email" | "otp" | "orgs" | "profile" | "org-setup";

export default function RegisterPage() {
  const { refreshOrgs, setCurrentOrg } = useAuth();
  const router = useRouter();

  // Phase state
  const [phase, setPhase] = useState<RegPhase>("email");

  // Phase 1: Email
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Phase 2: OTP
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 3: Orgs (existing user)
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // Phase 4: Profile completion (new users)
  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  // Phase 5: Org setup
  const [orgName, setOrgName] = useState("");
  const [orgIndustry, setOrgIndustry] = useState("");
  const [orgSize, setOrgSize] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
    }
  }, [resendCooldown]);

  // ── Phase 1: Send OTP ──
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailLoading(true);
    try {
      await authApi.sendOtp(email);
      toast.success("OTP sent to your email");
      toast.info("DEV: Check backend console for OTP");
      setPhase("otp");
      setResendCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";
      toast.error(message);
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Phase 2: Verify OTP ──
  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otp);
      const data = res.data as { tokens?: { accessToken: string; refreshToken: string }; orgs?: Organization[]; isNewUser?: boolean } | undefined;

      // Store tokens — user is now authenticated
      if (data?.tokens) {
        localStorage.setItem("accessToken", data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.tokens.refreshToken);
      }

      const userIsNew = data?.isNewUser;
      const userOrgs: Organization[] = data?.orgs || [];

      setOrgs(userOrgs);

      if (userIsNew) {
        // New user — needs profile completion
        setPhase("profile");
      } else if (userOrgs.length > 0) {
        // Existing user with orgs — show org list
        setPhase("orgs");
      } else {
        // Existing user with no orgs — go to org setup
        setPhase("org-setup");
      }

      toast.success("OTP verified successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid OTP";
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await authApi.sendOtp(email);
      toast.success("OTP resent to your email");
      toast.info("DEV: Check backend console for OTP");
      setResendCooldown(60);
      setOtp("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend OTP";
      toast.error(message);
    }
  };

  // ── Phase 3: Select org (existing user) ──
  const handleSelectOrg = async (org: Organization) => {
    try {
      const res = await orgApi.switchOrg(org._id);
      if (res.data) {
        localStorage.setItem("accessToken", res.data.accessToken);
        localStorage.setItem("refreshToken", res.data.refreshToken);
        localStorage.setItem("currentOrgId", org._id);
      }
      setCurrentOrg(org);
      await refreshOrgs();
      router.push("/dashboard");
    } catch {
      // Fallback — just set org and go
      localStorage.setItem("currentOrgId", org._id);
      setCurrentOrg(org);
      router.push("/dashboard");
    }
  };

  // ── Phase 4: Complete profile ──
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setProfileLoading(true);
    try {
      await authApi.completeProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        password: "", // No password needed — OTP is the auth method
      });
      toast.success("Profile completed!");
      setPhase("org-setup");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete profile";
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Phase 5: Create organization ──
  const handleOrgSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setOrgLoading(true);
    try {
      const domain = email.split("@")[1];
      const safeD = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain) ? undefined : domain;
      await orgApi.create({
        name: orgName,
        industry: orgIndustry || undefined,
        size: orgSize || undefined,
        domain: safeD,
      });
      toast.success("Organization created!");
      await refreshOrgs();
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create organization";
      toast.error(message);
    } finally {
      setOrgLoading(false);
    }
  };

  // Steps for left panel
  const steps = [
    {
      num: 1,
      label: "Verify your email",
      desc: "Enter your email and verify with OTP",
      active: phase === "email" || phase === "otp",
      done: phase === "orgs" || phase === "profile" || phase === "org-setup",
    },
    {
      num: 2,
      label: "Set up your profile",
      desc: "Complete your account details",
      active: phase === "profile" || phase === "orgs",
      done: phase === "org-setup",
    },
    {
      num: 3,
      label: "Create your organization",
      desc: "Set up your team workspace",
      active: phase === "org-setup",
      done: false,
    },
  ];

  const progressWidth =
    phase === "email" ? "w-[10%]" :
    phase === "otp" ? "w-1/4" :
    phase === "orgs" || phase === "profile" ? "w-1/2" :
    "w-3/4";

  const Spinner = ({ size = "h-5 w-5" }: { size?: string }) => (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] bg-gradient-to-br from-[#0B1D33] via-[#143D65] to-[#2478B3] items-center justify-center px-10 xl:px-20 py-16 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-16 -left-16 w-80 h-80 bg-white/[0.03] rounded-full blur-2xl" />
          <div className="absolute bottom-20 right-0 w-96 h-96 bg-[#5DADE2]/[0.07] rounded-full blur-3xl" />
          <div className="absolute bottom-16 left-24 w-24 h-24 border border-white/[0.08] rounded-2xl rotate-12" />
          <div className="absolute top-20 right-16 w-20 h-20 border border-white/[0.06] rounded-xl -rotate-12" />
          <div className="absolute top-1/2 left-12 w-3 h-3 bg-emerald-400/30 rounded-full" />
          <div className="absolute bottom-40 left-1/3 w-2.5 h-2.5 bg-white/20 rounded-full" />
        </div>

        <div className="max-w-lg text-white relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg shadow-black/10 border border-white/10">
              N
            </div>
            <span className="text-[26px] font-bold tracking-tight">Nexora</span>
          </div>

          {/* Headline */}
          <h1 className="text-[46px] xl:text-[52px] font-extrabold leading-[1.05] mb-6 tracking-tight">
            Start your<br />
            <span className="text-[#85C1E9]">journey today</span>
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-md mb-14">
            Join teams who&apos;ve unified their operations into a single, powerful platform.
          </p>

          {/* Illustration — Onboarding steps visual */}
          <div className="relative mb-14">
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl border border-white/[0.1] p-6 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="h-2.5 w-28 bg-white/20 rounded" />
                  <div className="h-2 w-20 bg-white/10 rounded mt-1.5" />
                </div>
                <div className="ml-auto flex gap-1">
                  <div className="w-16 h-7 bg-emerald-500/30 rounded-lg flex items-center justify-center">
                    <div className="h-2 w-10 bg-white/30 rounded" />
                  </div>
                </div>
              </div>
              {/* Form mockup */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="space-y-1.5">
                  <div className="h-2 w-14 bg-white/15 rounded" />
                  <div className="h-9 bg-white/[0.06] rounded-lg border border-white/[0.06]" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-12 bg-white/15 rounded" />
                  <div className="h-9 bg-white/[0.06] rounded-lg border border-white/[0.06]" />
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="h-2 w-20 bg-white/15 rounded" />
                <div className="h-9 bg-white/[0.06] rounded-lg border border-white/[0.06]" />
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-500 ${progressWidth}`} />
                </div>
                <span className="text-xs text-white/40 font-medium">
                  Step {phase === "email" || phase === "otp" ? "1" : phase === "profile" || phase === "orgs" ? "2" : "3"} of 3
                </span>
              </div>
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-3 bg-[#2E86C1] text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg shadow-[#2E86C1]/30 backdrop-blur-sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure Setup
            </div>
          </div>

          {/* Onboarding steps */}
          <div className="space-y-2 mb-14">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                    step.done
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : step.active
                        ? "bg-white text-[#1A5276] shadow-lg shadow-white/20"
                        : "bg-white/[0.08] text-white/40 border border-white/[0.08]"
                  }`}>
                    {step.done ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.num
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-px h-6 my-1.5 ${step.active || step.done ? "bg-white/25" : "bg-white/[0.08]"}`} />
                  )}
                </div>
                <div className="pt-2">
                  <p className={`text-[15px] font-semibold ${step.active || step.done ? "text-white" : "text-white/40"}`}>
                    {step.label}
                  </p>
                  <p className={`text-sm mt-0.5 ${step.active || step.done ? "text-white/55" : "text-white/25"}`}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="pt-7 border-t border-white/[0.08]">
            <div className="flex items-center gap-8 text-sm text-white/35">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                256-bit SSL
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                SOC 2 Compliant
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                99.9% Uptime
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-4 bg-[#F8FAFC]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-6 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-lg font-bold">
              N
            </div>
            <span className="text-xl font-bold text-[#0F172A]">Nexora</span>
          </div>

          {/* ── Phase 1: Email entry ── */}
          {phase === "email" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Get Started</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">
                  Enter your work email to receive a verification code
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-5">
                <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-[#475569]">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                    disabled={emailLoading || !email.trim()}
                  >
                    {emailLoading ? (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        Sending OTP...
                      </span>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </form>

                <p className="text-center text-sm text-[#94A3B8] mt-4">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#2E86C1] font-semibold hover:text-[#1A5276] transition-colors">
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Phase 2: OTP Verification ── */}
          {phase === "otp" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Verify your email</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">
                  Enter the 6-digit code sent to <span className="font-medium text-[#64748B]">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-5">
                <form onSubmit={handleOtpSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-sm font-medium text-[#475569]">Verification code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                      autoFocus
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                    disabled={otpLoading || otp.length !== 6}
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        Verifying...
                      </span>
                    ) : (
                      "Verify Code"
                    )}
                  </Button>
                </form>

                <div className="text-center mt-4">
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-[#94A3B8]">
                      Resend OTP in <span className="font-semibold text-[#64748B]">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      className="text-sm text-[#2E86C1] font-semibold hover:text-[#1A5276] transition-colors"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  onClick={() => { setPhase("email"); setOtp(""); }}
                  className="w-full text-center text-sm text-[#94A3B8] mt-3 hover:text-[#64748B] transition-colors"
                >
                  Use a different email
                </button>
              </CardContent>
            </Card>
          )}

          {/* ── Phase 3: Organization list (existing user with orgs) ── */}
          {phase === "orgs" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Welcome back!</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">
                  You&apos;re part of these organizations
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-5">
                <div className="space-y-3 mt-4 mb-4">
                  {orgs.map((org) => (
                    <div
                      key={org._id}
                      className="flex items-center justify-between p-4 border border-[#E2E8F0] rounded-xl hover:border-[#CBD5E1] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white font-bold">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{org.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {org.industry && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                {org.industry}
                              </span>
                            )}
                            {org.size && (
                              <span className="text-[10px] text-[#94A3B8]">{org.size}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSelectOrg(org)}
                        className="h-8 px-4 bg-[#2E86C1] hover:bg-[#2471A3] text-white text-xs font-semibold rounded-lg"
                      >
                        Open
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#E2E8F0] pt-4">
                  <button
                    onClick={() => setPhase("org-setup")}
                    className="w-full flex items-center justify-center gap-2 h-10 border-2 border-dashed border-[#E2E8F0] rounded-xl text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] hover:border-[#CBD5E1] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Organization
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Phase 4: Profile completion (new users) ── */}
          {phase === "profile" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Complete your profile</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">
                  Setting up as <span className="font-medium text-[#64748B]">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-5">
                <form onSubmit={handleProfileSubmit} className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-sm font-medium text-[#475569]">First name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={form.firstName}
                        onChange={update("firstName")}
                        className="h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-sm font-medium text-[#475569]">Last name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={form.lastName}
                        onChange={update("lastName")}
                        className="h-12 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                    disabled={profileLoading || !form.firstName.trim() || !form.lastName.trim()}
                  >
                    {profileLoading ? (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        Saving...
                      </span>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Phase 5: Organization setup ── */}
          {phase === "org-setup" && (
            <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
              <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
                <CardTitle className="text-xl font-bold text-[#0F172A]">Set up your organization</CardTitle>
                <CardDescription className="text-sm text-[#94A3B8]">
                  Every team needs a workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-5">
                <form onSubmit={handleOrgSubmit} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#475569]">Organization name *</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Inc."
                      className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 rounded-xl px-4"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-[#475569]">Industry</Label>
                      <select
                        value={orgIndustry}
                        onChange={(e) => setOrgIndustry(e.target.value)}
                        className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20"
                      >
                        <option value="">Select</option>
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
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-[#475569]">Company size</Label>
                      <select
                        value={orgSize}
                        onChange={(e) => setOrgSize(e.target.value)}
                        className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20"
                      >
                        <option value="">Select</option>
                        {["1-10", "11-50", "51-200", "201-500", "500+"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={orgLoading || !orgName.trim()}
                    className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                  >
                    {orgLoading ? (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        Creating organization...
                      </span>
                    ) : (
                      "Create Organization"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
