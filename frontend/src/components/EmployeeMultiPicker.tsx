"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hrApi, Employee } from "@/lib/api";

/**
 * Multi-select variant of `EmployeePicker`. Used for places where you
 * need an array of employee references — interview panels, approval
 * chains, announcement target lists. Visually renders the current
 * selection as pills with an "x" to remove each, and an open search
 * input that behaves like the single-picker.
 *
 * Same `valueKind` semantics as the single picker (`businessId` /
 * `hrId` / `authUserId`) so callers can request whichever ID shape
 * their backend DTO expects without a wrapping transform. Interviewer
 * IDs on the recruitment flow are auth user IDs (match the hiring
 * manager field), so the default is `authUserId`.
 */

export type EmployeePickerValueKind = "businessId" | "hrId" | "authUserId";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  valueKind?: EmployeePickerValueKind; // default: "authUserId"
  placeholder?: string;
  disabled?: boolean;
  filterEmployee?: (emp: Employee) => boolean;
  className?: string;
}

let cache: Promise<Employee[]> | null = null;
async function loadEmployees(): Promise<Employee[]> {
  if (cache) return cache;
  cache = (async () => {
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
      cache = null;
      return [];
    }
  })();
  return cache;
}

const idOf = (e: Employee, kind: EmployeePickerValueKind): string =>
  kind === "businessId" ? e.employeeId : kind === "authUserId" ? e.userId : e._id;

export function EmployeeMultiPicker({
  value,
  onChange,
  valueKind = "authUserId",
  placeholder = "Add interviewer…",
  disabled = false,
  filterEmployee,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (employees.length > 0) return;
    loadEmployees().then(setEmployees);
  }, [employees.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = useMemo(
    () =>
      value
        .map((id) => employees.find((e) => idOf(e, valueKind) === id))
        .filter((e): e is Employee => !!e),
    [value, employees, valueKind],
  );

  const filtered = useMemo(() => {
    let list = employees;
    if (filterEmployee) list = list.filter(filterEmployee);
    // Hide already-selected rows — cleaner than showing them with a disabled styling
    const selectedSet = new Set(value);
    list = list.filter((e) => !selectedSet.has(idOf(e, valueKind)));
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 30);
    return list
      .filter((e) =>
        [e.firstName, e.lastName, `${e.firstName} ${e.lastName}`, e.email, e.employeeId]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase())
          .some((s) => s.includes(q)),
      )
      .slice(0, 30);
  }, [employees, filterEmployee, value, valueKind, query]);

  const add = (emp: Employee) => {
    const id = idOf(emp, valueKind);
    if (!id || value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div
      ref={ref}
      className={`relative border border-[#E2E8F0] rounded-lg bg-white px-2 py-1.5 min-h-[38px] ${className}`}
      onClick={() => !disabled && setOpen(true)}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((emp) => {
          const id = idOf(emp, valueKind);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-0.5 text-[12px]"
            >
              <span className="font-medium">
                {emp.firstName} {emp.lastName}
              </span>
              <span className="text-[10px] text-blue-600 font-mono">
                {emp.employeeId}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(id);
                  }}
                  className="hover:bg-blue-100 rounded px-0.5 text-[12px]"
                  aria-label={`Remove ${emp.firstName}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {/* Show any unresolved ids (e.g. loaded from backend while
            directory still loading or stale reference) as plain chips
            so the user can see them + remove them. */}
        {value
          .filter((id) => !selected.find((e) => idOf(e, valueKind) === id))
          .map((id) => (
            <span
              key={`unres-${id}`}
              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-600 rounded px-2 py-0.5 text-[11px] font-mono"
              title="User id not found in directory"
            >
              {id.slice(0, 8)}…
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(id);
                  }}
                  className="hover:bg-gray-200 rounded px-0.5"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        {!disabled && (
          <input
            ref={inputRef}
            value={query}
            placeholder={selected.length === 0 ? placeholder : ""}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
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
                if (emp) add(emp);
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Backspace" && query === "" && value.length > 0) {
                remove(value[value.length - 1]);
              }
            }}
            className="flex-1 min-w-[120px] border-none outline-none text-[13px] bg-transparent py-0.5"
          />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-sm z-20 max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[#94A3B8]">
              {query ? "No matches" : "No more employees to add"}
            </div>
          ) : (
            filtered.map((emp, i) => (
              <div
                key={emp._id}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(emp);
                }}
                className={`px-3 py-2 cursor-pointer text-[13px] flex items-center justify-between gap-3 ${i === highlight ? "bg-blue-50" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[#0F172A] truncate">
                    {emp.firstName} {emp.lastName}
                  </div>
                  <div className="text-[11px] text-[#64748B] truncate">
                    {emp.email}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-[#94A3B8]">
                  {emp.employeeId}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
