"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { hrApi, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// /org-chart — hierarchical employee org chart.
//
// Two view modes:
//   • Tree   — proper top-down tree with boxes + connector lines. The CEO
//              (or whoever has no manager) sits at the top, direct reports
//              fan out below. Each card shows avatar / name / role / dept
//              and a "# reports" chip; clicking expands or collapses.
//   • List   — denser indented list view for quick name search.
//
// Stats header gives at-a-glance organisational shape: total people,
// number of managers (anyone with at least one report), max depth,
// orphan count (anyone whose reportingManagerId points at nothing).
// ─────────────────────────────────────────────────────────────────────────────

interface OrgNode {
  employee: Employee;
  children: OrgNode[];
  depth: number;
}

function buildTree(employees: Employee[]): {
  roots: OrgNode[];
  byId: Map<string, OrgNode>;
  maxDepth: number;
} {
  const byId = new Map<string, OrgNode>();
  employees.forEach((e) => {
    byId.set(e._id, { employee: e, children: [], depth: 0 });
    if (e.userId) byId.set(e.userId, byId.get(e._id)!);
  });

  const roots: OrgNode[] = [];
  employees.forEach((e) => {
    const node = byId.get(e._id);
    if (!node) return;
    if (!e.reportingManagerId) {
      roots.push(node);
    } else {
      const parent = byId.get(e.reportingManagerId);
      if (parent && parent !== node) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  // Stamp depth + sort children by name for stable rendering.
  let maxDepth = 0;
  const stamp = (node: OrgNode, d: number) => {
    node.depth = d;
    if (d > maxDepth) maxDepth = d;
    node.children.sort((a, b) =>
      `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
        `${b.employee.firstName} ${b.employee.lastName}`,
      ),
    );
    node.children.forEach((c) => stamp(c, d + 1));
  };
  roots.forEach((r) => stamp(r, 0));
  roots.sort((a, b) =>
    `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
      `${b.employee.firstName} ${b.employee.lastName}`,
    ),
  );
  return { roots, byId, maxDepth };
}

function getInitials(emp: Employee): string {
  return (
    `${emp.firstName?.charAt(0) || ""}${emp.lastName?.charAt(0) || ""}`.toUpperCase() || "?"
  );
}

// Tone palette — keyed by hash of the employee id so the same person
// always gets the same colour across renders. Same family the rest of
// the app uses elsewhere (avatar dot in the header, etc.).
const AVATAR_TONES = [
  { bg: "bg-indigo-100",  fg: "text-indigo-700",  ring: "ring-indigo-200" },
  { bg: "bg-violet-100",  fg: "text-violet-700",  ring: "ring-violet-200" },
  { bg: "bg-emerald-100", fg: "text-emerald-700", ring: "ring-emerald-200" },
  { bg: "bg-amber-100",   fg: "text-amber-700",   ring: "ring-amber-200" },
  { bg: "bg-rose-100",    fg: "text-rose-700",    ring: "ring-rose-200" },
  { bg: "bg-teal-100",    fg: "text-teal-700",    ring: "ring-teal-200" },
  { bg: "bg-sky-100",     fg: "text-sky-700",     ring: "ring-sky-200" },
  { bg: "bg-orange-100",  fg: "text-orange-700",  ring: "ring-orange-200" },
];
function avatarTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

function deptName(emp: Employee): string {
  return (
    (emp as any).department?.name ||
    (emp as any).departmentName ||
    emp.departmentId ||
    ""
  );
}

function roleName(emp: Employee): string {
  return (
    (emp as any).designation?.title ||
    (emp as any).designationName ||
    emp.designationId ||
    "—"
  );
}

export default function OrgChartPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"tree" | "list">("tree");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    hrApi
      .getEmployees({ status: "active" })
      .then((res) => {
        const emps = Array.isArray(res.data) ? res.data : [];
        setEmployees(emps);
      })
      .catch((err: any) => toast.error(err.message || "Failed to load employees"))
      .finally(() => setLoading(false));
  }, [user]);

  const { roots, maxDepth } = useMemo(() => buildTree(employees), [employees]);

  // ─── Stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const managerIds = new Set<string>();
    employees.forEach((e) => {
      if (e.reportingManagerId) managerIds.add(e.reportingManagerId);
    });
    const departments = new Set<string>();
    employees.forEach((e) => {
      const d = deptName(e);
      if (d) departments.add(d);
    });
    return {
      total: employees.length,
      managers: managerIds.size,
      departments: departments.size,
      layers: maxDepth + 1,
    };
  }, [employees, maxDepth]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  const searchLower = search.trim().toLowerCase();

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Org Chart</h1>
            <p className="mt-1 text-[13px] text-[#94A3B8]">
              How your team reports up — managers and direct reports at a glance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, role..."
                className="h-9 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] pl-9 text-sm"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1">
              <button
                onClick={() => setView("tree")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  view === "tree"
                    ? "bg-[#2E86C1] text-white"
                    : "text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
                title="Tree view"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="5" y="1" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="1" y="9.5" width="3.5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="5.25" y="9.5" width="3.5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="9.5" y="9.5" width="3.5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7 4.5v2M2.75 6.5h8.5v2.5M7 6.5v2.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                Tree
              </button>
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  view === "list"
                    ? "bg-[#2E86C1] text-white"
                    : "text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
                title="List view"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                List
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="People"
            value={stats.total}
            cornerColor="bg-blue-50"
            iconBg="bg-blue-100"
            iconColor="text-[#2E86C1]"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />}
          />
          <StatCard
            label="Managers"
            value={stats.managers}
            cornerColor="bg-violet-50"
            iconBg="bg-violet-100"
            iconColor="text-violet-700"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
          />
          <StatCard
            label="Departments"
            value={stats.departments}
            cornerColor="bg-emerald-50"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-700"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
          />
          <StatCard
            label="Layers"
            value={stats.layers}
            cornerColor="bg-amber-50"
            iconBg="bg-amber-100"
            iconColor="text-amber-700"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
          />
        </div>

        {/* Body */}
        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center justify-center p-16 text-sm text-[#94A3B8]">
              Loading employees…
            </CardContent>
          </Card>
        ) : employees.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-3 text-4xl">🏢</div>
              <h3 className="text-lg font-bold text-[#0F172A]">
                No employees yet
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Add employees in the Directory to see the org chart take shape.
              </p>
            </CardContent>
          </Card>
        ) : view === "tree" ? (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-8 overflow-x-auto">
              <div className="min-w-max flex flex-col items-center gap-12">
                {roots.map((root) => (
                  <TreeNode
                    key={root.employee._id}
                    node={root}
                    searchLower={searchLower}
                    isRoot
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              {roots.map((root) => (
                <ListNode
                  key={root.employee._id}
                  node={root}
                  depth={0}
                  searchLower={searchLower}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card — 4-tile header strip.
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  cornerColor,
  iconBg,
  iconColor,
  icon,
}: {
  label: string;
  value: number;
  cornerColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className={`absolute right-0 top-0 -mr-2 -mt-2 h-20 w-20 rounded-bl-[60px] ${cornerColor}`} />
      <CardContent className="relative p-5">
        <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <svg className={`h-4 w-4 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icon}
          </svg>
        </div>
        <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
        <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree view — proper top-down org chart with connector lines.
//
// Layout strategy: each node renders as a centered card with its children
// laid out in a horizontal flex row below. A vertical line drops from the
// card down to a horizontal "trunk" that spans the children, with another
// short vertical line from the trunk into each child. Pure CSS borders —
// no SVG, no measurement code, scales with content.
// ─────────────────────────────────────────────────────────────────────────────
function TreeNode({
  node,
  searchLower,
  isRoot,
}: {
  node: OrgNode;
  searchLower: string;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(node.depth < 2);
  const emp = node.employee;
  const tone = avatarTone(emp._id);

  const matchesSearch =
    !searchLower ||
    `${emp.firstName} ${emp.lastName} ${roleName(emp)}`
      .toLowerCase()
      .includes(searchLower);

  const hasMatchingDescendant = useCallback(
    (n: OrgNode): boolean => {
      const txt =
        `${n.employee.firstName} ${n.employee.lastName} ${roleName(n.employee)}`.toLowerCase();
      if (txt.includes(searchLower)) return true;
      return n.children.some(hasMatchingDescendant);
    },
    [searchLower],
  );
  if (searchLower && !hasMatchingDescendant(node)) return null;

  const showChildren = expanded && node.children.length > 0;
  const reportCount = countDescendants(node);

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <button
        type="button"
        onClick={() => node.children.length > 0 && setExpanded((v) => !v)}
        className={`group relative w-[240px] rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-all ${
          matchesSearch && searchLower
            ? "border-[#2E86C1] ring-2 ring-[#2E86C1]/20"
            : "border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-md"
        }`}
      >
        {isRoot && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#2E86C1] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
            Top
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ring-2 ${tone.bg} ${tone.ring}`}>
            <span className={`text-sm font-bold ${tone.fg}`}>
              {getInitials(emp)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-[#0F172A]">
              {emp.firstName} {emp.lastName}
            </p>
            <p className="truncate text-[11px] font-medium text-[#475569]">
              {roleName(emp)}
            </p>
            {deptName(emp) && (
              <p className="truncate text-[10px] text-[#94A3B8]">
                {deptName(emp)}
              </p>
            )}
          </div>
        </div>
        {node.children.length > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {node.children.length} direct · {reportCount - 1} total
            </span>
            <svg
              className={`h-3.5 w-3.5 text-[#94A3B8] transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </button>

      {/* Connectors + children */}
      {showChildren && (
        <>
          {/* Vertical line from card down to the trunk */}
          <div className="h-6 w-px bg-[#CBD5E1]" />
          {/* Horizontal trunk + short verticals to each child */}
          <div className="relative flex items-start">
            {/* Trunk — only visible when there's more than one child */}
            {node.children.length > 1 && (
              <div className="absolute left-[120px] right-[120px] top-0 h-px bg-[#CBD5E1]" />
            )}
            <div className="flex items-start gap-6">
              {node.children.map((child) => (
                <div key={child.employee._id} className="flex flex-col items-center">
                  <div className="h-6 w-px bg-[#CBD5E1]" />
                  <TreeNode node={child} searchLower={searchLower} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function countDescendants(node: OrgNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countDescendants(c), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// List view — denser indented version. Useful when the team is huge and the
// tree view scrolls horizontally too much.
// ─────────────────────────────────────────────────────────────────────────────
function ListNode({
  node,
  depth,
  searchLower,
}: {
  node: OrgNode;
  depth: number;
  searchLower: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const emp = node.employee;
  const tone = avatarTone(emp._id);
  const hasChildren = node.children.length > 0;

  const matchesSearch =
    !searchLower ||
    `${emp.firstName} ${emp.lastName} ${roleName(emp)}`
      .toLowerCase()
      .includes(searchLower);

  const hasMatchingDescendant = useCallback(
    (n: OrgNode): boolean => {
      const txt =
        `${n.employee.firstName} ${n.employee.lastName} ${roleName(n.employee)}`.toLowerCase();
      if (txt.includes(searchLower)) return true;
      return n.children.some(hasMatchingDescendant);
    },
    [searchLower],
  );
  if (searchLower && !hasMatchingDescendant(node)) return null;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-[#F1F5F9] pl-4" : ""}>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((v) => !v)}
        className={`my-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
          matchesSearch && searchLower
            ? "border-[#2E86C1] bg-[#EBF5FB]"
            : "border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC]"
        }`}
      >
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone.bg}`}>
          <span className={`text-xs font-bold ${tone.fg}`}>
            {getInitials(emp)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[#0F172A]">
            {emp.firstName} {emp.lastName}
          </p>
          <p className="truncate text-[11px] text-[#64748B]">
            {roleName(emp)}
            {deptName(emp) ? ` · ${deptName(emp)}` : ""}
          </p>
        </div>
        {hasChildren && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#94A3B8]">
            <span>{node.children.length}</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ListNode
              key={child.employee._id}
              node={child}
              depth={depth + 1}
              searchLower={searchLower}
            />
          ))}
        </div>
      )}
    </div>
  );
}
