// ABOUTME: Tests for web/lib/validation.ts — clampPageSize.

import { describe, it, expect } from "vitest";
import { clampPageSize } from "@/lib/validation";

// ---------------------------------------------------------------------------
// clampPageSize
// ---------------------------------------------------------------------------

describe("clampPageSize", () => {
  it("returns input when within range (1-100)", () => {
    expect(clampPageSize(50)).toBe(50);
  });

  it("returns 1 at the lower boundary", () => {
    expect(clampPageSize(1)).toBe(1);
  });

  it("returns 100 at the upper boundary", () => {
    expect(clampPageSize(100)).toBe(100);
  });

  it("clamps to 100 when exceeding maximum", () => {
    expect(clampPageSize(200)).toBe(100);
  });

  it("clamps to 100 for very large numbers", () => {
    expect(clampPageSize(9999)).toBe(100);
  });

  it("returns default (20) when given 0", () => {
    expect(clampPageSize(0)).toBe(20);
  });

  it("returns default when given a negative number", () => {
    expect(clampPageSize(-5)).toBe(20);
  });

  it("returns default when given NaN", () => {
    expect(clampPageSize(NaN)).toBe(20);
  });

  it("returns default when given undefined", () => {
    expect(clampPageSize(undefined)).toBe(20);
  });

  it("returns default when given a non-numeric string", () => {
    expect(clampPageSize("abc")).toBe(20);
  });

  it("parses a numeric string correctly", () => {
    expect(clampPageSize("50")).toBe(50);
  });

  it("clamps a numeric string that exceeds max", () => {
    expect(clampPageSize("500")).toBe(100);
  });

  it("returns custom default size when provided", () => {
    expect(clampPageSize(0, 10)).toBe(10);
    expect(clampPageSize(NaN, 50)).toBe(50);
  });

  it("returns default when given null (cast to string 'null' → NaN)", () => {
    expect(clampPageSize(null)).toBe(20);
  });
});
