import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  // Try multiple paths — works both in Docker and local dev
  const paths = [
    path.join(process.cwd(), "public", "test-report.json"),
    path.join(process.cwd(), "..", "tests", "reports", "latest.json"),
    path.join("/app", "public", "test-report.json"),
  ];

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        return NextResponse.json(data);
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "No test report found. Run: npx ts-node tests/runner.ts" },
    { status: 404 }
  );
}
