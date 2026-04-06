"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

export default function BusinessSettingsPage() {
  const { user, currentOrg } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Registered Address
  const [regLine1, setRegLine1] = useState("");
  const [regLine2, setRegLine2] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regState, setRegState] = useState("");
  const [regPincode, setRegPincode] = useState("");

  // Communication Address
  const [sameAsRegistered, setSameAsRegistered] = useState(true);
  const [commLine1, setCommLine1] = useState("");
  const [commLine2, setCommLine2] = useState("");
  const [commCity, setCommCity] = useState("");
  const [commState, setCommState] = useState("");
  const [commPincode, setCommPincode] = useState("");

  // Tax & Registration
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [cin, setCin] = useState("");
  const [tan, setTan] = useState("");
  const [msme, setMsme] = useState("");
  const [iec, setIec] = useState("");
  const [shopsLicense, setShopsLicense] = useState("");

  // Contact
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [financeEmail, setFinanceEmail] = useState("");

  // Authorized Signatory
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");
  const [signatoryPan, setSignatoryPan] = useState("");
  const [signatoryDin, setSignatoryDin] = useState("");

  // Bank Details
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState("current");
  const [micrCode, setMicrCode] = useState("");
  const [swiftCode, setSwiftCode] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    settingsApi.getBusiness().then((res: any) => {
      const b = res.data || {};
      setRegLine1(b.registeredAddress?.line1 || "");
      setRegLine2(b.registeredAddress?.line2 || "");
      setRegCity(b.registeredAddress?.city || "");
      setRegState(b.registeredAddress?.state || "");
      setRegPincode(b.registeredAddress?.pincode || "");
      setSameAsRegistered(b.communicationAddress?.sameAsRegistered !== false);
      setCommLine1(b.communicationAddress?.line1 || "");
      setCommLine2(b.communicationAddress?.line2 || "");
      setCommCity(b.communicationAddress?.city || "");
      setCommState(b.communicationAddress?.state || "");
      setCommPincode(b.communicationAddress?.pincode || "");
      setPan(b.pan || "");
      setGstin(b.gstin || "");
      setCin(b.cin || "");
      setTan(b.tan || "");
      setMsme(b.msmeRegistration || "");
      setIec(b.iec || "");
      setShopsLicense(b.shopsEstablishmentLicense || "");
      setContactEmail(b.contactEmail || "");
      setContactPhone(b.contactPhone || "");
      setAlternatePhone(b.alternatePhone || "");
      setHrEmail(b.hrEmail || "");
      setFinanceEmail(b.financeEmail || "");
      setSignatoryName(b.authorizedSignatory?.name || "");
      setSignatoryDesignation(b.authorizedSignatory?.designation || "");
      setSignatoryPan(b.authorizedSignatory?.pan || "");
      setSignatoryDin(b.authorizedSignatory?.din || "");
      setBankName(b.bankDetails?.bankName || "");
      setBranchName(b.bankDetails?.branchName || "");
      setAccountNumber(b.bankDetails?.accountNumber || "");
      setIfscCode(b.bankDetails?.ifscCode || "");
      setAccountType(b.bankDetails?.accountType || "current");
      setMicrCode(b.bankDetails?.micrCode || "");
      setSwiftCode(b.bankDetails?.swiftCode || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentOrg]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errs.pan = "Invalid PAN format (e.g., ABCDE1234F)";
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(gstin)) errs.gstin = "Invalid GSTIN format (15 chars)";
    if (tan && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tan)) errs.tan = "Invalid TAN format (e.g., ABCD12345E)";
    if (cin && !/^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(cin)) errs.cin = "Invalid CIN format (21 chars)";
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) errs.ifsc = "Invalid IFSC format (e.g., SBIN0001234)";
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errs.contactEmail = "Invalid email";
    if (hrEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hrEmail)) errs.hrEmail = "Invalid email";
    if (financeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(financeEmail)) errs.financeEmail = "Invalid email";
    if (regPincode && !/^[1-9][0-9]{5}$/.test(regPincode)) errs.regPincode = "Invalid PIN code (6 digits)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { toast.error("Please fix validation errors"); return; }
    setSaving(true);
    try {
      await settingsApi.updateBusiness({
        registeredAddress: { line1: regLine1, line2: regLine2, city: regCity, state: regState, pincode: regPincode, country: (currentOrg as any)?.country },
        communicationAddress: sameAsRegistered
          ? { sameAsRegistered: true, line1: regLine1, line2: regLine2, city: regCity, state: regState, pincode: regPincode }
          : { sameAsRegistered: false, line1: commLine1, line2: commLine2, city: commCity, state: commState, pincode: commPincode },
        pan, gstin, cin, tan, msmeRegistration: msme, iec, shopsEstablishmentLicense: shopsLicense,
        contactEmail, contactPhone, alternatePhone, hrEmail, financeEmail,
        authorizedSignatory: { name: signatoryName, designation: signatoryDesignation, pan: signatoryPan, din: signatoryDin },
        bankDetails: { bankName, branchName, accountNumber, ifscCode, accountType, micrCode, swiftCode },
      });
      toast.success("Business details saved successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const selectClass = inputClass + " bg-white appearance-none cursor-pointer";
  const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";
  const errorClass = "text-xs text-red-500 mt-1";
  const sectionIcon = "w-4 h-4 text-[#2E86C1]";

  const InfoTip = ({ text }: { text: string }) => (
    <span className="inline-flex items-center ml-1 group relative">
      <svg className="w-3.5 h-3.5 text-[#94A3B8] cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#0F172A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">{text}</span>
    </span>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">Business & Legal Details</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Manage your registered address, tax registration, and bank details. Required for payroll and invoicing.</p>
      </div>

      {/* Registered Address */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className={sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
          </svg>
          Registered Address
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelClass}>Address Line 1 <span className="text-red-500">*</span></label>
            <input type="text" value={regLine1} onChange={(e) => setRegLine1(e.target.value)} className={inputClass} placeholder="Street address" maxLength={200} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Address Line 2</label>
            <input type="text" value={regLine2} onChange={(e) => setRegLine2(e.target.value)} className={inputClass} placeholder="Building, floor, suite" maxLength={200} />
          </div>
          <div><label className={labelClass}>City <span className="text-red-500">*</span></label><input type="text" value={regCity} onChange={(e) => setRegCity(e.target.value)} className={inputClass} placeholder="Mumbai" /></div>
          <div><label className={labelClass}>State / Province <span className="text-red-500">*</span></label><input type="text" value={regState} onChange={(e) => setRegState(e.target.value)} className={inputClass} placeholder="Maharashtra" /></div>
          <div>
            <label className={labelClass}>PIN / ZIP Code <span className="text-red-500">*</span></label>
            <input type="text" value={regPincode} onChange={(e) => setRegPincode(e.target.value)} className={inputClass} placeholder="400001" maxLength={10} />
            {errors.regPincode && <p className={errorClass}>{errors.regPincode}</p>}
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input type="text" value={(currentOrg as any)?.country || "—"} disabled className={inputClass + " bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed"} />
            <p className="text-xs text-[#94A3B8] mt-1">Set in General Settings</p>
          </div>
        </div>
      </div>

      {/* Communication Address */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
            <svg className={sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Communication Address
          </h3>
          <label className="flex items-center gap-2 text-sm text-[#64748B] cursor-pointer">
            <input type="checkbox" checked={sameAsRegistered} onChange={(e) => setSameAsRegistered(e.target.checked)} className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
            Same as registered
          </label>
        </div>
        {!sameAsRegistered ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2"><label className={labelClass}>Address Line 1</label><input type="text" value={commLine1} onChange={(e) => setCommLine1(e.target.value)} className={inputClass} placeholder="Street address" /></div>
            <div className="md:col-span-2"><label className={labelClass}>Address Line 2</label><input type="text" value={commLine2} onChange={(e) => setCommLine2(e.target.value)} className={inputClass} placeholder="Building, floor, suite" /></div>
            <div><label className={labelClass}>City</label><input type="text" value={commCity} onChange={(e) => setCommCity(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>State</label><input type="text" value={commState} onChange={(e) => setCommState(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>PIN / ZIP Code</label><input type="text" value={commPincode} onChange={(e) => setCommPincode(e.target.value)} className={inputClass} /></div>
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8] italic">Communication address is the same as the registered address.</p>
        )}
      </div>

      {/* Tax & Registration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className={sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Tax & Registration Numbers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>PAN <InfoTip text="Permanent Account Number — 10 chars" /></label>
            <input type="text" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} className={inputClass} placeholder="ABCDE1234F" maxLength={10} />
            {errors.pan && <p className={errorClass}>{errors.pan}</p>}
          </div>
          <div>
            <label className={labelClass}>GSTIN <InfoTip text="GST Identification Number — 15 chars" /></label>
            <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className={inputClass} placeholder="22ABCDE1234F1Z5" maxLength={15} />
            {errors.gstin && <p className={errorClass}>{errors.gstin}</p>}
            {gstin.length >= 2 && <p className="text-xs text-[#94A3B8] mt-1">State Code: {gstin.substring(0, 2)}</p>}
          </div>
          <div>
            <label className={labelClass}>TAN <InfoTip text="Tax Deduction Account Number — 10 chars" /></label>
            <input type="text" value={tan} onChange={(e) => setTan(e.target.value.toUpperCase())} className={inputClass} placeholder="ABCD12345E" maxLength={10} />
            {errors.tan && <p className={errorClass}>{errors.tan}</p>}
          </div>
          <div>
            <label className={labelClass}>CIN <InfoTip text="Corporate Identity Number — 21 chars" /></label>
            <input type="text" value={cin} onChange={(e) => setCin(e.target.value.toUpperCase())} className={inputClass} placeholder="U12345MH2020PLC123456" maxLength={21} />
            {errors.cin && <p className={errorClass}>{errors.cin}</p>}
          </div>
          <div>
            <label className={labelClass}>MSME / Udyam Registration</label>
            <input type="text" value={msme} onChange={(e) => setMsme(e.target.value.toUpperCase())} className={inputClass} placeholder="UDYAM-XX-00-0000000" />
          </div>
          <div>
            <label className={labelClass}>Import Export Code (IEC)</label>
            <input type="text" value={iec} onChange={(e) => setIec(e.target.value)} className={inputClass} placeholder="0000000000" maxLength={10} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Shops & Establishment License</label>
            <input type="text" value={shopsLicense} onChange={(e) => setShopsLicense(e.target.value)} className={inputClass} placeholder="State-specific license number" />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className={sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className={labelClass}>Organization Email <span className="text-red-500">*</span></label><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} placeholder="info@company.com" />{errors.contactEmail && <p className={errorClass}>{errors.contactEmail}</p>}</div>
          <div><label className={labelClass}>Organization Phone <span className="text-red-500">*</span></label><input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} placeholder="+91 98765 43210" /></div>
          <div><label className={labelClass}>Alternate Phone</label><input type="tel" value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>HR Department Email</label><input type="email" value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} className={inputClass} placeholder="hr@company.com" />{errors.hrEmail && <p className={errorClass}>{errors.hrEmail}</p>}</div>
          <div><label className={labelClass}>Finance Department Email</label><input type="email" value={financeEmail} onChange={(e) => setFinanceEmail(e.target.value)} className={inputClass} placeholder="finance@company.com" />{errors.financeEmail && <p className={errorClass}>{errors.financeEmail}</p>}</div>
        </div>
      </div>

      {/* Signatory */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
          <svg className={sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Authorized Signatory
        </h3>
        <p className="text-xs text-[#94A3B8] mb-5">Person authorized to sign statutory filings and official documents.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className={labelClass}>Full Name</label><input type="text" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className={inputClass} placeholder="Full legal name" /></div>
          <div><label className={labelClass}>Designation</label><input type="text" value={signatoryDesignation} onChange={(e) => setSignatoryDesignation(e.target.value)} className={inputClass} placeholder="Director, CEO" /></div>
          <div><label className={labelClass}>Personal PAN</label><input type="text" value={signatoryPan} onChange={(e) => setSignatoryPan(e.target.value.toUpperCase())} className={inputClass} placeholder="ABCDE1234F" maxLength={10} /></div>
          <div><label className={labelClass}>DIN <InfoTip text="Director Identification Number — 8 digits" /></label><input type="text" value={signatoryDin} onChange={(e) => setSignatoryDin(e.target.value)} className={inputClass} placeholder="12345678" maxLength={8} /></div>
        </div>
      </div>

      {/* Bank */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
          <svg className={sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
          </svg>
          Bank Details
        </h3>
        <p className="text-xs text-[#94A3B8] mb-5">Primary bank account for salary disbursement and vendor payments.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className={labelClass}>Bank Name <span className="text-red-500">*</span></label><input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} placeholder="State Bank of India" /></div>
          <div><label className={labelClass}>Branch Name</label><input type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)} className={inputClass} placeholder="Main Branch, Mumbai" /></div>
          <div><label className={labelClass}>Account Number <span className="text-red-500">*</span></label><input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputClass} placeholder="Enter account number" /></div>
          <div>
            <label className={labelClass}>IFSC Code <span className="text-red-500">*</span> <InfoTip text="11 chars: 4 letters + 0 + 6 alphanumeric" /></label>
            <input type="text" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} className={inputClass} placeholder="SBIN0001234" maxLength={11} />
            {errors.ifsc && <p className={errorClass}>{errors.ifsc}</p>}
          </div>
          <div>
            <label className={labelClass}>Account Type</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={selectClass}>
              <option value="current">Current Account</option>
              <option value="savings">Savings Account</option>
            </select>
          </div>
          <div><label className={labelClass}>MICR Code</label><input type="text" value={micrCode} onChange={(e) => setMicrCode(e.target.value)} className={inputClass} placeholder="9 digits" maxLength={9} /></div>
          <div><label className={labelClass}>SWIFT Code <InfoTip text="For international transactions — 8 or 11 chars" /></label><input type="text" value={swiftCode} onChange={(e) => setSwiftCode(e.target.value.toUpperCase())} className={inputClass} placeholder="SBININBB" maxLength={11} /></div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="bg-[#2E86C1] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 shadow-sm">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
