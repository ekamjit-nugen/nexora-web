"use client";

import { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authApi, orgApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

type InvitePhase = "loading" | "otp" | "profile" | "joining" | "done";

function InviteFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get("email") || "";
  const orgId = searchParams.get("org") || "";

  const [phase, setPhase] = useState<InvitePhase>("loading");

  // OTP
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const otpSentRef = useRef(false);

  // Profile (new users)
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password strength
  const checks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };
  const strength = Object.values(checks).filter(Boolean).length;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"][strength];
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
    }
  }, [resendCooldown]);

  // Auto-send OTP on mount
  useEffect(() => {
    if (!email) return;
    if (otpSentRef.current) return;
    otpSentRef.current = true;

    const sendInitialOtp = async () => {
      try {
        await authApi.sendOtp(email);
        toast.success("Verification code sent to your email");
        toast.info("DEV: OTP is 000000");
        setPhase("otp");
        setResendCooldown(60);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to send OTP";
        toast.error(message);
        setPhase("otp");
      }
    };

    sendInitialOtp();
  }, [email]);

  // Verify OTP
  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otp);
      const data = res.data as { tokens?: { accessToken: string; refreshToken: string }; isNewUser?: boolean } | undefined;

      if (data?.tokens) {
        localStorage.setItem("accessToken", data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.tokens.refreshToken);
      }

      const userIsNew = data?.isNewUser ?? false;

      toast.success("Email verified!");

      if (userIsNew) {
        setPhase("profile");
      } else {
        // Existing user -- join org directly
        await joinOrgAndRedirect();
      }
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
      toast.info("DEV: OTP is 000000");
      setResendCooldown(60);
      setOtp("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend OTP";
      toast.error(message);
    }
  };

  // Complete profile (new users)
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (strength < 3) {
      toast.error("Password is too weak. Meet at least 3 requirements.");
      return;
    }

    setProfileLoading(true);
    try {
      await authApi.completeProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      });
      toast.success("Profile completed!");
      await joinOrgAndRedirect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete profile";
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Join org and redirect
  const joinOrgAndRedirect = async () => {
    setPhase("joining");
    try {
      if (orgId) {
        await orgApi.join(orgId);
        // Switch to the org to get proper tokens
        try {
          const switchRes = await orgApi.switchOrg(orgId);
          if (switchRes.data) {
            localStorage.setItem("accessToken", switchRes.data.accessToken);
            localStorage.setItem("refreshToken", switchRes.data.refreshToken);
            localStorage.setItem("currentOrgId", orgId);
          }
        } catch {
          // switchOrg may fail if not yet active, continue anyway
          localStorage.setItem("currentOrgId", orgId);
        }
        toast.success("You've joined the organization!");
      }
    } catch (err: unknown) {
      // If join fails (e.g. already a member), just continue
      const message = err instanceof Error ? err.message : "";
      if (message && !message.includes("already")) {
        toast.error("Could not join organization: " + message);
      }
    }
    setPhase("done");
    router.push("/dashboard");
  };

  // No email in URL
  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl w-full max-w-[420px]">
          <CardContent className="px-8 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#2E86C1] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
              N
            </div>
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Invalid Invitation</h2>
            <p className="text-sm text-[#94A3B8] mb-6">
              This invitation link appears to be invalid or expired. Please contact your administrator.
            </p>
            <Button
              onClick={() => router.push("/login")}
              className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-semibold rounded-xl"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Spinner = ({ size = "h-5 w-5" }: { size?: string }) => (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  const EyeIcon = ({ open, className }: { open: boolean; className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </>
      )}
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-lg font-bold">
            N
          </div>
          <span className="text-xl font-bold text-[#0F172A]">Nexora</span>
        </div>

        {/* Loading phase */}
        {phase === "loading" && (
          <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
            <CardContent className="px-8 py-12 text-center">
              <Spinner size="h-8 w-8" />
              <p className="text-sm text-[#94A3B8] mt-4">Sending verification code...</p>
            </CardContent>
          </Card>
        )}

        {/* OTP phase */}
        {phase === "otp" && (
          <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
            <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
              <CardTitle className="text-xl font-bold text-[#0F172A]">You&apos;ve been invited!</CardTitle>
              <CardDescription className="text-sm text-[#94A3B8]">
                Enter the 6-digit code sent to your email to accept the invitation
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 sm:px-8 pb-5">
              {/* Read-only email display */}
              <div className="mt-4 mb-4">
                <Label className="text-sm font-medium text-[#475569]">Email</Label>
                <div className="mt-1.5 h-10 flex items-center px-4 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl text-sm text-[#64748B]">
                  {email}
                </div>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-4">
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
                    "Verify & Accept Invitation"
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
            </CardContent>
          </Card>
        )}

        {/* Profile completion phase (new users) */}
        {phase === "profile" && (
          <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
            <CardHeader className="space-y-1 pb-0 px-6 sm:px-8 pt-5">
              <CardTitle className="text-xl font-bold text-[#0F172A]">Complete your profile</CardTitle>
              <CardDescription className="text-sm text-[#94A3B8]">
                Setting up as <span className="font-medium text-[#64748B]">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 sm:px-8 pb-5">
              <form onSubmit={handleProfileSubmit} className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-sm font-medium text-[#475569]">First name</Label>
                    <Input id="firstName" placeholder="John" value={form.firstName} onChange={update("firstName")} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4" autoFocus required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-sm font-medium text-[#475569]">Last name</Label>
                    <Input id="lastName" placeholder="Doe" value={form.lastName} onChange={update("lastName")} className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-[#475569]">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={update("password")}
                      className="h-10 text-sm pr-12 bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                      tabIndex={-1}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>

                  {/* Strength bar + checklist */}
                  {form.password && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-[#E2E8F0]"}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-semibold ${
                          strength <= 1 ? "text-red-500" : strength <= 2 ? "text-orange-500" : strength <= 3 ? "text-yellow-600" : "text-emerald-600"
                        }`}>{strengthLabel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          { met: checks.length, label: "8+ characters" },
                          { met: checks.upper, label: "Uppercase letter" },
                          { met: checks.lower, label: "Lowercase letter" },
                          { met: checks.number, label: "Number" },
                          { met: checks.special, label: "Special character" },
                        ].map((req) => (
                          <div key={req.label} className="flex items-center gap-2">
                            {req.met ? (
                              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#D1D5DB] shrink-0" />
                            )}
                            <span className={`text-xs ${req.met ? "text-emerald-600 font-medium" : "text-[#94A3B8]"}`}>{req.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#475569]">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={update("confirmPassword")}
                      className={`h-10 text-sm pr-20 bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 transition-all placeholder:text-[#CBD5E1] rounded-xl px-4 ${
                        form.confirmPassword && !passwordsMatch ? "border-red-300 focus-visible:border-red-400 focus-visible:ring-red-100" : ""
                      } ${passwordsMatch ? "border-emerald-300 focus-visible:border-emerald-400 focus-visible:ring-emerald-100" : ""}`}
                      required
                    />
                    {form.confirmPassword && (
                      <div className={`absolute right-12 top-1/2 -translate-y-1/2 ${passwordsMatch ? "text-emerald-500" : "text-red-400"}`}>
                        {passwordsMatch ? (
                          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                      tabIndex={-1}
                    >
                      <EyeIcon open={showConfirmPassword} />
                    </button>
                  </div>
                  {form.confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-red-500 font-medium">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#2E86C1] hover:bg-[#2471A3] active:bg-[#1A5276] text-white font-semibold shadow-sm shadow-[#2E86C1]/25 transition-all text-[15px] rounded-xl"
                  disabled={profileLoading}
                >
                  {profileLoading ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Setting up your account...
                    </span>
                  ) : (
                    "Complete Profile & Join"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Joining phase */}
        {(phase === "joining" || phase === "done") && (
          <Card className="border-0 shadow-xl shadow-black/[0.04] bg-white rounded-2xl">
            <CardContent className="px-8 py-12 text-center">
              <Spinner size="h-8 w-8" />
              <p className="text-sm text-[#64748B] mt-4 font-medium">Joining your team...</p>
              <p className="text-xs text-[#94A3B8] mt-1">You will be redirected shortly</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-lg font-bold mx-auto mb-4">
              N
            </div>
            <p className="text-sm text-[#94A3B8]">Loading invitation...</p>
          </div>
        </div>
      }
    >
      <InviteFlow />
    </Suspense>
  );
}
