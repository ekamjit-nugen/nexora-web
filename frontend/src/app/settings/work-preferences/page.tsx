"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SATURDAY_PATTERNS = ["Every Week", "1st & 3rd", "2nd & 4th", "Alternate", "All"];
const OVERTIME_RATES = ["1x", "1.5x", "2x"];
const HOLIDAY_TYPES = ["National", "Regional", "Restricted", "Company", "Optional"];
const ACCRUAL_METHODS = ["Yearly", "Monthly", "Quarterly"];
const GENDER_OPTIONS = ["All", "Male", "Female"];
const TRACKING_METHODS = ["Manual Check-in", "Biometric", "Geo-fenced Mobile", "IP-restricted Web"];

const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
const selectClass = inputClass + " bg-white appearance-none cursor-pointer";
const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

interface Holiday {
  name: string;
  date: string;
  type: string;
  optional: boolean;
}

interface LeaveType {
  name: string;
  code: string;
  annualQuota: number;
  accrualMethod: string;
  carryForward: boolean;
  maxCarryForward: number;
  encashable: boolean;
  approvalRequired: boolean;
  genderSpecific: string;
}

export default function WorkPreferencesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Working Days & Hours
  const [workingDays, setWorkingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [saturdayPattern, setSaturdayPattern] = useState("Every Week");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [flexibleTiming, setFlexibleTiming] = useState(false);
  const [gracePeriodLate, setGracePeriodLate] = useState(15);
  const [gracePeriodEarly, setGracePeriodEarly] = useState(15);
  const [halfDayThreshold, setHalfDayThreshold] = useState(4);
  const [overtimeApplicable, setOvertimeApplicable] = useState(false);
  const [overtimeRate, setOvertimeRate] = useState("1.5x");
  const [overtimeMinTrigger, setOvertimeMinTrigger] = useState(30);

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [editingHolidayIdx, setEditingHolidayIdx] = useState<number | null>(null);
  const [holidayForm, setHolidayForm] = useState<Holiday>({ name: "", date: "", type: "National", optional: false });

  // Leave Types
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [editingLeaveIdx, setEditingLeaveIdx] = useState<number | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveType>({
    name: "", code: "", annualQuota: 12, accrualMethod: "Yearly",
    carryForward: false, maxCarryForward: 0, encashable: false,
    approvalRequired: true, genderSpecific: "All",
  });

  // Attendance
  const [trackingMethods, setTrackingMethods] = useState<string[]>(["Manual Check-in"]);
  const [geoFenceRadius, setGeoFenceRadius] = useState(200);
  const [autoCheckout, setAutoCheckout] = useState(false);
  const [autoCheckoutTime, setAutoCheckoutTime] = useState("21:00");
  const [regularizationAllowed, setRegularizationAllowed] = useState(true);
  const [regularizationWindow, setRegularizationWindow] = useState(7);

  const userRoles = user?.roles || [];
  const isAdminOrHr = userRoles.some((r) => ["admin", "super_admin", "hr", "owner"].includes(r));

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await settingsApi.getWorkPreferences();
      const data = res.data as any;
      if (!data) return;

      if (data.workingDays?.length) setWorkingDays(data.workingDays);
      if (data.saturdayPattern) setSaturdayPattern(data.saturdayPattern);
      if (data.workingHours?.start) setWorkStart(data.workingHours.start);
      if (data.workingHours?.end) setWorkEnd(data.workingHours.end);
      if (data.workingHours?.breakMinutes != null) setBreakMinutes(data.workingHours.breakMinutes);
      if (data.flexibleTiming != null) setFlexibleTiming(data.flexibleTiming);
      if (data.gracePeriodLate != null) setGracePeriodLate(data.gracePeriodLate);
      if (data.gracePeriodEarly != null) setGracePeriodEarly(data.gracePeriodEarly);
      if (data.halfDayThreshold != null) setHalfDayThreshold(data.halfDayThreshold);
      if (data.overtime?.applicable != null) setOvertimeApplicable(data.overtime.applicable);
      if (data.overtime?.rate) setOvertimeRate(data.overtime.rate);
      if (data.overtime?.minimumTriggerMinutes != null) setOvertimeMinTrigger(data.overtime.minimumTriggerMinutes);
      if (data.holidays) setHolidays(data.holidays);
      if (data.leaveTypes) setLeaveTypes(data.leaveTypes);
      if (data.attendance?.trackingMethods?.length) setTrackingMethods(data.attendance.trackingMethods);
      if (data.attendance?.geoFenceRadius != null) setGeoFenceRadius(data.attendance.geoFenceRadius);
      if (data.attendance?.autoCheckout != null) setAutoCheckout(data.attendance.autoCheckout);
      if (data.attendance?.autoCheckoutTime) setAutoCheckoutTime(data.attendance.autoCheckoutTime);
      if (data.attendance?.regularizationAllowed != null) setRegularizationAllowed(data.attendance.regularizationAllowed);
      if (data.attendance?.regularizationWindow != null) setRegularizationWindow(data.attendance.regularizationWindow);
    } catch {
      toast.error("Failed to load work preferences");
    } finally {
      setLoading(false);
    }
  }

  function calcEffectiveHours(): string {
    const [sh, sm] = workStart.split(":").map(Number);
    const [eh, em] = workEnd.split(":").map(Number);
    const totalMin = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes;
    if (totalMin <= 0) return "0.0";
    return (totalMin / 60).toFixed(1);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.updateWorkPreferences({
        workingDays,
        saturdayPattern: workingDays.includes("Saturday") ? saturdayPattern : undefined,
        workingHours: { start: workStart, end: workEnd, breakMinutes },
        flexibleTiming,
        gracePeriodLate,
        gracePeriodEarly,
        halfDayThreshold,
        overtime: {
          applicable: overtimeApplicable,
          rate: overtimeRate,
          minimumTriggerMinutes: overtimeMinTrigger,
        },
        attendance: {
          trackingMethods,
          geoFenceRadius,
          autoCheckout,
          autoCheckoutTime: autoCheckout ? autoCheckoutTime : undefined,
          regularizationAllowed,
          regularizationWindow: regularizationAllowed ? regularizationWindow : undefined,
        },
      });
      toast.success("Work preferences saved successfully");
    } catch {
      toast.error("Failed to save work preferences");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleTrackingMethod(method: string) {
    setTrackingMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  // Holiday CRUD
  function resetHolidayForm() {
    setHolidayForm({ name: "", date: "", type: "National", optional: false });
  }

  async function handleAddHoliday() {
    if (!holidayForm.name || !holidayForm.date) { toast.error("Holiday name and date are required"); return; }
    try {
      await settingsApi.addHoliday(holidayForm as unknown as Record<string, unknown>);
      setHolidays((prev) => [...prev, { ...holidayForm }]);
      resetHolidayForm();
      setShowAddHoliday(false);
      toast.success("Holiday added");
    } catch {
      toast.error("Failed to add holiday");
    }
  }

  async function handleUpdateHoliday(idx: number) {
    if (!holidayForm.name || !holidayForm.date) { toast.error("Holiday name and date are required"); return; }
    try {
      await settingsApi.updateHoliday(String(idx), holidayForm as unknown as Record<string, unknown>);
      setHolidays((prev) => prev.map((h, i) => (i === idx ? { ...holidayForm } : h)));
      resetHolidayForm();
      setEditingHolidayIdx(null);
      toast.success("Holiday updated");
    } catch {
      toast.error("Failed to update holiday");
    }
  }

  async function handleDeleteHoliday(idx: number) {
    if (!confirm("Delete this holiday?")) return;
    try {
      await settingsApi.deleteHoliday(String(idx));
      setHolidays((prev) => prev.filter((_, i) => i !== idx));
      toast.success("Holiday deleted");
    } catch {
      toast.error("Failed to delete holiday");
    }
  }

  // Leave Type CRUD
  function resetLeaveForm() {
    setLeaveForm({
      name: "", code: "", annualQuota: 12, accrualMethod: "Yearly",
      carryForward: false, maxCarryForward: 0, encashable: false,
      approvalRequired: true, genderSpecific: "All",
    });
  }

  async function handleAddLeaveType() {
    if (!leaveForm.name || !leaveForm.code) { toast.error("Leave name and code are required"); return; }
    try {
      await settingsApi.addLeaveType(leaveForm as unknown as Record<string, unknown>);
      setLeaveTypes((prev) => [...prev, { ...leaveForm }]);
      resetLeaveForm();
      setShowAddLeave(false);
      toast.success("Leave type added");
    } catch {
      toast.error("Failed to add leave type");
    }
  }

  async function handleUpdateLeaveType(idx: number) {
    if (!leaveForm.name || !leaveForm.code) { toast.error("Leave name and code are required"); return; }
    try {
      await settingsApi.updateLeaveType(String(idx), leaveForm as unknown as Record<string, unknown>);
      setLeaveTypes((prev) => prev.map((l, i) => (i === idx ? { ...leaveForm } : l)));
      resetLeaveForm();
      setEditingLeaveIdx(null);
      toast.success("Leave type updated");
    } catch {
      toast.error("Failed to update leave type");
    }
  }

  async function handleDeleteLeaveType(idx: number) {
    if (!confirm("Delete this leave type?")) return;
    try {
      await settingsApi.deleteLeaveType(String(idx));
      setLeaveTypes((prev) => prev.filter((_, i) => i !== idx));
      toast.success("Leave type deleted");
    } catch {
      toast.error("Failed to delete leave type");
    }
  }

  if (!user || !isAdminOrHr) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You need admin or HR access to manage work preferences.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0F172A]">Work Preferences</h1>
        <button onClick={handleSave} disabled={saving} className="bg-[#2E86C1] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2471A3] disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Section 1: Working Days & Hours */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-base font-semibold text-[#0F172A]">Working Days & Hours</h2>
        </div>

        {/* Working Days */}
        <div className="mb-5">
          <label className={labelClass}>Working Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button key={day} type="button" onClick={() => toggleDay(day)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  workingDays.includes(day)
                    ? "bg-[#2E86C1] text-white border-[#2E86C1]"
                    : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#94A3B8]"
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Saturday Pattern */}
        {workingDays.includes("Saturday") && (
          <div className="mb-5">
            <label className={labelClass}>Saturday Pattern</label>
            <select value={saturdayPattern} onChange={(e) => setSaturdayPattern(e.target.value)} className={selectClass + " max-w-xs"}>
              {SATURDAY_PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* Time & Break */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className={labelClass}>Work Start Time</label>
            <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Work End Time</label>
            <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Break Duration (minutes)</label>
            <input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} min={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Effective Working Hours</label>
            <div className={inputClass + " bg-[#F8FAFC] text-[#64748B] cursor-default"}>{calcEffectiveHours()} hrs</div>
          </div>
        </div>

        {/* Flexible Timing */}
        <div className="flex items-center gap-3 mb-5">
          <input type="checkbox" id="flexibleTiming" checked={flexibleTiming} onChange={(e) => setFlexibleTiming(e.target.checked)}
            className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
          <label htmlFor="flexibleTiming" className="text-sm font-medium text-[#334155] cursor-pointer">Flexible Timing</label>
        </div>

        {/* Grace Periods & Half Day */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className={labelClass}>Grace Period - Late (minutes)</label>
            <input type="number" value={gracePeriodLate} onChange={(e) => setGracePeriodLate(Number(e.target.value))} min={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Grace Period - Early Leave (minutes)</label>
            <input type="number" value={gracePeriodEarly} onChange={(e) => setGracePeriodEarly(Number(e.target.value))} min={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Half Day Threshold (hours)</label>
            <input type="number" value={halfDayThreshold} onChange={(e) => setHalfDayThreshold(Number(e.target.value))} min={0} className={inputClass} />
          </div>
        </div>

        {/* Overtime */}
        <div className="flex items-center gap-3 mb-4">
          <input type="checkbox" id="overtimeApplicable" checked={overtimeApplicable} onChange={(e) => setOvertimeApplicable(e.target.checked)}
            className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
          <label htmlFor="overtimeApplicable" className="text-sm font-medium text-[#334155] cursor-pointer">Overtime Applicable</label>
        </div>
        {overtimeApplicable && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Overtime Rate</label>
              <select value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} className={selectClass}>
                {OVERTIME_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Overtime Min Trigger (minutes)</label>
              <input type="number" value={overtimeMinTrigger} onChange={(e) => setOvertimeMinTrigger(Number(e.target.value))} min={0} className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Holiday Calendar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <h2 className="text-base font-semibold text-[#0F172A]">Holiday Calendar</h2>
          </div>
          <button type="button" onClick={() => { setShowAddHoliday(true); setEditingHolidayIdx(null); resetHolidayForm(); }}
            className="text-sm font-medium text-[#2E86C1] hover:text-[#2471A3] transition-colors">
            + Add Holiday
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Date</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Type</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Optional</th>
                <th className="text-right py-2.5 px-3 font-medium text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Add form row */}
              {showAddHoliday && (
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <td className="py-2.5 px-3">
                    <input type="text" placeholder="Holiday name" value={holidayForm.name}
                      onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} className={inputClass} />
                  </td>
                  <td className="py-2.5 px-3">
                    <input type="date" value={holidayForm.date}
                      onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} className={inputClass} />
                  </td>
                  <td className="py-2.5 px-3">
                    <select value={holidayForm.type} onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })} className={selectClass}>
                      {HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <input type="checkbox" checked={holidayForm.optional}
                      onChange={(e) => setHolidayForm({ ...holidayForm, optional: e.target.checked })}
                      className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button onClick={handleAddHoliday} className="text-sm font-medium text-[#2E86C1] hover:text-[#2471A3]">Save</button>
                    <button onClick={() => { setShowAddHoliday(false); resetHolidayForm(); }} className="text-sm font-medium text-[#94A3B8] hover:text-[#64748B]">Cancel</button>
                  </td>
                </tr>
              )}

              {holidays.map((h, idx) => (
                editingHolidayIdx === idx ? (
                  <tr key={idx} className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <td className="py-2.5 px-3">
                      <input type="text" value={holidayForm.name}
                        onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} className={inputClass} />
                    </td>
                    <td className="py-2.5 px-3">
                      <input type="date" value={holidayForm.date}
                        onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} className={inputClass} />
                    </td>
                    <td className="py-2.5 px-3">
                      <select value={holidayForm.type} onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })} className={selectClass}>
                        {HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input type="checkbox" checked={holidayForm.optional}
                        onChange={(e) => setHolidayForm({ ...holidayForm, optional: e.target.checked })}
                        className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button onClick={() => handleUpdateHoliday(idx)} className="text-sm font-medium text-[#2E86C1] hover:text-[#2471A3]">Save</button>
                      <button onClick={() => { setEditingHolidayIdx(null); resetHolidayForm(); }} className="text-sm font-medium text-[#94A3B8] hover:text-[#64748B]">Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={idx} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 text-[#0F172A]">{h.name}</td>
                    <td className="py-2.5 px-3 text-[#0F172A]">{h.date}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2E86C1]">{h.type}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#64748B]">{h.optional ? "Yes" : "No"}</td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button onClick={() => { setEditingHolidayIdx(idx); setShowAddHoliday(false); setHolidayForm({ ...h }); }}
                        className="text-sm font-medium text-[#2E86C1] hover:text-[#2471A3]">Edit</button>
                      <button onClick={() => handleDeleteHoliday(idx)}
                        className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>
                    </td>
                  </tr>
                )
              ))}

              {holidays.length === 0 && !showAddHoliday && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-[#94A3B8]">No holidays added yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Leave Types */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <h2 className="text-base font-semibold text-[#0F172A]">Leave Types</h2>
          </div>
          <button type="button" onClick={() => { setShowAddLeave(true); setEditingLeaveIdx(null); resetLeaveForm(); }}
            className="text-sm font-medium text-[#2E86C1] hover:text-[#2471A3] transition-colors">
            + Add Leave Type
          </button>
        </div>

        {/* Add/Edit Leave Form */}
        {(showAddLeave || editingLeaveIdx !== null) && (
          <div className="mb-5 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3">{editingLeaveIdx !== null ? "Edit Leave Type" : "Add Leave Type"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>Name</label>
                <input type="text" placeholder="e.g. Casual Leave" value={leaveForm.name}
                  onChange={(e) => setLeaveForm({ ...leaveForm, name: e.target.value, code: editingLeaveIdx !== null ? leaveForm.code : e.target.value.toUpperCase().replace(/\s+/g, "_").slice(0, 10) })}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Code</label>
                <input type="text" placeholder="CL" value={leaveForm.code}
                  onChange={(e) => setLeaveForm({ ...leaveForm, code: e.target.value.toUpperCase() })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Annual Quota</label>
                <input type="number" value={leaveForm.annualQuota} min={0}
                  onChange={(e) => setLeaveForm({ ...leaveForm, annualQuota: Number(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Accrual Method</label>
                <select value={leaveForm.accrualMethod} onChange={(e) => setLeaveForm({ ...leaveForm, accrualMethod: e.target.value })} className={selectClass}>
                  {ACCRUAL_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Gender Specific</label>
                <select value={leaveForm.genderSpecific} onChange={(e) => setLeaveForm({ ...leaveForm, genderSpecific: e.target.value })} className={selectClass}>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={leaveForm.carryForward}
                  onChange={(e) => setLeaveForm({ ...leaveForm, carryForward: e.target.checked })}
                  className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
                <span className="text-sm text-[#334155]">Carry Forward</span>
              </label>
              {leaveForm.carryForward && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#334155]">Max:</span>
                  <input type="number" value={leaveForm.maxCarryForward} min={0}
                    onChange={(e) => setLeaveForm({ ...leaveForm, maxCarryForward: Number(e.target.value) })}
                    className={inputClass + " w-20"} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={leaveForm.encashable}
                  onChange={(e) => setLeaveForm({ ...leaveForm, encashable: e.target.checked })}
                  className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
                <span className="text-sm text-[#334155]">Encashable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={leaveForm.approvalRequired}
                  onChange={(e) => setLeaveForm({ ...leaveForm, approvalRequired: e.target.checked })}
                  className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
                <span className="text-sm text-[#334155]">Approval Required</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={editingLeaveIdx !== null ? () => handleUpdateLeaveType(editingLeaveIdx) : handleAddLeaveType}
                className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-colors">
                {editingLeaveIdx !== null ? "Update" : "Add"}
              </button>
              <button onClick={() => { setShowAddLeave(false); setEditingLeaveIdx(null); resetLeaveForm(); }}
                className="rounded-xl px-5 py-2 text-sm font-medium text-[#64748B] hover:text-[#334155] border border-[#E2E8F0] hover:border-[#94A3B8] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Code</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Annual Quota</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Carry Forward</th>
                <th className="text-left py-2.5 px-3 font-medium text-[#64748B]">Encashable</th>
                <th className="text-right py-2.5 px-3 font-medium text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((lt, idx) => (
                <tr key={idx} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                  <td className="py-2.5 px-3 text-[#0F172A]">{lt.name}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#334155]">{lt.code}</span>
                  </td>
                  <td className="py-2.5 px-3 text-[#0F172A]">{lt.annualQuota}</td>
                  <td className="py-2.5 px-3 text-[#64748B]">{lt.carryForward ? `Yes (max ${lt.maxCarryForward})` : "No"}</td>
                  <td className="py-2.5 px-3 text-[#64748B]">{lt.encashable ? "Yes" : "No"}</td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button onClick={() => { setEditingLeaveIdx(idx); setShowAddLeave(false); setLeaveForm({ ...lt }); }}
                      className="text-sm font-medium text-[#2E86C1] hover:text-[#2471A3]">Edit</button>
                    <button onClick={() => handleDeleteLeaveType(idx)}
                      className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
              {leaveTypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-[#94A3B8]">No leave types configured yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Attendance Configuration */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <h2 className="text-base font-semibold text-[#0F172A]">Attendance Configuration</h2>
        </div>

        {/* Tracking Methods */}
        <div className="mb-5">
          <label className={labelClass}>Tracking Methods</label>
          <div className="flex flex-wrap gap-3">
            {TRACKING_METHODS.map((method) => (
              <label key={method} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={trackingMethods.includes(method)}
                  onChange={() => toggleTrackingMethod(method)}
                  className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
                <span className="text-sm text-[#334155]">{method}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Geo-fence Radius */}
        {trackingMethods.includes("Geo-fenced Mobile") && (
          <div className="mb-5 max-w-xs">
            <label className={labelClass}>Geo-fence Radius (meters)</label>
            <input type="number" value={geoFenceRadius} onChange={(e) => setGeoFenceRadius(Number(e.target.value))} min={50} className={inputClass} />
          </div>
        )}

        {/* Auto Check-out */}
        <div className="flex items-center gap-3 mb-4">
          <input type="checkbox" id="autoCheckout" checked={autoCheckout} onChange={(e) => setAutoCheckout(e.target.checked)}
            className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
          <label htmlFor="autoCheckout" className="text-sm font-medium text-[#334155] cursor-pointer">Auto Check-out</label>
        </div>
        {autoCheckout && (
          <div className="mb-5 max-w-xs">
            <label className={labelClass}>Auto Check-out Time</label>
            <input type="time" value={autoCheckoutTime} onChange={(e) => setAutoCheckoutTime(e.target.value)} className={inputClass} />
          </div>
        )}

        {/* Regularization */}
        <div className="flex items-center gap-3 mb-4">
          <input type="checkbox" id="regularization" checked={regularizationAllowed} onChange={(e) => setRegularizationAllowed(e.target.checked)}
            className="w-4 h-4 rounded border-[#E2E8F0] text-[#2E86C1] focus:ring-[#2E86C1]" />
          <label htmlFor="regularization" className="text-sm font-medium text-[#334155] cursor-pointer">Regularization Allowed</label>
        </div>
        {regularizationAllowed && (
          <div className="max-w-xs">
            <label className={labelClass}>Regularization Window (days)</label>
            <input type="number" value={regularizationWindow} onChange={(e) => setRegularizationWindow(Number(e.target.value))} min={1} className={inputClass} />
          </div>
        )}
      </div>

      {/* Bottom Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="bg-[#2E86C1] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2471A3] disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
