"use client";

// Admin approval queue for employee-submitted bank-detail changes.
// Bank changes never apply directly from self-service — every submission
// lands on `employee.pendingBankChange` and waits for an admin/HR
// approver to act here. Approval merges into `employee.bankDetails`
// and writes an audit row; rejection clears the pending state with
// a captured reason.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { hrApi, type Employee } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_ROLES = new Set(["admin", "hr", "owner", "super_admin"]);

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function BankChangeApprovalsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  // Surface a friendly error rather than a 403 wall of text if a
  // non-admin somehow lands here. The backend role guard is still
  // the real enforcer; this is just UX.
  const isAdmin = (() => {
    const u = user as any;
    if (!u) return false;
    if (u.isPlatformAdmin) return true;
    if (Array.isArray(u.roles) && u.roles.some((r: string) => ADMIN_ROLES.has(r))) return true;
    if (u.orgRole && ADMIN_ROLES.has(u.orgRole)) return true;
    return false;
  })();

  const refetch = async () => {
    setLoading(true);
    try {
      const res: any = await hrApi.listPendingBankChanges();
      const list: Employee[] = res?.data ?? res ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load pending bank changes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refetch(); }, []);

  const handleApprove = async (emp: Employee) => {
    if (!confirm(`Approve bank change for ${emp.firstName} ${emp.lastName}? This will replace their payout account immediately.`)) return;
    setBusyId(emp._id);
    try {
      await hrApi.approveBankChange(emp._id);
      toast.success("Bank change approved");
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (emp: Employee) => {
    const reason = (rejectReason[emp._id] || "").trim();
    if (!reason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setBusyId(emp._id);
    try {
      await hrApi.rejectBankChange(emp._id, reason);
      toast.success("Bank change rejected");
      setRejectReason((s) => { const n = { ...s }; delete n[emp._id]; return n; });
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject");
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-[#E2E8F0] bg-[#FEF2F2] p-6 text-center">
          <h2 className="text-lg font-bold text-[#0F172A] mb-1">Admin only</h2>
          <p className="text-[13px] text-[#64748B]">You need admin or HR permissions to review bank changes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A]">Bank Change Approvals</h2>
          <p className="text-[13px] text-[#94A3B8] mt-1">Employee-submitted bank-detail changes awaiting your review</p>
        </div>
        <Button variant="outline" onClick={refetch} className="h-9 text-[12px] border-[#E2E8F0]">Refresh</Button>
      </div>

      {loading ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-10 text-center text-[13px] text-[#94A3B8]">Loading…</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#ECFDF5] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-[14px] font-bold text-[#0F172A]">All caught up</h3>
            <p className="text-[13px] text-[#94A3B8] mt-1">No bank changes pending review.</p>
          </CardContent>
        </Card>
      ) : (
        rows.map((emp) => {
          const pend = emp.pendingBankChange!;
          const same = (a?: string, b?: string) => (a || "") === (b || "");
          // Highlight the fields that actually changed so the approver
          // can spot a one-character account-number swap quickly. A bank
          // change that only updates the holder name is much less
          // suspicious than one that flips the account number.
          const flag = (key: keyof typeof pend.bankDetails) =>
            same((emp.bankDetails as any)?.[key], (pend.bankDetails as any)?.[key])
              ? "text-[#0F172A]"
              : "text-[#92400E] font-medium";
          return (
            <Card key={emp._id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[15px] font-bold text-[#0F172A]">{emp.firstName} {emp.lastName}</div>
                    <div className="text-[12px] text-[#94A3B8]">{emp.email} · {emp.employeeId}</div>
                    <div className="text-[11px] text-[#94A3B8] mt-1">Submitted {formatRelative(pend.submittedAt)}{pend.reason ? ` · "${pend.reason}"` : ""}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div className="rounded-lg border border-[#E2E8F0] p-3">
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Current</div>
                    {emp.bankDetails?.accountNumber ? (
                      <div className="space-y-1">
                        <div><span className="text-[#94A3B8]">Bank:</span> {emp.bankDetails.bankName}</div>
                        <div><span className="text-[#94A3B8]">A/c:</span> {emp.bankDetails.accountNumber}</div>
                        <div><span className="text-[#94A3B8]">IFSC:</span> {emp.bankDetails.ifsc}</div>
                        <div><span className="text-[#94A3B8]">Holder:</span> {emp.bankDetails.accountHolder}</div>
                      </div>
                    ) : (
                      <div className="text-[#94A3B8]">No bank on file</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-[#F59E0B]/40 bg-[#FEF3C7]/40 p-3">
                    <div className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider mb-2">Requested</div>
                    <div className="space-y-1">
                      <div className={flag("bankName")}><span className="text-[#94A3B8]">Bank:</span> {pend.bankDetails.bankName}</div>
                      <div className={flag("accountNumber")}><span className="text-[#94A3B8]">A/c:</span> {pend.bankDetails.accountNumber}</div>
                      <div className={flag("ifsc")}><span className="text-[#94A3B8]">IFSC:</span> {pend.bankDetails.ifsc}</div>
                      <div className={flag("accountHolder")}><span className="text-[#94A3B8]">Holder:</span> {pend.bankDetails.accountHolder}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-end gap-3 mt-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1 block">Rejection reason (required to reject)</label>
                    <Input
                      value={rejectReason[emp._id] || ""}
                      onChange={(e) => setRejectReason((s) => ({ ...s, [emp._id]: e.target.value }))}
                      placeholder="e.g., IFSC mismatch — please re-submit with correct branch code"
                      className="h-9 text-[13px] bg-white border-[#E2E8F0]"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleReject(emp)}
                    disabled={busyId === emp._id}
                    className="h-9 text-[12px] border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2]"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(emp)}
                    disabled={busyId === emp._id}
                    className="h-9 text-[12px] bg-[#10B981] hover:bg-[#059669]"
                  >
                    {busyId === emp._id ? "…" : "Approve"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
