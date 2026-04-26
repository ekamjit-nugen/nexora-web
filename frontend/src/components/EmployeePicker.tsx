"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hrApi, Employee } from "@/lib/api";

/**
 * Autocomplete employee picker for fields that historically accepted
 * free-text employee IDs (onboarding, offboarding, recruitment, etc).
 *
 * Design notes:
 *
 * - The source of truth is the HR `/api/v1/employees` list. We lazily
 *   load it on first focus so static-rendered pages don't pay for
 *   employee data that most users don't open the picker on. The list
 *   is kept in a module-level cache so repeat mounts across pages
 *   don't re-fetch — HR lists don't change during a single admin
 *   session often enough to matter.
 *
 * - Value semantics: the picker returns either the business id
 *   (e.g. `NXR-0003`) or the HR `_id`, controlled by the `valueKind`
 *   prop. Onboarding/offboarding historically key off the business
 *   id; newer callers (payroll, leave) use `_id`. Explicit prop is
 *   clearer than guessing.
 *
 * - Search matches on: firstName, lastName, email, business id, or
 *   combined "firstName lastName" — all case-insensitive. Small
 *   enough dataset that client-side filter is fine; moving this to a
 *   server-side search would only matter past ~10k employees.
 *
 * - Keyboard: arrow keys navigate, Enter selects, Escape closes.
 *   Click-outside closes via a global click handler registered on
 *   open. No external dep on headless-ui to keep bundle small.
 */

export type EmployeePickerValue = string;
/**
 * What identifier shape `value` uses:
 *   - "businessId": the human-facing `NXR-0003` — used by onboarding,
 *     offboarding where the backend records have this on the doc.
 *   - "hrId":       the HR collection's `_id` — payroll-service's
 *     preferred foreign key (policyIds[], employee.policyIds[]).
 *   - "authUserId": the auth user `_id` (JWT sub) — recruitment's
 *     `hiringManagerId` and a few other callers key off this.
 */
export type EmployeePickerValueKind = "businessId" | "hrId" | "authUserId";

interface Props {
  value: EmployeePickerValue;
  onChange: (value: EmployeePickerValue, employee: Employee | null) => void;
  valueKind?: EmployeePickerValueKind;       // default: "businessId"
  placeholder?: string;
  disabled?: boolean;
  /** Filter candidates (e.g. exclude already-offboarded). */
  filterEmployee?: (emp: Employee) => boolean;
  required?: boolean;
  className?: string;
}

// Module-level cache. Invalidated only by full page reload — that's
// the right cadence for a dataset that HR admins rarely edit mid-flow.
let employeeCachePromise: Promise<Employee[]> | null = null;

async function loadEmployees(): Promise<Employee[]> {
  if (employeeCachePromise) return employeeCachePromise;
  employeeCachePromise = (async () => {
    try {
      const res = await hrApi.getEmployees({ limit: "500" });
      const raw = (res as any)?.data ?? res;
      const rows = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.items)
            ? raw.items
            : [];
      return rows as Employee[];
    } catch {
      employeeCachePromise = null; // retry on next open
      return [];
    }
  })();
  return employeeCachePromise;
}

export function EmployeePicker({
  value,
  onChange,
  valueKind = "businessId",
  placeholder = "Search employees by name, ID, or email…",
  disabled = false,
  filterEmployee,
  required = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve current selection for label/display — keeps the input in
  // sync when the parent sets an initial value from a loaded record.
  const selected = useMemo(() => {
    if (!value) return null;
    return (
      employees.find((e) => {
        if (valueKind === "businessId") return e.employeeId === value;
        if (valueKind === "authUserId") return e.userId === value;
        return e._id === value;
      }) || null
    );
  }, [value, employees, valueKind]);

  // Load on first focus (or whenever `open` flips true with no data).
  useEffect(() => {
    if (!open || employees.length > 0) return;
    setLoading(true);
    loadEmployees().then((list) => {
      setEmployees(list);
      setLoading(false);
    });
  }, [open, employees.length]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!containerRef.current?.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = employees;
    if (filterEmployee) list = list.filter(filterEmployee);
    if (!q) return list.slice(0, 50); // cap rendered rows
    return list
      .filter((e) => {
        const hay = [
          e.firstName,
          e.lastName,
          `${e.firstName} ${e.lastName}`,
          e.email,
          e.employeeId,
        ]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase())
          .join(" | ");
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [employees, query, filterEmployee]);

  const pick = (emp: Employee) => {
    const next =
      valueKind === "businessId"
        ? emp.employeeId
        : valueKind === "authUserId"
          ? emp.userId
          : emp._id;
    onChange(next, emp);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    onChange("", null);
    setQuery("");
    inputRef.current?.focus();
  };

  const displayedValue = selected
    ? `${selected.firstName} ${selected.lastName} (${selected.employeeId})`
    : value && !selected && employees.length === 0
      ? value // not loaded yet — show the raw id until cache arrives
      : value && !selected
        ? `${value} (not found)`
        : "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Closed state: readonly display with clear/change actions. */}
      {!open ? (
        <div className="flex items-center gap-2 w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <span
            className={`flex-1 truncate ${
              displayedValue ? "text-[#0F172A]" : "text-[#94A3B8]"
            }`}
            onClick={() => !disabled && setOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                setOpen(true);
              }
            }}
          >
            {displayedValue || placeholder}
          </span>
          {value && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="text-[12px] text-[#64748B] hover:text-[#0F172A]"
              aria-label="Clear selection"
            >
              ×
            </button>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-[12px] text-blue-600 hover:text-blue-700 font-medium"
            >
              {value ? "Change" : "Select"}
            </button>
          )}
          {required && !value && (
            <span className="text-red-500 text-[12px]">*</span>
          )}
        </div>
      ) : (
        <div className="border border-[#E2E8F0] rounded-lg bg-white shadow-sm">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const emp = filtered[highlight];
                if (emp) pick(emp);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none border-b border-[#E2E8F0]"
          />
          <ul
            className="max-h-60 overflow-y-auto py-1"
            role="listbox"
            aria-label="Employees"
          >
            {loading && (
              <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
                Loading employees…
              </li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
                {query ? "No matches" : "No employees"}
              </li>
            )}
            {filtered.map((emp, i) => {
              const isActive = i === highlight;
              return (
                <li
                  key={emp._id}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    // onMouseDown to beat the document click-outside handler
                    e.preventDefault();
                    pick(emp);
                  }}
                  className={`px-3 py-2 cursor-pointer text-[13px] flex items-center justify-between gap-3 ${
                    isActive ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#0F172A] truncate">
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div className="text-[11px] text-[#64748B] truncate">
                      {emp.email}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-[#94A3B8] shrink-0">
                    {emp.employeeId}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
