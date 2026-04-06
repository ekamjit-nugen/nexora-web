"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { orgApi, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full access" },
  { value: "hr", label: "HR", desc: "People management" },
  { value: "manager", label: "Manager", desc: "Team oversight" },
  { value: "developer", label: "Developer", desc: "Engineering" },
  { value: "designer", label: "Designer", desc: "Design & creative" },
  { value: "employee", label: "Employee", desc: "Basic access" },
];

const STEPS = [
  { num: 1, label: "Organization", desc: "Your workspace" },
  { num: 2, label: "Profile", desc: "About you" },
  { num: 3, label: "Team", desc: "Invite members" },
];

interface InvitedMember {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

export default function InviteTeamPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("employee");
  const [invitedMembers, setInvitedMembers] = useState<InvitedMember[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("currentOrgId");
    setOrgId(stored);
    if (!stored) {
      // Try to fetch from user's orgs
      orgApi.getMyOrgs().then(res => {
        const orgs = res.data || [];
        if (orgs.length > 0) {
          const id = orgs[0]._id;
          localStorage.setItem("currentOrgId", id);
          setOrgId(id);
        }
      }).catch(() => {});
    }
  }, []);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (!orgId) {
      toast.error("Organization not found. Please go back and create one.");
      return;
    }
    setLoading(true);
    try {
      await orgApi.invite(orgId, {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });
      setInvitedMembers((prev) => [
        ...prev,
        { email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), role: ROLES.find(r => r.value === role)?.label || role, status: "Pending" },
      ]);
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("employee");
      toast.success("Invitation sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      await authApi.updateSetupStage("complete");
    } catch {}
    window.location.href = "/dashboard";
  };

  const currentStep = 2;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] relative">
      {/* ── Blurred Dashboard Shell ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="fixed top-0 left-0 bottom-0 w-[260px] bg-white border-r border-[#E2E8F0] blur-[3px]">
          <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[#F1F5F9]">
            <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg">N</div>
            <span className="text-lg font-bold text-[#0F172A]">Nexora</span>
          </div>
          <div className="px-3 py-4 space-y-1">
            {["Dashboard","Calendar","Team Chat","Projects","Tasks","Attendance","Leaves","Directory"].map((l,i) => (
              <div key={l} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${i===0 ? "bg-[#2E86C1]/10 text-[#2E86C1] font-semibold" : "text-[#64748B]"}`}>
                <div className="w-5 h-5 rounded bg-current opacity-20" /><span>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ml-[260px] p-8 blur-[3px]">
          <div className="h-7 w-48 bg-[#E2E8F0] rounded-lg mb-8" />
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-28"><div className="h-4 w-20 bg-[#F1F5F9] rounded mb-3" /><div className="h-8 w-16 bg-[#E2E8F0] rounded" /></div>)}
          </div>
        </div>
      </div>
      <div className="fixed inset-0 bg-[#0F172A]/30 z-40" />

      {/* ── Modal content ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
        <div className="w-full max-w-[680px] my-auto">
          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-0">
              {STEPS.map((step, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div key={step.num} className="flex items-center">
                    <div className="flex items-center gap-3">
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
                      <div className="hidden sm:block">
                        <p className={`text-sm font-semibold ${isActive || isDone ? "text-white" : "text-white/50"}`}>{step.label}</p>
                        <p className={`text-xs ${isActive || isDone ? "text-white/70" : "text-white/30"}`}>{step.desc}</p>
                      </div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-12 sm:w-20 h-[2px] mx-3 rounded-full ${isDone ? "bg-emerald-500" : "bg-[#E2E8F0]"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-500" style={{ width: "83%" }} />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 border border-[#E2E8F0]/60 overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E86C1]/5 via-[#2E86C1]/[0.02] to-transparent px-8 pt-8 pb-6 border-b border-[#E2E8F0]/60">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#2E86C1]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Invite Your Team</h2>
                  <p className="text-sm text-[#64748B] mt-1">Add members to your organization. You can always invite more later.</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      required
                      className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-3">
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      required
                      className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !firstName.trim() || !lastName.trim()}
                  className="w-full py-2.5 border-2 border-dashed border-[#2E86C1]/30 text-[#2E86C1] rounded-xl text-sm font-semibold hover:bg-[#2E86C1]/5 hover:border-[#2E86C1]/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                  {loading ? "Sending..." : "Add Member"}
                </button>
              </form>

              {invitedMembers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-[#334155] mb-3">
                    Invited ({invitedMembers.length})
                  </h3>
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Name</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Email</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Role</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {invitedMembers.map((m, i) => (
                          <tr key={i} className="hover:bg-[#F8FAFC]/50">
                            <td className="px-4 py-2.5 text-[#0F172A] font-medium">{m.firstName} {m.lastName}</td>
                            <td className="px-4 py-2.5 text-[#64748B]">{m.email}</td>
                            <td className="px-4 py-2.5 text-[#64748B]">{m.role}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/auth/setup-profile")}
                  className="px-6 py-3 border border-[#E2E8F0] text-[#64748B] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 py-3 text-[#64748B] border border-[#E2E8F0] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-all"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 py-3 bg-[#2E86C1] text-white rounded-xl text-sm font-semibold hover:bg-[#2471A3] transition-all shadow-lg shadow-[#2E86C1]/20"
                >
                  Continue to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
