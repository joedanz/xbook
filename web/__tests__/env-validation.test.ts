// ABOUTME: Tests for web/lib/env.ts validateEnv() function.
// ABOUTME: Covers local mode and optional var warnings.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv } from "@/lib/env";

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
});

describe("validateEnv", () => {
  it("returns warn when X_CLIENT_ID is missing", () => {
    delete process.env.X_CLIENT_ID;
    process.env.X_CLIENT_SECRET = "secret";
    process.env.RESEND_API_KEY = "re_test_key";

    const errors = validateEnv();
    const xError = errors.find((e) => e.variable === "X_CLIENT_ID");
    expect(xError).toBeDefined();
    expect(xError!.severity).toBe("warn");
  });

  it("returns warn when X_CLIENT_SECRET is missing", () => {
    process.env.X_CLIENT_ID = "client-id";
    delete process.env.X_CLIENT_SECRET;
    process.env.RESEND_API_KEY = "re_test_key";

    const errors = validateEnv();
    const xError = errors.find((e) => e.variable === "X_CLIENT_SECRET");
    expect(xError).toBeDefined();
    expect(xError!.severity).toBe("warn");
  });

  it("returns warn when RESEND_API_KEY is missing", () => {
    process.env.X_CLIENT_ID = "client-id";
    process.env.X_CLIENT_SECRET = "secret";
    delete process.env.RESEND_API_KEY;

    const errors = validateEnv();
    const resendError = errors.find((e) => e.variable === "RESEND_API_KEY");
    expect(resendError).toBeDefined();
    expect(resendError!.severity).toBe("warn");
  });

  it("works with minimal vars (only warnings)", () => {
    process.env.X_CLIENT_ID = "client-id";
    process.env.X_CLIENT_SECRET = "secret";
    process.env.RESEND_API_KEY = "re_test_key";

    const errors = validateEnv();
    // No errors — all cloud-only vars are skipped
    const errorLevel = errors.filter((e) => e.severity === "error");
    expect(errorLevel).toEqual([]);
  });
});
