// ABOUTME: Tests for the v1 folders GET route handler.
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
const mockGetFolders = vi.fn();
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    getFolders: mockGetFolders,
  })),
}));

import { GET } from "../web/app/api/v1/folders/route";
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
  return new Request("http://localhost:3000/api/v1/folders");
}

describe("GET /api/v1/folders", () => {
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
    mockedAuth.mockResolvedValueOnce({ error: "Missing API key. Use: Authorization: Bearer <api-key>", status: 401 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Missing API key");
  });

  it("returns folders on success", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetFolders.mockResolvedValueOnce([
      { id: "f1", name: "Tech" },
      { id: "f2", name: "Design" },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.folders).toHaveLength(2);
    expect(json.folders[0].name).toBe("Tech");
  });

  it("returns empty array when no folders exist", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetFolders.mockResolvedValueOnce([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.folders).toEqual([]);
  });

  it("returns 500 when repository throws", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetFolders.mockRejectedValueOnce(new Error("DB failure"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
