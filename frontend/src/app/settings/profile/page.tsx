"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi, hrApi, type Employee } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Empty sub-doc placeholders — we keep the form fields controlled even
// when the backing HR record has the field as null, so the controlled-
// vs-uncontrolled React warning never fires on initial render.
const EMPTY_ADDRESS = { street: "", city: "", state: "", country: "", zip: "" };
const EMPTY_EMERGENCY = { name: "", relation: "", phone: "" };
const EMPTY_BANK = { bankName: "", accountNumber: "", ifsc: "", accountHolder: "" };

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth-side profile fields (saved via PUT /auth/me — see handleSave).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [bio, setBio] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [github, setGithub] = useState("");
  const [saving, setSaving] = useState(false);

  // HR-side fields (saved via PATCH /employees/me — separate store from
  // the auth User document, owned by hr-service). On the first render we
  // populate from the HR record fetched on mount; if the user has no HR
  // record (e.g. a platform admin not in any org's employee directory)
  // the section degrades gracefully — we just hide it.
  const [hrEmployee, setHrEmployee] = useState<Employee | null>(null);
  const [hrFetched, setHrFetched] = useState(false);
  const [personalEmail, setPersonalEmail] = useState("");
  const [maritalStatus, setMaritalStatus] = useState<string>("");
  const [bloodGroup, setBloodGroup] = useState<string>("");
  const [currentAddress, setCurrentAddress] = useState({ ...EMPTY_ADDRESS });
  const [permanentAddress, setPermanentAddress] = useState({ ...EMPTY_ADDRESS });
  const [emergencyContact, setEmergencyContact] = useState({ ...EMPTY_EMERGENCY });

  // Bank-change submission flow. Bank details are NOT directly editable;
  // the employee fills the form and submits → admin approves before the
  // change applies to the live employee.bankDetails.
  const [bankForm, setBankForm] = useState({ ...EMPTY_BANK });
  const [bankReason, setBankReason] = useState("");
  const [submittingBank, setSubmittingBank] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);

  useEffect(() => {
    if (user) {
      const u = user as any;
      setFirstName(u.firstName || "");
      setLastName(u.lastName || "");
      setPhone(u.phone || "");
      setAvatar(u.avatar || "");
      setJobTitle(u.jobTitle || u.designation || "");
      setDepartment(u.department || "");
      setLocation(u.location || "");
      setTimezone(u.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "");
      setBio(u.bio || "");
      setLinkedIn(u.linkedIn || "");
      setGithub(u.github || "");
    }
  }, [user]);

  // Fetch the user's HR employee record once on mount. Wrapped in a
  // try/catch so platform admins / users without an HR record see the
  // page degrade silently instead of throwing — they just don't get the
  // HR sections.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await hrApi.getMyEmployee();
        const emp: Employee = res?.data ?? res;
        if (cancelled || !emp || !emp._id) return;
        setHrEmployee(emp);
        setPersonalEmail(emp.personalEmail || "");
        setMaritalStatus((emp.maritalStatus as string) || "");
        setBloodGroup((emp.bloodGroup as string) || "");
        setCurrentAddress({ ...EMPTY_ADDRESS, ...(emp.address || {}) });
        setPermanentAddress({ ...EMPTY_ADDRESS, ...(emp.permanentAddress || {}) });
        setEmergencyContact({ ...EMPTY_EMERGENCY, ...(emp.emergencyContact || {}) });
        // Pre-fill the bank-change form with current details so a user
        // changing only the IFSC doesn't have to retype the rest.
        setBankForm({ ...EMPTY_BANK, ...(emp.bankDetails || {}) });
      } catch {
        // Treat any error here as "no HR record for this user" — the
        // sections downstream check `hrEmployee` and skip rendering.
        if (!cancelled) setHrEmployee(null);
      } finally {
        if (!cancelled) setHrFetched(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const primaryRole = ["super_admin", "admin", "hr", "manager", "developer", "designer", "employee"].find((r) => user.roles?.includes(r)) || user.role || "member";

  const handleAvatarUpload = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setAvatar(reader.result); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Auth-side profile (name, avatar, social links, bio, etc.)
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/me`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ firstName, lastName, phone, avatar: avatar || undefined, jobTitle, department, location, timezone, bio, linkedIn, github }),
        }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to update profile"); }

      // 2. HR-side personal record (only if the user has an HR employee
      //    record — platform-only users skip this step). We send only
      //    fields the DTO whitelists; sub-docs (address etc.) get
      //    forwarded as-is because Mongoose merges them as a whole sub-doc.
      if (hrEmployee) {
        const hrPatch: any = {};
        if (personalEmail) hrPatch.personalEmail = personalEmail;
        if (maritalStatus) hrPatch.maritalStatus = maritalStatus;
        if (bloodGroup) hrPatch.bloodGroup = bloodGroup;
        // Only include the address sub-docs if at least one field is
        // non-empty — sending an empty sub-doc clears it on the backend
        // (Mongoose treats `{street:"",city:"",...}` as a real value).
        const addrFilled = Object.values(currentAddress).some((v) => (v || "").trim() !== "");
        const permFilled = Object.values(permanentAddress).some((v) => (v || "").trim() !== "");
        const emerFilled = Object.values(emergencyContact).some((v) => (v || "").trim() !== "");
        if (addrFilled) hrPatch.address = currentAddress;
        if (permFilled) hrPatch.permanentAddress = permanentAddress;
        if (emerFilled) hrPatch.emergencyContact = emergencyContact;

        if (Object.keys(hrPatch).length > 0) {
          const hrRes: any = await hrApi.updateMyProfile(hrPatch);
          const updatedEmp: Employee = hrRes?.data ?? hrRes;
          if (updatedEmp?._id) setHrEmployee(updatedEmp);
        }
      }

      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitBankChange = async () => {
    // Sanity-check the four required fields client-side. The backend
    // also enforces this — this is just to keep the toast user-friendly.
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.ifsc || !bankForm.accountHolder) {
      toast.error("All four bank fields are required");
      return;
    }
    setSubmittingBank(true);
    try {
      const res: any = await hrApi.submitMyBankChange({
        bankDetails: {
          bankName: bankForm.bankName,
          accountNumber: bankForm.accountNumber,
          ifsc: bankForm.ifsc,
          accountHolder: bankForm.accountHolder,
        },
        reason: bankReason || undefined,
      });
      const updatedEmp: Employee = res?.data ?? res;
      if (updatedEmp?._id) setHrEmployee(updatedEmp);
      toast.success("Bank change submitted for approval");
      setShowBankForm(false);
      setBankReason("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit bank change");
    } finally {
      setSubmittingBank(false);
    }
  };

  const handleWithdrawBankChange = async () => {
    if (!confirm("Withdraw your pending bank change?")) return;
    try {
      await hrApi.withdrawMyBankChange();
      // Refetch the employee record so the pending state goes away.
      const refreshed: any = await hrApi.getMyEmployee();
      const emp: Employee = refreshed?.data ?? refreshed;
      if (emp?._id) setHrEmployee(emp);
      toast.success("Pending bank change withdrawn");
    } catch (err: any) {
      toast.error(err?.message || "Failed to withdraw");
    }
  };

  const timezones = [
    "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
    "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0F172A]">Profile</h2>
        <p className="text-[13px] text-[#94A3B8] mt-1">Manage your personal information and preferences</p>
      </div>

      {/* Avatar section */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#2E86C1] to-[#60A5FA] relative">
          <div className="absolute -bottom-10 left-6">
            <div className="relative group">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all"
              >
                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); e.target.value = ""; }} />
            </div>
          </div>
        </div>
        <CardContent className="pt-14 pb-5 px-6">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">{user.firstName} {user.lastName}</h3>
              <p className="text-[13px] text-[#64748B]">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] capitalize">{primaryRole.replace("_", " ")}</span>
                {jobTitle && <span className="text-[11px] text-[#94A3B8]">&middot; {jobTitle}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {avatar && (
                <Button variant="outline" onClick={() => setAvatar("")} className="h-8 text-[12px] border-[#E2E8F0] text-[#64748B]">Remove Photo</Button>
              )}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-8 text-[12px] border-[#E2E8F0] text-[#64748B]">
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Change Photo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Input value={user.email} readOnly className="h-11 text-sm bg-[#F1F5F9] border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed pr-10" />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Phone Number</label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Information */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
            Work Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Job Title</label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g., Senior Developer" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Department</label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., Engineering" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Bengaluru, India" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                <option value="">Select timezone</option>
                {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
            About
          </h3>
          <div>
            <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your team a little about yourself..."
              rows={4}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
            Social Links
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">LinkedIn</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">linkedin.com/in/</span>
                <Input value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} placeholder="username" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0] pl-[120px]" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">GitHub</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">github.com/</span>
                <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0] pl-[96px]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── HR-side fields (only shown if the user has an HR record) ─── */}
      {hrFetched && hrEmployee && (
        <>
          {/* Personal Details */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-1 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                Personal Details
              </h3>
              <p className="text-[12px] text-[#94A3B8] mb-5">Stored on your HR record. Visible to HR administrators.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Personal Email</label>
                  <Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="you@personal.com" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Marital Status</label>
                  <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                    <option value="">Not specified</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                    <option value="">Not specified</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Address */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                Current Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Street</label>
                  <Input value={currentAddress.street} onChange={(e) => setCurrentAddress({ ...currentAddress, street: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">City</label>
                  <Input value={currentAddress.city} onChange={(e) => setCurrentAddress({ ...currentAddress, city: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">State</label>
                  <Input value={currentAddress.state} onChange={(e) => setCurrentAddress({ ...currentAddress, state: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Country</label>
                  <Input value={currentAddress.country} onChange={(e) => setCurrentAddress({ ...currentAddress, country: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Postal Code</label>
                  <Input value={currentAddress.zip} onChange={(e) => setCurrentAddress({ ...currentAddress, zip: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permanent Address */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-5">
                <h3 className="text-[14px] font-bold text-[#0F172A] flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.125 1.125 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                  Permanent Address
                </h3>
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#2E86C1] hover:underline"
                  onClick={() => setPermanentAddress({ ...currentAddress })}
                >
                  Same as current
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Street</label>
                  <Input value={permanentAddress.street} onChange={(e) => setPermanentAddress({ ...permanentAddress, street: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">City</label>
                  <Input value={permanentAddress.city} onChange={(e) => setPermanentAddress({ ...permanentAddress, city: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">State</label>
                  <Input value={permanentAddress.state} onChange={(e) => setPermanentAddress({ ...permanentAddress, state: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Country</label>
                  <Input value={permanentAddress.country} onChange={(e) => setPermanentAddress({ ...permanentAddress, country: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Postal Code</label>
                  <Input value={permanentAddress.zip} onChange={(e) => setPermanentAddress({ ...permanentAddress, zip: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Name</label>
                  <Input value={emergencyContact.name} onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Relation</label>
                  <Input value={emergencyContact.relation} onChange={(e) => setEmergencyContact({ ...emergencyContact, relation: e.target.value })} placeholder="e.g., spouse, parent" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Phone</label>
                  <Input type="tel" value={emergencyContact.phone} onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })} className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account (maker-checker) */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-1 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                Bank Account
              </h3>
              <p className="text-[12px] text-[#94A3B8] mb-5">Bank changes require admin approval before they take effect.</p>

              {/* Pending change banner */}
              {hrEmployee.pendingBankChange ? (
                <div className="mb-4 rounded-lg border border-[#F59E0B]/30 bg-[#FEF3C7] px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-[#92400E]">⏳ Change pending review</span>
                    <button onClick={handleWithdrawBankChange} className="text-[11px] font-medium text-[#92400E] hover:underline">Withdraw</button>
                  </div>
                  <div className="text-[12px] text-[#78350F] grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="opacity-60">Bank:</span> {hrEmployee.pendingBankChange.bankDetails.bankName}</div>
                    <div><span className="opacity-60">A/c:</span> ****{(hrEmployee.pendingBankChange.bankDetails.accountNumber || "").slice(-4)}</div>
                    <div><span className="opacity-60">IFSC:</span> {hrEmployee.pendingBankChange.bankDetails.ifsc}</div>
                    <div><span className="opacity-60">Holder:</span> {hrEmployee.pendingBankChange.bankDetails.accountHolder}</div>
                  </div>
                </div>
              ) : null}

              {/* Current bank details */}
              <div className="rounded-lg border border-[#E2E8F0] px-4 py-3 mb-3">
                <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Current</div>
                {hrEmployee.bankDetails?.accountNumber ? (
                  <div className="text-[13px] text-[#0F172A] grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="text-[#94A3B8]">Bank:</span> {hrEmployee.bankDetails.bankName}</div>
                    <div><span className="text-[#94A3B8]">A/c:</span> ****{(hrEmployee.bankDetails.accountNumber || "").slice(-4)}</div>
                    <div><span className="text-[#94A3B8]">IFSC:</span> {hrEmployee.bankDetails.ifsc}</div>
                    <div><span className="text-[#94A3B8]">Holder:</span> {hrEmployee.bankDetails.accountHolder}</div>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#94A3B8]">No bank details on file</div>
                )}
              </div>

              {/* Submit-change form (only shown when toggled and no pending) */}
              {!hrEmployee.pendingBankChange && (
                <>
                  {!showBankForm ? (
                    <Button variant="outline" onClick={() => setShowBankForm(true)} className="h-9 text-[12px] border-[#E2E8F0] text-[#2E86C1]">
                      Request Bank Change
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-[#E2E8F0] p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Bank Name</label>
                          <Input value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} className="h-10 text-sm bg-white border-[#E2E8F0]" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Account Number</label>
                          <Input value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} className="h-10 text-sm bg-white border-[#E2E8F0]" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">IFSC</label>
                          <Input value={bankForm.ifsc} onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })} placeholder="HDFC0001234" className="h-10 text-sm bg-white border-[#E2E8F0] font-mono" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Account Holder</label>
                          <Input value={bankForm.accountHolder} onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })} className="h-10 text-sm bg-white border-[#E2E8F0]" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Reason (optional)</label>
                        <Input value={bankReason} onChange={(e) => setBankReason(e.target.value)} placeholder="e.g., switched primary bank" className="h-10 text-sm bg-white border-[#E2E8F0]" />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => { setShowBankForm(false); setBankReason(""); }} className="h-9 text-[12px] border-[#E2E8F0] text-[#64748B]">Cancel</Button>
                        <Button onClick={handleSubmitBankChange} disabled={submittingBank} className="h-9 text-[12px] bg-[#2E86C1] hover:bg-[#2471A3]">
                          {submittingBank ? "Submitting…" : "Submit for Approval"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-8">
        <Button variant="outline" className="h-10 border-[#E2E8F0] text-[#64748B]">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="h-10 min-w-[140px] bg-gradient-to-r from-[#2E86C1] to-[#2471A3] hover:from-[#2471A3] hover:to-[#1A5276] shadow-sm">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
