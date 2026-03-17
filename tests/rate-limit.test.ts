// ABOUTME: Tests for web/lib/rate-limit.ts — in-memory rate limiter.
// ABOUTME: Covers window creation, limit enforcement, window expiry, and IP extraction.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "../web/lib/rate-limit";
import type { RateLimitConfig } from "../web/lib/rate-limit";

// Ensure local mode (no DATABASE_URL) so the in-memory backend is used.
let savedDbUrl: string | undefined;

beforeEach(() => {
  savedDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (savedDbUrl !== undefined) {
    process.env.DATABASE_URL = savedDbUrl;
  }
});

// ── checkRateLimit (in-memory) ──────────────────────────────────────

describe("checkRateLimit (local mode)", () => {
  // Use a unique key prefix per test to avoid cross-test pollution
  let keyCounter = 0;
  function uniqueKey() {
    return `test-rl-${Date.now()}-${keyCounter++}`;
  }

  const config: RateLimitConfig = { limit: 3, windowSeconds: 60 };

  it("allows first request and reports correct remaining", async () => {
    const key = uniqueKey();
    const result = await checkRateLimit(key, config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 limit - 1 used
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests up to the limit", async () => {
    const key = uniqueKey();

    const r1 = await checkRateLimit(key, config);
    const r2 = await checkRateLimit(key, config);
    const r3 = await checkRateLimit(key, config);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests beyond the limit", async () => {
    const key = uniqueKey();

    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    const r4 = await checkRateLimit(key, config);

    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("uses separate windows for different keys", async () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();

    await checkRateLimit(key1, config);
    await checkRateLimit(key1, config);
    await checkRateLimit(key1, config);

    // key1 is exhausted, but key2 should still be fresh
    const r1 = await checkRateLimit(key1, config);
    const r2 = await checkRateLimit(key2, config);

    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(2);
  });

  it("resets after window expires", async () => {
    // Use a very short window (1 second) to test expiry
    vi.useFakeTimers();
    const shortConfig: RateLimitConfig = { limit: 1, windowSeconds: 1 };
    const key = uniqueKey();

    const r1 = await checkRateLimit(key, shortConfig);
    expect(r1.allowed).toBe(true);

    const r2 = await checkRateLimit(key, shortConfig);
    expect(r2.allowed).toBe(false);

    // Advance past the window using fake timers instead of real setTimeout
    vi.advanceTimersByTime(1100);

    const r3 = await checkRateLimit(key, shortConfig);
    expect(r3.allowed).toBe(true);
    vi.useRealTimers();
  });

  it("returns a resetAt timestamp in the future", async () => {
    const key = uniqueKey();
    const before = Date.now();
    const result = await checkRateLimit(key, config);

    expect(result.resetAt).toBeGreaterThan(before);
    expect(result.resetAt).toBeLessThanOrEqual(before + config.windowSeconds * 1000 + 50);
  });
});

// ── getClientIp ─────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("extracts first IP from comma-separated x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns fingerprint-based fallback when no IP headers present", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toMatch(/^anon-/);
  });

  it("handles whitespace in x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  1.2.3.4  ,  5.6.7.8  " },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "10.0.0.1", "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("extracts IP from x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "  10.0.0.1  " },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });
});
