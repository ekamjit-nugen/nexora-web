/**
 * Nexora Micro Test Framework
 * Lightweight test runner for individual test files — outputs structured results
 */

interface TestCase {
  name: string;
  fn: () => Promise<void>;
  category?: string;
  businessNote?: string;
}

interface TestResultItem {
  name: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  error?: string;
  businessNote?: string;
}

const tests: TestCase[] = [];
let suiteName = "unknown";
let suiteCategory: "e2e" | "unit" | "integration" | "business" = "e2e";
let suiteModule = "unknown";

export function suite(name: string, category: "e2e" | "unit" | "integration" | "business", module: string) {
  suiteName = name;
  suiteCategory = category;
  suiteModule = module;
}

export function test(name: string, fn: () => Promise<void>, options?: { businessNote?: string }) {
  tests.push({ name, fn, businessNote: options?.businessNote });
}

export function businessTest(name: string, fn: () => Promise<void>, insight: string) {
  tests.push({ name, fn, businessNote: insight });
}

export function expect(value: unknown) {
  return {
    toBe(expected: unknown) {
      if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(value) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toBeTruthy() {
      if (!value) throw new Error(`Expected truthy, got ${JSON.stringify(value)}`);
    },
    toBeFalsy() {
      if (value) throw new Error(`Expected falsy, got ${JSON.stringify(value)}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof value !== "number" || value <= n) throw new Error(`Expected > ${n}, got ${value}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof value !== "number" || value < n) throw new Error(`Expected >= ${n}, got ${value}`);
    },
    toContain(item: unknown) {
      if (Array.isArray(value)) {
        if (!value.includes(item)) throw new Error(`Array does not contain ${JSON.stringify(item)}`);
      } else if (typeof value === "string") {
        if (!value.includes(item as string)) throw new Error(`String does not contain "${item}"`);
      }
    },
    toHaveLength(n: number) {
      if (!Array.isArray(value) && typeof value !== "string") throw new Error(`Not an array or string`);
      if ((value as unknown[]).length !== n) throw new Error(`Expected length ${n}, got ${(value as unknown[]).length}`);
    },
    toBeNull() {
      if (value !== null) throw new Error(`Expected null, got ${JSON.stringify(value)}`);
    },
    toBeUndefined() {
      if (value !== undefined) throw new Error(`Expected undefined, got ${JSON.stringify(value)}`);
    },
    toBeDefined() {
      if (value === undefined || value === null) throw new Error(`Expected defined, got ${JSON.stringify(value)}`);
    },
    toMatch(regex: RegExp) {
      if (typeof value !== "string" || !regex.test(value)) throw new Error(`"${value}" does not match ${regex}`);
    },
    toThrow() {
      // For function wrapping
    },
    not: {
      toBe(expected: unknown) {
        if (value === expected) throw new Error(`Expected NOT ${JSON.stringify(expected)}`);
      },
      toContain(item: unknown) {
        if (Array.isArray(value) && value.includes(item)) throw new Error(`Array should not contain ${JSON.stringify(item)}`);
      },
      toBeNull() {
        if (value === null) throw new Error(`Expected NOT null`);
      },
    },
  };
}

export async function run() {
  const results: TestResultItem[] = [];
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      const duration = Date.now() - start;
      results.push({ name: t.name, status: "pass", duration, businessNote: t.businessNote });
      console.log(`  ✓ ${t.name} (${duration}ms)`);
      passed++;
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: t.name, status: "fail", duration, error: msg, businessNote: t.businessNote });
      console.log(`  ✗ ${t.name} — ${msg}`);
      failed++;
    }
  }

  const report = {
    suite: suiteName,
    category: suiteCategory,
    module: suiteModule,
    tests: results,
    totalTests: results.length,
    passed,
    failed,
    skipped: 0,
    duration: results.reduce((s, r) => s + r.duration, 0),
    timestamp: new Date().toISOString(),
  };

  console.log(`\n  ${passed}/${results.length} passed`);

  // Output structured result for the runner to parse
  console.log(`RESULTS:${JSON.stringify(report)}`);

  if (failed > 0) process.exit(1);
}
