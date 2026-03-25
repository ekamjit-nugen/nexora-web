"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { hrApi, policyApi, callApi, Employee, Department, Designation, Policy } from "@/lib/api";
import type { CallLog } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

// ── Employee Form Modal ──

interface EmployeeFormData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  designationId: string;
  employmentType: string;
  joiningDate: string;
  location: string;
  timezone: string;
  skills: string;
  status: string;
  reportingManagerId: string;
}

const emptyForm: EmployeeFormData = {
  userId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  departmentId: "",
  designationId: "",
  employmentType: "full_time",
  joiningDate: new Date().toISOString().split("T")[0],
  location: "",
  timezone: "",
  skills: "",
  status: "active",
  reportingManagerId: "",
};

function EmployeeFormModal({
  open,
  onClose,
  onSaved,
  employee,
  departments,
  designations,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee: Employee | null;
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        userId: employee.userId || "",
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        phone: employee.phone || "",
        departmentId: employee.departmentId || "",
        designationId: employee.designationId || "",
        employmentType: employee.employmentType || "full_time",
        joiningDate: employee.joiningDate ? employee.joiningDate.split("T")[0] : "",
        location: employee.location || "",
        timezone: employee.timezone || "",
        skills: (employee.skills || []).join(", "),
        status: employee.status || "active",
        reportingManagerId: employee.reportingManagerId || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [employee, open]);

  if (!open) return null;

  const handleChange = (field: keyof EmployeeFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error("First name, last name, and email are required");
      return;
    }

    if (!isEdit && !form.userId.trim()) {
      toast.error("User ID is required for new employees");
      return;
    }

    setSaving(true);
    try {
      const skills = form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        employmentType: form.employmentType || "full_time",
        joiningDate: form.joiningDate || new Date().toISOString(),
        skills,
        status: form.status || "active",
      };

      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (form.designationId) payload.designationId = form.designationId;
      if (form.reportingManagerId) payload.reportingManagerId = form.reportingManagerId;
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.timezone.trim()) payload.timezone = form.timezone.trim();

      if (isEdit) {
        await hrApi.updateEmployee(employee._id, payload as Partial<Employee>);
        toast.success("Employee updated successfully");
      } else {
        payload.userId = form.userId.trim();
        await hrApi.createEmployee(payload as Partial<Employee>);
        toast.success("Employee created successfully");
      }

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save employee";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {isEdit ? "Edit Employee" : "Add Employee"}
            </h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              {isEdit ? "Update employee information" : "Add a new team member to your organization"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors text-[#94A3B8]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* User ID (create only) */}
          {!isEdit && (
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                User ID <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.userId}
                onChange={(e) => handleChange("userId", e.target.value)}
                placeholder="user-id or auth user reference"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                required
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">Link to an existing auth user account</p>
            </div>
          )}

          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="John"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                required
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Doe"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                required
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john@company.com"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                required
                disabled={isEdit}
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
          </div>

          {/* Department & Designation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Department</Label>
              <select
                value={form.departmentId}
                onChange={(e) => handleChange("departmentId", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Designation</Label>
              <select
                value={form.designationId}
                onChange={(e) => handleChange("designationId", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="">Select designation</option>
                {designations.map((d) => (
                  <option key={d._id} value={d._id}>{d.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Employment Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Employment Type</Label>
              <select
                value={form.employmentType}
                onChange={(e) => handleChange("employmentType", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Status</Label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="active">Active</option>
                <option value="on_notice">On Notice</option>
                <option value="probation">Probation</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Joining Date & Reporting Manager */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Joining Date</Label>
              <Input
                type="date"
                value={form.joiningDate}
                onChange={(e) => handleChange("joiningDate", e.target.value)}
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Reporting Manager</Label>
              <select
                value={form.reportingManagerId}
                onChange={(e) => handleChange("reportingManagerId", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="">Select manager</option>
                {employees
                  .filter((emp) => !employee || emp._id !== employee._id)
                  .map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Location & Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Location</Label>
              <Input
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="New York, NY"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Timezone</Label>
              <Input
                value={form.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
                placeholder="America/New_York"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
          </div>

          {/* Skills */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Skills</Label>
            <Input
              value={form.skills}
              onChange={(e) => handleChange("skills", e.target.value)}
              placeholder="React, TypeScript, Node.js (comma-separated)"
              className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
            />
            <p className="text-[11px] text-[#94A3B8] mt-1">Separate skills with commas</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Add Employee"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Policy Management Modal ──

function PolicyManageModal({
  open,
  onClose,
  employee,
  allPolicies,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  allPolicies: Policy[];
  onUpdated: () => void;
}) {
  const [attachedPolicies, setAttachedPolicies] = useState<string[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    if (open && employee) {
      setAttachedPolicies(employee.policyIds || []);
      setSelectedPolicyId("");
    }
  }, [open, employee]);

  if (!open || !employee) return null;

  const attachedPolicyObjects = allPolicies.filter((p) =>
    attachedPolicies.includes(p._id)
  );
  const availablePolicies = allPolicies.filter(
    (p) => !attachedPolicies.includes(p._id) && p.isActive !== false && !p.isTemplate
  );

  const categoryColors: Record<string, string> = {
    work_timing: "bg-blue-50 text-blue-700 border-blue-200",
    leave: "bg-emerald-50 text-emerald-700 border-emerald-200",
    wfh: "bg-violet-50 text-violet-700 border-violet-200",
    attendance: "bg-amber-50 text-amber-700 border-amber-200",
    overtime: "bg-orange-50 text-orange-700 border-orange-200",
    shift: "bg-indigo-50 text-indigo-700 border-indigo-200",
    expense: "bg-pink-50 text-pink-700 border-pink-200",
  };

  const handleAttach = async () => {
    if (!selectedPolicyId) return;
    setAttaching(true);
    try {
      await hrApi.attachPolicy(employee._id, selectedPolicyId);
      setAttachedPolicies((prev) => [...prev, selectedPolicyId]);
      setSelectedPolicyId("");
      toast.success("Policy attached successfully");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach policy");
    } finally {
      setAttaching(false);
    }
  };

  const handleDetach = async (policyId: string) => {
    try {
      await hrApi.detachPolicy(employee._id, policyId);
      setAttachedPolicies((prev) => prev.filter((id) => id !== policyId));
      toast.success("Policy detached successfully");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to detach policy");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Manage Policies</h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              {employee.firstName} {employee.lastName} ({employee.employeeId})
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors text-[#94A3B8]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Attach Policy */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Attach a Policy</Label>
            <div className="flex gap-2">
              <select
                value={selectedPolicyId}
                onChange={(e) => setSelectedPolicyId(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="">Select a policy to attach...</option>
                {availablePolicies.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.policyName} ({p.category || p.type || "general"})
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAttach}
                disabled={!selectedPolicyId || attaching}
                className="h-10 px-4 rounded-lg text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50"
              >
                {attaching ? "..." : "Attach"}
              </Button>
            </div>
            {availablePolicies.length === 0 && (
              <p className="text-[11px] text-[#94A3B8] mt-1">No more policies available to attach</p>
            )}
          </div>

          {/* Attached Policies */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-2 block">
              Attached Policies ({attachedPolicyObjects.length})
            </Label>
            {attachedPolicyObjects.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800">No policies attached to this employee.</p>
                    <p className="text-[12px] text-amber-600 mt-0.5">Attach policies to define working hours, leave, and other rules.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {attachedPolicyObjects.map((policy) => (
                  <div
                    key={policy._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] hover:border-[#CBD5E1] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A] truncate">{policy.policyName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${categoryColors[policy.category || policy.type || ""] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {(policy.category || policy.type || "general").replace("_", " ")}
                          </span>
                          {policy.isActive !== false && (
                            <span className="text-[10px] text-emerald-600 font-medium">Active</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDetach(policy._id)}
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors"
                      title="Detach policy"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick link */}
          {allPolicies.filter((p) => !p.isTemplate).length === 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                No policies created yet.{" "}
                <a href="/policies" className="font-semibold underline hover:text-blue-900">
                  Go to Policies
                </a>{" "}
                to create your first policy.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#F1F5F9]">
          <Button
            onClick={onClose}
            className="h-10 px-5 rounded-xl text-sm font-medium bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Directory Page ──

export default function DirectoryPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, onNotice: 0, departments: 0 });
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  // Policy state
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyEmployee, setPolicyEmployee] = useState<Employee | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterDept) params.departmentId = filterDept;
      if (filterStatus) params.status = filterStatus;

      const [empRes, deptRes, statsRes, desigRes, policiesRes] = await Promise.all([
        hrApi.getEmployees(params),
        hrApi.getDepartments(),
        hrApi.getStats(),
        hrApi.getDesignations(),
        policyApi.getAll().catch(() => ({ data: [] as Policy[] })),
      ]);

      // Filter out the currently logged-in user from directory
      const allEmps = empRes.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEmployees(allEmps.filter((e: any) => e.email !== user?.email));
      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setAllPolicies(policiesRes.data || []);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterStatus, user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const openAddModal = () => {
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setModalOpen(true);
  };

  const openPolicyModal = (emp: Employee) => {
    setPolicyEmployee(emp);
    setPolicyModalOpen(true);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const canManageEmployees = user.roles?.some((r) => ["admin", "super_admin", "hr"].includes(r));

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    try {
      await hrApi.deleteEmployee(deletingEmployee._id);
      toast.success("Employee removed successfully");
      setDeletingEmployee(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete employee");
    }
  };

  const getDeptName = (id?: string) => departments.find((d) => d._id === id)?.name || "\u2014";

  const initiateCall = async (emp: Employee, type: "audio" | "video") => {
    try {
      await callApi.create({
        receiverId: emp.userId || emp._id,
        receiverName: `${emp.firstName} ${emp.lastName}`,
        callerName: user ? `${user.firstName} ${user.lastName}` : undefined,
        type,
      } as Partial<CallLog>);
      toast.success(`${type === "video" ? "Video" : "Audio"} call initiated with ${emp.firstName}`);
      router.push("/calls");
    } catch {
      toast.error("Failed to initiate call");
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    on_notice: "bg-amber-50 text-amber-700 border-amber-200",
    exited: "bg-red-50 text-red-700 border-red-200",
    on_leave: "bg-blue-50 text-blue-700 border-blue-200",
    probation: "bg-violet-50 text-violet-700 border-violet-200",
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Employee Directory</h1>
            <p className="text-[13px] text-[#64748B] mt-1">Browse and manage your organization&apos;s team members</p>
          </div>
          {canManageEmployees && (
            <Button
              onClick={openAddModal}
              className="h-11 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium px-5 rounded-xl text-[15px]"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Employees", value: stats.total, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "text-blue-600 bg-blue-50" },
            { label: "Active", value: stats.active, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-emerald-600 bg-emerald-50" },
            { label: "On Notice", value: stats.onNotice, icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z", color: "text-amber-600 bg-amber-50" },
            { label: "Departments", value: stats.departments, icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "text-violet-600 bg-violet-50" },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748B]">{stat.label}</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-1">{stat.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Policy Reminder Banner */}
        {canManageEmployees && !loading && employees.length > 0 &&
          employees.some((e) => !e.policyIds || e.policyIds.length === 0) &&
          allPolicies.filter((p) => !p.isTemplate && p.isActive !== false).length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6 flex items-center justify-between">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">Some employees don&apos;t have policies attached.</p>
                <p className="text-[12px] text-blue-600 mt-0.5">
                  Create policies in{" "}
                  <a href="/policies" className="font-semibold underline hover:text-blue-800">Policies</a>
                  , then attach them to employees from their cards below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder="Search by name, email, ID, or skill..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 text-[15px] bg-[#F8FAFC] border-[#E2E8F0] rounded-xl"
                />
              </div>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#475569] min-w-[160px]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#475569] min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="on_notice">On Notice</option>
                <option value="probation">Probation</option>
                <option value="on_leave">On Leave</option>
              </select>
              <div className="flex border border-[#E2E8F0] rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 h-11 flex items-center ${viewMode === "grid" ? "bg-[#2E86C1] text-white" : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]"} transition-colors`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 h-11 flex items-center ${viewMode === "list" ? "bg-[#2E86C1] text-white" : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]"} transition-colors`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : employees.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#334155]">No employees found</p>
              <p className="text-[13px] text-[#94A3B8] mt-1">
                {search || filterDept || filterStatus ? "Try adjusting your filters" : "Add your first employee to get started"}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {employees.map((emp) => {
              const initials = `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase();
              return (
                <Card key={emp._id} className="border-0 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3.5 mb-4">
                      <Avatar className="h-12 w-12 bg-[#2E86C1] shrink-0">
                        <AvatarFallback className="bg-[#2E86C1] text-white font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-[13px] text-[#64748B] truncate">{emp.email}</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5 font-mono">{emp.employeeId}</p>
                      </div>
                      {canManageEmployees && (<>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(emp);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#2E86C1] shrink-0"
                          title="Edit employee"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingEmployee(emp);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-[#94A3B8] hover:text-red-500 shrink-0"
                          title="Delete employee"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>)}
                    </div>

                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#94A3B8]">Department</span>
                        <span className="text-[#334155] font-medium">{getDeptName(emp.departmentId)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#94A3B8]">Location</span>
                        <span className="text-[#334155]">{emp.location || "\u2014"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#94A3B8]">Type</span>
                        <span className="text-[#334155] capitalize">{emp.employmentType.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1F5F9]">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${statusColors[emp.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {emp.status.replace("_", " ")}
                      </span>
                      {emp.skills.length > 0 && (
                        <div className="flex gap-1">
                          {emp.skills.slice(0, 2).map((s) => (
                            <span key={s} className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                          {emp.skills.length > 2 && (
                            <span className="text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-full">+{emp.skills.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Policy Badges */}
                    {canManageEmployees && (
                      <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-[#94A3B8] font-medium">Policies</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPolicyModal(emp);
                            }}
                            className="text-[11px] font-medium text-[#2E86C1] hover:text-[#1A5276] transition-colors"
                          >
                            Manage
                          </button>
                        </div>
                        {(!emp.policyIds || emp.policyIds.length === 0) ? (
                          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
                            No policies attached
                          </p>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {emp.policyIds.slice(0, 2).map((pid) => {
                              const pol = allPolicies.find((p) => p._id === pid);
                              return (
                                <span key={pid} className="text-[10px] bg-[#EBF5FB] text-[#2E86C1] px-2 py-0.5 rounded-full border border-[#BEE3F8]">
                                  {pol ? pol.policyName : "Unknown"}
                                </span>
                              );
                            })}
                            {emp.policyIds.length > 2 && (
                              <span className="text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-full">+{emp.policyIds.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List view */
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#FAFBFC]">
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Employee</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">ID</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Department</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Location</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Type</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Status</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Skills</th>
                    {canManageEmployees && <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Policies</th>}
                    <th className="text-right text-xs font-semibold text-[#64748B] uppercase tracking-wider px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const initials = `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase();
                    return (
                      <tr key={emp._id} className="border-b border-[#F8FAFC] hover:bg-[#FAFBFC] transition-colors cursor-pointer group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 bg-[#2E86C1]">
                              <AvatarFallback className="bg-[#2E86C1] text-white text-xs font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-[13px] text-[#0F172A]">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-[#94A3B8]">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B] font-mono">{emp.employeeId}</td>
                        <td className="px-5 py-3.5 text-[13px] text-[#334155]">{getDeptName(emp.departmentId)}</td>
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B]">{emp.location || "\u2014"}</td>
                        <td className="px-5 py-3.5 text-[13px] text-[#64748B] capitalize">{emp.employmentType.replace("_", " ")}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${statusColors[emp.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {emp.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1 flex-wrap">
                            {emp.skills.slice(0, 3).map((s) => (
                              <span key={s} className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                            {emp.skills.length > 3 && (
                              <span className="text-[10px] text-[#94A3B8]">+{emp.skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        {canManageEmployees && (
                          <td className="px-5 py-3.5">
                            {(!emp.policyIds || emp.policyIds.length === 0) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPolicyModal(emp);
                                }}
                                className="text-[11px] text-amber-600 bg-amber-50 rounded-full px-2.5 py-1 border border-amber-200 hover:bg-amber-100 transition-colors"
                              >
                                Attach
                              </button>
                            ) : (
                              <div className="flex gap-1 flex-wrap items-center">
                                {emp.policyIds.slice(0, 2).map((pid) => {
                                  const pol = allPolicies.find((p) => p._id === pid);
                                  return (
                                    <span key={pid} className="text-[10px] bg-[#EBF5FB] text-[#2E86C1] px-2 py-0.5 rounded-full border border-[#BEE3F8]">
                                      {pol ? pol.policyName : "..."}
                                    </span>
                                  );
                                })}
                                {emp.policyIds.length > 2 && (
                                  <span className="text-[10px] text-[#94A3B8]">+{emp.policyIds.length - 2}</span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPolicyModal(emp);
                                  }}
                                  className="text-[10px] text-[#2E86C1] hover:text-[#1A5276] ml-1"
                                  title="Manage policies"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-right">
                          {canManageEmployees && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(emp);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2E86C1] hover:text-[#1A5276] px-2.5 py-1.5 rounded-lg hover:bg-[#EBF5FB]"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Employee Form Modal */}
      <EmployeeFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEmployee(null);
        }}
        onSaved={fetchData}
        employee={editingEmployee}
        departments={departments}
        designations={designations}
        employees={employees}
      />

      {/* Policy Management Modal */}
      <PolicyManageModal
        open={policyModalOpen}
        onClose={() => {
          setPolicyModalOpen(false);
          setPolicyEmployee(null);
        }}
        employee={policyEmployee}
        allPolicies={allPolicies}
        onUpdated={fetchData}
      />

      {/* Delete Confirmation Modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-[#0F172A] mb-1">Delete Employee</h3>
              <p className="text-[13px] text-[#64748B]">
                Are you sure you want to remove <span className="font-semibold text-[#334155]">{deletingEmployee.firstName} {deletingEmployee.lastName}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setDeletingEmployee(null)}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
