#!/usr/bin/env npx ts-node
/**
 * Nexora Test Runner
 * Executes all test suites in parallel, collects results, outputs JSON report
 * Usage: npx ts-node tests/runner.ts
 */

import { execSync, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface TestResult {
  suite: string;
  category: "e2e" | "unit" | "integration" | "business";
  module: string;
  tests: {
    name: string;
    status: "pass" | "fail" | "skip";
    duration: number;
    error?: string;
    businessNote?: string;
  }[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  timestamp: string;
}

interface TestReport {
  timestamp: string;
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  coverage: number;
  duration: number;
  suites: TestResult[];
  businessInsights: string[];
}

const SUITES_DIR = path.join(__dirname, "e2e");
const REPORT_DIR = path.join(__dirname, "reports");

async function runSuite(filePath: string): Promise<TestResult> {
  const fileName = path.basename(filePath, ".test.ts");
  const startTime = Date.now();

  try {
    let output = "";
    try {
      output = execSync(
        `npx ts-node --transpile-only "${filePath}" 2>&1`,
        { timeout: 120000, encoding: "utf-8", cwd: path.join(__dirname, "..") }
      );
    } catch (execErr: unknown) {
      // Suite may exit with code 1 on failures but still produce output
      output = (execErr as { stdout?: string }).stdout || "";
    }

    // Parse JSON output from test file
    const jsonMatch = output.match(/^RESULTS:(.+)$/m);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[1]) as TestResult;
      result.duration = Date.now() - startTime;
      return result;
    }

    // Fallback: count PASS/FAIL lines
    const lines = output.split("\n");
    const tests: TestResult["tests"] = [];
    for (const line of lines) {
      const passMatch = line.match(/✓\s+(.+)\s+\((\d+)ms\)/);
      const failMatch = line.match(/✗\s+(.+)\s*[-—]\s*(.*)/);
      if (passMatch) tests.push({ name: passMatch[1].trim(), status: "pass", duration: parseInt(passMatch[2]) });
      if (failMatch) tests.push({ name: failMatch[1].trim(), status: "fail", duration: 0, error: failMatch[2] });
    }

    return {
      suite: fileName,
      category: "e2e",
      module: fileName.replace(".test", ""),
      tests,
      totalTests: tests.length,
      passed: tests.filter((t) => t.status === "pass").length,
      failed: tests.filter((t) => t.status === "fail").length,
      skipped: 0,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    return {
      suite: fileName,
      category: "e2e",
      module: fileName.replace(".test", ""),
      tests: [{ name: "Suite execution", status: "fail", duration: 0, error: error.stderr || error.message || "Unknown error" }],
      totalTests: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

async function main() {
  console.log("🧪 Nexora Test Runner");
  console.log("═".repeat(60));

  // Find all test files
  const suiteFiles: string[] = [];
  for (const dir of ["e2e", "unit", "integration", "business"]) {
    const fullDir = path.join(__dirname, dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith(".test.ts"));
      suiteFiles.push(...files.map((f) => path.join(fullDir, f)));
    }
  }

  if (suiteFiles.length === 0) {
    console.log("No test files found.");
    return;
  }

  console.log(`Found ${suiteFiles.length} test suites\n`);

  // Run all suites in parallel
  const startTime = Date.now();
  const results = await Promise.all(suiteFiles.map(runSuite));

  // Aggregate
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    totalSuites: results.length,
    totalTests: results.reduce((s, r) => s + r.totalTests, 0),
    totalPassed: results.reduce((s, r) => s + r.passed, 0),
    totalFailed: results.reduce((s, r) => s + r.failed, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    coverage: 0,
    duration: Date.now() - startTime,
    suites: results,
    businessInsights: [],
  };

  report.coverage = report.totalTests > 0 ? Math.round((report.totalPassed / report.totalTests) * 100) : 0;

  // Collect business insights
  for (const suite of results) {
    for (const test of suite.tests) {
      if (test.businessNote) report.businessInsights.push(test.businessNote);
    }
  }

  // Print summary
  console.log("═".repeat(60));
  console.log(`Results: ${report.totalPassed}/${report.totalTests} passed (${report.coverage}%)`);
  console.log(`Failed: ${report.totalFailed} | Skipped: ${report.totalSkipped}`);
  console.log(`Duration: ${(report.duration / 1000).toFixed(1)}s`);
  console.log("");

  for (const suite of results) {
    const icon = suite.failed === 0 ? "✅" : "❌";
    console.log(`${icon} ${suite.suite}: ${suite.passed}/${suite.totalTests} passed`);
    for (const test of suite.tests.filter((t) => t.status === "fail")) {
      console.log(`   ❌ ${test.name}: ${test.error}`);
    }
  }

  if (report.businessInsights.length > 0) {
    console.log("\n📊 Business Insights:");
    for (const insight of report.businessInsights) {
      console.log(`   💡 ${insight}`);
    }
  }

  // Write report
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, "latest.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);

  // Copy to frontend/public for the test dashboard
  const publicDir = path.join(__dirname, "..", "frontend", "public");
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, "test-report.json"), JSON.stringify(report, null, 2));
    console.log("Report copied to frontend/public/test-report.json");
  }

  // Also save timestamped copy
  const tsPath = path.join(REPORT_DIR, `report-${Date.now()}.json`);
  fs.writeFileSync(tsPath, JSON.stringify(report, null, 2));

  // Exit with error code if tests failed
  if (report.totalFailed > 0) process.exit(1);
}

main().catch(console.error);
