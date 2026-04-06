"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{
    orgName: string;
    role: string;
    email: string;
    orgId: string;
  } | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        // Save invite URL so user returns here after login
        localStorage.setItem("postLoginRedirect", `/auth/accept-invite?token=${token}`);
        router.push("/login");
      }
    }
  }, [authLoading, user, token, router]);

  useEffect(() => {
    if (authLoading) return; // wait for auth check
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }
    authApi
      .validateInvite(token)
      .then((res) => {
        if (res.data?.valid) {
          setInvite({
            orgName: res.data.orgName,
            role: res.data.role,
            email: res.data.email,
            orgId: res.data.orgId,
          });
        } else {
          setError("This invitation is invalid or has expired");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to validate invitation");
      })
      .finally(() => setLoading(false));
  }, [token, authLoading]);

  const handleAccept = async () => {
    setActing(true);
    try {
      await authApi.acceptInvite(token);
      toast.success("Welcome! You have joined the organization.");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    setActing(true);
    try {
      await authApi.declineInvite(token);
      toast.success("Invitation declined");
      router.push("/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to decline invitation");
    } finally {
      setActing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-[#2E86C1]/10 flex items-center justify-center mb-6">
          <svg className="animate-spin h-7 w-7 text-[#2E86C1]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-sm text-[#64748B]">Validating your invitation...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#0F172A] mb-2">Invitation Not Found</h2>
        <p className="text-sm text-[#64748B] mb-8 max-w-sm mx-auto leading-relaxed">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="px-8 py-3 bg-[#2E86C1] text-white rounded-xl text-sm font-semibold hover:bg-[#2471A3] transition-all shadow-lg shadow-[#2E86C1]/20"
        >
          Back to Login
        </button>
      </div>
    );
  }

  // Invite found
  if (!invite) return null;

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    admin: "Administrator",
    hr: "HR Manager",
    manager: "Manager",
    developer: "Developer",
    designer: "Designer",
    employee: "Employee",
    member: "Member",
  };

  return (
    <div className="py-6">
      {/* Invite illustration */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#2E86C1]/20">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] mb-2">You&apos;re Invited!</h2>
        <p className="text-[#64748B] text-sm">You&apos;ve been invited to join a team on Nexora</p>
      </div>

      {/* Org card */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-[#2E86C1]/15 flex-shrink-0">
            {invite.orgName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">{invite.orgName}</h3>
            <p className="text-sm text-[#64748B]">Organization</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2.5 border-b border-[#E2E8F0]/60">
            <span className="text-sm text-[#64748B]">Your Role</span>
            <span className="text-sm font-semibold text-[#0F172A] bg-[#2E86C1]/10 text-[#2E86C1] px-3 py-1 rounded-full">
              {roleLabels[invite.role] || invite.role}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-[#64748B]">Email</span>
            <span className="text-sm text-[#334155] font-medium">{invite.email}</span>
          </div>
        </div>
      </div>

      {/* What you'll get */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">What you&apos;ll get access to</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", label: "Projects" },
            { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: "Team Chat" },
            { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", label: "Tasks" },
            { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: "Directory" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-[#E2E8F0]/60">
              <svg className="w-4 h-4 text-[#2E86C1] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-sm text-[#334155]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDecline}
          disabled={acting}
          className="flex-1 py-3 border border-[#E2E8F0] text-[#64748B] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-all disabled:opacity-50"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          disabled={acting}
          className="flex-[2] py-3 bg-[#2E86C1] text-white rounded-xl text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#2E86C1]/20"
        >
          {acting && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Accept &amp; Join
        </button>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-center px-6 sm:px-10 py-5 border-b border-[#E2E8F0]/60 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg">N</div>
          <span className="text-xl font-bold text-[#0F172A] tracking-tight">Nexora</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[480px]">
          <div className="bg-white rounded-2xl shadow-xl shadow-black/[0.04] border border-[#E2E8F0]/60 px-8 py-2 overflow-hidden">
            <Suspense
              fallback={
                <div className="flex flex-col items-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-[#2E86C1]/10 flex items-center justify-center mb-6">
                    <svg className="animate-spin h-7 w-7 text-[#2E86C1]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <p className="text-sm text-[#64748B]">Loading...</p>
                </div>
              }
            >
              <AcceptInviteContent />
            </Suspense>
          </div>

          <p className="text-center text-xs text-[#94A3B8] mt-6">
            Nexora — The complete IT operations platform
          </p>
        </div>
      </div>
    </div>
  );
}
