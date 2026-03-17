// ABOUTME: Tests for the v1 me GET route handler (OSS overlay).
// ABOUTME: Covers rate limiting, auth, and local mode stub profile.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation((rl: { resetAt: number }, message = "Too many requests") =>
    NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  ),
  getClientIp: vi.fn(() => "127.0.0.1"),
  API_RATE_LIMIT: { limit: 100, windowSeconds: 60 },
}));

// Mock api-auth module
vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: vi.fn(),
}));

import { GET } from "../web/app/api/v1/me/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { authenticateApiRequest } from "../web/lib/api-auth";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAuth = vi.mocked(authenticateApiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/v1/me");
}

describe("GET /api/v1/me", () => {
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

  it("returns auth error when authentication fails", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ error: "Invalid API key", status: 401 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("returns local stub profile when DATABASE_URL is not set", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userId).toBe("local");
    expect(json.mode).toBe("local");
    expect(json.name).toBe("Local User");
  });
});
