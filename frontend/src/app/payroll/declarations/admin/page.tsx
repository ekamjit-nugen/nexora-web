"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Investment Declaration Admin Review (#15).
 *
 * The `GET /investment-declarations` (admin-scoped) endpoint and
 * `POST /investment-declarations/:id/verify` already existed on the
 * backend; this page is the missing UI on top. HR admins work the
 * queue here: filter by status + FY, review declared vs. proof-
 * submitted amounts section-by-section, and verify (with an editable
 * `verifiedAmount` per item) or reject with a reason.
 *
 * Design notes:
 * - Two panels: list on the left (filterable), detail on the right.
 *   This mirrors the pattern used elsewhere in the app for
 *   review-type workflows (expenses, leave approvals).
 * - Verification saves the whole declaration at once — payroll's
 *   verifyDeclaration endpoint replaces `totalVerified` + per-item
 *   `verifiedAmount` in one call.
 * - Employee names are resolved client-side against the HR list
 *   (same trick as onboarding/offboarding pages — backend returns
 *   auth `employeeId`, no joined name).
 */

interface InvestmentItem {
  description: string;
  declaredAmount: number;
  proofSubmitted: boolean;
  verifiedAmount: number;
  proofUrl?: string | null;
}

interface InvestmentSection {
  section: string;
  items: InvestmentItem[];
}

interface Declaration {
  _id: string;
  employeeId: string;
  financialYear: string;
  regime: "old" | "new";
  status: "draft" | "submitted" | "verified" | "rejected";
  sections: InvestmentSection[];
  totalDeclared: number;
  totalVerified: number;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

const statusStyle: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-50 text-amber-700 border border-amber-200",
  verified: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

const currentFY = (): string => {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(-2)}`;
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export default function DeclarationAdminReview() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [employeeLookup, setEmployeeLookup] = useState<
    Record<string, Employee>
  >({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("submitted");
  const [filterFY, setFilterFY] = useState(currentFY());

  // Per-item edits for the currently selected declaration. Keyed by
  // "sectionIdx:itemIdx" so we can diff against the server row.
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Gate: only admin/hr can see this page.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const roles: string[] = (user as any)?.roles ?? [];
    const canVerify =
      roles.includes("admin") ||
      roles.includes("hr") ||
      roles.includes("super_admin") ||
      roles.includes("owner");
    if (!canVerify) {
      toast.error("Only HR/admin can review declarations");
      router.push("/payroll/declarations");
    }
  }, [authLoading, user, router]);

  const loadEmployees = useCallback(async () => {
    try {
      const res: any = await hrApi.getEmployees({ limit: "500" });
      const rows: Employee[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
            ? res.items
            : [];
      const map: Record<string, Employee> = {};
      for (const e of rows) {
        // Admin list API returns declaration.employeeId = auth userId,
        // not HR _id. Key by both so the lookup works either way.
        if (e?.userId) map[e.userId] = e;
        if (e?._id) map[e._id] = e;
        if (e?.employeeId) map[e.employeeId] = e;
      }
      setEmployeeLookup(map);
    } catch {
      /* non-fatal: IDs render raw when lookup misses */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus && filterStatus !== "all") params.status = filterStatus;
      if (filterFY) params.financialYear = filterFY;
      const res: any = await payrollApi.getAllDeclarations(params);
      const rows: Declaration[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
            ? res.items
            : [];
      setDeclarations(rows);
      if (rows.length > 0 && !rows.find((r) => r._id === selectedId)) {
        setSelectedId(rows[0]._id);
      } else if (rows.length === 0) {
        setSelectedId(null);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load declarations");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterFY, selectedId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);
  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => declarations.find((d) => d._id === selectedId) || null,
    [declarations, selectedId],
  );

  // Reset per-row edits whenever a new declaration is opened so we
  // don't carry stale amounts across selections. Default to the
  // currently-recorded verifiedAmount if any, else to declaredAmount
  // (HR's common first action is "accept what the employee declared").
  useEffect(() => {
    if (!selected) {
      setEdits({});
      setRejectReason("");
      return;
    }
    const next: Record<string, number> = {};
    selected.sections.forEach((s, si) => {
      s.items.forEach((it, ii) => {
        const key = `${si}:${ii}`;
        next[key] =
          it.verifiedAmount > 0 ? it.verifiedAmount : it.declaredAmount;
      });
    });
    setEdits(next);
    setRejectReason(selected.rejectionReason || "");
  }, [selected]);

  const totalEdited = useMemo(() => {
    if (!selected) return 0;
    let sum = 0;
    selected.sections.forEach((s, si) => {
      s.items.forEach((_it, ii) => {
        sum += Number(edits[`${si}:${ii}`]) || 0;
      });
    });
    return sum;
  }, [selected, edits]);

  const resolveName = (employeeId: string) => {
    const emp = employeeLookup[employeeId];
    if (!emp) return null;
    return {
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      bizId: emp.employeeId,
      email: emp.email,
    };
  };

  const verify = async (verified: boolean) => {
    if (!selected) return;
    if (!verified && !rejectReason.trim()) {
      toast.error("Provide a rejection reason");
      return;
    }
    setSaving(true);
    try {
      // On approval, send the per-item edits so the backend applies
      // them and recomputes `totalVerified` from the updated amounts.
      // Only include items whose verified amount ≠ the server's
      // current value — keeps the payload small and avoids a redundant
      // clobber when the admin accepted everything as declared.
      const items: Array<{ section: string; itemIndex: number; verifiedAmount: number }> = [];
      if (verified) {
        selected.sections.forEach((s, si) => {
          s.items.forEach((it, ii) => {
            const key = `${si}:${ii}`;
            const edited = edits[key];
            if (typeof edited !== "number") return;
            const current = it.verifiedAmount > 0 ? it.verifiedAmount : it.declaredAmount;
            if (Math.round(edited) !== Math.round(current)) {
              items.push({
                section: s.section,
                itemIndex: ii,
                verifiedAmount: Math.max(0, Math.min(edited, it.declaredAmount)),
              });
            }
          });
        });
      }

      const payload: {
        verified: boolean;
        remarks?: string;
        items?: typeof items;
      } = {
        verified,
        remarks: verified ? undefined : rejectReason.trim(),
        ...(items.length ? { items } : {}),
      };
      await payrollApi.verifyDeclaration(selected._id, payload);
      toast.success(
        verified
          ? items.length
            ? `Verified with ${items.length} per-item adjustment${items.length > 1 ? "s" : ""}`
            : "Declaration verified"
          : "Declaration rejected",
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save decision");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* `user` guarded above (redirects to /login when null). */}
      <Sidebar user={user!} onLogout={logout} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[20px] font-semibold text-[#0F172A]">
                Investment Declarations — Review
              </h1>
              <p className="text-[13px] text-[#64748B] mt-0.5">
                Verify Chapter VI-A (80C / 80D / 80E / etc.) proofs submitted
                by employees for the current financial year.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/payroll/declarations")}
            >
              My declarations
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] bg-white"
              >
                <option value="submitted">Submitted (pending)</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                Financial year
              </label>
              <input
                type="text"
                value={filterFY}
                onChange={(e) => setFilterFY(e.target.value)}
                placeholder="e.g. 2026-27"
                className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] bg-white w-32"
              />
            </div>
          </div>

          {/* Two-column: list + detail */}
          <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
            {/* Left: list */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                <div className="text-[13px] font-medium text-[#0F172A]">
                  Queue
                </div>
                <div className="text-[11px] text-[#94A3B8]">
                  {declarations.length} total
                </div>
              </div>
              <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
                {loading && (
                  <div className="px-4 py-6 text-[13px] text-[#94A3B8]">
                    Loading…
                  </div>
                )}
                {!loading && declarations.length === 0 && (
                  <div className="px-4 py-6 text-[13px] text-[#94A3B8]">
                    No declarations for this filter.
                  </div>
                )}
                {declarations.map((d) => {
                  const emp = resolveName(d.employeeId);
                  const isActive = selectedId === d._id;
                  return (
                    <button
                      key={d._id}
                      onClick={() => setSelectedId(d._id)}
                      className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] ${isActive ? "bg-blue-50/50 border-l-2 border-l-blue-500" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-[#0F172A] truncate">
                            {emp?.name || d.employeeId}
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-0.5">
                            {emp?.bizId ? `${emp.bizId} · ` : ""}FY {d.financialYear} · {d.regime} regime
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusStyle[d.status] || statusStyle.draft}`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-[#64748B]">
                          Declared: {inr(d.totalDeclared)}
                        </span>
                        <span className="text-[#64748B]">
                          Verified: {inr(d.totalVerified)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: detail */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl">
              {!selected ? (
                <div className="p-8 text-[13px] text-[#94A3B8]">
                  Select a declaration from the queue to review.
                </div>
              ) : (
                <>
                  {(() => {
                    const emp = resolveName(selected.employeeId);
                    return (
                      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-start justify-between">
                        <div>
                          <div className="text-[15px] font-semibold text-[#0F172A]">
                            {emp?.name || selected.employeeId}
                          </div>
                          <div className="text-[12px] text-[#64748B] mt-0.5">
                            {emp?.bizId ? `${emp.bizId} · ` : ""}
                            {emp?.email ? `${emp.email} · ` : ""}
                            FY {selected.financialYear} · {selected.regime} regime
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-[11px] font-medium ${statusStyle[selected.status] || statusStyle.draft}`}
                        >
                          {selected.status}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="p-5 space-y-5 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {selected.sections.map((s, si) => (
                      <div
                        key={`${s.section}-${si}`}
                        className="border border-[#F1F5F9] rounded-lg overflow-hidden"
                      >
                        <div className="px-4 py-2 bg-[#F8FAFC] text-[12px] font-medium text-[#0F172A]">
                          Section {s.section}
                        </div>
                        <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
                        <table className="w-full text-[12px]">
                          <thead className="text-[#64748B] bg-white">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium">
                                Description
                              </th>
                              <th className="text-right px-4 py-2 font-medium">
                                Declared
                              </th>
                              <th className="text-center px-4 py-2 font-medium">
                                Proof
                              </th>
                              <th className="text-right px-4 py-2 font-medium">
                                Verified
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((it, ii) => {
                              const key = `${si}:${ii}`;
                              return (
                                <tr
                                  key={key}
                                  className="border-t border-[#F1F5F9]"
                                >
                                  <td className="px-4 py-2 text-[#0F172A]">
                                    {it.description}
                                  </td>
                                  <td className="px-4 py-2 text-right text-[#0F172A]">
                                    {inr(it.declaredAmount)}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    {it.proofSubmitted ? (
                                      <a
                                        href={it.proofUrl || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`text-[11px] font-medium ${it.proofUrl ? "text-blue-600 hover:underline" : "text-emerald-600"}`}
                                      >
                                        {it.proofUrl ? "View" : "Submitted"}
                                      </a>
                                    ) : (
                                      <span className="text-[11px] text-amber-600">
                                        Missing
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <input
                                      type="number"
                                      value={edits[key] ?? 0}
                                      onChange={(e) =>
                                        setEdits((prev) => ({
                                          ...prev,
                                          [key]: Number(e.target.value) || 0,
                                        }))
                                      }
                                      className="w-28 border border-[#E2E8F0] rounded px-2 py-1 text-right text-[12px]"
                                      min={0}
                                      max={it.declaredAmount}
                                      disabled={
                                        selected.status === "verified" ||
                                        selected.status === "rejected"
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg">
                      <div className="text-[12px] text-[#64748B]">
                        Total declared:{" "}
                        <span className="font-medium text-[#0F172A]">
                          {inr(selected.totalDeclared)}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#64748B]">
                        Total to verify (edited):{" "}
                        <span className="font-medium text-emerald-700">
                          {inr(totalEdited)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  {selected.status === "submitted" && (
                    <div className="border-t border-[#F1F5F9] p-5 space-y-3">
                      <div>
                        <label className="block text-[12px] font-medium text-[#334155] mb-1">
                          Rejection reason (required if rejecting)
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="e.g. LIC premium receipt doesn't match declared amount"
                          rows={2}
                          className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px]"
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => verify(false)}
                          disabled={saving}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                        <Button
                          onClick={() => verify(true)}
                          disabled={saving}
                        >
                          {saving ? "Saving…" : "Verify declaration"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {selected.status === "rejected" && selected.rejectionReason && (
                    <div className="border-t border-[#F1F5F9] px-5 py-4 bg-red-50/30">
                      <div className="text-[12px] font-medium text-red-700 mb-0.5">
                        Rejection reason
                      </div>
                      <div className="text-[13px] text-[#0F172A]">
                        {selected.rejectionReason}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
