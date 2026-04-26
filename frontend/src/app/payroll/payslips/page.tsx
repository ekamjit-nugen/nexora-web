"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, API_BASE_URL } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { toast } from "sonner";

interface Payslip {
  _id: string;
  // Live API nests these under payPeriod + totals. Legacy flat fields are
  // kept as fallbacks for very old records.
  payPeriod?: { month: number; year: number };
  totals?: {
    grossEarnings?: number;
    totalDeductions?: number;
    netPayable?: number;
  };
  month?: number;
  year?: number;
  grossEarnings?: number;
  totalDeductions?: number;
  netPayable?: number;
  status?: string;
  payslipUrl?: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Backend stores payslip amounts in rupees (matches PayrollEntry). Do not
// divide by 100 — previous code dumped ₹95,000 as ₹950.
function formatCurrency(rupees: number | undefined): string {
  const v = typeof rupees === "number" && !isNaN(rupees) ? rupees : 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(v);
}

export default function MyPayslipsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchPayslips = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res: any = await payrollApi.getMyPayslips({ year: String(year) });
      // API returns `{success, data: {data: [...], pagination}}`. Unwrap
      // whichever shape we get (array, {data:[...]}, or {items:[...]}).
      const raw = res?.data;
      const list: Payslip[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.items)
            ? raw.items
            : [];
      setPayslips(list);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  }, [user, year]);

  useEffect(() => {
    if (user) fetchPayslips();
  }, [fetchPayslips, user]);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Stream the PDF from `GET /payslips/:id/download`, which authorises
  // per-user and returns `application/pdf`. We can't use the normal
  // `request()` helper because it assumes JSON — we need the raw blob.
  const handleDownload = useCallback(async (slip: Payslip) => {
    if (downloadingId) return;
    setDownloadingId(slip._id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch(`${API_BASE_URL}/api/v1/payslips/${slip._id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
          const body = await res.json();
          msg = body?.message || body?.error || msg;
        } catch { /* non-JSON body */ }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      // Pull the filename the server suggested; fall back to a sensible
      // local name so the browser doesn't save it as "download.pdf".
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const m = slip.payPeriod?.month ?? slip.month;
      const y = slip.payPeriod?.year ?? slip.year;
      const fallback = typeof m === "number" && typeof y === "number"
        ? `Payslip_${MONTH_NAMES[m - 1]}_${y}.pdf`
        : `Payslip_${slip._id}.pdf`;
      const filename = match?.[1] || fallback;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payslip downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download payslip");
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

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
        <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 md:px-8 py-5 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-[#0F172A] truncate">My Payslips</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5 truncate">View and download your monthly payslips</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <label className="text-[13px] text-[#64748B] font-medium hidden sm:inline">Year:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
            </div>
          ) : payslips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#0F172A]">No payslips found for this year</p>
              <p className="text-[13px] text-[#64748B] mt-1">Payslips will appear here once payroll is processed</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {payslips.map((slip) => {
                const m = slip.payPeriod?.month ?? slip.month;
                const y = slip.payPeriod?.year ?? slip.year;
                const gross = slip.totals?.grossEarnings ?? slip.grossEarnings ?? 0;
                const ded = slip.totals?.totalDeductions ?? slip.totalDeductions ?? 0;
                const net = slip.totals?.netPayable ?? slip.netPayable ?? 0;
                return (
                <div key={slip._id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">
                      {typeof m === "number" && typeof y === "number" ? `${MONTH_NAMES[m - 1]} ${y}` : "—"}
                    </h3>
                    {slip.status && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 capitalize">
                        {slip.status}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#64748B]">Gross Earnings</span>
                      <span className="text-[13px] font-medium text-[#0F172A]">{formatCurrency(gross)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#64748B]">Total Deductions</span>
                      <span className="text-[13px] font-medium text-red-600">{formatCurrency(ded)}</span>
                    </div>
                    <div className="h-px bg-[#E2E8F0] my-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#0F172A]">Net Payable</span>
                      <span className="text-[14px] font-bold text-emerald-700">{formatCurrency(net)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(slip)}
                    disabled={downloadingId === slip._id}
                    className="mt-4 w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {downloadingId === slip._id ? (
                      <>
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-[#64748B] border-t-transparent" />
                        Preparing…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </>
                    )}
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
