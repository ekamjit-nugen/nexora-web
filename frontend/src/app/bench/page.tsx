"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  benchApi, projectApi,
  BenchOverview, BenchEmployee, ResourceRequest, BenchAnalytics, Project,
} from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
const PRIORITY_COLORS: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#94A3B8" };
const STATUS_COLORS: Record<string, string> = { open: "#3B82F6", matched: "#10B981", partially_filled: "#F59E0B", closed: "#6B7280", cancelled: "#94A3B8" };

type Tab = "overview" | "employees" | "requests" | "analytics";

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
      <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-[#0F172A]"}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse">
          <div className="h-3 bg-[#E2E8F0] rounded w-20 mb-3" />
          <div className="h-7 bg-[#E2E8F0] rounded w-14" />
        </div>
      ))}
    </div>
  );
}

function formatCurrency(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
}

export default function BenchManagementPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<BenchOverview | null>(null);
  const [analytics, setAnalytics] = useState<BenchAnalytics | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Employee filters
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("");
  const [empSkillFilter, setEmpSkillFilter] = useState("");

  // Resource request form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    projectId: "", projectName: "", title: "", requiredSkills: "", preferredSkills: "",
    allocationPercentage: 100, priority: "medium",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, analyticsRes, trendsRes, requestsRes, projRes] = await Promise.allSettled([
        benchApi.getOverview(),
        benchApi.getAnalytics(),
        benchApi.getTrends({ fromDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
        benchApi.getResourceRequests(),
        projectApi.getAll({ status: "active" }),
      ]);

      if (overviewRes.status === "fulfilled") setOverview(overviewRes.value.data as any);
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value.data as any);
      if (trendsRes.status === "fulfilled") setTrends((trendsRes.value.data as any) || []);
      if (requestsRes.status === "fulfilled") setRequests(((requestsRes.value as any).data) || []);
      if (projRes.status === "fulfilled") setProjects(Array.isArray(projRes.value.data) ? projRes.value.data : []);
    } catch (err) {
      toast.error("Failed to load bench data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasOrgRole("manager")) { router.push("/dashboard"); return; }
    fetchData();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  // Filtered employees
  const filteredEmployees = (overview?.benchEmployees || []).filter(emp => {
    if (empSearch && !emp.name.toLowerCase().includes(empSearch.toLowerCase()) && !emp.employeeId.toLowerCase().includes(empSearch.toLowerCase())) return false;
    if (empDeptFilter && emp.departmentId !== empDeptFilter) return false;
    if (empSkillFilter && !emp.skills.some(s => s.toLowerCase().includes(empSkillFilter.toLowerCase()))) return false;
    return true;
  });

  const departments = overview?.departmentBreakdown || [];
  const uniqueDepts = departments.filter(d => d.departmentId !== "unassigned");

  const handleCreateRequest = async () => {
    if (!formData.projectId || !formData.title || !formData.requiredSkills) {
      toast.error("Project, title, and required skills are mandatory");
      return;
    }
    try {
      const proj = projects.find(p => p._id === formData.projectId);
      await benchApi.createResourceRequest({
        ...formData,
        projectName: proj?.projectName || "",
        requiredSkills: formData.requiredSkills.split(",").map(s => s.trim()).filter(Boolean),
        preferredSkills: formData.preferredSkills ? formData.preferredSkills.split(",").map(s => s.trim()).filter(Boolean) : [],
      });
      toast.success("Resource request created");
      setShowCreateForm(false);
      setFormData({ projectId: "", projectName: "", title: "", requiredSkills: "", preferredSkills: "", allocationPercentage: 100, priority: "medium" });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    }
  };

  const handleMatchAction = async (requestId: string, userId: string, status: string) => {
    try {
      await benchApi.updateMatch(requestId, userId, { status });
      toast.success(`Match ${status}`);
      fetchData();
    } catch (err) {
      toast.error("Failed to update match");
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "employees", label: "Bench Employees" },
    { key: "requests", label: "Resource Requests" },
    { key: "analytics", label: "Analytics" },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Bench Management</h1>
            <p className="text-sm text-[#64748B] mt-1">Track unbilled resources, costs, and skill availability</p>
          </div>
          <Button
            onClick={() => benchApi.takeSnapshot().then(() => toast.success("Snapshot taken")).catch(() => toast.error("Failed"))}
            className="bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0] text-sm"
          >
            Take Snapshot
          </Button>
        </div>

        {/* Summary Stats */}
        {loading ? (
          <SkeletonCards count={7} />
        ) : overview ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <StatCard label="Total Employees" value={overview.totalEmployees} />
            <StatCard label="On Bench" value={overview.benchCount} color="text-[#EF4444]" />
            <StatCard label="Partial" value={overview.partiallyAllocatedCount} color="text-[#F59E0B]" />
            <StatCard label="Allocated" value={overview.allocatedCount} color="text-[#10B981]" />
            <StatCard label="Bench %" value={`${overview.benchPercentage}%`} color={overview.benchPercentage > 30 ? "text-[#EF4444]" : overview.benchPercentage > 15 ? "text-[#F59E0B]" : "text-[#10B981]"} />
            <StatCard label="Daily Cost" value={formatCurrency(overview.benchCostDaily)} color="text-[#EF4444]" sub="bench burn" />
            <StatCard label="Monthly Cost" value={formatCurrency(overview.benchCostMonthly)} color="text-[#EF4444]" sub="bench burn" />
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-[#E2E8F0] w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Bench by Department</h3>
              {departments.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={departments}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="departmentName" tick={{ fontSize: 11, fill: "#64748B" }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                    <Legend />
                    <Bar dataKey="benchCount" name="On Bench" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="allocatedCount" name="Allocated" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No department data</div>
              )}
            </div>

            {/* Skills on Bench */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Top Skills on Bench</h3>
              {overview.skillBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={overview.skillBreakdown.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#64748B" }} />
                    <YAxis type="category" dataKey="skill" tick={{ fontSize: 11, fill: "#64748B" }} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                    <Bar dataKey="benchCount" name="On Bench" fill="#EF4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No skill data</div>
              )}
            </div>

            {/* Bench Cost Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Bench Cost Trend (Last 90 Days)</h3>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trends.map(t => ({ ...t, date: new Date(t.snapshotDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), cost: t.benchCostDaily }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748B" }} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), "Daily Bench Cost"]} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                    <Line type="monotone" dataKey="cost" stroke="#EF4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-[#94A3B8] text-sm">No trend data yet — snapshots build over time</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "employees" && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0]">
            {/* Filters */}
            <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap gap-3">
              <Input placeholder="Search by name or ID..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="w-60 text-sm" />
              <select value={empDeptFilter} onChange={e => setEmpDeptFilter(e.target.value)} className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                <option value="">All Departments</option>
                {uniqueDepts.map(d => <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>)}
              </select>
              <Input placeholder="Filter by skill..." value={empSkillFilter} onChange={e => setEmpSkillFilter(e.target.value)} className="w-48 text-sm" />
              <span className="ml-auto text-sm text-[#64748B] self-center">{filteredEmployees.length} employees</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">ID</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">Skills</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">Days on Bench</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">Allocation</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">Daily Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.userId} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#0F172A]">{emp.name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{emp.employeeId}</td>
                      <td className="px-4 py-3 text-[#64748B]">{emp.departmentName}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {emp.skills.slice(0, 4).map(s => (
                            <span key={s} className="px-2 py-0.5 bg-[#F1F5F9] text-[#334155] rounded text-[11px] font-medium">{s}</span>
                          ))}
                          {emp.skills.length > 4 && <span className="px-2 py-0.5 text-[#94A3B8] text-[11px]">+{emp.skills.length - 4}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${emp.benchSinceDays > 30 ? "text-[#EF4444]" : emp.benchSinceDays > 14 ? "text-[#F59E0B]" : "text-[#64748B]"}`}>
                          {emp.benchSinceDays > 0 ? `${emp.benchSinceDays}d` : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${emp.allocationPercentage === 0 ? "text-[#EF4444]" : "text-[#F59E0B]"}`}>
                          {emp.allocationPercentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#EF4444]">{formatCurrency(emp.dailyCost)}</td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[#94A3B8]">No bench employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "requests" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-[#0F172A]">{requests.length} Resource Request{requests.length !== 1 ? "s" : ""}</h3>
              <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-[#2E86C1] text-white text-sm">
                {showCreateForm ? "Cancel" : "New Request"}
              </Button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
                <h4 className="text-sm font-semibold text-[#0F172A] mb-4">Create Resource Request</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[#64748B] mb-1 block">Project *</label>
                    <select
                      value={formData.projectId}
                      onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white"
                    >
                      <option value="">Select project...</option>
                      {projects.map(p => <option key={p._id} value={p._id}>{p.projectName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] mb-1 block">Title *</label>
                    <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Senior React Developer" className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] mb-1 block">Required Skills * (comma-separated)</label>
                    <Input value={formData.requiredSkills} onChange={e => setFormData({ ...formData, requiredSkills: e.target.value })} placeholder="React, Node.js, TypeScript" className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] mb-1 block">Preferred Skills (comma-separated)</label>
                    <Input value={formData.preferredSkills} onChange={e => setFormData({ ...formData, preferredSkills: e.target.value })} placeholder="AWS, Docker" className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] mb-1 block">Allocation %</label>
                    <Input type="number" value={formData.allocationPercentage} onChange={e => setFormData({ ...formData, allocationPercentage: Number(e.target.value) })} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] mb-1 block">Priority</label>
                    <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleCreateRequest} className="bg-[#2E86C1] text-white text-sm">Create & Match</Button>
                </div>
              </div>
            )}

            {/* Request List */}
            <div className="space-y-4">
              {requests.map(req => (
                <div key={req._id} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#94A3B8]">{req.requestId}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: PRIORITY_COLORS[req.priority] }}>{req.priority.toUpperCase()}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: STATUS_COLORS[req.status] }}>{req.status.replace("_", " ").toUpperCase()}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-[#0F172A] mt-1">{req.title}</h4>
                      <p className="text-xs text-[#64748B]">{req.projectName} · {req.allocationPercentage}% allocation</p>
                    </div>
                    <div className="flex gap-1">
                      {req.requiredSkills?.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-[#DBEAFE] text-[#1E40AF] rounded text-[10px] font-medium">{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Matched Employees */}
                  {req.matchedEmployees?.length > 0 && (
                    <div className="mt-3 border-t border-[#F1F5F9] pt-3">
                      <p className="text-xs font-medium text-[#64748B] mb-2">{req.matchedEmployees.length} matches found</p>
                      <div className="space-y-2">
                        {req.matchedEmployees.map(match => (
                          <div key={match.userId} className="flex items-center justify-between py-2 px-3 bg-[#F8FAFC] rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#2E86C1] text-white flex items-center justify-center text-xs font-bold">
                                {match.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#0F172A]">{match.name}</p>
                                <div className="flex gap-1 mt-0.5">
                                  {match.skills?.slice(0, 3).map(s => (
                                    <span key={s} className="px-1.5 py-0 bg-[#E2E8F0] text-[#475569] rounded text-[9px]">{s}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-[#2E86C1]">{match.matchScore}pts</span>
                              {match.status === "suggested" ? (
                                <div className="flex gap-1">
                                  <button onClick={() => handleMatchAction(req._id, match.userId, "approved")} className="px-2 py-1 bg-[#10B981] text-white rounded text-[10px] font-medium hover:bg-[#059669]">Approve</button>
                                  <button onClick={() => handleMatchAction(req._id, match.userId, "rejected")} className="px-2 py-1 bg-[#F1F5F9] text-[#64748B] rounded text-[10px] font-medium hover:bg-[#E2E8F0]">Reject</button>
                                </div>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${match.status === "approved" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                                  {match.status.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {requests.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center text-[#94A3B8] text-sm">
                  No resource requests yet. Create one to find matching bench employees.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Metrics */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Key Metrics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#64748B]">Average Days on Bench</span>
                  <span className={`text-lg font-bold ${analytics.averageBenchDays > 30 ? "text-[#EF4444]" : "text-[#0F172A]"}`}>{analytics.averageBenchDays} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#64748B]">Current Bench %</span>
                  <span className="text-lg font-bold text-[#0F172A]">{analytics.current.benchPercentage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#64748B]">Daily Bench Burn</span>
                  <span className="text-lg font-bold text-[#EF4444]">{formatCurrency(analytics.current.benchCostDaily)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#64748B]">Monthly Bench Burn</span>
                  <span className="text-lg font-bold text-[#EF4444]">{formatCurrency(analytics.current.benchCostMonthly)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#64748B]">Trend Data Points</span>
                  <span className="text-lg font-bold text-[#0F172A]">{analytics.trendDataPoints}</span>
                </div>
              </div>
            </div>

            {/* Top Skills on Bench */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Most Common Skills on Bench</h3>
              {analytics.topBenchSkills.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.topBenchSkills} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#64748B" }} />
                    <YAxis type="category" dataKey="skill" tick={{ fontSize: 11, fill: "#64748B" }} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }} />
                    <Bar dataKey="count" name="Employees" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[#94A3B8] text-sm">No data</div>
              )}
            </div>

            {/* Department Bench % */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Bench % by Department</h3>
              {analytics.departmentBenchPercentages.length > 0 ? (
                <div className="space-y-3">
                  {analytics.departmentBenchPercentages
                    .filter(d => d.departmentId !== "unassigned")
                    .sort((a, b) => b.benchPercentage - a.benchPercentage)
                    .map((d, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-[160px] text-xs font-medium text-[#334155] truncate">{d.departmentName}</div>
                        <div className="flex-1 bg-[#F1F5F9] rounded-full h-5 relative overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${d.benchPercentage}%`,
                              backgroundColor: d.benchPercentage > 40 ? "#EF4444" : d.benchPercentage > 20 ? "#F59E0B" : "#10B981",
                            }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#334155]">
                            {d.benchPercentage}% ({d.benchCount} of {d.benchCount + d.allocatedCount})
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#94A3B8] text-sm">No department data</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
