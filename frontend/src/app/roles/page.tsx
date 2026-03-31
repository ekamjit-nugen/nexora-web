"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { roleApi, Role, RolePermission } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { ConfirmModal } from "@/components/confirm-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

// ── Permission Matrix Definition ──

interface SectionDef {
  label: string;
  resources: { key: string; label: string; actions: string[] }[];
}

const SECTIONS: SectionDef[] = [
  {
    label: "Dashboard",
    resources: [{ key: "dashboard", label: "Dashboard", actions: ["view"] }],
  },
  {
    label: "People",
    resources: [
      { key: "employees", label: "Employees", actions: ["view", "create", "edit", "delete", "export", "assign"] },
      { key: "departments", label: "Departments", actions: ["view", "create", "edit", "delete"] },
      { key: "roles", label: "Roles", actions: ["view", "create", "edit", "delete"] },
    ],
  },
  {
    label: "Time & Attendance",
    resources: [
      { key: "attendance", label: "Attendance", actions: ["view", "create", "edit", "delete", "export"] },
      { key: "leaves", label: "Leaves", actions: ["view", "create", "edit", "delete", "export", "assign"] },
      { key: "policies", label: "Policies", actions: ["view", "create", "edit", "delete"] },
    ],
  },
  {
    label: "Finance",
    resources: [
      { key: "invoices", label: "Invoices", actions: ["view", "create", "edit", "delete", "export"] },
      { key: "expenses", label: "Expenses", actions: ["view", "create", "edit", "delete", "export"] },
      { key: "clients", label: "Clients", actions: ["view", "create", "edit", "delete"] },
    ],
  },
  {
    label: "System",
    resources: [
      { key: "reports", label: "Reports", actions: ["view", "export"] },
      { key: "settings", label: "Settings", actions: ["view", "edit"] },
    ],
  },
];

const ALL_RESOURCES = SECTIONS.flatMap((s) => s.resources);

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  export: "Export",
  assign: "Assign",
};

function hasPermission(role: Role, resource: string, action: string): boolean {
  const perm = role.permissions.find((p) => p.resource === resource);
  return perm ? perm.actions.includes(action) : false;
}

function countPermissions(permissions: RolePermission[]): number {
  return permissions.reduce((sum, p) => sum + p.actions.length, 0);
}

function toggleInPermissions(
  permissions: RolePermission[],
  resource: string,
  action: string
): RolePermission[] {
  const perms = permissions.map((p) => ({ resource: p.resource, actions: [...p.actions] }));
  const existing = perms.find((p) => p.resource === resource);
  if (existing) {
    if (existing.actions.includes(action)) {
      existing.actions = existing.actions.filter((a) => a !== action);
      if (existing.actions.length === 0) {
        return perms.filter((p) => p.resource !== resource);
      }
    } else {
      existing.actions.push(action);
    }
  } else {
    perms.push({ resource, actions: [action] });
  }
  return perms;
}

// ── Color presets ──
const COLOR_PRESETS = ["#7C3AED", "#4F46E5", "#2563EB", "#0D9488", "#D97706", "#EC4899", "#475569", "#DC2626", "#059669", "#8B5CF6"];

// ── Spinner SVG ──
function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-[#2E86C1] ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Checkbox component ──
function PermCheckbox({
  checked,
  disabled,
  saving,
  systemLocked,
  onClick,
  tooltip,
}: {
  checked: boolean;
  disabled?: boolean;
  saving?: boolean;
  systemLocked?: boolean;
  onClick?: () => void;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      title={tooltip}
      className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all mx-auto ${
        systemLocked
          ? checked
            ? "bg-[#CBD5E1] border-[#CBD5E1] text-white cursor-not-allowed"
            : "border-[#E2E8F0] cursor-not-allowed"
          : disabled
            ? "border-[#E2E8F0] cursor-not-allowed opacity-40"
            : checked
              ? "bg-[#2E86C1] border-[#2E86C1] text-white hover:bg-[#2471A3] hover:border-[#2471A3]"
              : "border-[#CBD5E1] hover:border-[#2E86C1]"
      }`}
    >
      {saving ? (
        <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : checked ? (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
    </button>
  );
}

// ── Main Page Component ──

export default function RolesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<{ _id: string; roles?: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  // Create role form state
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#475569");
  const [formPermissions, setFormPermissions] = useState<RolePermission[]>([]);
  const [formBaseRole, setFormBaseRole] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [modalCollapsed, setModalCollapsed] = useState<Set<number>>(new Set());

  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; variant?: "danger" | "warning" | "info"; confirmLabel?: string; action: () => void}>({open: false, title: "", message: "", action: () => {}});

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        roleApi.getRoles(),
        roleApi.getUsers(),
      ]);
      setRoles(rolesRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load roles";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Filter roles based on search
  const filteredRoles = useMemo(() => {
    if (!searchFilter.trim()) return roles;
    const q = searchFilter.toLowerCase();
    return roles.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [roles, searchFilter]);

  const getUserCountForRole = (roleName: string): number => {
    return users.filter((u) => u.roles?.includes(roleName)).length;
  };

  // ── Matrix inline toggle ──
  const toggleMatrixPermission = async (role: Role, resource: string, action: string) => {
    if (role.isSystem) return;
    const key = `${role._id}-${resource}-${action}`;
    setSavingCells((prev) => new Set(prev).add(key));

    const newPerms = toggleInPermissions(role.permissions, resource, action);

    try {
      await roleApi.updateRole(role._id, { permissions: newPerms });
      setRoles((prev) =>
        prev.map((r) => (r._id === role._id ? { ...r, permissions: newPerms } : r))
      );
    } catch {
      toast.error("Failed to update permission");
    } finally {
      setSavingCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // ── Select All for a role column ──
  const toggleAllForRole = async (role: Role, selectAll: boolean) => {
    if (role.isSystem) return;
    const newPerms: RolePermission[] = selectAll
      ? ALL_RESOURCES.map((r) => ({ resource: r.key, actions: [...r.actions] }))
      : [];

    const key = `bulk-${role._id}`;
    setSavingCells((prev) => new Set(prev).add(key));

    try {
      await roleApi.updateRole(role._id, { permissions: newPerms });
      setRoles((prev) =>
        prev.map((r) => (r._id === role._id ? { ...r, permissions: newPerms } : r))
      );
      toast.success(selectAll ? "All permissions granted" : "All permissions revoked", { duration: 1500 });
    } catch {
      toast.error("Failed to update permissions");
    } finally {
      setSavingCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // ── Select All for a row (give all roles a specific permission) ──
  const toggleAllForRow = async (resource: string, action: string, selectAll: boolean) => {
    const editableRoles = filteredRoles.filter((r) => !r.isSystem);
    const promises = editableRoles.map((role) => {
      const has = hasPermission(role, resource, action);
      if ((selectAll && has) || (!selectAll && !has)) return null;
      const newPerms = toggleInPermissions(role.permissions, resource, action);
      return roleApi.updateRole(role._id, { permissions: newPerms }).then(() => {
        setRoles((prev) =>
          prev.map((r) => (r._id === role._id ? { ...r, permissions: newPerms } : r))
        );
      });
    }).filter(Boolean);

    if (promises.length === 0) return;

    try {
      await Promise.all(promises);
      toast.success("Row permissions updated", { duration: 1500 });
    } catch {
      toast.error("Some permissions failed to update");
      fetchData();
    }
  };

  // ── Section collapse ──
  const toggleSection = (idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Modal form helpers ──
  const resetForm = () => {
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormColor("#475569");
    setFormPermissions([]);
    setFormBaseRole("");
    setSelectedRole(null);
    setModalCollapsed(new Set());
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormName(role.name);
    setFormDisplayName(role.displayName);
    setFormDescription(role.description);
    setFormColor(role.color);
    setFormPermissions(role.permissions.map((p) => ({ ...p, actions: [...p.actions] })));
    setFormBaseRole("");
    setShowCreateModal(true);
  };

  const applyBaseTemplate = (roleName: string) => {
    setFormBaseRole(roleName);
    if (!roleName) {
      setFormPermissions([]);
      return;
    }
    const base = roles.find((r) => r.name === roleName);
    if (base) {
      setFormPermissions(base.permissions.map((p) => ({ resource: p.resource, actions: [...p.actions] })));
    }
  };

  const toggleFormPermission = (resource: string, action: string) => {
    setFormPermissions((prev) => toggleInPermissions(prev, resource, action));
  };

  const toggleFormSelectAllSection = (sectionIdx: number, selectAll: boolean) => {
    const sec = SECTIONS[sectionIdx];
    setFormPermissions((prev) => {
      let perms = prev.map((p) => ({ resource: p.resource, actions: [...p.actions] }));
      sec.resources.forEach((res) => {
        if (selectAll) {
          const existing = perms.find((p) => p.resource === res.key);
          if (existing) {
            existing.actions = [...res.actions];
          } else {
            perms.push({ resource: res.key, actions: [...res.actions] });
          }
        } else {
          perms = perms.filter((p) => p.resource !== res.key);
        }
      });
      return perms;
    });
  };

  const handleSaveRole = async () => {
    if (!formName.trim() || !formDisplayName.trim()) {
      toast.error("Name and display name are required");
      return;
    }

    try {
      setSaving(true);
      if (selectedRole) {
        await roleApi.updateRole(selectedRole._id, {
          displayName: formDisplayName,
          description: formDescription,
          color: formColor,
          permissions: formPermissions,
        });
        toast.success("Role updated successfully");
      } else {
        await roleApi.createRole({
          name: formName,
          displayName: formDisplayName,
          description: formDescription,
          color: formColor,
          permissions: formPermissions,
        });
        toast.success("Role created successfully");
      }
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save role";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = (role: Role) => {
    if (role.isSystem) {
      toast.error("System roles cannot be deleted");
      return;
    }
    setConfirmState({
      open: true,
      title: "Delete Role",
      message: `Are you sure you want to delete the "${role.displayName}" role?`,
      variant: "danger",
      confirmLabel: "Delete",
      action: async () => {
        setConfirmState(s => ({...s, open: false}));
        try {
          await roleApi.deleteRole(role._id);
          toast.success("Role deleted successfully");
          fetchData();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete role";
          toast.error(message);
        }
      },
    });
  };

  // ── Auth guard ──
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Spinner />
      </div>
    );
  }

  const hasAccess = user.roles?.some((r) => ["admin", "super_admin"].includes(r));

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 ml-[260px] p-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="border-0 shadow-sm max-w-md w-full">
              <CardContent className="flex flex-col items-center justify-center py-16 px-8">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-[#0F172A] mb-2">Access Denied</h2>
                <p className="text-[13px] text-[#64748B] text-center mb-6">
                  You don&apos;t have permission to view this page. Contact your administrator.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white transition-colors"
                >
                  Go to Dashboard
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Calculate total perms for a role among all resources
  const totalPossiblePerms = ALL_RESOURCES.reduce((sum, r) => sum + r.actions.length, 0);

  return (
    <RouteGuard minOrgRole="admin">
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Roles &amp; Permissions</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Manage user roles and their access control across the platform
            </p>
          </div>
          <Button
            onClick={openCreateModal}
            className="h-10 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium px-4 rounded-xl text-[13px]"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Role
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Roles", value: roles.length, icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", color: "text-blue-600 bg-blue-50" },
            { label: "System Roles", value: roles.filter((r) => r.isSystem).length, icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", color: "text-violet-600 bg-violet-50" },
            { label: "Custom Roles", value: roles.filter((r) => !r.isSystem).length, icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", color: "text-emerald-600 bg-emerald-50" },
            { label: "Total Users", value: users.length, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "text-amber-600 bg-amber-50" },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748B]">{stat.label}</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-0.5">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Role Cards (horizontal scroll) */}
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {roles.map((role) => {
              const userCount = getUserCountForRole(role.name);
              const permCount = countPermissions(role.permissions);
              const permPercent = totalPossiblePerms > 0 ? Math.round((permCount / totalPossiblePerms) * 100) : 0;
              return (
                <div
                  key={role._id}
                  className="flex-shrink-0 w-[220px] bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-4"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[12px]"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{role.displayName}</p>
                        {role.isSystem && (
                          <svg className="w-3 h-3 text-[#94A3B8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </div>
                      <p className="text-[10px] text-[#94A3B8] font-mono">{role.name}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#64748B] line-clamp-2 mb-2 min-h-[30px]">
                    {role.description || "No description"}
                  </p>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-[#94A3B8] mb-0.5">
                      <span>{permCount} permissions</span>
                      <span>{permPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${permPercent}%`, backgroundColor: role.color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#64748B] mb-3">
                    <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{userCount} user{userCount !== 1 ? "s" : ""}</span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-[#F1F5F9]">
                    <button
                      onClick={() => openEditModal(role)}
                      className="flex-1 text-center py-1.5 text-[11px] font-medium text-[#2E86C1] hover:bg-[#EBF5FF] rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="flex-1 text-center py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permission Matrix */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-[13px] font-semibold text-[#0F172A]">Permission Matrix</h2>
              <p className="text-[11px] text-[#94A3B8]">
                Click checkboxes to toggle. System roles are locked.
              </p>
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter roles..."
                className="h-8 pl-8 w-48 text-[12px] bg-white border-[#E2E8F0] rounded-lg"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-[13px] text-[#94A3B8]">
                {searchFilter ? "No roles match your filter" : "No roles found. Create one to get started."}
              </p>
            </div>
          ) : (
            <div ref={matrixContainerRef} className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#FAFBFC] border-b border-[#E2E8F0]">
                    {/* Sticky first column header */}
                    <th className="text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-3 sticky left-0 bg-[#FAFBFC] z-30 min-w-[200px] border-r border-[#F1F5F9]">
                      Permission
                    </th>
                    {/* Row-level select all header */}
                    <th className="text-center px-1 py-3 min-w-[44px] bg-[#FAFBFC]">
                      <span className="text-[9px] font-semibold text-[#94A3B8] uppercase">All</span>
                    </th>
                    {filteredRoles.map((role) => {
                      return (
                        <th key={role._id} className="text-center px-1.5 py-3 min-w-[80px]">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-[9px]"
                              style={{ backgroundColor: role.color }}
                            >
                              {role.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] font-semibold text-[#334155] leading-tight">{role.displayName}</span>
                            {role.isSystem && (
                              <span className="text-[8px] text-[#94A3B8] leading-tight">locked</span>
                            )}
                            {/* Select/Deselect all for this role */}
                            {!role.isSystem && (
                              <div className="flex gap-0.5 mt-0.5">
                                <button
                                  onClick={() => toggleAllForRole(role, true)}
                                  disabled={savingCells.has(`bulk-${role._id}`)}
                                  title="Select all permissions"
                                  className="text-[8px] text-[#2E86C1] hover:underline disabled:opacity-50"
                                >
                                  All
                                </button>
                                <span className="text-[8px] text-[#CBD5E1]">/</span>
                                <button
                                  onClick={() => toggleAllForRole(role, false)}
                                  disabled={savingCells.has(`bulk-${role._id}`)}
                                  title="Deselect all permissions"
                                  className="text-[8px] text-[#94A3B8] hover:underline disabled:opacity-50"
                                >
                                  None
                                </button>
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((section, sIdx) => {
                    const isCollapsed = collapsedSections.has(sIdx);
                    const sectionRows: JSX.Element[] = [];

                    // Section header row
                    sectionRows.push(
                      <tr key={`sec-${sIdx}`} className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <td
                          className="px-4 py-2 sticky left-0 bg-[#F8FAFC] z-10 border-r border-[#F1F5F9] cursor-pointer select-none"
                          colSpan={1}
                          onClick={() => toggleSection(sIdx)}
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-3 h-3 text-[#94A3B8] transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                              {section.label}
                            </span>
                            <span className="text-[9px] text-[#94A3B8]">
                              {section.resources.length} resource{section.resources.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </td>
                        <td className="bg-[#F8FAFC]" />
                        {filteredRoles.map((role) => (
                          <td key={role._id} className="bg-[#F8FAFC]" />
                        ))}
                      </tr>
                    );

                    // Resource + action rows (if not collapsed)
                    if (!isCollapsed) {
                      section.resources.forEach((res, rIdx) => {
                        res.actions.forEach((action, aIdx) => {
                          const isFirstAction = aIdx === 0;
                          const isLastAction = aIdx === res.actions.length - 1;
                          const rowKey = `${res.key}-${action}`;

                          // Check if all editable roles have this permission (for row-level select-all)
                          const editableRoles = filteredRoles.filter((r) => !r.isSystem);
                          const allHave = editableRoles.length > 0 && editableRoles.every((r) => hasPermission(r, res.key, action));

                          sectionRows.push(
                            <tr
                              key={rowKey}
                              className={`border-b ${isLastAction && rIdx < section.resources.length - 1 ? "border-[#E2E8F0]" : "border-[#F8FAFC]"} hover:bg-[#FAFBFC] transition-colors`}
                            >
                              <td className="px-4 py-[7px] sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                                <div className="flex items-center gap-1">
                                  {isFirstAction && (
                                    <span className="text-[11px] font-semibold text-[#334155] mr-1.5">
                                      {res.label}
                                    </span>
                                  )}
                                  {!isFirstAction && <span className="w-[calc(11px*0+0px)] mr-1.5" />}
                                  <span
                                    className={`text-[11px] ${isFirstAction ? "text-[#64748B]" : "text-[#94A3B8]"} pl-${isFirstAction ? "0" : "2"}`}
                                    style={{ paddingLeft: isFirstAction ? 0 : undefined }}
                                  >
                                    {isFirstAction ? "" : ""}{ACTION_LABELS[action]}
                                  </span>
                                </div>
                              </td>
                              {/* Row-level select all */}
                              <td className="text-center px-1 py-[7px]">
                                <PermCheckbox
                                  checked={allHave}
                                  disabled={editableRoles.length === 0}
                                  onClick={() => toggleAllForRow(res.key, action, !allHave)}
                                  tooltip={allHave ? `Revoke ${res.label} ${action} from all roles` : `Grant ${res.label} ${action} to all roles`}
                                />
                              </td>
                              {filteredRoles.map((role) => {
                                const checked = hasPermission(role, res.key, action);
                                const cellKey = `${role._id}-${res.key}-${action}`;
                                const isSaving = savingCells.has(cellKey) || savingCells.has(`bulk-${role._id}`);

                                return (
                                  <td key={role._id} className="text-center px-1.5 py-[7px]">
                                    <PermCheckbox
                                      checked={checked}
                                      saving={isSaving}
                                      systemLocked={role.isSystem}
                                      disabled={role.isSystem}
                                      onClick={() => toggleMatrixPermission(role, res.key, action)}
                                      tooltip={`${role.displayName}: ${res.label} ${action}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      });
                    }

                    return sectionRows;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Mobile simplified list view */}
        <div className="mt-6 lg:hidden">
          <h3 className="text-[13px] font-semibold text-[#0F172A] mb-3">Roles Overview (Mobile)</h3>
          <div className="space-y-3">
            {roles.map((role) => (
              <Card key={role._id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-[11px]"
                        style={{ backgroundColor: role.color }}
                      >
                        {role.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#0F172A]">{role.displayName}</p>
                        <p className="text-[10px] text-[#94A3B8]">{countPermissions(role.permissions)} permissions</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openEditModal(role)}
                      className="text-[11px] text-[#2E86C1] font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <span key={p.resource} className="text-[9px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-full capitalize">
                        {p.resource} ({p.actions.length})
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* ── Create / Edit Role Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#E2E8F0] flex-shrink-0">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {selectedRole ? "Edit Role" : "Create New Role"}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#334155] mb-1">Role Name (slug)</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
                    placeholder="e.g. team_lead"
                    disabled={!!selectedRole}
                    className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#334155] mb-1">Display Name</label>
                  <Input
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Team Lead"
                    className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Description</label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this role"
                  className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-[#E2E8F0] cursor-pointer"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="#475569"
                    className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg w-28 font-mono"
                  />
                  <div className="flex gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFormColor(c)}
                        className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                          formColor === c ? "border-[#0F172A] scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Base Template (only for new roles) */}
              {!selectedRole && (
                <div>
                  <label className="block text-[12px] font-medium text-[#334155] mb-1">Copy Permissions From</label>
                  <select
                    value={formBaseRole}
                    onChange={(e) => applyBaseTemplate(e.target.value)}
                    className="h-9 w-full text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  >
                    <option value="">Start blank</option>
                    {roles.map((r) => (
                      <option key={r._id} value={r.name}>
                        {r.displayName} ({countPermissions(r.permissions)} permissions)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Permissions grid in modal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[12px] font-medium text-[#334155]">
                    Permissions ({formPermissions.reduce((s, p) => s + p.actions.length, 0)} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPermissions(ALL_RESOURCES.map((r) => ({ resource: r.key, actions: [...r.actions] })))}
                      className="text-[10px] text-[#2E86C1] hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPermissions([])}
                      className="text-[10px] text-[#94A3B8] hover:underline font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                  {SECTIONS.map((section, sIdx) => {
                    const isCollapsed = modalCollapsed.has(sIdx);
                    // Check if all perms in section are selected
                    const allInSection = section.resources.every((res) =>
                      res.actions.every((act) =>
                        formPermissions.some((p) => p.resource === res.key && p.actions.includes(act))
                      )
                    );

                    return (
                      <div key={sIdx}>
                        {/* Section header */}
                        <div
                          className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] cursor-pointer select-none"
                          onClick={() => {
                            setModalCollapsed((prev) => {
                              const next = new Set(prev);
                              if (next.has(sIdx)) next.delete(sIdx);
                              else next.add(sIdx);
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-3 h-3 text-[#94A3B8] transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                              {section.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFormSelectAllSection(sIdx, !allInSection);
                            }}
                            className="text-[9px] text-[#2E86C1] hover:underline font-medium"
                          >
                            {allInSection ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        {/* Section content */}
                        {!isCollapsed && (
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[#F1F5F9]">
                                <th className="text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-1.5 w-[140px]">
                                  Resource
                                </th>
                                {["view", "create", "edit", "delete", "export", "assign"].map((act) => (
                                  <th key={act} className="text-center text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wider px-1 py-1.5 w-[60px]">
                                    {ACTION_LABELS[act]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.resources.map((res) => (
                                <tr key={res.key} className="border-b border-[#F8FAFC] last:border-b-0 hover:bg-[#FAFBFC]">
                                  <td className="px-3 py-2 text-[12px] font-medium text-[#334155]">
                                    {res.label}
                                  </td>
                                  {["view", "create", "edit", "delete", "export", "assign"].map((act) => {
                                    const available = res.actions.includes(act);
                                    const checked = formPermissions.some(
                                      (p) => p.resource === res.key && p.actions.includes(act)
                                    );
                                    return (
                                      <td key={act} className="text-center px-1 py-2">
                                        {available ? (
                                          <PermCheckbox
                                            checked={checked}
                                            onClick={() => toggleFormPermission(res.key, act)}
                                            tooltip={`${res.label}: ${act}`}
                                          />
                                        ) : (
                                          <span className="block w-[18px] h-[18px] mx-auto text-[#E2E8F0] text-center text-[10px] leading-[18px]">
                                            &mdash;
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-[#E2E8F0] flex-shrink-0">
              <Button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="h-9 px-4 rounded-lg text-[13px] bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={saving}
                className="h-9 px-5 rounded-lg text-[13px] bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium"
              >
                {saving ? "Saving..." : selectedRole ? "Update Role" : "Create Role"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(s => ({...s, open: false}))}
      />
    </div>
    </RouteGuard>
  );
}
