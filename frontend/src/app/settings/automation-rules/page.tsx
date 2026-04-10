"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi, projectApi } from "@/lib/api";
import type {
  AutomationRule,
  AutomationRuleInput,
  AutomationEvent,
  AutomationOperator,
  AutomationActionType,
  AutomationCondition,
  AutomationAction,
  AutomationRuleTestResult,
  CustomField,
  Project,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Event / operator / action configuration
// ---------------------------------------------------------------------------
const eventLabels: Record<string, string> = {
  task_created: "When a task is created",
  task_updated: "When a task is updated",
  status_changed: "When status changes",
  assignee_changed: "When assignee changes",
  priority_changed: "When priority changes",
  due_date_approaching: "When due date approaches",
  comment_added: "When a comment is added",
  field_changed: "When a field changes",
};

const EVENTS: AutomationEvent[] = [
  "task_created", "task_updated", "status_changed", "assignee_changed",
  "priority_changed", "due_date_approaching", "comment_added", "field_changed",
];

const operatorLabels: Record<AutomationOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  greater_than: "is greater than",
  less_than: "is less than",
  in: "is one of",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const OPERATORS: AutomationOperator[] = [
  "equals", "not_equals", "contains", "greater_than",
  "less_than", "in", "is_empty", "is_not_empty",
];

const UNARY_OPERATORS: AutomationOperator[] = ["is_empty", "is_not_empty"];

const actionLabels: Record<AutomationActionType, string> = {
  change_status: "Change status",
  assign_to: "Assign to",
  set_priority: "Set priority",
  add_label: "Add label",
  remove_label: "Remove label",
  add_comment: "Add comment",
  send_notification: "Send notification",
  create_subtask: "Create subtask",
  set_due_date: "Set due date",
  set_field: "Set custom field",
};

const ACTION_TYPES: AutomationActionType[] = [
  "change_status", "assign_to", "set_priority", "add_label", "remove_label",
  "add_comment", "send_notification", "create_subtask", "set_due_date", "set_field",
];

const STATUS_OPTIONS = ["todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

const CORE_FIELDS = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "assigneeId", label: "Assignee" },
  { key: "labels", label: "Labels" },
  { key: "dueDate", label: "Due Date" },
  { key: "title", label: "Title" },
];

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------
interface RuleFormCondition {
  field: string;
  operator: AutomationOperator;
  value: string;
}

interface RuleFormAction {
  type: AutomationActionType;
  // shared params (only a subset used per action type)
  status?: string;
  priority?: string;
  assigneeId?: string;
  label?: string;
  comment?: string;
  notificationMessage?: string;
  subtaskTitle?: string;
  dueDate?: string;
  daysFromNow?: string;
  fieldKey?: string;
  fieldValue?: string;
}

interface RuleForm {
  name: string;
  description: string;
  projectId: string;
  enabled: boolean;
  event: AutomationEvent;
  conditions: RuleFormCondition[];
  actions: RuleFormAction[];
}

const emptyForm = (): RuleForm => ({
  name: "",
  description: "",
  projectId: "",
  enabled: true,
  event: "task_created",
  conditions: [],
  actions: [{ type: "change_status" }],
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AutomationRulesPage() {
  const { user, loading: authLoading, hasOrgRole } = useAuth();
  const router = useRouter();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProjectId, setFilterProjectId] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [testResult, setTestResult] = useState<AutomationRuleTestResult | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // Collapsible section state for the modal
  const [openSection, setOpenSection] = useState<"trigger" | "conditions" | "actions" | "review" | null>("trigger");

  // Auth guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (!hasOrgRole("manager")) {
        toast.error("Manager role required to access automation rules");
        router.push("/settings");
      }
    }
  }, [authLoading, user, hasOrgRole, router]);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rulesRes, projectsRes, fieldsRes] = await Promise.all([
        taskApi.listAutomationRules(filterProjectId || undefined),
        projectApi.getAll(),
        taskApi.listCustomFields(),
      ]);
      setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      setCustomFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load automation rules");
    } finally {
      setLoading(false);
    }
  }, [user, filterProjectId]);

  useEffect(() => {
    if (user && hasOrgRole("manager")) fetchData();
  }, [fetchData, user, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------
  const getProjectName = (projectId?: string): string => {
    if (!projectId) return "All Projects";
    const p = projects.find((proj) => proj._id === projectId);
    return p ? p.projectName : "Unknown project";
  };

  const availableFields = useMemo(() => {
    const custom = customFields.map((f) => ({
      key: `customFields.${f.key}`,
      label: `${f.name} (custom)`,
    }));
    return [...CORE_FIELDS, ...custom];
  }, [customFields]);

  const fieldLabel = (key: string): string => {
    const match = availableFields.find((f) => f.key === key);
    return match ? match.label : key;
  };

  // ---------------------------------------------------------------------------
  // Modal open/close
  // ---------------------------------------------------------------------------
  const openNewModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpenSection("trigger");
    setShowModal(true);
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingId(rule._id);
    const actions: RuleFormAction[] = (rule.actions || []).map((a) => {
      const params = (a.params || {}) as Record<string, unknown>;
      const toStr = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
      return {
        type: a.type,
        status: toStr(params.status),
        priority: toStr(params.priority),
        assigneeId: toStr(params.assigneeId || params.userId),
        label: toStr(params.label),
        comment: toStr(params.comment || params.template),
        notificationMessage: toStr(params.message),
        subtaskTitle: toStr(params.title),
        dueDate: toStr(params.dueDate),
        daysFromNow: toStr(params.daysFromNow),
        fieldKey: toStr(params.fieldKey),
        fieldValue: toStr(params.fieldValue || params.value),
      };
    });

    const conditions: RuleFormCondition[] = (rule.trigger.conditions || []).map((c) => ({
      field: c.field,
      operator: c.operator,
      value:
        c.value === undefined || c.value === null
          ? ""
          : Array.isArray(c.value)
          ? c.value.join(", ")
          : String(c.value),
    }));

    setForm({
      name: rule.name,
      description: rule.description || "",
      projectId: rule.projectId || "",
      enabled: !!rule.enabled,
      event: rule.trigger.event,
      conditions,
      actions: actions.length > 0 ? actions : [{ type: "change_status" }],
    });
    setOpenSection("trigger");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  // ---------------------------------------------------------------------------
  // Condition / action helpers
  // ---------------------------------------------------------------------------
  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "status", operator: "equals", value: "" }],
    }));
  };

  const updateCondition = (idx: number, patch: Partial<RuleFormCondition>) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };

  const removeCondition = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== idx),
    }));
  };

  const addAction = () => {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { type: "change_status" }],
    }));
  };

  const updateAction = (idx: number, patch: Partial<RuleFormAction>) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  };

  const removeAction = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== idx),
    }));
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  const buildPayload = (): AutomationRuleInput | null => {
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return null;
    }
    if (form.actions.length === 0) {
      toast.error("Add at least one action");
      return null;
    }

    const conditions: AutomationCondition[] = form.conditions.map((c) => {
      const cond: AutomationCondition = { field: c.field, operator: c.operator };
      if (!UNARY_OPERATORS.includes(c.operator)) {
        if (c.operator === "in") {
          cond.value = c.value.split(",").map((s) => s.trim()).filter(Boolean);
        } else if (c.operator === "greater_than" || c.operator === "less_than") {
          const n = Number(c.value);
          cond.value = isNaN(n) ? c.value : n;
        } else {
          cond.value = c.value;
        }
      }
      return cond;
    });

    const actions: AutomationAction[] = form.actions.map((a) => {
      const params: Record<string, unknown> = {};
      switch (a.type) {
        case "change_status":
          if (a.status) params.status = a.status;
          break;
        case "assign_to":
          if (a.assigneeId) params.assigneeId = a.assigneeId;
          break;
        case "set_priority":
          if (a.priority) params.priority = a.priority;
          break;
        case "add_label":
        case "remove_label":
          if (a.label) params.label = a.label;
          break;
        case "add_comment":
          if (a.comment) params.comment = a.comment;
          break;
        case "send_notification":
          if (a.notificationMessage) params.message = a.notificationMessage;
          break;
        case "create_subtask":
          if (a.subtaskTitle) params.title = a.subtaskTitle;
          break;
        case "set_due_date":
          if (a.dueDate) params.dueDate = a.dueDate;
          if (a.daysFromNow) params.daysFromNow = Number(a.daysFromNow);
          break;
        case "set_field":
          if (a.fieldKey) params.fieldKey = a.fieldKey;
          if (a.fieldValue !== undefined) params.value = a.fieldValue;
          break;
      }
      return { type: a.type, params };
    });

    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      projectId: form.projectId || undefined,
      enabled: form.enabled,
      trigger: { event: form.event, conditions },
      actions,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      if (editingId) {
        await taskApi.updateAutomationRule(editingId, payload);
        toast.success("Rule updated");
      } else {
        await taskApi.createAutomationRule(payload);
        toast.success("Rule created");
      }
      closeModal();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle / delete / test
  // ---------------------------------------------------------------------------
  const handleToggle = async (rule: AutomationRule) => {
    try {
      await taskApi.toggleAutomationRule(rule._id);
      setRules((prev) =>
        prev.map((r) => (r._id === rule._id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle rule");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await taskApi.deleteAutomationRule(deleteId);
      toast.success("Rule deleted");
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule");
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (rule: AutomationRule) => {
    setTesting(rule._id);
    try {
      // Pass empty string as sample task id; backend will use a default sample
      const res = await taskApi.testAutomationRule(rule._id, "");
      setTestResult(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to test rule");
    } finally {
      setTesting(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Plain-English summary
  // ---------------------------------------------------------------------------
  const buildSummary = (f: RuleForm): string => {
    const eventPart = eventLabels[f.event] || f.event;
    const projectPart = f.projectId ? ` in ${getProjectName(f.projectId)}` : "";
    let summary = `${eventPart}${projectPart}`;
    if (f.conditions.length > 0) {
      const conds = f.conditions
        .map((c) => {
          const field = fieldLabel(c.field);
          const op = operatorLabels[c.operator];
          if (UNARY_OPERATORS.includes(c.operator)) return `${field} ${op}`;
          return `${field} ${op} "${c.value || "?"}"`;
        })
        .join(" AND ");
      summary += `, if ${conds}`;
    }
    if (f.actions.length > 0) {
      const acts = f.actions
        .map((a) => {
          switch (a.type) {
            case "change_status":
              return `change status to "${a.status || "?"}"`;
            case "assign_to":
              return `assign to "${a.assigneeId || "?"}"`;
            case "set_priority":
              return `set priority to "${a.priority || "?"}"`;
            case "add_label":
              return `add label "${a.label || "?"}"`;
            case "remove_label":
              return `remove label "${a.label || "?"}"`;
            case "add_comment":
              return `add comment "${(a.comment || "").slice(0, 40)}${(a.comment || "").length > 40 ? "..." : ""}"`;
            case "send_notification":
              return `send a notification`;
            case "create_subtask":
              return `create subtask "${a.subtaskTitle || "?"}"`;
            case "set_due_date":
              return a.daysFromNow
                ? `set due date to ${a.daysFromNow} days from now`
                : `set due date to ${a.dueDate || "?"}`;
            case "set_field":
              return `set ${a.fieldKey || "?"} to "${a.fieldValue || "?"}"`;
            default:
              return actionLabels[a.type] || a.type;
          }
        })
        .join(" and ");
      summary += `, then ${acts}`;
    }
    return summary.charAt(0).toUpperCase() + summary.slice(1) + ".";
  };

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-6 w-6 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!hasOrgRole("manager")) return null;

  const formatDate = (date?: string) => {
    if (!date) return null;
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---------------------------------------------------------------------------
  // Render an action's params editor
  // ---------------------------------------------------------------------------
  const renderActionParams = (action: RuleFormAction, idx: number) => {
    const commonClasses =
      "h-9 text-sm bg-white border-[#E2E8F0]";
    switch (action.type) {
      case "change_status":
        return (
          <select
            value={action.status || ""}
            onChange={(e) => updateAction(idx, { status: e.target.value })}
            className="h-9 text-sm bg-white border border-[#E2E8F0] rounded-md px-2 flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
          >
            <option value="">Select status...</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        );
      case "set_priority":
        return (
          <select
            value={action.priority || ""}
            onChange={(e) => updateAction(idx, { priority: e.target.value })}
            className="h-9 text-sm bg-white border border-[#E2E8F0] rounded-md px-2 flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
          >
            <option value="">Select priority...</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        );
      case "assign_to":
        return (
          <Input
            value={action.assigneeId || ""}
            onChange={(e) => updateAction(idx, { assigneeId: e.target.value })}
            placeholder="User ID or email"
            className={`${commonClasses} flex-1 min-w-[140px]`}
          />
        );
      case "add_label":
      case "remove_label":
        return (
          <Input
            value={action.label || ""}
            onChange={(e) => updateAction(idx, { label: e.target.value })}
            placeholder="Label name"
            className={`${commonClasses} flex-1 min-w-[140px]`}
          />
        );
      case "add_comment":
        return (
          <Input
            value={action.comment || ""}
            onChange={(e) => updateAction(idx, { comment: e.target.value })}
            placeholder="Comment (supports {{task.title}})"
            className={`${commonClasses} flex-1 min-w-[200px]`}
          />
        );
      case "send_notification":
        return (
          <Input
            value={action.notificationMessage || ""}
            onChange={(e) => updateAction(idx, { notificationMessage: e.target.value })}
            placeholder="Notification message"
            className={`${commonClasses} flex-1 min-w-[200px]`}
          />
        );
      case "create_subtask":
        return (
          <Input
            value={action.subtaskTitle || ""}
            onChange={(e) => updateAction(idx, { subtaskTitle: e.target.value })}
            placeholder="Subtask title"
            className={`${commonClasses} flex-1 min-w-[200px]`}
          />
        );
      case "set_due_date":
        return (
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="date"
              value={action.dueDate || ""}
              onChange={(e) => updateAction(idx, { dueDate: e.target.value, daysFromNow: "" })}
              className={`${commonClasses} flex-1`}
            />
            <span className="text-[11px] text-[#94A3B8]">or</span>
            <Input
              type="number"
              value={action.daysFromNow || ""}
              onChange={(e) =>
                updateAction(idx, { daysFromNow: e.target.value, dueDate: "" })
              }
              placeholder="days from now"
              className={`${commonClasses} w-32`}
            />
          </div>
        );
      case "set_field":
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={action.fieldKey || ""}
              onChange={(e) => updateAction(idx, { fieldKey: e.target.value })}
              className="h-9 text-sm bg-white border border-[#E2E8F0] rounded-md px-2 flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
            >
              <option value="">Select field...</option>
              {customFields.map((f) => (
                <option key={f._id} value={f.key}>
                  {f.name}
                </option>
              ))}
            </select>
            <Input
              value={action.fieldValue || ""}
              onChange={(e) => updateAction(idx, { fieldValue: e.target.value })}
              placeholder="Value"
              className={`${commonClasses} flex-1`}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[#0F172A]">Automation Rules</h2>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Automate task workflows with triggers, conditions, and actions.
          </p>
        </div>
        <Button onClick={openNewModal} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Rule
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-[12px] font-semibold text-[#64748B]">Filter by project:</label>
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="h-9 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.projectName}
            </option>
          ))}
        </select>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-6 w-6 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-[#E2E8F0] bg-white">
          <CardContent className="text-center py-16 px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F1F5F9] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-[#334155]">No automation rules yet</p>
            <p className="text-[12px] text-[#64748B] mt-1">
              Click "New Rule" to create your first automation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const conditionCount = rule.trigger.conditions?.length || 0;
            const actionCount = rule.actions?.length || 0;
            const lastRun = formatDate(rule.lastRunAt);
            const statusColors: Record<string, string> = {
              success: "bg-emerald-50 text-emerald-700 border-emerald-200",
              failure: "bg-red-50 text-red-700 border-red-200",
              skipped: "bg-gray-50 text-gray-600 border-gray-200",
            };
            return (
              <Card key={rule._id} className="border-[#E2E8F0] bg-white">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors mt-1 ${
                        rule.enabled ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"
                      }`}
                      title={rule.enabled ? "Disable rule" : "Enable rule"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold text-[#0F172A] truncate">
                            {rule.name}
                          </h3>
                          {rule.description && (
                            <p className="text-[12px] text-[#64748B] mt-0.5">
                              {rule.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleTest(rule)}
                            disabled={testing === rule._id}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] disabled:opacity-50"
                          >
                            {testing === rule._id ? "Testing..." : "Test"}
                          </button>
                          <button
                            onClick={() => openEditModal(rule)}
                            className="p-1.5 rounded-md text-[#64748B] hover:bg-[#EBF5FF] hover:text-[#2E86C1] transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteId(rule._id)}
                            className="p-1.5 rounded-md text-[#64748B] hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Chips */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {eventLabels[rule.trigger.event] || rule.trigger.event}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          {conditionCount === 0
                            ? "Always"
                            : `If ${conditionCount} condition${conditionCount > 1 ? "s" : ""} match`}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Then {actionCount} action{actionCount !== 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                          {getProjectName(rule.projectId)}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#64748B]">
                        <span>
                          <span className="font-semibold text-[#334155]">{rule.runCount || 0}</span>{" "}
                          run{rule.runCount === 1 ? "" : "s"}
                        </span>
                        {lastRun && (
                          <span>
                            Last run:{" "}
                            <span className="text-[#334155] font-medium">{lastRun}</span>
                          </span>
                        )}
                        {rule.lastRunStatus && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              statusColors[rule.lastRunStatus] || statusColors.skipped
                            }`}
                          >
                            {rule.lastRunStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New/Edit Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-3xl my-8">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="text-[16px] font-bold text-[#0F172A]">
                {editingId ? "Edit Automation Rule" : "New Automation Rule"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              {/* Section: Trigger */}
              <CollapsibleSection
                title="1. Trigger"
                subtitle={eventLabels[form.event]}
                open={openSection === "trigger"}
                onToggle={() =>
                  setOpenSection(openSection === "trigger" ? null : "trigger")
                }
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                        Name *
                      </label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="e.g. Auto-assign bugs to QA"
                        className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                        Project scope
                      </label>
                      <select
                        value={form.projectId}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, projectId: e.target.value }))
                        }
                        className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                      >
                        <option value="">All Projects</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.projectName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                      Description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Optional description..."
                      rows={2}
                      className="w-full text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                      Trigger Event *
                    </label>
                    <select
                      value={form.event}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          event: e.target.value as AutomationEvent,
                        }))
                      }
                      className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    >
                      {EVENTS.map((ev) => (
                        <option key={ev} value={ev}>
                          {eventLabels[ev]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1]"
                    />
                    <span className="text-[13px] text-[#334155]">
                      Enable rule immediately
                    </span>
                  </label>
                </div>
              </CollapsibleSection>

              {/* Section: Conditions */}
              <CollapsibleSection
                title="2. Conditions"
                subtitle={
                  form.conditions.length === 0
                    ? "Always run"
                    : `${form.conditions.length} condition${form.conditions.length > 1 ? "s (all must match)" : ""}`
                }
                open={openSection === "conditions"}
                onToggle={() =>
                  setOpenSection(openSection === "conditions" ? null : "conditions")
                }
              >
                <div className="space-y-2">
                  {form.conditions.length === 0 && (
                    <p className="text-[12px] text-[#94A3B8] italic">
                      No conditions — rule runs every time the trigger fires.
                    </p>
                  )}
                  {form.conditions.map((cond, idx) => {
                    const isUnary = UNARY_OPERATORS.includes(cond.operator);
                    return (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md"
                      >
                        <select
                          value={cond.field}
                          onChange={(e) => updateCondition(idx, { field: e.target.value })}
                          className="h-9 text-sm bg-white border border-[#E2E8F0] rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                        >
                          {availableFields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={cond.operator}
                          onChange={(e) =>
                            updateCondition(idx, {
                              operator: e.target.value as AutomationOperator,
                            })
                          }
                          className="h-9 text-sm bg-white border border-[#E2E8F0] rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {operatorLabels[op]}
                            </option>
                          ))}
                        </select>
                        {!isUnary && (
                          <Input
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(idx, { value: e.target.value })
                            }
                            placeholder={
                              cond.operator === "in" ? "comma,separated,values" : "Value"
                            }
                            className="h-9 text-sm bg-white border-[#E2E8F0] flex-1 min-w-[140px]"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeCondition(idx)}
                          className="p-1 text-[#94A3B8] hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-[12px] font-semibold text-[#2E86C1] hover:text-[#2471A3]"
                  >
                    + Add Condition
                  </button>
                </div>
              </CollapsibleSection>

              {/* Section: Actions */}
              <CollapsibleSection
                title="3. Actions"
                subtitle={`${form.actions.length} action${form.actions.length !== 1 ? "s" : ""}`}
                open={openSection === "actions"}
                onToggle={() =>
                  setOpenSection(openSection === "actions" ? null : "actions")
                }
              >
                <div className="space-y-2">
                  {form.actions.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md"
                    >
                      <select
                        value={action.type}
                        onChange={(e) =>
                          updateAction(idx, {
                            type: e.target.value as AutomationActionType,
                          })
                        }
                        className="h-9 text-sm bg-white border border-[#E2E8F0] rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                      >
                        {ACTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {actionLabels[t]}
                          </option>
                        ))}
                      </select>
                      {renderActionParams(action, idx)}
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="p-1 text-[#94A3B8] hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAction}
                    className="text-[12px] font-semibold text-[#2E86C1] hover:text-[#2471A3]"
                  >
                    + Add Action
                  </button>
                </div>
              </CollapsibleSection>

              {/* Section: Review */}
              <CollapsibleSection
                title="4. Review"
                subtitle="Plain-English summary"
                open={openSection === "review"}
                onToggle={() =>
                  setOpenSection(openSection === "review" ? null : "review")
                }
              >
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-[13px] text-[#1E3A8A] leading-relaxed">
                    {buildSummary(form)}
                  </p>
                </div>
              </CollapsibleSection>
            </div>

            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-2 rounded-b-xl sticky bottom-0">
              <Button
                variant="outline"
                onClick={closeModal}
                disabled={saving}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#2E86C1] hover:bg-[#2471A3] h-9"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Save Rule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-[#0F172A]">Delete automation rule?</h3>
                <p className="text-[13px] text-[#64748B] mt-1">
                  This rule will be soft-deleted and will no longer run on matching events.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 h-9 text-white"
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Test result modal */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#0F172A]">Test Result</h3>
              <button
                onClick={() => setTestResult(null)}
                className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase">Rule</p>
                <p className="text-[14px] font-semibold text-[#0F172A]">
                  {testResult.ruleName}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase">
                  Conditions
                </p>
                <p className="text-[13px] text-[#334155]">
                  {testResult.conditionsMatch ? (
                    <span className="text-emerald-600 font-semibold">Match</span>
                  ) : (
                    <span className="text-red-600 font-semibold">Do not match</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase">
                  Would Execute
                </p>
                <p className="text-[13px] text-[#334155]">
                  {testResult.wouldExecute ? (
                    <span className="text-emerald-600 font-semibold">Yes</span>
                  ) : (
                    <span className="text-[#94A3B8] font-semibold">No</span>
                  )}
                </p>
              </div>
              {testResult.actions && testResult.actions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase mb-2">
                    Actions that would run
                  </p>
                  <ul className="space-y-1">
                    {testResult.actions.map((a, idx) => (
                      <li
                        key={idx}
                        className="text-[12px] text-[#334155] p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]"
                      >
                        <span className="font-semibold">{actionLabels[a.type] || a.type}</span>
                        {a.params && Object.keys(a.params).length > 0 && (
                          <span className="text-[#64748B]">
                            {" "}
                            — {JSON.stringify(a.params)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-[11px] text-[#94A3B8] italic">
                This was a dry run. No changes were made.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end rounded-b-xl">
              <Button
                onClick={() => setTestResult(null)}
                className="bg-[#2E86C1] hover:bg-[#2471A3] h-9"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section helper
// ---------------------------------------------------------------------------
function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors"
      >
        <div className="text-left">
          <div className="text-[13px] font-bold text-[#0F172A]">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</div>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[#64748B] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 py-4 bg-white">{children}</div>}
    </div>
  );
}
