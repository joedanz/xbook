// ABOUTME: Tests for resolveNewsletterDates pure helper and formatSqliteDate.
// ABOUTME: Covers all 4 modes, fallback behavior, date validation, and SQLite formatting.

import { describe, it, expect } from "vitest";
import { resolveNewsletterDates, formatSqliteDate, validateDateRange, parseDateRange } from "../shared/newsletter";

describe("resolveNewsletterDates", () => {
  // --- all_unsent / undefined ---

  it("returns includeAlreadySent=false when range is undefined", () => {
    const result = resolveNewsletterDates(undefined, null);
    expect(result).toEqual({ includeAlreadySent: false });
    expect(result.sinceDate).toBeUndefined();
    expect(result.beforeDate).toBeUndefined();
  });

  it("returns includeAlreadySent=false for all_unsent mode", () => {
    const result = resolveNewsletterDates({ mode: "all_unsent" }, "2026-03-01T12:00:00Z");
    expect(result).toEqual({ includeAlreadySent: false });
  });

  // --- since_last_send ---

  it("returns sinceDate from lastSendDate for since_last_send mode", () => {
    const lastSend = "2026-03-15T10:00:00Z";
    const result = resolveNewsletterDates(
      { mode: "since_last_send" },
      lastSend
    );
    expect(result.sinceDate).toEqual(new Date(lastSend));
    expect(result.includeAlreadySent).toBe(false);
    expect(result.beforeDate).toBeUndefined();
  });

  it("falls back to all_unsent when since_last_send has null lastSendDate", () => {
    const result = resolveNewsletterDates(
      { mode: "since_last_send" },
      null
    );
    expect(result).toEqual({ includeAlreadySent: false });
    expect(result.sinceDate).toBeUndefined();
  });

  it("respects includePreviouslySent in since_last_send mode", () => {
    const result = resolveNewsletterDates(
      { mode: "since_last_send", includePreviouslySent: true },
      "2026-03-15T10:00:00Z"
    );
    expect(result.includeAlreadySent).toBe(true);
  });

  // --- last_n_weeks ---

  it("computes correct sinceDate for last_n_weeks with weeks=2", () => {
    const now = Date.now();
    const result = resolveNewsletterDates(
      { mode: "last_n_weeks", weeks: 2 },
      null
    );
    expect(result.sinceDate).toBeDefined();
    // sinceDate should be ~14 days ago (within 1 second tolerance)
    const expectedMs = now - 14 * 24 * 60 * 60 * 1000;
    expect(Math.abs(result.sinceDate!.getTime() - expectedMs)).toBeLessThan(1000);
    expect(result.includeAlreadySent).toBe(false);
    expect(result.beforeDate).toBeUndefined();
  });

  it("computes correct sinceDate for last_n_weeks with weeks=1", () => {
    const now = Date.now();
    const result = resolveNewsletterDates(
      { mode: "last_n_weeks", weeks: 1 },
      null
    );
    const expectedMs = now - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(result.sinceDate!.getTime() - expectedMs)).toBeLessThan(1000);
  });

  it("respects includePreviouslySent in last_n_weeks mode", () => {
    const result = resolveNewsletterDates(
      { mode: "last_n_weeks", weeks: 3, includePreviouslySent: true },
      null
    );
    expect(result.includeAlreadySent).toBe(true);
  });

  // --- custom ---

  it("parses start and end dates for custom mode with end-of-day adjustment", () => {
    const result = resolveNewsletterDates(
      { mode: "custom", startDate: "2026-03-01", endDate: "2026-03-15" },
      null
    );
    expect(result.sinceDate).toEqual(new Date("2026-03-01"));
    // beforeDate should have end-of-day applied (23:59:59.999 UTC)
    expect(result.beforeDate!.getUTCFullYear()).toBe(2026);
    expect(result.beforeDate!.getUTCMonth()).toBe(2); // March (0-indexed)
    expect(result.beforeDate!.getUTCDate()).toBe(15);
    expect(result.beforeDate!.getUTCHours()).toBe(23);
    expect(result.beforeDate!.getUTCMinutes()).toBe(59);
    expect(result.includeAlreadySent).toBe(false);
  });

  it("throws for custom mode when endDate < startDate", () => {
    expect(() =>
      resolveNewsletterDates(
        { mode: "custom", startDate: "2026-03-15", endDate: "2026-03-01" },
        null
      )
    ).toThrow("End date must be on or after start date");
  });

  it("throws for custom mode with invalid date strings", () => {
    expect(() =>
      resolveNewsletterDates(
        { mode: "custom", startDate: "not-a-date", endDate: "2026-03-01" },
        null
      )
    ).toThrow("Invalid date in custom range");
  });

  it("respects includePreviouslySent in custom mode", () => {
    const result = resolveNewsletterDates(
      {
        mode: "custom",
        startDate: "2026-03-01",
        endDate: "2026-03-15",
        includePreviouslySent: true,
      },
      null
    );
    expect(result.includeAlreadySent).toBe(true);
  });

  it("allows same start and end date (single day) with end-of-day", () => {
    const result = resolveNewsletterDates(
      { mode: "custom", startDate: "2026-03-15", endDate: "2026-03-15" },
      null
    );
    expect(result.sinceDate).toEqual(new Date("2026-03-15"));
    // Same date — beforeDate should be end-of-day (UTC) on March 15
    expect(result.beforeDate!.getUTCDate()).toBe(15);
    expect(result.beforeDate!.getUTCHours()).toBe(23);
  });
});

describe("formatSqliteDate", () => {
  it("formats a Date to SQLite-compatible string (no T, no Z)", () => {
    const d = new Date("2026-03-15T14:30:00.000Z");
    expect(formatSqliteDate(d)).toBe("2026-03-15 14:30:00");
  });

  it("handles midnight correctly", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(formatSqliteDate(d)).toBe("2026-01-01 00:00:00");
  });

  it("handles end-of-day correctly", () => {
    const d = new Date("2026-12-31T23:59:59.000Z");
    expect(formatSqliteDate(d)).toBe("2026-12-31 23:59:59");
  });
});

describe("validateDateRange", () => {
  it("returns null for undefined input", () => {
    expect(validateDateRange(undefined)).toBeNull();
  });

  it("returns null for valid all_unsent", () => {
    expect(validateDateRange({ mode: "all_unsent" })).toBeNull();
  });

  it("returns null for valid since_last_send", () => {
    expect(validateDateRange({ mode: "since_last_send" })).toBeNull();
  });

  it("returns null for valid last_n_weeks", () => {
    expect(validateDateRange({ mode: "last_n_weeks", weeks: 2 })).toBeNull();
  });

  it("returns error for invalid weeks", () => {
    expect(validateDateRange({ mode: "last_n_weeks", weeks: 10 as never })).toBe("Weeks must be 1-4");
  });

  it("returns null for valid custom range", () => {
    expect(validateDateRange({ mode: "custom", startDate: "2026-03-01", endDate: "2026-03-15" })).toBeNull();
  });

  it("returns error for missing custom dates", () => {
    expect(validateDateRange({ mode: "custom", startDate: "", endDate: "2026-03-15" })).toBe("Start and end dates are required");
  });

  it("returns error for invalid custom date format", () => {
    expect(validateDateRange({ mode: "custom", startDate: "banana", endDate: "2026-03-15" })).toBe("Invalid date format");
  });

  it("returns error for reversed custom dates", () => {
    expect(validateDateRange({ mode: "custom", startDate: "2026-03-15", endDate: "2026-03-01" })).toBe("End date must be on or after start date");
  });

  it("returns error for invalid mode", () => {
    expect(validateDateRange({ mode: "bogus" } as never)).toBe("Invalid date range mode");
  });
});

describe("parseDateRange", () => {
  it("returns undefined when no date_range in body", () => {
    expect(parseDateRange({})).toBeUndefined();
  });

  it("returns undefined for non-object date_range", () => {
    expect(parseDateRange({ date_range: "string" })).toBeUndefined();
  });

  it("returns undefined for invalid mode", () => {
    expect(parseDateRange({ date_range: { mode: "bogus" } })).toBeUndefined();
  });

  it("parses all_unsent mode", () => {
    expect(parseDateRange({ date_range: { mode: "all_unsent" } })).toEqual({ mode: "all_unsent" });
  });

  it("parses since_last_send with include_previously_sent", () => {
    expect(parseDateRange({ date_range: { mode: "since_last_send", include_previously_sent: true } }))
      .toEqual({ mode: "since_last_send", includePreviouslySent: true });
  });

  it("parses last_n_weeks with valid weeks", () => {
    expect(parseDateRange({ date_range: { mode: "last_n_weeks", weeks: 3 } }))
      .toEqual({ mode: "last_n_weeks", weeks: 3, includePreviouslySent: false });
  });

  it("returns undefined for last_n_weeks with invalid weeks", () => {
    expect(parseDateRange({ date_range: { mode: "last_n_weeks", weeks: 5 } })).toBeUndefined();
  });

  it("parses custom mode with snake_case dates", () => {
    expect(parseDateRange({ date_range: { mode: "custom", start_date: "2026-03-01", end_date: "2026-03-15" } }))
      .toEqual({ mode: "custom", startDate: "2026-03-01", endDate: "2026-03-15", includePreviouslySent: false });
  });

  it("returns undefined for custom mode with missing dates", () => {
    expect(parseDateRange({ date_range: { mode: "custom", start_date: "2026-03-01" } })).toBeUndefined();
  });
});
