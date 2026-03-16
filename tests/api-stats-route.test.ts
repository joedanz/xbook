// ABOUTME: Tests for the v1 stats GET route handler.
// ABOUTME: Covers rate limiting, auth, successful response, and error handling.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// Mock db module
const mockGetStats = vi.fn();
const mockGetSyncHistory = vi.fn();
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    getStats: mockGetStats,
    getSyncHistory: mockGetSyncHistory,
  })),
}));

import { GET } from "../web/app/api/v1/stats/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { authenticateApiRequest } from "../web/lib/api-auth";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAuth = vi.mocked(authenticateApiRequest);

let savedDbUrl: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
  else delete process.env.DATABASE_URL;
});

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/v1/stats");
}

describe("GET /api/v1/stats", () => {
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
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns auth error when authentication fails", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ error: "Unauthorized", status: 401 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns stats and sync history on success", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetStats.mockResolvedValueOnce({ totalBookmarks: 150, totalFolders: 5 });
    mockGetSyncHistory.mockResolvedValueOnce([
      { syncedAt: "2026-03-01", fetched: 50, newCount: 10 },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stats.totalBookmarks).toBe(150);
    expect(json.syncHistory).toHaveLength(1);
  });

  it("returns zero counts when database is empty", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetStats.mockResolvedValueOnce({ totalBookmarks: 0, totalFolders: 0, totalTags: 0 });
    mockGetSyncHistory.mockResolvedValueOnce([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stats.totalBookmarks).toBe(0);
    expect(json.stats.totalFolders).toBe(0);
    expect(json.stats.totalTags).toBe(0);
    expect(json.syncHistory).toEqual([]);
  });

  it("returns 500 when repository throws", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetStats.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
