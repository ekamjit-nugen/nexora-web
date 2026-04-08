"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { clientPortalApi, ClientPortalData, ClientFeedbackItem } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ── Types ──

type PortalTab = "overview" | "milestones" | "budget" | "feedback";

// ── Status Helpers ──

const statusColors: Record<string, string> = {
  planning: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  missed: "bg-red-100 text-red-700",
  planned: "bg-slate-100 text-slate-600",
  released: "bg-emerald-100 text-emerald-700",
  archived: "bg-gray-100 text-gray-500",
};

const feedbackStatusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewed: "bg-purple-100 text-purple-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

function StatusBadge({ status, colorMap = statusColors }: { status: string; colorMap?: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

// ── Health Indicator ──

function HealthIndicator({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 75 ? "bg-emerald-50" : score >= 50 ? "bg-amber-50" : "bg-red-50";
  const label = score >= 75 ? "Healthy" : score >= 50 ? "At Risk" : "Critical";

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bgColor}`}>
      <div className={`w-2 h-2 rounded-full ${score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"}`} />
      <span className={`text-sm font-medium ${color}`}>{label} ({score}%)</span>
    </div>
  );
}

// ── Progress Ring ──

function ProgressRing({ percentage, size = 140, strokeWidth = 10 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? "#10B981" : percentage >= 50 ? "#F59E0B" : percentage >= 25 ? "#F97316" : "#EF4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-800">{percentage}%</span>
        <span className="text-xs text-slate-500 mt-0.5">Complete</span>
      </div>
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({ data }: { data: ClientPortalData }) {
  const totalMilestones = data.milestones.length;
  const completedMilestones = data.milestones.filter(m => m.status === "completed").length;
  const upcomingMilestones = data.milestones.filter(m => m.status === "pending" || m.status === "in_progress").length;
  const atRiskMilestones = data.milestones.filter(m => {
    if (m.status === "completed" || m.status === "missed") return false;
    return new Date(m.targetDate) < new Date();
  }).length;

  return (
    <div className="space-y-6">
      {/* Progress + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <ProgressRing percentage={data.progressPercentage} />
            <p className="text-sm text-slate-500 mt-3">Overall Progress</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Milestone Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-slate-800">{totalMilestones}</p>
                <p className="text-xs text-slate-500 mt-1">Total</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50">
                <p className="text-2xl font-bold text-emerald-600">{completedMilestones}</p>
                <p className="text-xs text-emerald-600 mt-1">Completed</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold text-blue-600">{upcomingMilestones}</p>
                <p className="text-xs text-blue-600 mt-1">In Progress</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50">
                <p className="text-2xl font-bold text-red-600">{atRiskMilestones}</p>
                <p className="text-xs text-red-600 mt-1">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Updates + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Recent Updates</h3>
            {data.recentUpdates.length === 0 ? (
              <p className="text-sm text-slate-400">No recent updates</p>
            ) : (
              <div className="space-y-0">
                {data.recentUpdates.slice(0, 5).map((update, i) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700">{update.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{update.description}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(update.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Team Members</h3>
            {data.team.length === 0 ? (
              <p className="text-sm text-slate-400">No team members listed</p>
            ) : (
              <div className="space-y-2">
                {data.team.map((member, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                      {member.userId.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{member.userId}</p>
                      <p className="text-xs text-slate-500">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Milestones Tab ──

function MilestonesTab({ data }: { data: ClientPortalData }) {
  const sortedMilestones = [...data.milestones].sort(
    (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
  );

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-6">Project Milestones</h3>
          {sortedMilestones.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No milestones defined</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-slate-200" />

              <div className="space-y-6">
                {sortedMilestones.map((milestone, i) => {
                  const isCompleted = milestone.status === "completed";
                  const isMissed = milestone.status === "missed";
                  const isOverdue = !isCompleted && !isMissed && new Date(milestone.targetDate) < new Date();

                  return (
                    <div key={milestone._id || i} className="relative flex gap-4 pl-0">
                      {/* Timeline dot */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                          isCompleted
                            ? "bg-emerald-100 border-emerald-400"
                            : isMissed
                              ? "bg-red-100 border-red-400"
                              : isOverdue
                                ? "bg-amber-100 border-amber-400"
                                : "bg-white border-slate-300"
                        }`}>
                          {isCompleted ? (
                            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : isMissed ? (
                            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <div className={`w-3 h-3 rounded-full ${isOverdue ? "bg-amber-400" : "bg-slate-300"}`} />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-2 rounded-lg border p-4 ${
                        isCompleted ? "border-emerald-200 bg-emerald-50/50" : isOverdue ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"
                      }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800">{milestone.name}</h4>
                            {milestone.phase && (
                              <p className="text-xs text-slate-500 mt-0.5">Phase: {milestone.phase}</p>
                            )}
                          </div>
                          <StatusBadge status={milestone.status} />
                        </div>

                        {milestone.description && (
                          <p className="text-xs text-slate-600 mt-2">{milestone.description}</p>
                        )}

                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <span>
                            Target: {new Date(milestone.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {milestone.completedDate && (
                            <span className="text-emerald-600">
                              Completed: {new Date(milestone.completedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>

                        {milestone.deliverables.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-slate-600 mb-1.5">Deliverables</p>
                            <div className="flex flex-wrap gap-1.5">
                              {milestone.deliverables.map((d, di) => (
                                <span key={di} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">
                                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Releases */}
      {data.releases.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Releases</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.releases.map((release, i) => (
                <div key={release._id || i} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-medium text-slate-800">{release.name}</h4>
                    <StatusBadge status={release.status} />
                  </div>
                  {release.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{release.description}</p>
                  )}
                  {release.releaseDate && (
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(release.releaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Budget Tab ──

const BUDGET_COLORS = ["#2E86C1", "#E2E8F0"];

function BudgetTab({ data }: { data: ClientPortalData }) {
  const { budget } = data;
  const chartData = [
    { name: "Spent", value: budget.spent },
    { name: "Remaining", value: Math.max(budget.remaining, 0) },
  ];

  const burnStatus = budget.utilizationPercent > 90
    ? { label: "Over Budget Risk", color: "text-red-600", bg: "bg-red-50" }
    : budget.utilizationPercent > 70
      ? { label: "On Track", color: "text-amber-600", bg: "bg-amber-50" }
      : { label: "Under Budget", color: "text-emerald-600", bg: "bg-emerald-50" };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: budget.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Budget Utilization</h3>
            {budget.total === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No budget configured</p>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                      >
                        {chartData.map((_, index) => (
                          <Cell key={index} fill={BUDGET_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-800">{budget.utilizationPercent}%</span>
                    <span className="text-xs text-slate-500">Used</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#2E86C1]" />
                    <span className="text-xs text-slate-600">Spent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#E2E8F0]" />
                    <span className="text-xs text-slate-600">Remaining</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Stats */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Budget Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">Total Budget</span>
                <span className="text-sm font-semibold text-slate-800">{formatCurrency(budget.total)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">Spent</span>
                <span className="text-sm font-semibold text-blue-600">{formatCurrency(budget.spent)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">Remaining</span>
                <span className={`text-sm font-semibold ${budget.remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(budget.remaining)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">Burn Rate</span>
                <span className="text-sm font-semibold text-slate-700">{formatCurrency(budget.burnRate)}/week</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${burnStatus.bg} ${burnStatus.color}`}>
                  {burnStatus.label}
                </span>
              </div>
            </div>

            {/* Budget progress bar */}
            {budget.total > 0 && (
              <div className="pt-2">
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      budget.utilizationPercent > 90 ? "bg-red-500" : budget.utilizationPercent > 70 ? "bg-amber-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(budget.utilizationPercent, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Feedback Tab ──

function FeedbackTab({ projectId }: { projectId: string }) {
  const [feedbackList, setFeedbackList] = useState<ClientFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    type: "general" as "bug" | "feature" | "question" | "general",
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
  });

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const res = await clientPortalApi.getFeedback(projectId);
      setFeedbackList((res as any).data || []);
    } catch {
      // silent - will show empty state
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.clientName.trim() || !form.clientEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setSubmitting(true);
      await clientPortalApi.submitFeedback(projectId, {
        clientId: form.clientEmail,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        type: form.type,
        title: form.title,
        description: form.description,
        priority: form.priority,
      });
      toast.success("Feedback submitted successfully");
      setShowForm(false);
      setForm({ clientName: "", clientEmail: "", type: "general", title: "", description: "", priority: "medium" });
      loadFeedback();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Submit Feedback */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Feedback</h3>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {showForm ? "Cancel" : "Submit Feedback"}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Your Name *</label>
                  <Input
                    value={form.clientName}
                    onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                    placeholder="John Smith"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Your Email *</label>
                  <Input
                    type="email"
                    value={form.clientEmail}
                    onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                    placeholder="john@company.com"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="general">General</option>
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="question">Question</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Brief summary of your feedback"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Provide details about your feedback..."
                  rows={4}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Feedback List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Previous Feedback</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedbackList.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No feedback submitted yet</p>
          ) : (
            <div className="space-y-3">
              {feedbackList.map(fb => (
                <div key={fb._id} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium text-slate-800">{fb.title}</h4>
                        <StatusBadge status={fb.status} colorMap={feedbackStatusColors} />
                        <StatusBadge status={fb.priority} colorMap={priorityColors} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{fb.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>{fb.clientName}</span>
                        <span>
                          {new Date(fb.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="capitalize">{fb.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Portal Page ──

export default function ClientPortalPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>("overview");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await clientPortalApi.getPortalData(projectId);
        setData(res.data || null);
      } catch (err: any) {
        setError(err.message || "Failed to load portal data");
      } finally {
        setLoading(false);
      }
    }
    if (projectId) load();
  }, [projectId]);

  const tabs: Array<{ key: PortalTab; label: string; icon: string }> = [
    { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { key: "milestones", label: "Milestones", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    { key: "budget", label: "Budget", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { key: "feedback", label: "Feedback", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading project portal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Portal Unavailable</h2>
          <p className="text-sm text-slate-500">{error || "This client portal is not available. It may be disabled or the project does not exist."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                {data.projectKey?.slice(0, 2) || data.projectName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-800">{data.projectName}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={data.status} />
                  <HealthIndicator score={data.healthScore} />
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Client Portal
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Description */}
        {data.description && activeTab === "overview" && (
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">{data.description}</p>
        )}

        {activeTab === "overview" && <OverviewTab data={data} />}
        {activeTab === "milestones" && <MilestonesTab data={data} />}
        {activeTab === "budget" && <BudgetTab data={data} />}
        {activeTab === "feedback" && <FeedbackTab projectId={projectId} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-slate-400 text-center">
            Powered by Nexora Project Management
          </p>
        </div>
      </footer>
    </div>
  );
}
