"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { orgApi } from "@/lib/api";
import type { Organization } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export default function SelectOrganizationPage() {
  const router = useRouter();
  const { switchOrg, user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    orgApi
      .getMyOrgs()
      .then((res) => {
        setOrganizations(res.data || []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load organizations");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (orgId: string) => {
    setSwitching(orgId);
    try {
      await switchOrg(orgId);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to switch organization");
    } finally {
      setSwitching(null);
    }
  };

  const handleSwitchAccount = async () => {
    try { await logout(); } catch {}
    router.push("/login");
  };

  const firstName = user?.firstName && user.firstName !== "Pending" ? user.firstName : null;
  const initial = (firstName?.[0] || user?.email?.[0] || "?").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* ─────────────── Left branded panel (lg+) ─────────────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[40%] bg-gradient-to-br from-[#0B1D33] via-[#143D65] to-[#2478B3] items-center justify-center px-10 py-16 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-16 -left-16 w-80 h-80 bg-white/[0.03] rounded-full blur-2xl" />
          <div className="absolute bottom-20 right-0 w-96 h-96 bg-[#5DADE2]/[0.07] rounded-full blur-3xl" />
          <div className="absolute bottom-16 left-24 w-24 h-24 border border-white/[0.08] rounded-2xl rotate-12" />
          <div className="absolute top-20 right-16 w-20 h-20 border border-white/[0.06] rounded-xl -rotate-12" />
        </div>
        <div className="max-w-sm text-white relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg shadow-black/10 border border-white/10">N</div>
            <span className="text-[26px] font-bold tracking-tight">Nexora</span>
          </div>
          <h1 className="text-[38px] font-extrabold leading-[1.1] mb-5 tracking-tight">
            {firstName ? `Welcome back,` : `Welcome back.`}
            {firstName && <><br /><span className="text-[#85C1E9]">{firstName}.</span></>}
          </h1>
          <p className="text-base text-white/65 leading-relaxed mb-10">
            You&apos;re a member of{" "}
            <span className="font-semibold text-white">
              {organizations.length} {organizations.length === 1 ? "organisation" : "organisations"}
            </span>
            . Pick one to get back to work — you can switch anytime from the sidebar.
          </p>
          {/* Tiny org preview stack */}
          {organizations.length > 0 && (
            <div className="flex -space-x-2">
              {organizations.slice(0, 5).map((o) => (
                <div
                  key={o._id}
                  title={o.name}
                  className="w-10 h-10 rounded-xl bg-white/10 border-2 border-[#143D65] backdrop-blur-sm flex items-center justify-center text-white font-semibold text-sm shadow-sm"
                >
                  {o.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {organizations.length > 5 && (
                <div className="w-10 h-10 rounded-xl bg-white/5 border-2 border-[#143D65] flex items-center justify-center text-white/70 font-medium text-xs">
                  +{organizations.length - 5}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────── Right content ─────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Top identity bar */}
        <div className="flex items-center justify-between px-5 sm:px-10 py-4 border-b border-[#E2E8F0] bg-white">
          {/* Mobile logo, hidden on lg (left panel takes that role) */}
          <div className="flex items-center gap-2 lg:invisible">
            <div className="w-8 h-8 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold">N</div>
            <span className="text-lg font-bold text-[#0F172A]">Nexora</span>
          </div>
          {/* User chip */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-[#0F172A]">
                {firstName ? `${firstName} ${user?.lastName || ""}`.trim() : user?.email || "You"}
              </span>
              {firstName && user?.email && (
                <span className="text-[11px] text-[#94A3B8]">{user.email}</span>
              )}
            </div>
            <div className="w-9 h-9 rounded-full bg-[#2E86C1] text-white font-bold text-sm flex items-center justify-center">
              {initial}
            </div>
            <button
              onClick={handleSwitchAccount}
              className="text-xs font-medium text-[#64748B] hover:text-[#2E86C1] hover:underline transition-colors px-2 py-1"
              title="Sign in with a different email"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
          <div className="w-full max-w-[520px]">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2 tracking-tight">
              {firstName ? `Hi ${firstName} 👋` : "Choose your workspace"}
            </h2>
            <p className="text-sm text-[#64748B] mb-8">
              Which organisation would you like to enter?
            </p>

            {loading && (
              <div className="flex flex-col items-center py-12">
                <svg className="animate-spin h-8 w-8 text-[#2E86C1] mb-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-[#94A3B8]">Loading your organisations…</p>
              </div>
            )}

            {!loading && organizations.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#2E86C1]/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-1">No organisations yet</h3>
                <p className="text-[13px] text-[#64748B] mb-5">Create your first workspace to get started.</p>
                <button
                  onClick={() => router.push("/auth/setup-organization")}
                  className="px-5 py-2.5 bg-[#2E86C1] hover:bg-[#2471A3] text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-[#2E86C1]/20"
                >
                  Create Organization
                </button>
              </div>
            )}

            {!loading && organizations.length > 0 && (
              <>
                <div className="space-y-2.5">
                  {organizations.map((org) => (
                    <button
                      key={org._id}
                      onClick={() => handleSelect(org._id)}
                      disabled={switching !== null}
                      className={`group w-full text-left p-4 rounded-xl border transition-all disabled:opacity-60 ${
                        switching === org._id
                          ? "border-[#2E86C1] bg-[#2E86C1]/5 shadow-sm"
                          : "border-[#E2E8F0] bg-white hover:border-[#2E86C1]/40 hover:shadow-md hover:-translate-y-[1px]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-[#2E86C1]/15 to-[#5DADE2]/10 flex items-center justify-center text-[#2E86C1] font-bold text-base">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">{org.name}</p>
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            {[org.industry, org.size ? `${org.size} members` : null]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        {switching === org._id ? (
                          <svg className="animate-spin h-5 w-5 text-[#2E86C1] shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-[#CBD5E1] group-hover:text-[#2E86C1] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Secondary actions — divider + create new org */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E2E8F0]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">or</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/auth/setup-organization")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-xl text-sm font-medium text-[#64748B] hover:border-[#2E86C1] hover:text-[#2E86C1] hover:bg-[#2E86C1]/[0.03] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create a new organisation
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
