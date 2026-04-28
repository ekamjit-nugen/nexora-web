"use client";

import { useEffect, useMemo, useState } from "react";
import { hrApi } from "@/lib/api";

/**
 * Rich filter bar for the /attendance "All Records" tab.
 *
 * Default = TODAY. Role-aware:
 *   - employee:                only their own attendance — these
 *                              filters are hidden by the page.
 *   - manager (no other role): "My team" filter is auto-applied
 *                              (managerId = self), other filters work.
 *   - hr / admin / owner / super_admin: every filter visible.
 *
 * Emits a `params` object on every change. The page re-fetches via
 * `attendanceApi.getAll(params)`.
 */

export type AttendanceFilterParams = {
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
  status?: string;
  search?: string;
  departmentId?: string;
  managerId?: string;
};

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "On leave" },
  { value: "wfh", label: "WFH" },
  { value: "holiday", label: "Holiday" },
] as const;

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "custom", label: "Custom" },
] as const;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(id: string): { start: string; end: string } {
  const now = new Date();
  switch (id) {
    case "today": return { start: ymd(now), end: ymd(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { start: ymd(y), end: ymd(y) };
    }
    case "week": {
      // Mon–Sun. Monday-first calendar week.
      const d = new Date(now);
      const day = d.getDay() || 7;       // 1..7 (Mon..Sun)
      const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
      return { start: ymd(monday), end: ymd(now) };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: ymd(start), end: ymd(now) };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: ymd(start), end: ymd(end) };
    }
    default: return { start: ymd(now), end: ymd(now) };
  }
}

interface Props {
  /** Allow department / manager filters? (HR/Admin/Owner only.) */
  privileged: boolean;
  /** Initial values — controlled in the parent. */
  value?: Partial<AttendanceFilterParams>;
  /** Called whenever the user changes a filter. Debounced for search. */
  onChange: (next: AttendanceFilterParams) => void;
}

export function AttendanceFilters({ privileged, value, onChange }: Props) {
  const today = useMemo(() => ymd(new Date()), []);
  const [preset, setPreset] = useState<string>("today");
  const [startDate, setStartDate] = useState<string>(value?.startDate || today);
  const [endDate, setEndDate] = useState<string>(value?.endDate || today);
  const [status, setStatus] = useState<string>(value?.status || "");
  const [search, setSearch] = useState<string>(value?.search || "");
  const [departmentId, setDepartmentId] = useState<string>(value?.departmentId || "");
  const [managerId, setManagerId] = useState<string>(value?.managerId || "");
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string }>>([]);
  const [managers, setManagers] = useState<Array<{ _id: string; firstName?: string; lastName?: string }>>([]);

  // Load departments + potential managers (HR/admin only).
  useEffect(() => {
    if (!privileged) return;
    let alive = true;
    Promise.all([
      hrApi.departments?.getAll?.().catch?.(() => ({ data: [] })) ?? Promise.resolve({ data: [] }),
      hrApi.getAll?.({ limit: "100" })?.catch?.(() => ({ data: [] })) ?? Promise.resolve({ data: [] }),
    ]).then(([dept, emps]: any[]) => {
      if (!alive) return;
      const deptList = Array.isArray(dept?.data) ? dept.data : (dept?.data?.data || []);
      const empList = Array.isArray(emps?.data) ? emps.data : (emps?.data?.data || []);
      setDepartments(deptList.map((d: any) => ({ _id: d._id, name: d.name })));
      setManagers(empList.map((e: any) => ({
        _id: e._id, firstName: e.firstName, lastName: e.lastName,
      })));
    });
    return () => { alive = false; };
  }, [privileged]);

  // When a preset is chosen, reset start/end. "custom" preserves what's there.
  function applyPreset(id: string) {
    setPreset(id);
    if (id !== "custom") {
      const { start, end } = presetRange(id);
      setStartDate(start);
      setEndDate(end);
    }
  }

  // Debounce search input by 300ms so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      onChange({
        startDate, endDate,
        status: status || undefined,
        search: search.trim() || undefined,
        departmentId: departmentId || undefined,
        managerId: managerId || undefined,
      });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, status, search, departmentId, managerId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        {/* Date range presets */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Date range</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-md px-2.5 py-1 text-[12px] transition ${
                  preset === p.id
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom date pickers — always visible so the user sees the
              current range in any preset. */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => { setPreset("custom"); setStartDate(e.target.value); }}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12.5px]"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => { setPreset("custom"); setEndDate(e.target.value); }}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12.5px]"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Employee</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or ID…"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]"
          />
        </div>

        {/* Privileged filters */}
        {privileged && (
          <>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Reporting manager</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]"
              >
                <option value="">Anyone</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.firstName || ""} {m.lastName || ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Active-filter chips + clear */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(status || search || departmentId || managerId || preset !== "today") && (
          <button
            type="button"
            onClick={() => {
              applyPreset("today");
              setStatus(""); setSearch(""); setDepartmentId(""); setManagerId("");
            }}
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            Reset to today
          </button>
        )}
      </div>
    </div>
  );
}
