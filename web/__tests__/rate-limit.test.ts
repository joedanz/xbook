// ABOUTME: Tests for web/lib/rate-limit.ts — checkRateLimit and getClientIp.
// ABOUTME: Uses vi.useFakeTimers() for all timing-dependent tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module isolation: re-import rate-limit fresh for each test so the module-level
// `store` and `lastCleanup` start clean. We use vi.resetModules() in beforeEach.
// ---------------------------------------------------------------------------

let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;
let getClientIp: typeof import("@/lib/rate-limit").getClientIp;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const mod = await import("@/lib/rate-limit");
  checkRateLimit = mod.checkRateLimit;
  getClientIp = mod.getClientIp;
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Basic allow / deny behaviour
// ---------------------------------------------------------------------------

describe("checkRateLimit — basic behaviour", () => {
  it("allows the first request and returns remaining = limit - 1", async () => {
    const result = await checkRateLimit("ip-1", { limit: 5, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests up to the limit", async () => {
    const config = { limit: 3, windowSeconds: 60 };
    await checkRateLimit("ip-2", config);
    await checkRateLimit("ip-2", config);
    const third = await checkRateLimit("ip-2", config);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests that exceed the limit", async () => {
    const config = { limit: 2, windowSeconds: 60 };
    await checkRateLimit("ip-3", config);
    await checkRateLimit("ip-3", config);
    const overflow = await checkRateLimit("ip-3", config);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it("returns resetAt in the future on first request", async () => {
    const now = Date.now();
    const config = { limit: 5, windowSeconds: 30 };
    const result = await checkRateLimit("ip-4", config);
    expect(result.resetAt).toBeGreaterThan(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + 30_000 + 1);
  });
});

// ---------------------------------------------------------------------------
// Window expiry — fake timers advance the clock
// ---------------------------------------------------------------------------

describe("checkRateLimit — window expiry", () => {
  it("resets count after the window expires", async () => {
    const config = { limit: 2, windowSeconds: 10 };
    await checkRateLimit("ip-5", config);
    await checkRateLimit("ip-5", config);
    const blocked = await checkRateLimit("ip-5", config);
    expect(blocked.allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(11_000);

    const afterReset = await checkRateLimit("ip-5", config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it("does not reset before the window expires", async () => {
    const config = { limit: 1, windowSeconds: 60 };
    await checkRateLimit("ip-6", config);
    const blocked = await checkRateLimit("ip-6", config);
    expect(blocked.allowed).toBe(false);

    // Advance, but not past the window
    vi.advanceTimersByTime(30_000);

    const stillBlocked = await checkRateLimit("ip-6", config);
    expect(stillBlocked.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Independent limits per key
// ---------------------------------------------------------------------------

describe("checkRateLimit — per-key isolation", () => {
  it("different keys have independent counters", async () => {
    const config = { limit: 1, windowSeconds: 60 };
    await checkRateLimit("ip-A", config);
    const blocked = await checkRateLimit("ip-A", config);
    expect(blocked.allowed).toBe(false);

    // ip-B is completely independent — should still be allowed
    const ipB = await checkRateLimit("ip-B", config);
    expect(ipB.allowed).toBe(true);
  });

  it("exhausting one key does not affect another", async () => {
    const config = { limit: 3, windowSeconds: 60 };
    await checkRateLimit("key-X", config);
    await checkRateLimit("key-X", config);
    await checkRateLimit("key-X", config);
    await checkRateLimit("key-X", config); // blocked

    const keyY = await checkRateLimit("key-Y", config);
    expect(keyY.allowed).toBe(true);
    expect(keyY.remaining).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Remaining count accuracy
// ---------------------------------------------------------------------------

describe("checkRateLimit — remaining count", () => {
  it("decrements remaining on each allowed request", async () => {
    const config = { limit: 5, windowSeconds: 60 };
    expect((await checkRateLimit("ip-R", config)).remaining).toBe(4);
    expect((await checkRateLimit("ip-R", config)).remaining).toBe(3);
    expect((await checkRateLimit("ip-R", config)).remaining).toBe(2);
    expect((await checkRateLimit("ip-R", config)).remaining).toBe(1);
    expect((await checkRateLimit("ip-R", config)).remaining).toBe(0);
  });

  it("returns remaining 0 when blocked", async () => {
    const config = { limit: 1, windowSeconds: 60 };
    await checkRateLimit("ip-S", config);
    const blocked = await checkRateLimit("ip-S", config);
    expect(blocked.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cleanup removes expired entries
// ---------------------------------------------------------------------------

describe("checkRateLimit — cleanup", () => {
  it("removes expired entries after the cleanup interval (60 s)", async () => {
    const config = { limit: 5, windowSeconds: 5 };

    // Create an entry
    await checkRateLimit("ip-cleanup", config);

    // Advance past both the window (5 s) and the cleanup interval (60 s)
    vi.advanceTimersByTime(70_000);

    // After cleanup, the entry should be gone — a new window starts fresh
    const result = await checkRateLimit("ip-cleanup", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("https://example.com", { headers });
  }

  it("returns the first IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("handles a single IP in x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "9.8.7.6" });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  it("trims whitespace from the first IP", () => {
    const req = makeRequest({ "x-forwarded-for": "  10.0.0.1  , 10.0.0.2" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = makeRequest({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns fingerprint-based fallback when no IP headers present", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toMatch(/^anon-/);
  });
});
