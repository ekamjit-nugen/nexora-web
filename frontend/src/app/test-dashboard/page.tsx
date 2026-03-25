"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  duration?: number;
  error?: string;
  businessNote?: string;
}

interface TestSuite {
  suite: string;
  module?: string;
  category?: string;
  tests: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped?: number;
  duration?: number;
}

interface TestReport {
  timestamp: string;
  // Flat format (from runner)
  totalTests?: number;
  totalPassed?: number;
  totalFailed?: number;
  totalSkipped?: number;
  totalSuites?: number;
  duration?: number;
  coverage?: number;
  // Nested format (legacy)
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped?: number;
    duration?: number;
    coverage?: number;
  };
  suites: TestSuite[];
  businessInsights?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return "Unknown";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ─── Coverage Ring SVG ───────────────────────────────────────────────────────

function CoverageRing({ value }: { value: number }) {
  const radius = 36;
  const stroke = 6;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const color =
    value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={radius * 2} height={radius * 2} className="block">
      <circle
        stroke="#e5e7eb"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          transition: "stroke-dashoffset 0.6s ease",
        }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-sm font-bold"
        fill={color}
      >
        {value}%
      </text>
    </svg>
  );
}

// ─── Category Badge ──────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  const colors: Record<string, string> = {
    auth: "bg-violet-100 text-violet-700",
    hr: "bg-sky-100 text-sky-700",
    attendance: "bg-amber-100 text-amber-700",
    leave: "bg-teal-100 text-teal-700",
    project: "bg-indigo-100 text-indigo-700",
    task: "bg-pink-100 text-pink-700",
    integration: "bg-orange-100 text-orange-700",
    e2e: "bg-emerald-100 text-emerald-700",
  };
  const cls =
    colors[category.toLowerCase()] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {category}
    </span>
  );
}

// Status badge helper used inline in the component

// ─── Horizontal Bar ──────────────────────────────────────────────────────────

function CoverageBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const color =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm text-gray-600">
        {label}
      </span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-12 text-right text-sm font-medium text-gray-700">
        {value}%
      </span>
    </div>
  );
}

// ─── Suite Row (expandable) ──────────────────────────────────────────────────

function SuiteRow({ suite }: { suite: TestSuite }) {
  const [open, setOpen] = useState(false);
  const passed = suite.tests.filter((t) => t.status === "pass").length;
  const failed = suite.tests.filter((t) => t.status === "fail").length;
  const skipped = suite.tests.filter((t) => t.status === "skip").length;
  const hasFail = failed > 0;

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={`cursor-pointer transition-colors hover:bg-gray-50 ${hasFail ? "bg-red-50/40" : ""}`}
      >
        <td className="px-4 py-3">
          <span
            className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
          >
            &#9654;
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">
          {suite.suite}
        </td>
        <td className="px-4 py-3">
          <CategoryBadge category={suite.category} />
        </td>
        <td className="px-4 py-3 text-emerald-600 font-medium">{passed}</td>
        <td className="px-4 py-3 text-red-600 font-medium">{failed}</td>
        {skipped > 0 && (
          <td className="px-4 py-3 text-amber-600 font-medium">
            {skipped}
          </td>
        )}
        <td className="px-4 py-3 text-gray-500 text-sm">
          {formatDuration(suite.duration)}
        </td>
      </tr>
      {open &&
        suite.tests.map((test, idx) => (
          <tr
            key={idx}
            className={`border-l-2 ${test.status === "fail" ? "border-l-red-400 bg-red-50/60" : "border-l-transparent bg-gray-50/50"}`}
          >
            <td className="px-4 py-2" />
            <td
              colSpan={skipped > 0 ? 4 : 3}
              className="px-4 py-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5">
                  {test.status === "pass" ? (
                    <span className="text-emerald-500 text-base">&#10003;</span>
                  ) : test.status === "fail" ? (
                    <span className="text-red-500 text-base">&#10007;</span>
                  ) : (
                    <span className="text-amber-500 text-base">&#9679;</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm text-gray-800">
                    {test.name}
                  </span>
                  {test.error && (
                    <p className="mt-1 rounded bg-red-100 px-2 py-1 font-mono text-xs text-red-700">
                      {test.error}
                    </p>
                  )}
                  {test.businessNote && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                      <span>&#128161;</span>
                      <span>{test.businessNote}</span>
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="px-4 py-2 text-xs text-gray-400">
              {formatDuration(test.duration)}
            </td>
          </tr>
        ))}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TestDashboardPage() {
  const [report, setReport] = useState<TestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      try {
        // Try static file first (most reliable in Docker)
        let data = null;
        for (const url of ["/test-report.json", "/api/test-results"]) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              data = await res.json();
              break;
            }
          } catch {
            continue;
          }
        }
        if (data && data.suites) {
          setReport(data);
        } else {
          setError("No test report found. Run: npx ts-node tests/runner.ts");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#2E86C1] border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading test results...</p>
        </div>
      </div>
    );
  }

  // ── Empty / error state ────────────────────────────────────────────────────
  if (error || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            No test results yet
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Run the test suite to generate a report.
          </p>
          <div className="mt-6 rounded-lg bg-gray-900 px-4 py-3 text-left">
            <code className="text-sm text-emerald-400">
              npx ts-node tests/runner.ts
            </code>
          </div>
          {error && (
            <p className="mt-4 text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const summary = {
    total: report.totalTests ?? report.summary?.total ?? 0,
    passed: report.totalPassed ?? report.summary?.passed ?? 0,
    failed: report.totalFailed ?? report.summary?.failed ?? 0,
    skipped: report.totalSkipped ?? report.summary?.skipped ?? 0,
    duration: report.duration ?? report.summary?.duration ?? 0,
    coverage: report.coverage ?? report.summary?.coverage ?? 0,
  };
  const suites = report.suites || [];
  const businessInsights = report.businessInsights || [];
  const overallPass = summary.failed === 0;

  // Collect all business notes from tests if not top-level
  const allInsights: { category?: string; text: string }[] = [];
  if (businessInsights) {
    businessInsights.forEach((text) => allInsights.push({ text }));
  }
  suites.forEach((suite) =>
    suite.tests.forEach((t) => {
      if (t.businessNote) {
        allInsights.push({
          category: suite.category,
          text: t.businessNote,
        });
      }
    }),
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2E86C1] text-sm font-bold text-white">
              N
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Test Dashboard
            </h1>
            <span className="ml-2">
              {overallPass ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  ALL PASS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  FAILURES
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              Last run: {formatTimestamp(report.timestamp)}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  "npx ts-node tests/runner.ts",
                );
                toast.success("Command copied!");
              }}
              className="rounded-lg bg-[#2E86C1] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2574a9]"
            >
              Run Tests
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Tests</p>
            <p className="mt-2 text-3xl font-bold text-[#2E86C1]">
              {summary.total}
            </p>
            {summary.duration != null && (
              <p className="mt-1 text-xs text-gray-400">
                {formatDuration(summary.duration)} total
              </p>
            )}
          </div>

          {/* Passed */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Passed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {summary.passed}
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{
                  width: `${summary.total ? (summary.passed / summary.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Failed */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Failed</p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {summary.failed}
            </p>
            {summary.failed > 0 && (
              <p className="mt-1 text-xs text-red-400">
                {((summary.failed / summary.total) * 100).toFixed(1)}% failure
                rate
              </p>
            )}
            {summary.failed === 0 && (
              <p className="mt-1 text-xs text-emerald-500">
                No failures
              </p>
            )}
          </div>

          {/* Coverage */}
          <div className="flex items-center gap-4 rounded-xl border bg-white p-6 shadow-sm">
            <CoverageRing value={summary.coverage ?? 0} />
            <div>
              <p className="text-sm font-medium text-gray-500">Coverage</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {summary.coverage ?? 0}%
              </p>
            </div>
          </div>
        </div>

        {/* ── Suite Results Table ──────────────────────────────────────── */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Suite Results
            </h2>
            <p className="text-xs text-gray-400">
              Click a row to expand individual test results
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3">Suite</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Pass</th>
                  <th className="px-4 py-3">Fail</th>
                  <th className="px-4 py-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suites.map((suite, idx) => (
                  <SuiteRow key={idx} suite={suite} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Business Insights ────────────────────────────────────────── */}
        {allInsights.length > 0 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Business Insights
            </h2>
            <div className="space-y-3">
              {allInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg bg-blue-50/50 px-4 py-3"
                >
                  <span className="mt-0.5 text-base">&#128161;</span>
                  <div className="flex-1">
                    {insight.category && (
                      <CategoryBadge category={insight.category} />
                    )}{" "}
                    <span className="text-sm text-gray-700">
                      {insight.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Coverage Chart ──────────────────────────────────────────── */}
        {suites.length > 0 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              Coverage by Module
            </h2>
            <div className="space-y-3">
              {suites.map((s, idx) => (
                <CoverageBar
                  key={idx}
                  label={s.suite || s.module || `Suite ${idx + 1}`}
                  value={s.totalTests > 0 ? Math.round((s.passed / s.totalTests) * 100) : 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <p className="pb-6 text-center text-xs text-gray-400">
          Nexora Test Dashboard &mdash; Dev Tool
        </p>
      </main>
    </div>
  );
}
