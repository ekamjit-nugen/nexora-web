"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BoardFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    assignees?: string[];
    labels?: string[];
    priority?: string;
    status?: string;
    type?: string;
  }) => void;
  employees: Array<{ _id: string; userId?: string; firstName: string; lastName: string; avatar?: string }>;
  availableLabels?: string[];
}

export function BoardFilters({ onFilterChange, employees, availableLabels = [] }: BoardFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");

  const statuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
  const priorities = ["critical", "high", "medium", "low", "trivial"];
  const types = ["epic", "story", "task", "sub_task", "bug", "improvement", "spike"];

  const applyFilters = () => {
    onFilterChange({
      search: search || undefined,
      assignees: selectedAssignees.size > 0 ? Array.from(selectedAssignees) : undefined,
      labels: selectedLabels.size > 0 ? Array.from(selectedLabels) : undefined,
      priority: selectedPriority || undefined,
      status: selectedStatus || undefined,
      type: selectedType || undefined,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedAssignees(new Set());
    setSelectedLabels(new Set());
    setSelectedPriority("");
    setSelectedStatus("");
    setSelectedType("");
    onFilterChange({});
  };

  const hasActiveFilters =
    search ||
    selectedAssignees.size > 0 ||
    selectedLabels.size > 0 ||
    selectedPriority ||
    selectedStatus ||
    selectedType;

  return (
    <div className="space-y-3 mb-4">
      {/* Filter Toggle & Search Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onFilterChange({
              search: e.target.value || undefined,
              assignees: selectedAssignees.size > 0 ? Array.from(selectedAssignees) : undefined,
              labels: selectedLabels.size > 0 ? Array.from(selectedLabels) : undefined,
              priority: selectedPriority || undefined,
              status: selectedStatus || undefined,
              type: selectedType || undefined,
            });
          }}
          className="h-8 text-[12px] flex-1 min-w-[200px]"
        />

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-medium transition-colors ${
            showFilters || hasActiveFilters
              ? "bg-[#EBF5FB] border-[#2E86C1] text-[#2E86C1]"
              : "bg-white border-[#E2E8F0] text-[#475569] hover:border-[#2E86C1]"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-[#2E86C1] text-white text-[10px] rounded-full font-bold">
              {[
                search ? 1 : 0,
                selectedAssignees.size,
                selectedLabels.size,
                selectedPriority ? 1 : 0,
                selectedStatus ? 1 : 0,
                selectedType ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-8 px-3 text-[12px] font-medium text-[#94A3B8] hover:text-[#475569] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-4 shadow-sm">
          {/* Assignees */}
          {employees.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-[#475569] block mb-2">Assignees</label>
              <div className="flex flex-wrap gap-1.5">
                {employees.map((emp) => {
                  const uid = emp.userId || emp._id;
                  const isSelected = selectedAssignees.has(uid);
                  const initials = `${emp.firstName?.charAt(0) || ""}${emp.lastName?.charAt(0) || ""}`.toUpperCase();
                  return (
                    <button
                      key={uid}
                      onClick={() => {
                        const next = new Set(selectedAssignees);
                        if (next.has(uid)) next.delete(uid);
                        else next.add(uid);
                        setSelectedAssignees(next);
                        applyFilters();
                      }}
                      title={`${emp.firstName} ${emp.lastName}`}
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${
                        isSelected
                          ? "border-[#2E86C1] ring-2 ring-[#2E86C1]/30"
                          : "border-[#E2E8F0] hover:border-[#2E86C1]"
                      } bg-gradient-to-br from-[#2E86C1] to-[#1A5276] text-white`}
                    >
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={initials} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        initials
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Labels */}
          {availableLabels.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-[#475569] block mb-2">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {availableLabels.map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      const next = new Set(selectedLabels);
                      if (next.has(label)) next.delete(label);
                      else next.add(label);
                      setSelectedLabels(next);
                      applyFilters();
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
                      selectedLabels.has(label)
                        ? "bg-[#2E86C1] text-white border border-[#2E86C1]"
                        : "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] hover:border-[#2E86C1]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="text-[11px] font-semibold text-[#475569] block mb-2">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                applyFilters();
              }}
              className="w-full h-8 text-[12px] border border-[#E2E8F0] rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
            >
              <option value="">All Priorities</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold text-[#475569] block mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                applyFilters();
              }}
              className="w-full h-8 text-[12px] border border-[#E2E8F0] rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="text-[11px] font-semibold text-[#475569] block mb-2">Type</label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                applyFilters();
              }}
              className="w-full h-8 text-[12px] border border-[#E2E8F0] rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30"
            >
              <option value="">All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
