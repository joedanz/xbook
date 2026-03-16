// ABOUTME: Tests for the v1 status (health check) GET route handler.
// ABOUTME: Covers rate limiting, local/cloud mode detection, and DB health check.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation((rl: { resetAt: number }, message = "Too many requests") =>
    NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  ),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Mock db module
vi.mock("@/lib/db", () => ({}));

import { GET } from "../web/app/api/v1/status/route";
import { checkRateLimit } from "../web/lib/rate-limit";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/v1/status");
}

describe("GET /api/v1/status", () => {
  it("returns 429 when rate-limited", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns degraded status in local mode when DB file is inaccessible", async () => {
    // In test environment, there is no xbook.db file, so the check fails
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 29, resetAt: 0 });

    const res = await GET(makeRequest());
    // Without a real SQLite DB file, the health check fails → degraded
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.mode).toBe("local");
    expect(json.timestamp).toBeTruthy();
  });

  it("includes version, timestamp, and mode fields in response", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 29, resetAt: 0 });

    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json).toHaveProperty("version");
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("mode");
    expect(json).toHaveProperty("status");
  });
});
