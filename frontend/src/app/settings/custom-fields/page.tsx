"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi, projectApi } from "@/lib/api";
import type {
  CustomField,
  CustomFieldInput,
  CustomFieldOption,
  CustomFieldType,
  CustomFieldValidation,
  Project,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Type configuration
// ---------------------------------------------------------------------------
const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  text: { label: "Text", color: "bg-gray-100 text-gray-700", icon: "M4 6h16M4 12h16M4 18h7" },
  number: { label: "Number", color: "bg-blue-100 text-blue-700", icon: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14" },
  date: { label: "Date", color: "bg-cyan-100 text-cyan-700", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  dropdown: { label: "Dropdown", color: "bg-purple-100 text-purple-700", icon: "M19 9l-7 7-7-7" },
  multi_select: { label: "Multi-Select", color: "bg-violet-100 text-violet-700", icon: "M5 13l4 4L19 7" },
  checkbox: { label: "Checkbox", color: "bg-emerald-100 text-emerald-700", icon: "M5 13l4 4L19 7" },
  url: { label: "URL", color: "bg-sky-100 text-sky-700", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
  user: { label: "User", color: "bg-pink-100 text-pink-700", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  currency: { label: "Currency", color: "bg-amber-100 text-amber-700", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" },
  percentage: { label: "Percentage", color: "bg-orange-100 text-orange-700", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01" },
};

const FIELD_TYPES: CustomFieldType[] = [
  "text", "number", "date", "dropdown", "multi_select",
  "checkbox", "url", "user", "currency", "percentage",
];

const COLOR_SWATCHES = [
  "#64748B", "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444",
  "#F59E0B", "#10B981", "#06B6D4", "#6366F1", "#F97316",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

function isValidKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(key);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface FormState {
  name: string;
  key: string;
  keyDirty: boolean;
  type: CustomFieldType;
  description: string;
  required: boolean;
  defaultValue: string;
  projectId: string; // "" means all
  options: CustomFieldOption[];
  validation: {
    min: string;
    max: string;
    minLength: string;
    maxLength: string;
    pattern: string;
  };
}

const emptyForm = (): FormState => ({
  name: "",
  key: "",
  keyDirty: false,
  type: "text",
  description: "",
  required: false,
  defaultValue: "",
  projectId: "",
  options: [],
  validation: { min: "", max: "", minLength: "", maxLength: "", pattern: "" },
});

export default function CustomFieldsPage() {
  const { user, loading: authLoading, hasOrgRole } = useAuth();
  const router = useRouter();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProjectId, setFilterProjectId] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (!hasOrgRole("manager")) {
        toast.error("Manager role required to access custom fields");
        router.push("/settings");
      }
    }
  }, [authLoading, user, hasOrgRole, router]);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [fieldsRes, projectsRes] = await Promise.all([
        taskApi.listCustomFields(filterProjectId || undefined),
        projectApi.getAll(),
      ]);
      setFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load custom fields");
    } finally {
      setLoading(false);
    }
  }, [user, filterProjectId]);

  useEffect(() => {
    if (user && hasOrgRole("manager")) fetchData();
  }, [fetchData, user, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------
  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      key: prev.keyDirty ? prev.key : slugifyKey(value),
    }));
  };

  const handleKeyChange = (value: string) => {
    setForm((prev) => ({ ...prev, key: value, keyDirty: true }));
  };

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { value: "", label: "", color: COLOR_SWATCHES[0] }],
    }));
  };

  const updateOption = (idx: number, patch: Partial<CustomFieldOption>) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  };

  const removeOption = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  const openNewModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEditModal = (field: CustomField) => {
    setEditingId(field._id);
    setForm({
      name: field.name,
      key: field.key,
      keyDirty: true,
      type: field.type,
      description: field.description || "",
      required: !!field.required,
      defaultValue:
        field.defaultValue === undefined || field.defaultValue === null
          ? ""
          : String(field.defaultValue),
      projectId: field.projectId || "",
      options: field.options ? field.options.map((o) => ({ ...o })) : [],
      validation: {
        min: field.validation?.min !== undefined ? String(field.validation.min) : "",
        max: field.validation?.max !== undefined ? String(field.validation.max) : "",
        minLength:
          field.validation?.minLength !== undefined ? String(field.validation.minLength) : "",
        maxLength:
          field.validation?.maxLength !== undefined ? String(field.validation.maxLength) : "",
        pattern: field.validation?.pattern || "",
      },
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.key.trim() || !isValidKey(form.key)) {
      toast.error("Key must be snake_case (letters, digits, underscores)");
      return;
    }
    if ((form.type === "dropdown" || form.type === "multi_select") && form.options.length === 0) {
      toast.error("Add at least one option for dropdown fields");
      return;
    }
    if (
      (form.type === "dropdown" || form.type === "multi_select") &&
      form.options.some((o) => !o.value.trim() || !o.label.trim())
    ) {
      toast.error("All options need a value and label");
      return;
    }

    // Build validation object only with defined fields
    const validation: CustomFieldValidation = {};
    if (form.type === "text") {
      if (form.validation.minLength) validation.minLength = Number(form.validation.minLength);
      if (form.validation.maxLength) validation.maxLength = Number(form.validation.maxLength);
      if (form.validation.pattern) validation.pattern = form.validation.pattern;
    }
    if (form.type === "number" || form.type === "currency" || form.type === "percentage") {
      if (form.validation.min) validation.min = Number(form.validation.min);
      if (form.validation.max) validation.max = Number(form.validation.max);
    }

    // Parse default value based on type
    let defaultValue: unknown = undefined;
    if (form.defaultValue !== "") {
      if (form.type === "number" || form.type === "currency" || form.type === "percentage") {
        const n = Number(form.defaultValue);
        defaultValue = isNaN(n) ? undefined : n;
      } else if (form.type === "checkbox") {
        defaultValue = form.defaultValue === "true";
      } else {
        defaultValue = form.defaultValue;
      }
    }

    const payload: CustomFieldInput = {
      name: form.name.trim(),
      key: form.key.trim(),
      type: form.type,
      description: form.description.trim() || undefined,
      required: form.required,
      defaultValue,
      projectId: form.projectId || undefined,
      appliesTo: form.projectId ? "project_specific" : "all",
      options:
        form.type === "dropdown" || form.type === "multi_select" ? form.options : undefined,
      validation: Object.keys(validation).length ? validation : undefined,
    };

    setSaving(true);
    try {
      if (editingId) {
        await taskApi.updateCustomField(editingId, payload);
        toast.success("Field updated");
      } else {
        await taskApi.createCustomField(payload);
        toast.success("Field created");
      }
      closeModal();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save field");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await taskApi.deleteCustomField(deleteId);
      toast.success("Field deleted");
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete field");
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const getProjectName = (projectId?: string): string => {
    if (!projectId) return "All Projects";
    const p = projects.find((proj) => proj._id === projectId);
    return p ? p.projectName : "Unknown project";
  };

  const displayDefault = (f: CustomField): string => {
    if (f.defaultValue === null || f.defaultValue === undefined || f.defaultValue === "") {
      return "\u2014";
    }
    if (typeof f.defaultValue === "boolean") return f.defaultValue ? "Yes" : "No";
    if (Array.isArray(f.defaultValue)) return f.defaultValue.join(", ");
    return String(f.defaultValue);
  };

  const filtered = useMemo(() => fields, [fields]);

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

  const needsOptions = form.type === "dropdown" || form.type === "multi_select";
  const isTextType = form.type === "text";
  const isNumericType = form.type === "number" || form.type === "currency" || form.type === "percentage";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[#0F172A]">Custom Fields</h2>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Create custom fields for tasks across your organization or specific projects.
          </p>
        </div>
        <Button onClick={openNewModal} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Field
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

      {/* Fields table */}
      <Card className="border-[#E2E8F0] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-6 w-6 text-[#2E86C1]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F1F5F9] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-[#334155]">No custom fields yet</p>
              <p className="text-[12px] text-[#64748B] mt-1">
                Click "New Field" to add your first custom field.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Key</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Applies To</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Required</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Default</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[11px] text-[#64748B] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((field) => {
                  const cfg = typeConfig[field.type] || typeConfig.text;
                  return (
                    <tr key={field._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#0F172A]">{field.name}</div>
                        {field.description && (
                          <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate max-w-[220px]">
                            {field.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[11px] bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded">
                          {field.key}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.color}`}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                          </svg>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#475569]">
                        {getProjectName(field.projectId)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#475569]">
                        {field.required ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#475569] max-w-[150px] truncate">
                        {displayDefault(field)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(field)}
                            className="p-1.5 rounded-md text-[#64748B] hover:bg-[#EBF5FF] hover:text-[#2E86C1] transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteId(field._id)}
                            className="p-1.5 rounded-md text-[#64748B] hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* New/Edit Field Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#0F172A]">
                {editingId ? "Edit Custom Field" : "New Custom Field"}
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

            <div className="px-6 py-5 space-y-4">
              {/* Name & Key */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                    Name *
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Story Points"
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                    Key *
                  </label>
                  <Input
                    value={form.key}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder="story_points"
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] font-mono"
                  />
                  {form.key && !isValidKey(form.key) && (
                    <p className="text-[10px] text-red-600 mt-1">
                      Must be snake_case (lowercase letters, digits, underscores)
                    </p>
                  )}
                </div>
              </div>

              {/* Type & Applies To */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                    Type *
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => updateForm("type", e.target.value as CustomFieldType)}
                    className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {typeConfig[t]?.label || t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                    Applies To
                  </label>
                  <select
                    value={form.projectId}
                    onChange={(e) => updateForm("projectId", e.target.value)}
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

              {/* Description */}
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Help text shown to users..."
                  rows={2}
                  className="w-full text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] resize-none"
                />
              </div>

              {/* Required & Default */}
              <div className="grid grid-cols-2 gap-3 items-start">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">
                    Default Value
                  </label>
                  {form.type === "checkbox" ? (
                    <select
                      value={form.defaultValue}
                      onChange={(e) => updateForm("defaultValue", e.target.value)}
                      className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    >
                      <option value="">None</option>
                      <option value="true">Checked</option>
                      <option value="false">Unchecked</option>
                    </select>
                  ) : form.type === "date" ? (
                    <Input
                      type="date"
                      value={form.defaultValue}
                      onChange={(e) => updateForm("defaultValue", e.target.value)}
                      className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                    />
                  ) : isNumericType ? (
                    <Input
                      type="number"
                      value={form.defaultValue}
                      onChange={(e) => updateForm("defaultValue", e.target.value)}
                      className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                    />
                  ) : (
                    <Input
                      value={form.defaultValue}
                      onChange={(e) => updateForm("defaultValue", e.target.value)}
                      className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                    />
                  )}
                </div>
                <div className="pt-6">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.required}
                      onChange={(e) => updateForm("required", e.target.checked)}
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1]"
                    />
                    <span className="text-[13px] text-[#334155]">Required field</span>
                  </label>
                </div>
              </div>

              {/* Options (for dropdown / multi_select) */}
              {needsOptions && (
                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold text-[#334155]">
                      Options *
                    </label>
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-[11px] font-semibold text-[#2E86C1] hover:text-[#2471A3]"
                    >
                      + Add Option
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.options.length === 0 && (
                      <p className="text-[11px] text-[#94A3B8] italic">
                        No options yet. Click "Add Option" above.
                      </p>
                    )}
                    {form.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md"
                      >
                        <select
                          value={opt.color || COLOR_SWATCHES[0]}
                          onChange={(e) => updateOption(idx, { color: e.target.value })}
                          className="h-8 text-xs bg-white border border-[#E2E8F0] rounded px-1 w-12"
                          style={{
                            color: opt.color || COLOR_SWATCHES[0],
                            backgroundColor: (opt.color || COLOR_SWATCHES[0]) + "20",
                          }}
                        >
                          {COLOR_SWATCHES.map((c) => (
                            <option key={c} value={c} style={{ color: c }}>
                              ●
                            </option>
                          ))}
                        </select>
                        <Input
                          value={opt.value}
                          onChange={(e) => updateOption(idx, { value: e.target.value })}
                          placeholder="value"
                          className="h-8 text-xs bg-white border-[#E2E8F0] font-mono flex-1"
                        />
                        <Input
                          value={opt.label}
                          onChange={(e) => updateOption(idx, { label: e.target.value })}
                          placeholder="Label"
                          className="h-8 text-xs bg-white border-[#E2E8F0] flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="p-1 text-[#94A3B8] hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation */}
              {(isTextType || isNumericType) && (
                <div className="border-t border-[#E2E8F0] pt-4">
                  <label className="text-[12px] font-semibold text-[#334155] mb-2 block">
                    Validation
                  </label>
                  {isTextType && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-[#64748B] mb-1 block">
                            Min length
                          </label>
                          <Input
                            type="number"
                            value={form.validation.minLength}
                            onChange={(e) =>
                              updateForm("validation", {
                                ...form.validation,
                                minLength: e.target.value,
                              })
                            }
                            className="h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[#64748B] mb-1 block">
                            Max length
                          </label>
                          <Input
                            type="number"
                            value={form.validation.maxLength}
                            onChange={(e) =>
                              updateForm("validation", {
                                ...form.validation,
                                maxLength: e.target.value,
                              })
                            }
                            className="h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#64748B] mb-1 block">
                          Pattern (regex)
                        </label>
                        <Input
                          value={form.validation.pattern}
                          onChange={(e) =>
                            updateForm("validation", {
                              ...form.validation,
                              pattern: e.target.value,
                            })
                          }
                          placeholder="^[A-Z]{2,}$"
                          className="h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0] font-mono"
                        />
                      </div>
                    </div>
                  )}
                  {isNumericType && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#64748B] mb-1 block">Min</label>
                        <Input
                          type="number"
                          value={form.validation.min}
                          onChange={(e) =>
                            updateForm("validation", {
                              ...form.validation,
                              min: e.target.value,
                            })
                          }
                          className="h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#64748B] mb-1 block">Max</label>
                        <Input
                          type="number"
                          value={form.validation.max}
                          onChange={(e) =>
                            updateForm("validation", {
                              ...form.validation,
                              max: e.target.value,
                            })
                          }
                          className="h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-2 rounded-b-xl">
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
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Field"}
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
                <h3 className="text-[16px] font-bold text-[#0F172A]">Delete custom field?</h3>
                <p className="text-[13px] text-[#64748B] mt-1">
                  This will soft-delete the field. Existing task values will be preserved but the
                  field won't appear on new tasks.
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
    </div>
  );
}
