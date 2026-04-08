"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { projectApi, Project } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ── Types ──

type SettingsSection = "general" | "features" | "board" | "sprint" | "budget" | "team" | "danger";

// ── Save Status Indicator ──

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      {status === "saving" && (
        <>
          <div className="w-3 h-3 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#64748B]">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-600">Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-red-600">Failed to save</span>
        </>
      )}
    </div>
  );
}

// ── Toggle Switch ──

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E86C1] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[#2E86C1]" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── Section Components ──

function GeneralSection({
  project,
  form,
  setForm,
  onSave,
}: {
  project: Project;
  form: Partial<Project>;
  setForm: (f: Partial<Project>) => void;
  onSave: (patch: Partial<Project>) => void;
}) {
  const methodologies = [
    { value: "scrum", label: "Scrum" },
    { value: "kanban", label: "Kanban" },
    { value: "scrumban", label: "Scrumban" },
    { value: "waterfall", label: "Waterfall" },
    { value: "xp", label: "Extreme Programming (XP)" },
    { value: "lean", label: "Lean" },
    { value: "safe", label: "SAFe" },
    { value: "custom", label: "Custom" },
  ];

  const statuses = [
    { value: "planning", label: "Planning" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On Hold" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const priorities = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const visibilities = [
    { value: "public", label: "Public", desc: "Visible to all organization members" },
    { value: "private", label: "Private", desc: "Only visible to project team members" },
    { value: "restricted", label: "Restricted", desc: "Visible to invited members only" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
        <p className="text-sm text-gray-500 mt-1">Configure basic project information and methodology.</p>
      </div>

      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          value={form.projectName || ""}
          onChange={(e) => setForm({ ...form, projectName: e.target.value })}
          className="max-w-md"
        />
      </div>

      {/* Project Key (read-only) */}
      <div className="space-y-2">
        <Label htmlFor="projectKey">Project Key</Label>
        <Input
          id="projectKey"
          value={project.projectKey || ""}
          disabled
          className="max-w-md bg-gray-50 text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-400">Project key cannot be changed after creation.</p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full max-w-lg rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-none"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={form.category || ""}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="e.g. Engineering, Marketing, Design"
          className="max-w-md"
        />
      </div>

      {/* Methodology */}
      <div className="space-y-2">
        <Label htmlFor="methodology">Methodology</Label>
        <select
          id="methodology"
          value={form.methodology || ""}
          onChange={(e) => setForm({ ...form, methodology: e.target.value })}
          className="h-10 max-w-md w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
        >
          <option value="">Select methodology</option>
          {methodologies.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={form.status || ""}
          onChange={(e) => {
            const newStatus = e.target.value as Project["status"];
            setForm({ ...form, status: newStatus });
            onSave({ status: newStatus });
          }}
          className="h-10 max-w-md w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <select
          id="priority"
          value={form.priority || "medium"}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="h-10 max-w-md w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
        >
          {priorities.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={form.startDate ? form.startDate.split("T")[0] : ""}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={form.endDate ? form.endDate.split("T")[0] : ""}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-3">
        <Label>Visibility</Label>
        <div className="space-y-2 max-w-md">
          {visibilities.map((v) => (
            <label
              key={v.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.visibility === v.value
                  ? "border-[#2E86C1] bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={v.value}
                checked={form.visibility === v.value}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as Project["visibility"] })}
                className="mt-0.5 accent-[#2E86C1]"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{v.label}</div>
                <div className="text-xs text-gray-500">{v.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Client Portal Toggle */}
      <div className="flex items-center justify-between max-w-md p-4 rounded-lg border border-gray-200">
        <div>
          <div className="text-sm font-medium text-gray-900">Client Portal</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Allow clients to view project progress, milestones, and approved deliverables.
          </div>
        </div>
        <Toggle
          checked={form.settings?.clientPortalEnabled || false}
          onChange={(val) => {
            const newSettings = { ...form.settings, clientPortalEnabled: val };
            setForm({ ...form, settings: newSettings as Project["settings"] });
            onSave({ settings: newSettings as Project["settings"] });
          }}
        />
      </div>
    </div>
  );
}

function FeaturesSection({
  form,
  setForm,
  onToggle,
}: {
  form: Partial<Project>;
  setForm: (f: Partial<Project>) => void;
  onToggle: (key: string, val: boolean) => void;
}) {
  const features = [
    {
      key: "enableTimeTracking",
      label: "Time Tracking",
      description: "Track time spent on tasks. Enables timer controls and time log reports.",
    },
    {
      key: "enableSubtasks",
      label: "Subtasks",
      description: "Break tasks into smaller sub-tasks with their own assignees and statuses.",
    },
    {
      key: "enableEpics",
      label: "Epics",
      description: "Group related stories and tasks under larger work items (epics).",
    },
    {
      key: "enableSprints",
      label: "Sprints",
      description: "Organize work into time-boxed iterations with sprint planning and reviews.",
    },
    {
      key: "enableReleases",
      label: "Releases",
      description: "Track software releases with versioning, release notes, and linked issues.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Features</h3>
        <p className="text-sm text-gray-500 mt-1">Enable or disable project features. Changes take effect immediately.</p>
      </div>

      <div className="space-y-1">
        {features.map((feature) => {
          const settingsKey = feature.key as keyof NonNullable<Project["settings"]>;
          const isEnabled = form.settings?.[settingsKey] as boolean || false;
          return (
            <div
              key={feature.key}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="pr-4">
                <div className="text-sm font-medium text-gray-900">{feature.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
              </div>
              <Toggle
                checked={isEnabled}
                onChange={(val) => {
                  const newSettings = { ...form.settings, [feature.key]: val };
                  setForm({ ...form, settings: newSettings as Project["settings"] });
                  onToggle(feature.key, val);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardSection({
  form,
  setForm,
}: {
  form: Partial<Project>;
  setForm: (f: Partial<Project>) => void;
}) {
  const boardTypes = [
    { value: "scrum", label: "Scrum Board", desc: "Sprint-based board with backlog and sprint lanes" },
    { value: "kanban", label: "Kanban Board", desc: "Continuous flow board with WIP limits" },
    { value: "custom", label: "Custom Board", desc: "Fully customizable columns and workflow" },
  ];

  const defaultViews = [
    { value: "board", label: "Board" },
    { value: "list", label: "List" },
    { value: "timeline", label: "Timeline" },
    { value: "calendar", label: "Calendar" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Board Configuration</h3>
        <p className="text-sm text-gray-500 mt-1">Configure your project board type and default view.</p>
      </div>

      {/* Board Type */}
      <div className="space-y-3">
        <Label>Board Type</Label>
        <div className="space-y-2 max-w-lg">
          {boardTypes.map((bt) => (
            <label
              key={bt.value}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                form.settings?.boardType === bt.value
                  ? "border-[#2E86C1] bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="boardType"
                value={bt.value}
                checked={form.settings?.boardType === bt.value}
                onChange={(e) => {
                  const newSettings = { ...form.settings, boardType: e.target.value as NonNullable<Project["settings"]>["boardType"] };
                  setForm({ ...form, settings: newSettings as Project["settings"] });
                }}
                className="mt-0.5 accent-[#2E86C1]"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{bt.label}</div>
                <div className="text-xs text-gray-500">{bt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Default View */}
      <div className="space-y-2">
        <Label htmlFor="defaultView">Default View</Label>
        <select
          id="defaultView"
          value={form.settings?.defaultView || "board"}
          onChange={(e) => {
            const newSettings = { ...form.settings, defaultView: e.target.value as NonNullable<Project["settings"]>["defaultView"] };
            setForm({ ...form, settings: newSettings as Project["settings"] });
          }}
          className="h-10 max-w-md w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
        >
          {defaultViews.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400">The view shown by default when team members open this project.</p>
      </div>
    </div>
  );
}

function SprintSection({
  form,
  setForm,
  sprintsEnabled,
}: {
  form: Partial<Project>;
  setForm: (f: Partial<Project>) => void;
  sprintsEnabled: boolean;
}) {
  if (!sprintsEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sprint Settings</h3>
          <p className="text-sm text-gray-500 mt-1">Configure sprint duration and estimation preferences.</p>
        </div>
        <div className="p-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center">
          <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-gray-600 font-medium">Sprints are disabled</p>
          <p className="text-xs text-gray-400 mt-1">Enable sprints in the Features section to configure sprint settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Sprint Settings</h3>
        <p className="text-sm text-gray-500 mt-1">Configure sprint duration and estimation preferences.</p>
      </div>

      {/* Sprint Duration */}
      <div className="space-y-2">
        <Label htmlFor="sprintDuration">Sprint Duration (days)</Label>
        <div className="flex items-center gap-3 max-w-md">
          <Input
            id="sprintDuration"
            type="number"
            min={1}
            max={90}
            value={form.settings?.sprintDuration || 14}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 14;
              const newSettings = { ...form.settings, sprintDuration: Math.max(1, Math.min(90, val)) };
              setForm({ ...form, settings: newSettings as Project["settings"] });
            }}
            className="w-24"
          />
          <span className="text-sm text-gray-500">days</span>
        </div>
        <p className="text-xs text-gray-400">Common durations: 7 days (1 week), 14 days (2 weeks), 21 days (3 weeks)</p>
      </div>

      {/* Estimation Unit */}
      <div className="space-y-3">
        <Label>Estimation Unit</Label>
        <div className="flex gap-3 max-w-md">
          {([
            { value: "story_points", label: "Story Points", desc: "Relative effort estimation" },
            { value: "hours", label: "Hours", desc: "Time-based estimation" },
          ] as const).map((unit) => (
            <label
              key={unit.value}
              className={`flex-1 flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.settings?.estimationUnit === unit.value
                  ? "border-[#2E86C1] bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="estimationUnit"
                value={unit.value}
                checked={form.settings?.estimationUnit === unit.value}
                onChange={(e) => {
                  const newSettings = { ...form.settings, estimationUnit: e.target.value as "hours" | "story_points" };
                  setForm({ ...form, settings: newSettings as Project["settings"] });
                }}
                className="mt-0.5 accent-[#2E86C1]"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{unit.label}</div>
                <div className="text-xs text-gray-500">{unit.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetSection({
  form,
  setForm,
}: {
  form: Partial<Project>;
  setForm: (f: Partial<Project>) => void;
}) {
  const billingTypes = [
    { value: "fixed", label: "Fixed Price", desc: "Set total budget for the project" },
    { value: "time_and_material", label: "Time & Material", desc: "Bill based on hours worked at an hourly rate" },
    { value: "retainer", label: "Retainer", desc: "Recurring monthly billing amount" },
    { value: "internal", label: "Internal", desc: "Internal project with no client billing" },
  ];

  const budget = form.budget || { amount: 0, currency: "USD", billingType: "fixed" };

  const updateBudget = (patch: Partial<NonNullable<Project["budget"]>>) => {
    setForm({ ...form, budget: { ...budget, ...patch } as Project["budget"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Budget</h3>
        <p className="text-sm text-gray-500 mt-1">Configure project billing and budget tracking.</p>
      </div>

      {/* Billing Type */}
      <div className="space-y-3">
        <Label>Billing Type</Label>
        <div className="grid grid-cols-2 gap-2 max-w-lg">
          {billingTypes.map((bt) => (
            <label
              key={bt.value}
              className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                budget.billingType === bt.value
                  ? "border-[#2E86C1] bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="billingType"
                value={bt.value}
                checked={budget.billingType === bt.value}
                onChange={(e) => updateBudget({ billingType: e.target.value })}
                className="mt-0.5 accent-[#2E86C1]"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{bt.label}</div>
                <div className="text-xs text-gray-500">{bt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Budget Amount */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="budgetAmount">Budget Amount</Label>
          <Input
            id="budgetAmount"
            type="number"
            min={0}
            value={budget.amount || 0}
            onChange={(e) => updateBudget({ amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budgetCurrency">Currency</Label>
          <select
            id="budgetCurrency"
            value={budget.currency || "USD"}
            onChange={(e) => updateBudget({ currency: e.target.value })}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (&#8364;)</option>
            <option value="GBP">GBP (&#163;)</option>
            <option value="INR">INR (&#8377;)</option>
            <option value="CAD">CAD (C$)</option>
            <option value="AUD">AUD (A$)</option>
          </select>
        </div>
      </div>

      {/* Hourly Rate (conditional) */}
      {budget.billingType === "time_and_material" && (
        <div className="space-y-2 max-w-md">
          <Label htmlFor="hourlyRate">Hourly Rate ({budget.currency || "USD"})</Label>
          <Input
            id="hourlyRate"
            type="number"
            min={0}
            step={0.01}
            value={budget.hourlyRate || 0}
            onChange={(e) => updateBudget({ hourlyRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}

      {/* Retainer Amount (conditional) */}
      {budget.billingType === "retainer" && (
        <div className="space-y-2 max-w-md">
          <Label htmlFor="retainerAmount">Monthly Retainer ({budget.currency || "USD"})</Label>
          <Input
            id="retainerAmount"
            type="number"
            min={0}
            step={0.01}
            value={budget.retainerAmount || 0}
            onChange={(e) => updateBudget({ retainerAmount: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}

      {/* Budget spent (read-only info) */}
      {(budget.spent ?? 0) > 0 && (
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 max-w-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Budget Spent</span>
            <span className="text-sm font-semibold text-gray-900">
              {budget.currency || "USD"} {(budget.spent || 0).toLocaleString()}
            </span>
          </div>
          {(budget.amount || 0) > 0 && (
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  ((budget.spent || 0) / (budget.amount || 1)) > 0.9 ? "bg-red-500" : ((budget.spent || 0) / (budget.amount || 1)) > 0.7 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, ((budget.spent || 0) / (budget.amount || 1)) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamSection({
  project,
  projectId,
  onRefresh,
}: {
  project: Project;
  projectId: string;
  onRefresh: () => void;
}) {
  const [addingMember, setAddingMember] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  const roles = [
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "member", label: "Member" },
    { value: "viewer", label: "Viewer" },
  ];

  const handleAddMember = async () => {
    if (!newUserId.trim()) return;
    setSaving(true);
    try {
      await projectApi.addTeamMember(projectId, { userId: newUserId.trim(), role: newRole });
      toast.success("Team member added");
      setNewUserId("");
      setNewRole("member");
      setAddingMember(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add member");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this team member from the project?")) return;
    try {
      await projectApi.removeTeamMember(projectId, userId);
      toast.success("Team member removed");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingMember(userId);
    try {
      await projectApi.updateTeamMember(projectId, userId, { role: newRole });
      toast.success("Role updated");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role");
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleUpdateAllocation = async (userId: string, allocation: number) => {
    setUpdatingMember(userId);
    try {
      await projectApi.updateTeamMember(projectId, userId, { allocationPercentage: allocation });
      toast.success("Allocation updated");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update allocation");
    } finally {
      setUpdatingMember(null);
    }
  };

  const team = project.team || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500 mt-1">Manage project team members and their roles.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setAddingMember(!addingMember)}
          className="gap-1.5 bg-[#2E86C1] hover:bg-[#2471A3]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </Button>
      </div>

      {/* Add Member Form */}
      {addingMember && (
        <div className="p-4 rounded-lg border border-[#2E86C1] bg-blue-50 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label htmlFor="newUserId">User ID</Label>
              <Input
                id="newUserId"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="Enter user ID"
                className="mt-1"
              />
            </div>
            <div className="col-span-1">
              <Label htmlFor="newRole">Role</Label>
              <select
                id="newRole"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 flex items-end gap-2">
              <Button size="sm" onClick={handleAddMember} disabled={saving} className="bg-[#2E86C1] hover:bg-[#2471A3]">
                {saving ? "Adding..." : "Add"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingMember(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Team List */}
      <div className="space-y-2">
        {team.length === 0 ? (
          <div className="p-8 text-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
            No team members yet.
          </div>
        ) : (
          team.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2E86C1] text-white flex items-center justify-center text-xs font-semibold">
                  {(member.name || member.userId || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {member.name || member.userId}
                  </div>
                  {member.email && (
                    <div className="text-xs text-gray-500">{member.email}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Allocation */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={member.allocation || 100}
                    onChange={(e) => handleUpdateAllocation(member.userId, parseInt(e.target.value))}
                    disabled={updatingMember === member.userId}
                    className="w-20 h-1.5 accent-[#2E86C1]"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{member.allocation || 100}%</span>
                </div>

                {/* Role select */}
                <select
                  value={member.role}
                  onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                  disabled={updatingMember === member.userId}
                  className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveMember(member.userId)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove member"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DangerSection({
  project,
  projectId,
  canDelete,
}: {
  project: Project;
  projectId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this project? It will be marked as completed.")) return;
    setArchiving(true);
    try {
      await projectApi.archive(projectId);
      toast.success("Project archived");
      router.push("/projects");
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive project");
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== project.projectName) return;
    setDeleting(true);
    try {
      await projectApi.delete(projectId);
      toast.success("Project deleted");
      router.push("/projects");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-red-600">Danger Zone</h3>
        <p className="text-sm text-gray-500 mt-1">Irreversible actions. Proceed with caution.</p>
      </div>

      {/* Archive */}
      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Archive Project</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Mark this project as completed and archive it. The project will no longer appear in active views.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleArchive}
            disabled={archiving || project.status === "completed"}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            {archiving ? "Archiving..." : "Archive"}
          </Button>
        </div>
      </div>

      {/* Delete */}
      <div className="p-4 rounded-lg border border-red-200 bg-red-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Delete Project</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Permanently delete this project and all associated data. This action cannot be undone.
            </div>
          </div>
          {canDelete ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Delete Project
            </Button>
          ) : (
            <span className="text-xs text-gray-400">Admin/Owner only</span>
          )}
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-4 pt-4 border-t border-red-200 space-y-3">
            <p className="text-sm text-red-700">
              Type <strong>{project.projectName}</strong> to confirm deletion:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type project name to confirm"
              className="max-w-sm border-red-300 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleteConfirmText !== project.projectName || deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Navigation Items ──

const NAV_ITEMS: { key: SettingsSection; label: string; icon: string }[] = [
  {
    key: "general",
    label: "General",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    key: "features",
    label: "Features",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  },
  {
    key: "board",
    label: "Board",
    icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7",
  },
  {
    key: "sprint",
    label: "Sprint",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    key: "budget",
    label: "Budget",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "team",
    label: "Team",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    key: "danger",
    label: "Danger Zone",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
];

// ── Main Settings Page ──

export default function ProjectSettingsPage() {
  const { user, loading: authLoading, isProjectRole, hasOrgRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [form, setForm] = useState<Partial<Project>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Permission checks
  const projectTeam = (project?.team as Array<{ userId: string; role: string }>) || [];
  const canManageProject = isProjectRole(projectTeam, "manager");
  const canDeleteProject = hasOrgRole("admin");

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await projectApi.getById(projectId);
      const proj = res.data || null;
      setProject(proj);
      if (proj) {
        setForm({
          projectName: proj.projectName,
          description: proj.description || "",
          category: proj.category || "",
          methodology: proj.methodology || "",
          status: proj.status,
          priority: proj.priority || "medium",
          startDate: proj.startDate || "",
          endDate: proj.endDate || "",
          visibility: proj.visibility || "public",
          settings: {
            boardType: proj.settings?.boardType || "kanban",
            clientPortalEnabled: proj.settings?.clientPortalEnabled || false,
            sprintDuration: proj.settings?.sprintDuration || 14,
            estimationUnit: proj.settings?.estimationUnit || "story_points",
            defaultView: proj.settings?.defaultView || "board",
            enableTimeTracking: proj.settings?.enableTimeTracking ?? true,
            enableSubtasks: proj.settings?.enableSubtasks ?? true,
            enableEpics: proj.settings?.enableEpics ?? false,
            enableSprints: proj.settings?.enableSprints ?? false,
            enableReleases: proj.settings?.enableReleases ?? false,
          },
          budget: {
            amount: proj.budget?.amount || 0,
            currency: proj.budget?.currency || "USD",
            billingType: proj.budget?.billingType || "fixed",
            hourlyRate: proj.budget?.hourlyRate || 0,
            spent: proj.budget?.spent || 0,
            retainerAmount: proj.budget?.retainerAmount || 0,
          },
        });
      }
    } catch (err) {
      toast.error("Failed to load project");
      router.push("/projects");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchProject();
    }
  }, [authLoading, user, fetchProject]);

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && project && !canManageProject) {
      toast.error("You don't have permission to manage project settings");
      router.push(`/projects/${projectId}`);
    }
  }, [loading, project, canManageProject, router, projectId]);

  // Debounced save for form field changes
  const debouncedSave = useCallback(
    (patch: Partial<Project>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await projectApi.update(projectId, patch);
          setSaveStatus("saved");
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err: any) {
          setSaveStatus("error");
          toast.error(err?.message || "Failed to save settings");
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        }
      }, 1500);
    },
    [projectId],
  );

  // Immediate save (for toggles)
  const immediateSave = useCallback(
    async (patch: Partial<Project>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      setSaveStatus("saving");
      try {
        await projectApi.update(projectId, patch);
        setSaveStatus("saved");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err: any) {
        setSaveStatus("error");
        toast.error(err?.message || "Failed to save settings");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [projectId],
  );

  // Watch for form changes and trigger debounced save
  const prevFormRef = useRef<string>("");
  useEffect(() => {
    const formStr = JSON.stringify(form);
    if (prevFormRef.current && prevFormRef.current !== formStr) {
      // Don't auto-save for team/danger sections (those have their own save patterns)
      if (activeSection !== "team" && activeSection !== "danger") {
        debouncedSave(form);
      }
    }
    prevFormRef.current = formStr;
  }, [form, debouncedSave, activeSection]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-[#E2E8F0] bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-gray-900">Project Settings</h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">
                    {project.projectKey}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{project.projectName}</p>
              </div>
            </div>
            <SaveIndicator status={saveStatus} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation */}
          <nav className="w-56 border-r border-[#E2E8F0] bg-white overflow-y-auto py-4 px-3 shrink-0">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === item.key
                      ? "bg-[#EBF5FB] text-[#2E86C1]"
                      : item.key === "danger"
                      ? "text-red-600 hover:bg-red-50"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${activeSection === item.key ? "text-[#2E86C1]" : item.key === "danger" ? "text-red-500" : "text-gray-400"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Right Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl">
              {activeSection === "general" && (
                <GeneralSection
                  project={project}
                  form={form}
                  setForm={setForm}
                  onSave={immediateSave}
                />
              )}
              {activeSection === "features" && (
                <FeaturesSection
                  form={form}
                  setForm={setForm}
                  onToggle={(key, val) => {
                    immediateSave({ settings: { ...form.settings, [key]: val } as Project["settings"] });
                  }}
                />
              )}
              {activeSection === "board" && (
                <BoardSection form={form} setForm={setForm} />
              )}
              {activeSection === "sprint" && (
                <SprintSection
                  form={form}
                  setForm={setForm}
                  sprintsEnabled={form.settings?.enableSprints || false}
                />
              )}
              {activeSection === "budget" && (
                <BudgetSection form={form} setForm={setForm} />
              )}
              {activeSection === "team" && (
                <TeamSection
                  project={project}
                  projectId={projectId}
                  onRefresh={fetchProject}
                />
              )}
              {activeSection === "danger" && (
                <DangerSection
                  project={project}
                  projectId={projectId}
                  canDelete={canDeleteProject}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
