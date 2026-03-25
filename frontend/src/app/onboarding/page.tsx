"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { orgApi, aiApi, hrApi, policyApi } from "@/lib/api";
import type { Organization } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ── Constants ──

const INDUSTRIES = [
  { value: "IT Services", icon: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" },
  { value: "Software Product", icon: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" },
  { value: "Digital Agency", icon: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" },
  { value: "Consulting", icon: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" },
  { value: "Healthcare", icon: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" },
  { value: "Finance", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { value: "Education", icon: "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" },
  { value: "Manufacturing", icon: "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" },
  { value: "E-commerce", icon: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" },
  { value: "Other", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
];

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

const TIMEZONES = [
  "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
  "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
];

const WORK_MODELS = [
  { value: "office", label: "Office", desc: "Team works from the office", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
  { value: "remote", label: "Remote", desc: "Team works from anywhere", icon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" },
  { value: "hybrid", label: "Hybrid", desc: "Mix of office and remote", icon: "M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" },
];

const HOUR_PRESETS = [
  { label: "9 AM - 6 PM", start: "09:00", end: "18:00" },
  { label: "10 AM - 7 PM", start: "10:00", end: "19:00" },
  { label: "Flexible", start: "", end: "" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEAVE_POLICIES = [
  { value: "generous", label: "Generous", desc: "20+ days/year", color: "emerald" },
  { value: "standard", label: "Standard", desc: "12-15 days/year", color: "blue" },
  { value: "minimal", label: "Minimal", desc: "~10 days/year", color: "amber" },
];

const MEETING_CULTURES = [
  { value: "heavy", label: "Heavy Meetings", desc: "Lots of syncs and standups" },
  { value: "moderate", label: "Moderate", desc: "Balanced meetings and focus time" },
  { value: "async", label: "Async-first", desc: "Prefer written communication" },
];

const METHODOLOGIES = [
  { value: "agile", label: "Agile / Scrum" },
  { value: "kanban", label: "Kanban" },
  { value: "waterfall", label: "Waterfall" },
  { value: "mixed", label: "Mixed" },
];

// ── Types ──

interface DeptCard {
  name: string;
  code: string;
  description: string;
  designations: string[];
}

interface InviteEntry {
  email: string;
  role: string;
}

// ── Step Labels ──

const STEP_LABELS = [
  "Organization Profile",
  "Work Culture",
  "Team Structure",
  "Invite Team",
  "Launch",
];

// ── Spinner Component ──

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Main Component ──

export default function OnboardingPage() {
  const { user, loading, currentOrg, refreshOrgs, setCurrentOrg } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Organization Profile
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [orgId, setOrgId] = useState<string | null>(null);

  // Step 2: Work Culture
  const [workModel, setWorkModel] = useState("office");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [leavePolicy, setLeavePolicy] = useState("standard");
  const [meetingCulture, setMeetingCulture] = useState("moderate");
  const [methodology, setMethodology] = useState("agile");

  // Step 3: AI Structure
  const [departments, setDepartments] = useState<DeptCard[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Step 4: Invites
  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [bulkEmails, setBulkEmails] = useState("");
  const [defaultRole, setDefaultRole] = useState("employee");

  // Step 5: Summary counts
  const [summary, setSummary] = useState({ deptsCreated: 0, invitesSent: 0 });

  // Pre-fill from existing org
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setIndustry(currentOrg.industry || "");
      setSize(currentOrg.size || "");
      setOrgId(currentOrg._id);
      setTimezone(currentOrg.settings?.timezone || "Asia/Kolkata");
      setCurrency(currentOrg.settings?.currency || "INR");
      if (currentOrg.domain) setWebsiteUrl(currentOrg.domain);
      const savedStep = currentOrg.onboardingStep || 1;
      setStep(savedStep > 5 ? 1 : savedStep);
    }
  }, [user, loading, currentOrg, router]);

  // ── Step 1 Handler ──

  const handleStep1 = async () => {
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    if (!industry) {
      toast.error("Please select an industry");
      return;
    }
    if (!size) {
      toast.error("Please select company size");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Organization> = {
        name: orgName,
        industry,
        size,
        domain: websiteUrl || undefined,
        settings: { timezone, currency, dateFormat: "DD/MM/YYYY" },
      } as Partial<Organization>;

      if (orgId) {
        await orgApi.update(orgId, payload);
        await orgApi.updateOnboarding(orgId, { step: 2 });
      } else {
        const res = await orgApi.create({ name: orgName, industry, size, domain: websiteUrl });
        if (res.data) {
          setOrgId(res.data._id);
          setCurrentOrg(res.data);
          // Update settings after creation
          await orgApi.update(res.data._id, { settings: { timezone, currency, dateFormat: "DD/MM/YYYY" } } as Partial<Organization>);
        }
      }
      toast.success("Organization profile saved");
      setStep(2);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save organization");
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2 Handler ──

  const handleStep2 = async () => {
    setSaving(true);
    try {
      if (orgId) {
        await orgApi.update(orgId, {
          settings: {
            timezone,
            currency,
            dateFormat: "DD/MM/YYYY",
          },
        } as Partial<Organization>);
        await orgApi.updateOnboarding(orgId, { step: 3 });
      }

      // Auto-create policies based on work culture selections
      // Work timing policy
      try {
        await policyApi.create({
          policyName: "Work Timing Policy",
          type: "work_timing",
          category: "work_policy",
          workTiming: {
            startTime: workStart || "09:00",
            endTime: workEnd || "18:00",
            graceMinutes: 15,
            minWorkingHours: 8,
            breakMinutes: 60,
            timezone,
          },
          maxWorkingHoursPerWeek: 40,
          applicableTo: "all",
          isActive: true,
        } as Partial<import("@/lib/api").Policy>);
      } catch {
        // Policy creation failure should not block onboarding
      }

      // Leave policy based on preference
      try {
        const leaveAllocations: Record<string, { casual: number; sick: number; earned: number; wfh: number }> = {
          generous: { casual: 20, sick: 15, earned: 20, wfh: 24 },
          standard: { casual: 12, sick: 12, earned: 15, wfh: 24 },
          minimal: { casual: 8, sick: 8, earned: 10, wfh: 12 },
        };
        const alloc = leaveAllocations[leavePolicy] || leaveAllocations.standard;
        await policyApi.create({
          policyName: "Leave Policy",
          type: "leave",
          category: "leave_policy",
          leavePolicy: {
            leaveTypes: [
              { type: "casual", label: "Casual Leave", annualAllocation: alloc.casual, accrualFrequency: "monthly", accrualAmount: Math.round((alloc.casual / 12) * 100) / 100, maxCarryForward: 5, encashable: false, maxConsecutiveDays: 3, requiresDocument: false, applicableTo: "all", minServiceMonths: 0 },
              { type: "sick", label: "Sick Leave", annualAllocation: alloc.sick, accrualFrequency: "monthly", accrualAmount: Math.round((alloc.sick / 12) * 100) / 100, maxCarryForward: 5, encashable: false, maxConsecutiveDays: 5, requiresDocument: true, applicableTo: "all", minServiceMonths: 0 },
              { type: "earned", label: "Earned Leave", annualAllocation: alloc.earned, accrualFrequency: "monthly", accrualAmount: Math.round((alloc.earned / 12) * 100) / 100, maxCarryForward: 10, encashable: true, maxConsecutiveDays: 10, requiresDocument: false, applicableTo: "all", minServiceMonths: 6 },
              { type: "wfh", label: "Work From Home", annualAllocation: alloc.wfh, accrualFrequency: "monthly", accrualAmount: Math.round((alloc.wfh / 12) * 100) / 100, maxCarryForward: 0, encashable: false, maxConsecutiveDays: 5, requiresDocument: false, applicableTo: "all", minServiceMonths: 0 },
            ],
            yearStart: "january",
            probationLeaveAllowed: false,
            halfDayAllowed: true,
            backDatedLeaveMaxDays: 7,
          },
          applicableTo: "all",
          isActive: true,
        } as Partial<import("@/lib/api").Policy>);
      } catch {
        // Policy creation failure should not block onboarding
      }

      // WFH policy if remote or hybrid
      if (workModel === "remote" || workModel === "hybrid") {
        try {
          await policyApi.create({
            policyName: "WFH Policy",
            type: "wfh",
            category: "wfh_policy",
            wfhPolicy: {
              maxDaysPerMonth: workModel === "remote" ? 22 : 10,
              requiresApproval: workModel !== "remote",
              allowedDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            },
            applicableTo: "all",
            isActive: true,
          } as Partial<import("@/lib/api").Policy>);
        } catch {
          // Policy creation failure should not block onboarding
        }
      }

      toast.success("Work preferences saved");
      // Trigger AI structure generation
      generateStructure();
      setStep(3);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3: AI Structure Generation ──

  const generateStructure = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await aiApi.generateOnboardingStructure({
        orgName,
        industry: industry || "Other",
        size: size || "11-50",
      });
      if (res.data) {
        // Group designations by department
        const deptMap: Record<string, DeptCard> = {};
        for (const d of res.data.departments) {
          deptMap[d.name] = { name: d.name, code: d.code, description: d.description, designations: [] };
        }
        for (const des of res.data.designations) {
          if (deptMap[des.department]) {
            deptMap[des.department].designations.push(des.title);
          }
        }
        setDepartments(Object.values(deptMap));
      }
    } catch {
      // Fallback to default structure
      const defaults: DeptCard[] = [
        { name: "Engineering", code: "ENG", description: "Software development", designations: ["Software Engineer", "Senior Engineer", "Tech Lead", "Engineering Manager"] },
        { name: "Product", code: "PROD", description: "Product management", designations: ["Product Manager", "Senior PM", "VP Product"] },
        { name: "Design", code: "DES", description: "UI/UX and branding", designations: ["UI/UX Designer", "Senior Designer", "Design Lead"] },
        { name: "Human Resources", code: "HR", description: "People operations", designations: ["HR Executive", "HR Manager"] },
      ];
      setDepartments(defaults);
      toast.error("AI unavailable, showing default structure");
    } finally {
      setAiLoading(false);
    }
  }, [orgName, industry, size]);

  const removeDept = (idx: number) => {
    setDepartments((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeDesignation = (deptIdx: number, desIdx: number) => {
    setDepartments((prev) =>
      prev.map((d, i) =>
        i === deptIdx ? { ...d, designations: d.designations.filter((_, j) => j !== desIdx) } : d
      )
    );
  };

  const addDepartment = () => {
    setDepartments((prev) => [
      ...prev,
      { name: "New Department", code: "NEW", description: "Description", designations: ["Role 1"] },
    ]);
  };

  const updateDeptName = (idx: number, name: string) => {
    setDepartments((prev) => prev.map((d, i) => (i === idx ? { ...d, name } : d)));
  };

  const handleStep3Apply = async () => {
    if (!orgId) return;
    setSaving(true);
    let created = 0;
    let designationsCreated = 0;
    try {
      for (const dept of departments) {
        try {
          const deptRes = await hrApi.createDepartment({ name: dept.name, code: dept.code });
          created++;
          // Auto-create designations for this department
          const newDeptId = deptRes.data?._id;
          if (newDeptId && dept.designations.length > 0) {
            for (let i = 0; i < dept.designations.length; i++) {
              try {
                const level = Math.min(10, Math.max(1, dept.designations.length - i));
                await hrApi.createDesignation({
                  title: dept.designations[i],
                  level,
                  departmentId: newDeptId,
                  track: "individual_contributor",
                });
                designationsCreated++;
              } catch {
                // Designation creation failure should not block onboarding
              }
            }
          }
        } catch {
          // Department may already exist
        }
      }
      await orgApi.updateOnboarding(orgId, { step: 4 });
      setSummary((s) => ({ ...s, deptsCreated: created }));
      const msgs: string[] = [];
      if (created > 0) msgs.push(`${created} department${created !== 1 ? "s" : ""}`);
      if (designationsCreated > 0) msgs.push(`${designationsCreated} designation${designationsCreated !== 1 ? "s" : ""}`);
      toast.success(msgs.length > 0 ? `Created ${msgs.join(" and ")}` : "Structure saved");
      setStep(4);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create structure");
    } finally {
      setSaving(false);
    }
  };

  const handleStep3Skip = async () => {
    if (orgId) await orgApi.updateOnboarding(orgId, { step: 4 });
    setStep(4);
  };

  // ── Step 4: Invite Handling ──

  const parseAndAddEmails = () => {
    const raw = bulkEmails.trim();
    if (!raw) return;
    const emails = raw.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
    if (emails.length === 0) {
      toast.error("No valid emails found");
      return;
    }
    const existing = new Set(invites.map((i) => i.email));
    const newInvites: InviteEntry[] = [];
    let dupes = 0;
    for (const email of emails) {
      if (existing.has(email)) {
        dupes++;
        continue;
      }
      existing.add(email);
      newInvites.push({ email, role: defaultRole });
    }
    setInvites((prev) => [...prev, ...newInvites]);
    setBulkEmails("");
    if (dupes > 0) toast.info(`${dupes} duplicate email${dupes > 1 ? "s" : ""} skipped`);
    if (newInvites.length > 0) toast.success(`${newInvites.length} email${newInvites.length > 1 ? "s" : ""} added`);
  };

  const updateInviteRole = (idx: number, role: string) => {
    setInvites((prev) => prev.map((inv, i) => (i === idx ? { ...inv, role } : inv)));
  };

  const removeInvite = (idx: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStep4Send = async () => {
    if (!orgId) return;
    setSaving(true);
    let sent = 0;
    try {
      for (const inv of invites) {
        try {
          await orgApi.invite(orgId, { email: inv.email, role: inv.role });
          sent++;
        } catch {
          // ignore individual failures
        }
      }
      await orgApi.updateOnboarding(orgId, { step: 5 });
      setSummary((s) => ({ ...s, invitesSent: sent }));
      toast.success(`${sent} invite${sent !== 1 ? "s" : ""} sent`);
      setStep(5);
    } catch {
      toast.error("Failed to send invites");
    } finally {
      setSaving(false);
    }
  };

  const handleStep4Skip = async () => {
    if (orgId) await orgApi.updateOnboarding(orgId, { step: 5 });
    setStep(5);
  };

  // ── Step 5: Launch ──

  const handleLaunch = async () => {
    setSaving(true);
    try {
      if (orgId) {
        await orgApi.updateOnboarding(orgId, { step: 5, completed: true });
      }
      await refreshOrgs();
      toast.success("Your workspace is ready!");
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAll = async () => {
    setSaving(true);
    try {
      if (orgId) {
        await orgApi.updateOnboarding(orgId, { step: 5, completed: true });
      }
      await refreshOrgs();
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle work day ──

  const toggleDay = (day: string) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // ── Loading State ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-[#2E86C1]" />
      </div>
    );
  }

  if (!user) return null;

  const progress = ((step - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#2E86C1] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[#0F172A]">Nexora</span>
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Set up your workspace</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Step {step} of 5 — {STEP_LABELS[step - 1]}</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  s === step
                    ? "bg-[#2E86C1] text-white shadow-md shadow-[#2E86C1]/30 scale-110"
                    : s < step
                    ? "bg-emerald-500 text-white"
                    : "bg-[#E2E8F0] text-[#94A3B8]"
                }`}
              >
                {s < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              {s < 5 && (
                <div className={`w-8 h-0.5 rounded-full transition-colors duration-300 ${s < step ? "bg-emerald-500" : "bg-[#E2E8F0]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-[#E2E8F0] rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-[#2E86C1] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════
            STEP 1: Organization Profile
           ═══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">Organization Profile</h2>
              <p className="text-[13px] text-[#64748B] mb-6">Tell us about your organization to personalize your experience</p>

              <div className="space-y-5">
                {/* Org Name */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#475569]">Organization name *</Label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Inc."
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 rounded-xl px-4"
                  />
                </div>

                {/* Industry */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#475569]">Industry *</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.value}
                        onClick={() => setIndustry(ind.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          industry === ind.value
                            ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                            : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={ind.icon} />
                        </svg>
                        <span className="text-[10px] font-medium leading-tight">{ind.value}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Company Size */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#475569]">Company size *</Label>
                  <div className="flex gap-2">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`flex-1 h-10 rounded-xl border-2 text-[13px] font-medium transition-all ${
                          size === s
                            ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                            : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Website URL */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#475569]">Website URL <span className="text-[#94A3B8] font-normal">(optional)</span></Label>
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://company.com"
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] focus-visible:bg-white focus-visible:border-[#2E86C1] focus-visible:ring-[#2E86C1]/20 rounded-xl px-4"
                  />
                </div>

                {/* Logo Upload Placeholder */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#475569]">Logo <span className="text-[#94A3B8] font-normal">(optional)</span></Label>
                  <div className="h-20 border-2 border-dashed border-[#E2E8F0] rounded-xl flex items-center justify-center gap-2 text-[#94A3B8] cursor-pointer hover:border-[#CBD5E1] transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-xs font-medium">Upload logo (coming soon)</span>
                  </div>
                </div>

                {/* Timezone & Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#475569]">Primary timezone</Label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#475569]">Currency</Label>
                    <div className="flex gap-2">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className={`flex-1 h-10 rounded-xl border-2 text-[13px] font-medium transition-all ${
                            currency === c.code
                              ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                              : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                          }`}
                        >
                          {c.symbol} {c.code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={handleStep1}
                  disabled={saving}
                  className="h-10 px-8 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-semibold rounded-xl text-[13px]"
                >
                  {saving ? <span className="flex items-center gap-2"><Spinner /> Saving...</span> : "Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════
            STEP 2: Work Culture & Preferences
           ═══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">Work Culture & Preferences</h2>
              <p className="text-[13px] text-[#64748B] mb-6">Help us understand how your organization works</p>

              <div className="space-y-6">
                {/* Work Model */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#475569]">Work model</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {WORK_MODELS.map((wm) => (
                      <button
                        key={wm.value}
                        onClick={() => setWorkModel(wm.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          workModel === wm.value
                            ? "border-[#2E86C1] bg-[#EBF5FF]"
                            : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          workModel === wm.value ? "bg-[#2E86C1] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                        }`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={wm.icon} />
                          </svg>
                        </div>
                        <div className="text-center">
                          <p className={`text-[13px] font-semibold ${workModel === wm.value ? "text-[#2E86C1]" : "text-[#334155]"}`}>{wm.label}</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">{wm.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Work Hours */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#475569]">Standard work hours</Label>
                  <div className="flex gap-2 mb-2">
                    {HOUR_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => { setWorkStart(preset.start); setWorkEnd(preset.end); }}
                        className={`px-3 h-8 rounded-lg text-[11px] font-medium border transition-all ${
                          workStart === preset.start && workEnd === preset.end
                            ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                            : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="time"
                        value={workStart}
                        onChange={(e) => setWorkStart(e.target.value)}
                        className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20"
                      />
                    </div>
                    <span className="text-[13px] text-[#94A3B8] font-medium">to</span>
                    <div className="flex-1">
                      <input
                        type="time"
                        value={workEnd}
                        onChange={(e) => setWorkEnd(e.target.value)}
                        className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Work Days */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#475569]">Work days</Label>
                  <div className="flex gap-2">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`flex-1 h-10 rounded-xl text-[13px] font-medium border-2 transition-all ${
                          workDays.includes(day)
                            ? day === "Sat" || day === "Sun"
                              ? "border-amber-400 bg-amber-50 text-amber-700"
                              : "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                            : "border-[#E2E8F0] bg-white text-[#94A3B8] hover:border-[#CBD5E1]"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leave Policy */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#475569]">Leave policy style</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {LEAVE_POLICIES.map((lp) => (
                      <button
                        key={lp.value}
                        onClick={() => setLeavePolicy(lp.value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          leavePolicy === lp.value
                            ? lp.color === "emerald"
                              ? "border-emerald-400 bg-emerald-50"
                              : lp.color === "blue"
                              ? "border-[#2E86C1] bg-[#EBF5FF]"
                              : "border-amber-400 bg-amber-50"
                            : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                        }`}
                      >
                        <p className={`text-[13px] font-semibold ${
                          leavePolicy === lp.value
                            ? lp.color === "emerald" ? "text-emerald-700" : lp.color === "blue" ? "text-[#2E86C1]" : "text-amber-700"
                            : "text-[#334155]"
                        }`}>{lp.label}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">{lp.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meeting Culture */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#475569]">Meeting culture</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {MEETING_CULTURES.map((mc) => (
                      <button
                        key={mc.value}
                        onClick={() => setMeetingCulture(mc.value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          meetingCulture === mc.value
                            ? "border-[#2E86C1] bg-[#EBF5FF]"
                            : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                        }`}
                      >
                        <p className={`text-[13px] font-semibold ${meetingCulture === mc.value ? "text-[#2E86C1]" : "text-[#334155]"}`}>{mc.label}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">{mc.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Methodology */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#475569]">Project methodology</Label>
                  <div className="flex gap-2">
                    {METHODOLOGIES.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setMethodology(m.value)}
                        className={`flex-1 h-10 rounded-xl text-[13px] font-medium border-2 transition-all ${
                          methodology === m.value
                            ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                            : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Back
                </button>
                <Button
                  onClick={handleStep2}
                  disabled={saving}
                  className="h-10 px-8 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-semibold rounded-xl text-[13px]"
                >
                  {saving ? <span className="flex items-center gap-2"><Spinner /> Saving...</span> : "Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════
            STEP 3: AI-Suggested Team Structure
           ═══════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">Team Structure</h2>
              <p className="text-[13px] text-[#64748B] mb-6">
                {aiLoading
                  ? "AI is designing your team structure based on your preferences..."
                  : "Review and customize the suggested structure"}
              </p>

              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#EBF5FF] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#2E86C1] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <Spinner className="absolute -top-1 -right-1 w-5 h-5 text-[#2E86C1]" />
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A]">AI is designing your team structure...</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Analyzing best practices for {industry || "your"} industry</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {departments.map((dept, deptIdx) => (
                      <div key={deptIdx} className="border border-[#E2E8F0] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#EBF5FF] flex items-center justify-center">
                              <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                              </svg>
                            </div>
                            <div>
                              <input
                                value={dept.name}
                                onChange={(e) => updateDeptName(deptIdx, e.target.value)}
                                className="text-sm font-semibold text-[#0F172A] bg-transparent border-none outline-none focus:ring-0 p-0 w-40"
                              />
                              <span className="text-[10px] text-[#94A3B8] font-mono block">{dept.code}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeDept(deptIdx)}
                            className="p-1.5 rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {dept.description && (
                          <p className="text-[11px] text-[#94A3B8] mb-2">{dept.description}</p>
                        )}

                        <div>
                          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">Designations</p>
                          <div className="flex flex-wrap gap-1.5">
                            {dept.designations.map((des, desIdx) => (
                              <span key={desIdx} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                {des}
                                <button
                                  onClick={() => removeDesignation(deptIdx, desIdx)}
                                  className="hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addDepartment}
                    className="mt-4 w-full h-10 border-2 border-dashed border-[#E2E8F0] rounded-xl flex items-center justify-center gap-2 text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] hover:border-[#CBD5E1] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Department
                  </button>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setStep(2)}
                        className="text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                        Back
                      </button>
                      <button
                        onClick={handleStep3Skip}
                        className="text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                    <Button
                      onClick={handleStep3Apply}
                      disabled={saving}
                      className="h-10 px-8 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-semibold rounded-xl text-[13px]"
                    >
                      {saving ? <span className="flex items-center gap-2"><Spinner /> Creating...</span> : "Apply & Continue"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════
            STEP 4: Invite Team Members
           ═══════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">Invite Team Members</h2>
              <p className="text-[13px] text-[#64748B] mb-6">Paste email addresses below to invite your team. One per line or comma-separated.</p>

              {/* Bulk Email Input */}
              <div className="space-y-3 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#475569]">Email addresses</Label>
                  <textarea
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder={"john@company.com\njane@company.com\nalex@company.com"}
                    rows={4}
                    className="w-full text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20 resize-none placeholder:text-[#CBD5E1]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] font-medium text-[#94A3B8]">Default role:</Label>
                    <select
                      value={defaultRole}
                      onChange={(e) => setDefaultRole(e.target.value)}
                      className="h-8 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 text-[#334155] focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Employee</option>
                    </select>
                  </div>
                  <Button
                    onClick={parseAndAddEmails}
                    variant="outline"
                    className="h-8 px-4 border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] rounded-lg text-[12px]"
                  >
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add to List
                  </Button>
                </div>
              </div>

              {/* Invite List */}
              {invites.length > 0 ? (
                <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{invites.length} member{invites.length !== 1 ? "s" : ""} to invite</p>
                  {invites.map((inv, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-[#F8FAFC] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E2E8F0] flex items-center justify-center">
                          <span className="text-[11px] font-bold text-[#64748B]">
                            {inv.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[13px] font-medium text-[#334155]">{inv.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={inv.role}
                          onChange={(e) => updateInviteRole(idx, e.target.value)}
                          className="h-7 text-[11px] bg-white border border-[#E2E8F0] rounded-lg px-2 text-[#334155] focus:outline-none focus:border-[#2E86C1]"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                        </select>
                        <button
                          onClick={() => removeInvite(idx)}
                          className="p-1 rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-[#94A3B8] mb-6">
                  <svg className="w-10 h-10 mx-auto mb-2 text-[#E2E8F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <p className="text-xs">No invites yet. Paste emails above to get started.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setStep(3)}
                    className="text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={handleStep4Skip}
                    className="text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  >
                    Skip
                  </button>
                </div>
                <Button
                  onClick={handleStep4Send}
                  disabled={saving || invites.length === 0}
                  className="h-10 px-8 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-semibold rounded-xl text-[13px]"
                >
                  {saving ? (
                    <span className="flex items-center gap-2"><Spinner /> Sending...</span>
                  ) : (
                    `Send Invites (${invites.length})`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════
            STEP 5: Ready to Launch!
           ═══════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="p-6 sm:p-8 text-center">
              {/* Sparkle celebration */}
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                {/* Sparkle decorations */}
                <svg className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <svg className="absolute -bottom-1 -left-3 w-5 h-5 text-[#2E86C1] animate-pulse" style={{ animationDelay: "0.5s" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <svg className="absolute -top-3 left-0 w-4 h-4 text-violet-400 animate-pulse" style={{ animationDelay: "1s" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-[#0F172A] mb-1">Ready to Launch!</h2>
              <p className="text-[13px] text-[#64748B] mb-8">Your workspace is all set up. Here&apos;s a summary of what we configured.</p>

              {/* Summary Card */}
              <div className="bg-[#F8FAFC] rounded-xl p-5 mb-8 text-left">
                <div className="grid grid-cols-2 gap-4">
                  {/* Org Info */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Organization</p>
                    <p className="text-[13px] font-semibold text-[#0F172A]">{orgName || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Industry</p>
                    <p className="text-[13px] font-medium text-[#334155]">{industry || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Company Size</p>
                    <p className="text-[13px] font-medium text-[#334155]">{size ? `${size} employees` : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Work Model</p>
                    <p className="text-[13px] font-medium text-[#334155] capitalize">{workModel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Work Hours</p>
                    <p className="text-[13px] font-medium text-[#334155]">
                      {workStart && workEnd ? `${workStart} - ${workEnd}` : "Flexible"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Leave Policy</p>
                    <p className="text-[13px] font-medium text-[#334155] capitalize">{leavePolicy}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Departments Created</p>
                    <p className="text-[13px] font-semibold text-[#2E86C1]">{summary.deptsCreated}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Members Invited</p>
                    <p className="text-[13px] font-semibold text-[#2E86C1]">{summary.invitesSent}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleLaunch}
                disabled={saving}
                className="h-12 px-10 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-semibold rounded-xl text-[15px] shadow-sm shadow-[#2E86C1]/25"
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Spinner className="h-5 w-5" /> Launching...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    </svg>
                    Launch Your Workspace
                  </>
                )}
              </Button>

              <div className="mt-4">
                <button
                  onClick={handleSkipAll}
                  className="text-[13px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  I&apos;ll do this later
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
