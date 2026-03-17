// ABOUTME: Tests for the connect-x/status GET route handler (OSS overlay).
// ABOUTME: Covers rate limiting and local mode file-based token check.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Mock fs for local mode token file check
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

import { GET } from "../web/app/api/connect-x/status/route";
import { checkRateLimit } from "../web/lib/rate-limit";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/connect-x/status");
}

describe("GET /api/connect-x/status", () => {
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

  it("returns authenticated: false in local mode when no tokens file exists", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 29, resetAt: 0 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authenticated).toBe(false);
  });

  it("returns authenticated: true in local mode when tokens file exists", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 29, resetAt: 0 });
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authenticated).toBe(true);
  });
});
