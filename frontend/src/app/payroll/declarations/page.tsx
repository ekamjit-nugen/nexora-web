"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Backend shape: section = { section: "80C", items: [{description, declaredAmount, ...}] }.
// The page historically had a flat `{section, description, declaredAmount}`
// model which silently failed validation on submit. Track both so old
// reads don't crash, but always READ the nested shape first.
interface DeclarationItem {
  description: string;
  declaredAmount: number;
  verifiedAmount?: number;
  proofUrl?: string;
}

interface DeclarationSection {
  section: string;
  items?: DeclarationItem[];
  // legacy flat fields (pre-fix) — unused by new reads but kept for safety
  description?: string;
  declaredAmount?: number;
  verifiedAmount?: number;
}

interface Declaration {
  _id: string;
  financialYear: string;
  regime: "old" | "new";
  status: "draft" | "submitted" | "verified" | "rejected";
  sections: DeclarationSection[];
  totalDeclared: number;
  totalVerified?: number;
  remarks?: string;
  createdAt?: string;
}

// Sum a section's declared amount across all its items (supports both
// new nested shape and the legacy flat shape).
function sectionDeclaredTotal(sec: DeclarationSection): number {
  if (Array.isArray(sec.items) && sec.items.length > 0) {
    return sec.items.reduce((s, it) => s + (Number(it.declaredAmount) || 0), 0);
  }
  return Number(sec.declaredAmount) || 0;
}

function sectionDescription(sec: DeclarationSection): string {
  if (Array.isArray(sec.items) && sec.items[0]?.description) return sec.items[0].description;
  return sec.description || "";
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  verified: { label: "Verified", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

const regimeConfig: Record<string, { label: string; color: string }> = {
  old: { label: "Old Regime", color: "bg-purple-50 text-purple-700 border-purple-200" },
  new: { label: "New Regime", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

// Declarations are stored in rupees on the backend (matching the rest of
// the payroll schemas). Earlier code divided by 100, turning a
// ₹1,50,000 PPF declaration into ₹1,500 on screen.
function formatCurrency(rupees: number | undefined): string {
  const v = typeof rupees === "number" && !isNaN(rupees) ? rupees : 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(v);
}

function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

function getNextFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-${year + 1}`;
}

export default function InvestmentDeclarationsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);

  // New / Edit Declaration modal
  const [showModal, setShowModal] = useState(false);
  const [editingDecl, setEditingDecl] = useState<Declaration | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formFY, setFormFY] = useState(getCurrentFinancialYear());
  const [formRegime, setFormRegime] = useState<"old" | "new">("old");
  const [form80C, setForm80C] = useState({ description: "", amount: "" });
  const [form80D, setForm80D] = useState({ description: "", amount: "" });
  const [formHRA, setFormHRA] = useState({ description: "", amount: "" });

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchDeclarations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res: any = await payrollApi.getMyDeclarations();
      // `/investment-declarations/my` can return an array directly or a
      // paginated `{data: [...], pagination}` — unwrap either.
      const raw = res?.data;
      const list: Declaration[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
      setDeclarations(list);
    } catch (err: any) {
      toast.error(err.message || "Failed to load declarations");
      setDeclarations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchDeclarations();
  }, [fetchDeclarations, user]);

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(declarations.length / ITEMS_PER_PAGE);
  const paginatedDeclarations = declarations.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when declarations change
  useEffect(() => { setCurrentPage(1); }, [declarations.length]);

  const resetForm = useCallback(() => {
    setFormFY(getCurrentFinancialYear());
    setFormRegime("old");
    setForm80C({ description: "", amount: "" });
    setForm80D({ description: "", amount: "" });
    setFormHRA({ description: "", amount: "" });
  }, []);

  // Section limits (in rupees)
  const SECTION_LIMITS: Record<string, number> = {
    "80C": 150000,
    "80D": 25000,
    "HRA": 0,
  };

  const handleSubmit = useCallback(async () => {
    // Backend expects `sections: [{section, items: [{description, declaredAmount}]}]`
    // with amounts in rupees. We used to send a flat shape with paise,
    // which failed DTO validation on every submit.
    const sections: Array<{ section: string; items: Array<{ description: string; declaredAmount: number }> }> = [];

    const pushSection = (code: string, defaultDesc: string, form: { description: string; amount: string }) => {
      if (!form.amount) return;
      const amt = parseFloat(form.amount);
      if (!(amt > 0)) return;
      sections.push({
        section: code,
        items: [
          {
            description: form.description || defaultDesc,
            declaredAmount: Math.round(amt),
          },
        ],
      });
    };
    pushSection("80C", "Section 80C investments", form80C);
    pushSection("80D", "Medical insurance premium", form80D);
    pushSection("HRA", "House Rent Allowance", formHRA);

    if (sections.length === 0) {
      toast.error("Add at least one declaration section with a valid amount");
      return;
    }

    // Validate statutory limits (amounts now in rupees already).
    for (const section of sections) {
      const limit = SECTION_LIMITS[section.section];
      const declaredRupees = section.items.reduce((s, i) => s + (i.declaredAmount || 0), 0);
      if (limit && declaredRupees > limit) {
        toast.error(`Section ${section.section} limit is \u20B9${limit.toLocaleString("en-IN")}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingDecl) {
        await payrollApi.updateDeclaration(editingDecl._id, {
          financialYear: formFY,
          regime: formRegime,
          sections,
        });
        toast.success("Declaration updated successfully");
      } else {
        await payrollApi.submitDeclaration({
          financialYear: formFY,
          regime: formRegime,
          sections,
        });
        toast.success("Declaration submitted successfully");
      }
      setShowModal(false);
      setEditingDecl(null);
      resetForm();
      fetchDeclarations();
    } catch (err: any) {
      toast.error(err.message || (editingDecl ? "Failed to update declaration" : "Failed to submit declaration"));
    } finally {
      setSubmitting(false);
    }
  }, [formFY, formRegime, form80C, form80D, formHRA, resetForm, fetchDeclarations, editingDecl]);

  const canEdit = (status: string) => status === "draft" || status === "rejected";

  const fyOptions = [getCurrentFinancialYear(), getNextFinancialYear()];

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
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Investment Declarations</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Submit your tax-saving declarations</p>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              // HR/admin also have a review queue (#15). Surface it
              // here so the same Declarations section in the nav
              // routes both actors to the right view.
              const roles: string[] = (user as any)?.roles ?? [];
              const canReview =
                roles.includes("admin") ||
                roles.includes("hr") ||
                roles.includes("super_admin") ||
                roles.includes("owner");
              return canReview ? (
                <Button
                  variant="outline"
                  onClick={() => router.push("/payroll/declarations/admin")}
                  className="h-9 text-[13px]"
                >
                  Review Queue
                </Button>
              ) : null;
            })()}
            <Button
              onClick={() => { setEditingDecl(null); resetForm(); setShowModal(true); }}
              className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px] gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Declaration
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
            </div>
          ) : declarations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#0F172A]">No declarations yet</p>
              <p className="text-[13px] text-[#64748B] mt-1">Create your first investment declaration to save on taxes</p>
              <Button
                onClick={() => { setEditingDecl(null); resetForm(); setShowModal(true); }}
                className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px] mt-4 gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Declaration
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {paginatedDeclarations.map((decl) => (
                <div key={decl._id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[15px] font-semibold text-[#0F172A]">FY {decl.financialYear}</h3>
                    <div className="flex items-center gap-2">
                      {regimeConfig[decl.regime] && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${regimeConfig[decl.regime].color}`}>
                          {regimeConfig[decl.regime].label}
                        </span>
                      )}
                      {statusConfig[decl.status] && (
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${statusConfig[decl.status].color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[decl.status].dot}`} />
                          {statusConfig[decl.status].label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sections summary — read the nested items shape,
                      fall through to the legacy flat fields */}
                  <div className="space-y-2 mb-3">
                    {(decl.sections || []).map((sec, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 gap-2">
                        <span className="text-[13px] text-[#64748B] truncate">
                          {sec.section}{sectionDescription(sec) ? `: ${sectionDescription(sec)}` : ""}
                        </span>
                        <span className="text-[13px] font-medium text-[#0F172A] shrink-0">{formatCurrency(sectionDeclaredTotal(sec))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="h-px bg-[#E2E8F0] mb-3" />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider">Declared</p>
                          <p className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(decl.totalDeclared)}</p>
                        </div>
                        {decl.totalVerified != null && (
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider">Verified</p>
                            <p className="text-[14px] font-semibold text-emerald-700">{formatCurrency(decl.totalVerified)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {canEdit(decl.status) && (
                      <button
                        onClick={() => {
                          setEditingDecl(decl);
                          setFormFY(decl.financialYear);
                          setFormRegime(decl.regime);
                          // Edit prefill reads the nested items[] shape and
                          // uses rupees directly (no /100 — amounts stopped
                          // being stored as paise with the same fix).
                          const sec80C = decl.sections.find((s) => s.section === "80C");
                          const sec80D = decl.sections.find((s) => s.section === "80D");
                          const secHRA = decl.sections.find((s) => s.section === "HRA");
                          const total = (sec?: DeclarationSection) => sec ? String(sectionDeclaredTotal(sec)) : "";
                          setForm80C({ description: sectionDescription(sec80C as any), amount: total(sec80C) });
                          setForm80D({ description: sectionDescription(sec80D as any), amount: total(sec80D) });
                          setFormHRA({ description: sectionDescription(secHRA as any), amount: total(secHRA) });
                          setShowModal(true);
                        }}
                        className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        Edit
                      </button>
                    )}
                  </div>

                  {decl.remarks && (
                    <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-[12px] text-amber-800"><span className="font-medium">Remarks:</span> {decl.remarks}</p>
                    </div>
                  )}
                </div>
              ))}
              {totalPages > 1 && (
                <div className="md:col-span-2 flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#E2E8F0]">
                  <p className="text-[12px] text-[#64748B]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, declarations.length)} of {declarations.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* New Declaration Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-[#0F172A]">{editingDecl ? "Edit Investment Declaration" : "New Investment Declaration"}</h2>
                <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-[#64748B]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Financial Year */}
                <div>
                  <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">Financial Year</label>
                  <select
                    value={formFY}
                    onChange={(e) => setFormFY(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                  >
                    {fyOptions.map((fy) => (
                      <option key={fy} value={fy}>FY {fy}</option>
                    ))}
                  </select>
                </div>

                {/* Tax Regime */}
                <div>
                  <label className="block text-[13px] font-medium text-[#0F172A] mb-2">Tax Regime</label>
                  <div className="flex gap-3">
                    {(["old", "new"] as const).map((regime) => (
                      <label
                        key={regime}
                        className={`flex-1 flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                          formRegime === regime
                            ? "border-[#2E86C1] bg-[#F0F9FF]"
                            : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="regime"
                          value={regime}
                          checked={formRegime === regime}
                          onChange={() => setFormRegime(regime)}
                          className="w-4 h-4 text-[#2E86C1] focus:ring-[#2E86C1]"
                        />
                        <div>
                          <p className="text-[13px] font-medium text-[#0F172A]">{regime === "old" ? "Old Regime" : "New Regime"}</p>
                          <p className="text-[11px] text-[#94A3B8]">{regime === "old" ? "With deductions" : "Lower tax rates"}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Section 80C */}
                <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">Section 80C</h4>
                  <p className="text-[11px] text-[#64748B] mb-2">PPF, ELSS, Life Insurance, etc. (Max 1.5L)</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Description (optional)"
                      value={form80C.description}
                      onChange={(e) => setForm80C((prev) => ({ ...prev, description: e.target.value }))}
                      className="flex-1 h-9 text-[13px]"
                    />
                    <Input
                      type="number"
                      placeholder="Amount (INR)"
                      value={form80C.amount}
                      onChange={(e) => setForm80C((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-36 h-9 text-[13px]"
                    />
                  </div>
                </div>

                {/* Section 80D */}
                <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">Section 80D</h4>
                  <p className="text-[11px] text-[#64748B] mb-2">Health insurance premiums (Max 25K/50K)</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Description (optional)"
                      value={form80D.description}
                      onChange={(e) => setForm80D((prev) => ({ ...prev, description: e.target.value }))}
                      className="flex-1 h-9 text-[13px]"
                    />
                    <Input
                      type="number"
                      placeholder="Amount (INR)"
                      value={form80D.amount}
                      onChange={(e) => setForm80D((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-36 h-9 text-[13px]"
                    />
                  </div>
                </div>

                {/* HRA */}
                <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">HRA Exemption</h4>
                  <p className="text-[11px] text-[#64748B] mb-2">House rent paid for HRA exemption</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Description (optional)"
                      value={formHRA.description}
                      onChange={(e) => setFormHRA((prev) => ({ ...prev, description: e.target.value }))}
                      className="flex-1 h-9 text-[13px]"
                    />
                    <Input
                      type="number"
                      placeholder="Amount (INR)"
                      value={formHRA.amount}
                      onChange={(e) => setFormHRA((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-36 h-9 text-[13px]"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-[#2E86C1] hover:bg-[#2471A3] h-10 text-[13px] font-medium"
                >
                  {submitting ? (editingDecl ? "Updating..." : "Submitting...") : (editingDecl ? "Update Declaration" : "Submit Declaration")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
