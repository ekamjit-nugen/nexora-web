"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReportTab = "form_16" | "pf_ecr" | "esi_return" | "tds_quarterly";

interface StatutoryReport {
  _id: string;
  reportType: string;
  period?: string;
  financialYear?: string;
  month?: number;
  year?: number;
  quarter?: number;
  status: string;
  generatedAt?: string;
  createdAt?: string;
  totalEmployees?: number;
  fileUrl?: string;
  metadata?: Record<string, unknown>;
}

interface EmployeeOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeId?: string;
}

interface Form16Document {
  _id: string;
  financialYear: string;
  generatedAt?: string;
  status: string;
  fileUrl?: string;
  totalTax?: number;
  grossIncome?: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const tabConfig: Record<
  ReportTab,
  { label: string; description: string; reportType: string }
> = {
  form_16: {
    label: "Form 16",
    description: "Annual income tax certificate for employees",
    reportType: "form_16",
  },
  pf_ecr: {
    label: "PF ECR",
    description: "Provident Fund Electronic Challan cum Return",
    reportType: "pf_ecr",
  },
  esi_return: {
    label: "ESI Return",
    description: "Employees' State Insurance monthly return",
    reportType: "esi_return",
  },
  tds_quarterly: {
    label: "TDS Quarterly",
    description: "Quarterly TDS return (Form 24Q)",
    reportType: "tds_quarterly",
  },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  generating: { label: "Generating", color: "bg-blue-50 text-blue-700 border-blue-200" },
  generated: {
    label: "Generated",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  filed: { label: "Filed", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
  failed: { label: "Failed", color: "bg-red-50 text-red-700 border-red-200" },
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatCurrency = (paise: number | undefined | null) => {
  if (typeof paise !== "number" || isNaN(paise)) return "\u20B90.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildPeriodLabel = (r: StatutoryReport): string => {
  if (r.period) return r.period;
  if (r.financialYear) return `FY ${r.financialYear}`;
  if (r.quarter && r.year) return `Q${r.quarter} ${r.year}`;
  if (r.month && r.year) return `${MONTHS[r.month - 1] || "?"} ${r.year}`;
  if (r.year) return `${r.year}`;
  return "\u2014";
};

const buildFinancialYears = (): string[] => {
  const now = new Date();
  const currentYear = now.getFullYear();
  // FY starts in April; if before April, current FY starts previous year
  const fyStart = now.getMonth() >= 3 ? currentYear : currentYear - 1;
  const years: string[] = [];
  for (let i = 0; i < 5; i++) {
    const start = fyStart - i;
    years.push(`${start}-${start + 1}`);
  }
  return years;
};

const renderBadge = (value: string) => {
  const cfg =
    statusConfig[value] ||
    { label: value, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StatutoryReportsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  const [activeTab, setActiveTab] = useState<ReportTab>("form_16");
  const [reports, setReports] = useState<StatutoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [myForm16s, setMyForm16s] = useState<Form16Document[]>([]);
  const [loadingMyForm16s, setLoadingMyForm16s] = useState(true);

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  const financialYears = useMemo(() => buildFinancialYears(), []);
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const [formEmployeeId, setFormEmployeeId] = useState<string>("ALL");
  const [formFinancialYear, setFormFinancialYear] = useState<string>("");
  const [formMonth, setFormMonth] = useState<number>(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState<number>(currentYear);
  const [formQuarter, setFormQuarter] = useState<number>(1);

  // -------------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && !isAdmin && !hasOrgRole("manager")) {
      router.push("/dashboard");
    }
  }, [authLoading, user, isAdmin, hasOrgRole, router]);

  useEffect(() => {
    if (financialYears.length > 0 && !formFinancialYear) {
      setFormFinancialYear(financialYears[0]);
    }
  }, [financialYears, formFinancialYear]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await payrollApi.listStatutoryReports({
        reportType: tabConfig[activeTab].reportType,
      });
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.reports ?? [];
      setReports(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  const fetchEmployees = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const res = await hrApi.getEmployees();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.employees ?? [];
      setEmployees(data);
    } catch {
      /* non-fatal */
    }
  }, [user, isAdmin]);

  const fetchMyForm16 = useCallback(async () => {
    if (!user) return;
    setLoadingMyForm16s(true);
    try {
      const res = await payrollApi.getMyForm16();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.documents ?? [];
      setMyForm16s(data);
    } catch {
      setMyForm16s([]);
    } finally {
      setLoadingMyForm16s(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user, fetchReports]);

  useEffect(() => {
    if (user && isAdmin) fetchEmployees();
  }, [user, isAdmin, fetchEmployees]);

  useEffect(() => {
    if (user) fetchMyForm16();
  }, [user, fetchMyForm16]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleOpenGenerateModal = () => {
    setShowGenerateModal(true);
  };

  const handleCloseGenerateModal = () => {
    if (generating) return;
    setShowGenerateModal(false);
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      if (activeTab === "form_16") {
        if (!formFinancialYear) {
          toast.error("Please select a financial year");
          return;
        }
        await payrollApi.generateForm16({
          employeeId: formEmployeeId === "ALL" ? "" : formEmployeeId,
          financialYear: formFinancialYear,
        });
        toast.success("Form 16 generation started");
      } else if (activeTab === "pf_ecr") {
        await payrollApi.generatePFECR({ month: formMonth, year: formYear });
        toast.success("PF ECR generation started");
      } else if (activeTab === "esi_return") {
        await payrollApi.generateESIReturn({ month: formMonth, year: formYear });
        toast.success("ESI Return generation started");
      } else if (activeTab === "tds_quarterly") {
        await payrollApi.generateTDSQuarterly({
          quarter: formQuarter,
          year: formYear,
        });
        toast.success("TDS Quarterly generation started");
      }
      setShowGenerateModal(false);
      await fetchReports();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = (report: StatutoryReport) => {
    if (report.fileUrl) {
      window.open(report.fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast.info("Report download not yet available");
  };

  const handleViewReport = (report: StatutoryReport) => {
    toast.info(`Viewing report ${report._id.slice(-8)}`);
  };

  // -------------------------------------------------------------------------
  // Auth gate
  // -------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E86C1]" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Statutory Reports</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Generate and manage compliance reports: Form 16, PF ECR, ESI, and TDS
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleOpenGenerateModal}
              className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Generate Report
            </Button>
          )}
        </div>

        <div className="flex-1 p-8 space-y-6">
          {/* Tabs */}
          <div className="bg-[#F1F5F9] rounded-xl p-1 w-fit flex flex-wrap">
            {(Object.keys(tabConfig) as ReportTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {tabConfig[tab].label}
              </button>
            ))}
          </div>

          {/* Tab description */}
          <p className="text-[13px] text-[#64748B] -mt-3">
            {tabConfig[activeTab].description}
          </p>

          {/* Reports Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse"
                >
                  <div className="flex items-center gap-6">
                    <div className="h-4 bg-gray-200 rounded w-28" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-5 bg-gray-200 rounded-full w-20" />
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-4 bg-gray-200 rounded w-16" />
                    <div className="flex-1" />
                    <div className="h-8 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
              <svg
                className="w-12 h-12 mx-auto text-[#CBD5E1]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-[#64748B] mt-3 text-[14px]">
                No {tabConfig[activeTab].label} reports found.
              </p>
              {isAdmin && (
                <Button
                  onClick={handleOpenGenerateModal}
                  variant="outline"
                  className="mt-4 h-8 text-[12px]"
                >
                  Generate your first report
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
                        Report Type
                      </th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
                        Period
                      </th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
                        Generated At
                      </th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
                        Employees
                      </th>
                      <th className="px-5 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr
                        key={report._id}
                        className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A]">
                          {tabConfig[activeTab].label}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#475569]">
                          {buildPeriodLabel(report)}
                        </td>
                        <td className="px-5 py-3.5">{renderBadge(report.status)}</td>
                        <td className="px-5 py-3.5 text-[12px] text-[#64748B]">
                          {formatDateTime(report.generatedAt || report.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#475569]">
                          {report.totalEmployees ?? "\u2014"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[12px]"
                              onClick={() => handleViewReport(report)}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-[12px] bg-[#2E86C1] hover:bg-[#2574A9] text-white"
                              onClick={() => handleDownloadReport(report)}
                            >
                              Download
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* My Form 16 Section */}
          <div className="pt-4">
            <Card className="rounded-xl border border-[#E2E8F0] shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#0F172A]">
                      My Tax Documents
                    </h3>
                    <p className="text-[13px] text-[#64748B] mt-1">
                      Your personal Form 16 certificates and tax filings
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-[#EBF5FF] text-[#2E86C1] border border-[#BFDBFE]">
                    Self Service
                  </span>
                </div>

                <div className="mt-5">
                  {loadingMyForm16s ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="h-14 rounded-lg bg-gray-100 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : myForm16s.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#E2E8F0] p-6 text-center">
                      <p className="text-[13px] text-[#64748B]">
                        No Form 16 certificates available yet.
                      </p>
                      <p className="text-[11px] text-[#94A3B8] mt-1">
                        Your employer will generate Form 16 after the financial year closes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myForm16s.map((doc) => (
                        <div
                          key={doc._id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#F8FAFC] transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-[#EBF5FF] flex items-center justify-center shrink-0">
                            <svg
                              className="w-5 h-5 text-[#2E86C1]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.8}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[14px] font-semibold text-[#0F172A]">
                                Form 16 - FY {doc.financialYear}
                              </p>
                              {renderBadge(doc.status)}
                            </div>
                            <div className="flex items-center gap-4 text-[12px] text-[#64748B] mt-0.5">
                              <span>Generated {formatDateTime(doc.generatedAt)}</span>
                              {typeof doc.totalTax === "number" && (
                                <span>Tax: {formatCurrency(doc.totalTax)}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[12px]"
                            onClick={() => {
                              if (doc.fileUrl) {
                                window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
                              } else {
                                toast.info("Download not yet available");
                              }
                            }}
                          >
                            <svg
                              className="w-3.5 h-3.5 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Generate {tabConfig[activeTab].label}
                </h3>
                <p className="text-[13px] text-[#64748B] mt-1">
                  {tabConfig[activeTab].description}
                </p>
              </div>
              <button
                onClick={handleCloseGenerateModal}
                className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {activeTab === "form_16" && (
                <>
                  <div>
                    <label className="text-[12px] font-medium text-[#64748B]">
                      Financial Year
                    </label>
                    <select
                      value={formFinancialYear}
                      onChange={(e) => setFormFinancialYear(e.target.value)}
                      className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      {financialYears.map((fy) => (
                        <option key={fy} value={fy}>
                          FY {fy}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#64748B]">
                      Employee
                    </label>
                    <select
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      <option value="ALL">All employees</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName || ""} {emp.lastName || ""}
                          {emp.employeeId ? ` (${emp.employeeId})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(activeTab === "pf_ecr" || activeTab === "esi_return") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-[#64748B]">Month</label>
                    <select
                      value={formMonth}
                      onChange={(e) => setFormMonth(parseInt(e.target.value, 10))}
                      className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      {MONTHS.map((name, idx) => (
                        <option key={name} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#64748B]">Year</label>
                    <select
                      value={formYear}
                      onChange={(e) => setFormYear(parseInt(e.target.value, 10))}
                      className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "tds_quarterly" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-[#64748B]">
                      Quarter
                    </label>
                    <select
                      value={formQuarter}
                      onChange={(e) => setFormQuarter(parseInt(e.target.value, 10))}
                      className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      <option value={1}>Q1 (Apr - Jun)</option>
                      <option value={2}>Q2 (Jul - Sep)</option>
                      <option value={3}>Q3 (Oct - Dec)</option>
                      <option value={4}>Q4 (Jan - Mar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#64748B]">Year</label>
                    <select
                      value={formYear}
                      onChange={(e) => setFormYear(parseInt(e.target.value, 10))}
                      className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1]"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-[12px] text-blue-900 leading-relaxed">
                  <span className="font-semibold">Note:</span> Report generation may take a few
                  minutes. You&apos;ll be notified once it&apos;s ready for download.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCloseGenerateModal}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateReport}
                disabled={generating}
                className="bg-[#2E86C1] hover:bg-[#2574A9] text-white"
              >
                {generating ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
