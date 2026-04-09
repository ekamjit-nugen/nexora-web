"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface EarningComponent {
  name: string;
  monthly: number;
  annual: number;
  type?: string;
}

interface DeductionComponent {
  name: string;
  monthly: number;
  annual: number;
}

interface SalaryStructure {
  _id: string;
  employeeId: string;
  ctc: number;
  status: string;
  earnings: EarningComponent[];
  deductions: DeductionComponent[];
  netPay: number;
  effectiveFrom?: string;
  createdAt?: string;
}

interface CTCSimulation {
  ctc: number;
  earnings: EarningComponent[];
  deductions: DeductionComponent[];
  netPay: number;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  pending_approval: { label: "Pending Approval", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(rupees);
}

export default function SalaryStructurePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"monthly" | "annual">("monthly");
  const [activeTab, setActiveTab] = useState<"active" | "pending_approval" | "draft">("active");

  // CTC Simulation modal
  const [showSimulate, setShowSimulate] = useState(false);
  const [ctcInput, setCtcInput] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<CTCSimulation | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchStructure = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (activeTab === "active") {
        const res = await payrollApi.getSalaryStructure(user._id);
        setStructure(res.data || null);
      } else {
        const res = await payrollApi.getSalaryHistory(user._id);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.find((s: any) => s.status === activeTab);
        setStructure(filtered || null);
      }
    } catch (err: any) {
      if (err.status !== 404) {
        toast.error(err.message || "Failed to load salary structure");
      }
      setStructure(null);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user) fetchStructure();
  }, [fetchStructure, user, activeTab]);

  const handleSimulateCTC = useCallback(async () => {
    const ctcRupees = parseFloat(ctcInput);
    if (!ctcRupees || ctcRupees <= 0) {
      toast.error("Enter a valid CTC amount");
      return;
    }
    const ctcPaise = Math.round(ctcRupees * 100);
    setSimulating(true);
    try {
      const res = await payrollApi.simulateCTC(ctcPaise);
      setSimulation(res.data || null);
    } catch (err: any) {
      toast.error(err.message || "Failed to simulate CTC");
    } finally {
      setSimulating(false);
    }
  }, [ctcInput]);

  const getAmount = (paise: number): string => {
    if (viewMode === "monthly") return formatCurrency(Math.round(paise / 12));
    return formatCurrency(paise);
  };

  const tabs = [
    { key: "active" as const, label: "Active" },
    { key: "pending_approval" as const, label: "Pending Approval" },
    { key: "draft" as const, label: "Draft" },
  ];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Salary Structures</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">View your salary breakdown and simulate CTC</p>
          </div>
          <Button
            onClick={() => { setShowSimulate(true); setSimulation(null); setCtcInput(""); }}
            className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px] gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
            </svg>
            Simulate CTC
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-5">
          <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 pt-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
            </div>
          ) : !structure ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#0F172A]">No salary structure found</p>
              <p className="text-[13px] text-[#64748B] mt-1">Your salary structure will appear here once it is configured</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* CTC Card */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[16px] font-semibold text-[#0F172A]">Cost to Company (CTC)</h2>
                    {structure.status && statusConfig[structure.status] && (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${statusConfig[structure.status].color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[structure.status].dot}`} />
                        {statusConfig[structure.status].label}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode("monthly")}
                      className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                        viewMode === "monthly" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setViewMode("annual")}
                      className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                        viewMode === "annual" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"
                      }`}
                    >
                      Annual
                    </button>
                  </div>
                </div>
                <p className="text-[28px] font-bold text-[#2E86C1]">{getAmount(structure.ctc)}</p>
                <p className="text-[12px] text-[#94A3B8] mt-1">
                  {viewMode === "monthly" ? "per month" : "per annum"}
                  {structure.effectiveFrom && ` | Effective from ${new Date(structure.effectiveFrom).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`}
                </p>
              </div>

              {/* Earnings Table */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E2E8F0]">
                  <h3 className="text-[15px] font-semibold text-[#0F172A]">Earnings</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="text-left px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Component</th>
                      <th className="text-right px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Monthly</th>
                      <th className="text-right px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Annual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(structure.earnings || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#FAFBFC]">
                        <td className="px-6 py-3 text-[13px] text-[#0F172A]">{item.name}</td>
                        <td className="px-6 py-3 text-[13px] text-[#0F172A] text-right">{formatCurrency(item.monthly)}</td>
                        <td className="px-6 py-3 text-[13px] text-[#0F172A] text-right">{formatCurrency(item.annual)}</td>
                      </tr>
                    ))}
                    {(!structure.earnings || structure.earnings.length === 0) && (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-[13px] text-[#94A3B8]">No earnings components</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Deductions Table */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E2E8F0]">
                  <h3 className="text-[15px] font-semibold text-[#0F172A]">Deductions</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="text-left px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Component</th>
                      <th className="text-right px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Monthly</th>
                      <th className="text-right px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Annual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(structure.deductions || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#FAFBFC]">
                        <td className="px-6 py-3 text-[13px] text-[#0F172A]">{item.name}</td>
                        <td className="px-6 py-3 text-[13px] text-red-600 text-right">{formatCurrency(item.monthly)}</td>
                        <td className="px-6 py-3 text-[13px] text-red-600 text-right">{formatCurrency(item.annual)}</td>
                      </tr>
                    ))}
                    {(!structure.deductions || structure.deductions.length === 0) && (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-[13px] text-[#94A3B8]">No deduction components</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Net Pay Summary */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#0F172A]">Net Pay</h3>
                  <span className="text-[22px] font-bold text-emerald-700">{getAmount(structure.netPay)}</span>
                </div>
                <p className="text-[12px] text-[#94A3B8] mt-1">{viewMode === "monthly" ? "Monthly take-home" : "Annual take-home"}</p>
              </div>
            </div>
          )}
        </div>

        {/* Simulate CTC Modal */}
        {showSimulate && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowSimulate(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-[#0F172A]">Simulate CTC Breakdown</h2>
                <button onClick={() => setShowSimulate(false)} className="text-[#94A3B8] hover:text-[#64748B]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">Annual CTC (in Rupees)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 1200000"
                      value={ctcInput}
                      onChange={(e) => setCtcInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSimulateCTC}
                      disabled={simulating || !ctcInput}
                      className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px]"
                    >
                      {simulating ? "Simulating..." : "Simulate"}
                    </Button>
                  </div>
                </div>

                {simulation && (
                  <div className="space-y-4 pt-2">
                    <div className="bg-[#F0F9FF] rounded-lg p-4">
                      <p className="text-[12px] text-[#64748B] uppercase tracking-wider font-medium">Simulated CTC</p>
                      <p className="text-[22px] font-bold text-[#2E86C1] mt-1">{formatCurrency(simulation.ctc)}</p>
                    </div>

                    {/* Simulated Earnings */}
                    <div>
                      <h4 className="text-[13px] font-semibold text-[#0F172A] mb-2">Earnings</h4>
                      <div className="space-y-1.5">
                        {(simulation.earnings || []).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-[#F8FAFC] rounded-lg">
                            <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                            <span className="text-[13px] font-medium text-[#0F172A]">{formatCurrency(item.monthly)}/mo</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Simulated Deductions */}
                    <div>
                      <h4 className="text-[13px] font-semibold text-[#0F172A] mb-2">Deductions</h4>
                      <div className="space-y-1.5">
                        {(simulation.deductions || []).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-[#FEF2F2] rounded-lg">
                            <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                            <span className="text-[13px] font-medium text-red-600">{formatCurrency(item.monthly)}/mo</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Simulated Net Pay */}
                    <div className="border-t border-[#E2E8F0] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-[#0F172A]">Net Monthly Pay</span>
                        <span className="text-[16px] font-bold text-emerald-700">{formatCurrency(Math.round(simulation.netPay / 12))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
