"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

const inputClass =
  "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
const selectClass = inputClass + " bg-white appearance-none cursor-pointer";
const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

const PT_LWF_STATES = [
  "Maharashtra",
  "Karnataka",
  "West Bengal",
  "Andhra Pradesh",
  "Telangana",
  "Gujarat",
  "Madhya Pradesh",
  "Kerala",
  "Assam",
  "Meghalaya",
  "Odisha",
  "Tamil Nadu",
  "Tripura",
  "Bihar",
  "Punjab",
  "Jharkhand",
  "Chhattisgarh",
  "Sikkim",
  "Mizoram",
];

const SALARY_COMPONENTS = [
  { component: "Basic Salary", type: "Earning", defaultPct: "40%", taxable: "Yes", pfEligible: "Yes", esiEligible: "Yes" },
  { component: "HRA", type: "Earning", defaultPct: "50% of Basic", taxable: "Partial", pfEligible: "No", esiEligible: "Yes" },
  { component: "Dearness Allowance", type: "Earning", defaultPct: "0%", taxable: "Yes", pfEligible: "Yes", esiEligible: "Yes" },
  { component: "Conveyance Allowance", type: "Earning", defaultPct: "Fixed \u20B91,600", taxable: "Exempt", pfEligible: "No", esiEligible: "Yes" },
  { component: "Medical Allowance", type: "Earning", defaultPct: "Fixed \u20B91,250", taxable: "Exempt", pfEligible: "No", esiEligible: "Yes" },
  { component: "Special Allowance", type: "Earning", defaultPct: "Remainder", taxable: "Yes", pfEligible: "No", esiEligible: "Yes" },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 ${
        checked ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SectionHeader({
  icon,
  title,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#EBF5FB] flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
      </div>
      <svg
        className={`w-5 h-5 text-[#64748B] transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export default function PayrollPage() {
  const { currentOrg } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessComplete, setBusinessComplete] = useState(true);
  const [businessTan, setBusinessTan] = useState("");

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["pf"])
  );

  // PF Config
  const [pfApplicable, setPfApplicable] = useState(false);
  const [pfRegNumber, setPfRegNumber] = useState("");
  const [pfRegDate, setPfRegDate] = useState("");
  const [pfEmployerRate, setPfEmployerRate] = useState(12);
  const [pfEmployeeRate, setPfEmployeeRate] = useState(12);
  const [pfAdminRate, setPfAdminRate] = useState(0.5);
  const [pfEdliRate, setPfEdliRate] = useState(0.5);
  const [pfWageCeiling, setPfWageCeiling] = useState(15000);
  const [pfInCTC, setPfInCTC] = useState(false);
  const [vpfAllowed, setVpfAllowed] = useState(false);

  // ESI Config
  const [esiApplicable, setEsiApplicable] = useState(false);
  const [esiRegNumber, setEsiRegNumber] = useState("");
  const [esiRegDate, setEsiRegDate] = useState("");
  const [esiEmployerRate, setEsiEmployerRate] = useState(3.25);
  const [esiEmployeeRate, setEsiEmployeeRate] = useState(0.75);
  const [esiWageCeiling, setEsiWageCeiling] = useState(21000);
  const [esiDispensary, setEsiDispensary] = useState("");

  // TDS Config
  const [tdsApplicable, setTdsApplicable] = useState(true);
  const [defaultTaxRegime, setDefaultTaxRegime] = useState("new");
  const [autoCalculateTds, setAutoCalculateTds] = useState(true);
  const [allowInvestmentDeclaration, setAllowInvestmentDeclaration] =
    useState(true);

  // PT Config
  const [ptApplicable, setPtApplicable] = useState(false);
  const [ptState, setPtState] = useState("");
  const [ptRegNumber, setPtRegNumber] = useState("");
  const [ptDeductionFrequency, setPtDeductionFrequency] = useState("monthly");

  // LWF Config
  const [lwfApplicable, setLwfApplicable] = useState(false);
  const [lwfState, setLwfState] = useState("");
  const [lwfDeductionFrequency, setLwfDeductionFrequency] =
    useState("half-yearly");

  // Payroll Schedule
  const [payCycle, setPayCycle] = useState("monthly");
  const [payDay, setPayDay] = useState(1);
  const [processingStartDay, setProcessingStartDay] = useState(1);
  const [attendanceCutoffDay, setAttendanceCutoffDay] = useState(26);
  const [arrearsProcessing, setArrearsProcessing] = useState(false);
  const [paymentModes, setPaymentModes] = useState<string[]>([
    "bank_transfer",
  ]);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);

    Promise.all([settingsApi.getBusiness(), settingsApi.getPayroll()])
      .then(([bizRes, payRes]: [any, any]) => {
        const biz = bizRes.data || {};
        if (!biz.pan || !biz.tan) {
          setBusinessComplete(false);
        }
        setBusinessTan(biz.tan || "");

        const d = payRes.data || {};

        // PF
        const pf = d.pfConfig || {};
        setPfApplicable(pf.applicable ?? false);
        setPfRegNumber(pf.registrationNumber || "");
        setPfRegDate(pf.registrationDate || "");
        setPfEmployerRate(pf.employerRate ?? 12);
        setPfEmployeeRate(pf.employeeRate ?? 12);
        setPfAdminRate(pf.adminChargesRate ?? 0.5);
        setPfEdliRate(pf.edliRate ?? 0.5);
        setPfWageCeiling(pf.wageCeiling ?? 15000);
        setPfInCTC(pf.includeInCTC ?? false);
        setVpfAllowed(pf.vpfAllowed ?? false);

        // ESI
        const esi = d.esiConfig || {};
        setEsiApplicable(esi.applicable ?? false);
        setEsiRegNumber(esi.registrationNumber || "");
        setEsiRegDate(esi.registrationDate || "");
        setEsiEmployerRate(esi.employerRate ?? 3.25);
        setEsiEmployeeRate(esi.employeeRate ?? 0.75);
        setEsiWageCeiling(esi.wageCeiling ?? 21000);
        setEsiDispensary(esi.dispensary || "");

        // TDS
        const tds = d.tdsConfig || {};
        setTdsApplicable(tds.applicable ?? true);
        setDefaultTaxRegime(tds.defaultTaxRegime || "new");
        setAutoCalculateTds(tds.autoCalculate ?? true);
        setAllowInvestmentDeclaration(tds.allowInvestmentDeclaration ?? true);

        // PT
        const pt = d.ptConfig || {};
        setPtApplicable(pt.applicable ?? false);
        setPtState(pt.state || "");
        setPtRegNumber(pt.registrationNumber || "");
        setPtDeductionFrequency(pt.deductionFrequency || "monthly");

        // LWF
        const lwf = d.lwfConfig || {};
        setLwfApplicable(lwf.applicable ?? false);
        setLwfState(lwf.state || "");
        setLwfDeductionFrequency(lwf.deductionFrequency || "half-yearly");

        // Schedule
        const sch = d.schedule || {};
        setPayCycle(sch.payCycle || "monthly");
        setPayDay(sch.payDay ?? 1);
        setProcessingStartDay(sch.processingStartDay ?? 1);
        setAttendanceCutoffDay(sch.attendanceCutoffDay ?? 26);
        setArrearsProcessing(sch.arrearsProcessing ?? false);
        setPaymentModes(sch.paymentModes || ["bank_transfer"]);
      })
      .catch(() => {
        toast.error("Failed to load payroll settings");
      })
      .finally(() => setLoading(false));
  }, [currentOrg]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePaymentMode = (mode: string) => {
    setPaymentModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updatePayroll({
        pfConfig: {
          applicable: pfApplicable,
          registrationNumber: pfRegNumber,
          registrationDate: pfRegDate,
          employerRate: pfEmployerRate,
          employeeRate: pfEmployeeRate,
          adminChargesRate: pfAdminRate,
          edliRate: pfEdliRate,
          wageCeiling: pfWageCeiling,
          includeInCTC: pfInCTC,
          vpfAllowed: vpfAllowed,
        },
        esiConfig: {
          applicable: esiApplicable,
          registrationNumber: esiRegNumber,
          registrationDate: esiRegDate,
          employerRate: esiEmployerRate,
          employeeRate: esiEmployeeRate,
          wageCeiling: esiWageCeiling,
          dispensary: esiDispensary,
        },
        tdsConfig: {
          applicable: tdsApplicable,
          defaultTaxRegime,
          autoCalculate: autoCalculateTds,
          allowInvestmentDeclaration,
        },
        ptConfig: {
          applicable: ptApplicable,
          state: ptState,
          registrationNumber: ptRegNumber,
          deductionFrequency: ptDeductionFrequency,
        },
        lwfConfig: {
          applicable: lwfApplicable,
          state: lwfState,
          deductionFrequency: lwfDeductionFrequency,
        },
        schedule: {
          payCycle,
          payDay,
          processingStartDay,
          attendanceCutoffDay,
          arrearsProcessing,
          paymentModes,
        },
      });
      toast.success("Payroll settings saved successfully");
    } catch {
      toast.error("Failed to save payroll settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prerequisite Banner */}
      {!businessComplete && (
        <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-xl p-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-[#F59E0B] mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-[#92400E]">
              Complete Business &amp; Legal details to configure payroll
            </p>
            <p className="text-sm text-[#B45309] mt-1">
              PAN and TAN are required before payroll can be processed.{" "}
              <a
                href="/settings/business"
                className="underline font-medium hover:text-[#92400E]"
              >
                Go to Business Details
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Section 1: PF Configuration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <SectionHeader
          icon={
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          }
          title="Provident Fund (PF) Configuration"
          isOpen={openSections.has("pf")}
          onToggle={() => toggleSection("pf")}
        />
        {openSections.has("pf") && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <label className={labelClass}>PF Applicable</label>
              <Toggle checked={pfApplicable} onChange={setPfApplicable} />
            </div>

            {pfApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>PF Registration Number</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="XX/XXX/XXXXXXX/XXX/XXXXXXX"
                    value={pfRegNumber}
                    onChange={(e) => setPfRegNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Date of PF Registration</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={pfRegDate}
                    onChange={(e) => setPfRegDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Employer PF Contribution Rate (%)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    max={12}
                    step={0.01}
                    value={pfEmployerRate}
                    onChange={(e) =>
                      setPfEmployerRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Employee PF Contribution Rate (%)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    max={12}
                    step={0.01}
                    value={pfEmployeeRate}
                    onChange={(e) =>
                      setPfEmployeeRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Admin Charges Rate (%)</label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    step={0.01}
                    value={pfAdminRate}
                    onChange={(e) =>
                      setPfAdminRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    EDLI Contribution Rate (%)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    step={0.01}
                    value={pfEdliRate}
                    onChange={(e) =>
                      setPfEdliRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    PF Wage Ceiling ({"\u20B9"}/month)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    value={pfWageCeiling}
                    onChange={(e) =>
                      setPfWageCeiling(parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="flex items-center justify-between md:col-span-2">
                  <label className={labelClass}>
                    Include Employer PF in CTC
                  </label>
                  <Toggle checked={pfInCTC} onChange={setPfInCTC} />
                </div>
                <div className="flex items-center justify-between md:col-span-2">
                  <label className={labelClass}>
                    Voluntary PF (VPF) Allowed
                  </label>
                  <Toggle checked={vpfAllowed} onChange={setVpfAllowed} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: ESI Configuration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <SectionHeader
          icon={
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }
          title="ESI Configuration"
          isOpen={openSections.has("esi")}
          onToggle={() => toggleSection("esi")}
        />
        {openSections.has("esi") && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <label className={labelClass}>ESI Applicable</label>
              <Toggle checked={esiApplicable} onChange={setEsiApplicable} />
            </div>

            {esiApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>ESI Registration Number</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="XX-XX-XXXXXXX-XXX-XXXX"
                    value={esiRegNumber}
                    onChange={(e) => setEsiRegNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Date of ESI Registration
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={esiRegDate}
                    onChange={(e) => setEsiRegDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Employer ESI Rate (%)</label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    step={0.01}
                    value={esiEmployerRate}
                    onChange={(e) =>
                      setEsiEmployerRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Employee ESI Rate (%)</label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    step={0.01}
                    value={esiEmployeeRate}
                    onChange={(e) =>
                      setEsiEmployeeRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    ESI Wage Ceiling ({"\u20B9"}/month)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    min={0}
                    value={esiWageCeiling}
                    onChange={(e) =>
                      setEsiWageCeiling(parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>ESI Dispensary</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Dispensary name"
                    value={esiDispensary}
                    onChange={(e) => setEsiDispensary(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: TDS / Income Tax Configuration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <SectionHeader
          icon={
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
          title="TDS / Income Tax Configuration"
          isOpen={openSections.has("tds")}
          onToggle={() => toggleSection("tds")}
        />
        {openSections.has("tds") && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <label className={labelClass}>TDS Applicable</label>
              <Toggle checked={tdsApplicable} onChange={setTdsApplicable} />
            </div>

            {tdsApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>TAN</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      className={inputClass + " bg-[#F8FAFC]"}
                      value={businessTan || "Not set"}
                      disabled
                    />
                    <a
                      href="/settings/business"
                      className="text-sm text-[#2E86C1] hover:text-[#2471A3] font-medium whitespace-nowrap"
                    >
                      Edit in Business Details
                    </a>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Default Tax Regime</label>
                  <select
                    className={selectClass}
                    value={defaultTaxRegime}
                    onChange={(e) => setDefaultTaxRegime(e.target.value)}
                  >
                    <option value="new">New Regime</option>
                    <option value="old">Old Regime</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Auto-calculate TDS</label>
                  <Toggle
                    checked={autoCalculateTds}
                    onChange={setAutoCalculateTds}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className={labelClass}>
                    Allow Investment Declaration
                  </label>
                  <Toggle
                    checked={allowInvestmentDeclaration}
                    onChange={setAllowInvestmentDeclaration}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Health &amp; Education Cess
                  </label>
                  <input
                    type="text"
                    className={inputClass + " bg-[#F8FAFC]"}
                    value="4%"
                    disabled
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Professional Tax (PT) Configuration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <SectionHeader
          icon={
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
            </svg>
          }
          title="Professional Tax (PT) Configuration"
          isOpen={openSections.has("pt")}
          onToggle={() => toggleSection("pt")}
        />
        {openSections.has("pt") && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <label className={labelClass}>PT Applicable</label>
              <Toggle checked={ptApplicable} onChange={setPtApplicable} />
            </div>

            {ptApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>PT State</label>
                  <select
                    className={selectClass}
                    value={ptState}
                    onChange={(e) => setPtState(e.target.value)}
                  >
                    <option value="">Select State</option>
                    {PT_LWF_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>PT Registration Number</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Registration number"
                    value={ptRegNumber}
                    onChange={(e) => setPtRegNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>PT Deduction Frequency</label>
                  <select
                    className={selectClass}
                    value={ptDeductionFrequency}
                    onChange={(e) => setPtDeductionFrequency(e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 5: LWF Configuration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <SectionHeader
          icon={
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          }
          title="LWF (Labour Welfare Fund) Configuration"
          isOpen={openSections.has("lwf")}
          onToggle={() => toggleSection("lwf")}
        />
        {openSections.has("lwf") && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <label className={labelClass}>LWF Applicable</label>
              <Toggle checked={lwfApplicable} onChange={setLwfApplicable} />
            </div>

            {lwfApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>LWF State</label>
                  <select
                    className={selectClass}
                    value={lwfState}
                    onChange={(e) => setLwfState(e.target.value)}
                  >
                    <option value="">Select State</option>
                    {PT_LWF_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>LWF Deduction Frequency</label>
                  <select
                    className={selectClass}
                    value={lwfDeductionFrequency}
                    onChange={(e) => setLwfDeductionFrequency(e.target.value)}
                  >
                    <option value="half-yearly">Half-yearly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 6: Payroll Schedule */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <SectionHeader
          icon={
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
          title="Payroll Schedule"
          isOpen={openSections.has("schedule")}
          onToggle={() => toggleSection("schedule")}
        />
        {openSections.has("schedule") && (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Pay Cycle</label>
                <select
                  className={selectClass}
                  value={payCycle}
                  onChange={(e) => setPayCycle(e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Pay Day</label>
                <input
                  type="number"
                  className={inputClass}
                  min={1}
                  max={28}
                  value={payDay}
                  onChange={(e) =>
                    setPayDay(parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>
                  Payroll Processing Start Day
                </label>
                <input
                  type="number"
                  className={inputClass}
                  min={1}
                  max={28}
                  value={processingStartDay}
                  onChange={(e) =>
                    setProcessingStartDay(parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Attendance Cutoff Day</label>
                <input
                  type="number"
                  className={inputClass}
                  min={1}
                  max={28}
                  value={attendanceCutoffDay}
                  onChange={(e) =>
                    setAttendanceCutoffDay(parseInt(e.target.value) || 26)
                  }
                />
              </div>
              <div className="flex items-center justify-between md:col-span-2">
                <label className={labelClass}>Arrears Processing</label>
                <Toggle
                  checked={arrearsProcessing}
                  onChange={setArrearsProcessing}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Payment Mode</label>
                <div className="flex items-center gap-6 mt-1">
                  {[
                    { value: "bank_transfer", label: "Bank Transfer" },
                    { value: "cheque", label: "Cheque" },
                    { value: "cash", label: "Cash" },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1]/20"
                        checked={paymentModes.includes(mode.value)}
                        onChange={() => togglePaymentMode(mode.value)}
                      />
                      <span className="text-sm text-[#334155]">
                        {mode.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 7: Default Salary Structure (non-accordion table) */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-[#EBF5FB] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#0F172A]">
            Default Salary Structure
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-3 px-4 font-medium text-[#64748B]">
                  Component
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#64748B]">
                  Type
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#64748B]">
                  Default %
                </th>
                <th className="text-center py-3 px-4 font-medium text-[#64748B]">
                  Taxable
                </th>
                <th className="text-center py-3 px-4 font-medium text-[#64748B]">
                  PF Eligible
                </th>
                <th className="text-center py-3 px-4 font-medium text-[#64748B]">
                  ESI Eligible
                </th>
              </tr>
            </thead>
            <tbody>
              {SALARY_COMPONENTS.map((row, i) => (
                <tr
                  key={row.component}
                  className={
                    i < SALARY_COMPONENTS.length - 1
                      ? "border-b border-[#F1F5F9]"
                      : ""
                  }
                >
                  <td className="py-3 px-4 text-[#0F172A] font-medium">
                    {row.component}
                  </td>
                  <td className="py-3 px-4 text-[#64748B]">{row.type}</td>
                  <td className="py-3 px-4 text-[#0F172A]">
                    {row.defaultPct}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.taxable === "Yes"
                          ? "bg-red-50 text-red-700"
                          : row.taxable === "Partial"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {row.taxable}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.pfEligible === "Yes"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-[#F1F5F9] text-[#94A3B8]"
                      }`}
                    >
                      {row.pfEligible}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.esiEligible === "Yes"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-[#F1F5F9] text-[#94A3B8]"
                      }`}
                    >
                      {row.esiEligible}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-[#94A3B8]">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <span>
            Salary structure customization coming soon. This is the default
            reference structure.
          </span>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2E86C1] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2471A3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
