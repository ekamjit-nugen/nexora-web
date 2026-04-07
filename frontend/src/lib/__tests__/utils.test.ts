/**
 * Tests for shared utility functions: getInitials, formatTime, cn
 */
import { getInitials, formatTime, cn } from "../utils";

describe("getInitials", () => {
  it('returns initials from first and last name: "J" + "D" = "JD"', () => {
    expect(getInitials("John", "Doe")).toBe("JD");
  });

  it("returns single initial when only firstName is provided", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("returns single initial when only lastName is provided", () => {
    expect(getInitials(undefined, "Smith")).toBe("S");
  });

  it("returns empty string when both are undefined", () => {
    expect(getInitials()).toBe("");
  });

  it("returns empty string when both are empty strings", () => {
    expect(getInitials("", "")).toBe("");
  });

  it("uppercases lowercase inputs", () => {
    expect(getInitials("jane", "smith")).toBe("JS");
  });
});

describe("formatTime", () => {
  it("formats an ISO timestamp to HH:MM format", () => {
    const result = formatTime("2026-04-07T14:30:00Z");
    // The exact output depends on locale/timezone, but it should contain digits and a colon
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("handles midnight correctly", () => {
    const result = formatTime("2026-01-01T00:00:00Z");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns a string for any valid date", () => {
    const result = formatTime("2025-12-25T09:15:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("cn (class name merger)", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toBe("base visible");
  });
});
