// ABOUTME: Tests for the v1 bookmarks GET route handler.
// ABOUTME: Covers rate limiting, auth, and query parameter parsing.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation((rl: { resetAt: number }, message = "Too many requests") =>
    NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  ),
  getClientIp: vi.fn(() => "127.0.0.1"),
  API_RATE_LIMIT: { requests: 60, windowMs: 60000 },
}));

// Mock api-auth module
vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: vi.fn(),
}));

// Mock db module
const mockQueryBookmarks = vi.fn();
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    queryBookmarks: mockQueryBookmarks,
  })),
}));

import { GET } from "../web/app/api/v1/bookmarks/route";
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

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/v1/bookmarks");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

describe("GET /api/v1/bookmarks", () => {
  it("returns 429 when rate-limited", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      resetAt: Date.now() + 30000,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns auth error when authentication fails", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ error: "Missing API key. Use: Authorization: Bearer <api-key>", status: 401 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Missing API key");
  });

  it("returns bookmarks on success", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockQueryBookmarks.mockResolvedValueOnce({
      bookmarks: [{ id: "1", text: "Hello" }],
      total: 1,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bookmarks).toHaveLength(1);
    expect(json.total).toBe(1);
  });

  it("passes query parameters to repository", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockQueryBookmarks.mockResolvedValueOnce({ bookmarks: [], total: 0 });

    await GET(
      makeRequest({
        folder: "tech",
        author: "johndoe",
        search: "typescript",
        starred: "true",
        page: "2",
        page_size: "25",
      })
    );

    expect(mockQueryBookmarks).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "tech",
        authorUsername: "johndoe",
        search: "typescript",
        starred: true,
        page: 2,
        pageSize: 25,
      })
    );
  });

  it("returns 200 with empty items when no bookmarks match", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockQueryBookmarks.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("passes sorting params to repository", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockQueryBookmarks.mockResolvedValueOnce({ bookmarks: [], total: 0 });

    await GET(makeRequest({ order_by: "author_name", order_dir: "asc" }));

    expect(mockQueryBookmarks).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "author_name",
        orderDir: "asc",
      })
    );
  });

  it("ignores invalid order_by values", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockQueryBookmarks.mockResolvedValueOnce({ bookmarks: [], total: 0 });

    await GET(makeRequest({ order_by: "DROP_TABLE" }));

    const callArg = mockQueryBookmarks.mock.calls[0][0];
    expect(callArg.orderBy).toBeUndefined();
  });

  it("splits tag filter and caps at 20 tags", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockQueryBookmarks.mockResolvedValueOnce({ bookmarks: [], total: 0 });

    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`).join(",");
    await GET(makeRequest({ tags }));

    const callArg = mockQueryBookmarks.mock.calls[0][0];
    expect(callArg.tags).toHaveLength(20);
  });
});
