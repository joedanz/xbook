// ABOUTME: Tests for the v1 bookmarks/:id GET route handler.
// ABOUTME: Covers auth, rate limiting, 404, and successful retrieval.

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
const mockGetBookmarkById = vi.fn();

vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    getBookmarkById: mockGetBookmarkById,
  })),
}));

import { GET } from "../web/app/api/v1/bookmarks/[id]/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { authenticateApiRequest } from "../web/lib/api-auth";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAuth = vi.mocked(authenticateApiRequest);

let savedDbUrl: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  // Default: pass rate limit and auth
  mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
  mockedAuth.mockResolvedValue({ userId: "local" });
});

afterEach(() => {
  if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
  else delete process.env.DATABASE_URL;
});

function getRequest(): Request {
  return new Request("http://localhost:3000/api/v1/bookmarks/bm-1", {
    method: "GET",
  });
}

const params = Promise.resolve({ id: "bm-1" });

describe("GET /api/v1/bookmarks/:id", () => {
  it("returns 401 when authentication fails", async () => {
    mockedAuth.mockResolvedValueOnce({ error: "Unauthorized", status: 401 });

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when IP rate limit is exceeded", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns 429 when per-user rate limit is exceeded", async () => {
    // First call (IP check) passes, second call (user check) fails
    mockedCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns 400 when bookmark ID exceeds max length", async () => {
    const longId = "a".repeat(31);
    const longParams = Promise.resolve({ id: longId });
    const req = new Request(`http://localhost:3000/api/v1/bookmarks/${longId}`, {
      method: "GET",
    });

    const res = await GET(req, { params: longParams });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid bookmark ID");
  });

  it("returns 404 when bookmark is not found", async () => {
    mockGetBookmarkById.mockResolvedValueOnce(null);

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Bookmark not found");
  });

  it("returns 404 when repo returns undefined", async () => {
    mockGetBookmarkById.mockResolvedValueOnce(undefined);

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 200 with bookmark data for valid ID", async () => {
    const bookmark = {
      id: "bm-1",
      tweet_id: "tweet-123",
      text: "Hello world",
      author_name: "Test User",
      author_username: "testuser",
      created_at: "2024-01-01T00:00:00.000Z",
      starred: false,
      need_to_read: false,
      notes: null,
      tags: [],
      folder_id: null,
      folder_name: null,
    };
    mockGetBookmarkById.mockResolvedValueOnce(bookmark);

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("bm-1");
    expect(json.tweet_id).toBe("tweet-123");
    expect(json.text).toBe("Hello world");
    expect(json.author_name).toBe("Test User");
    expect(json.author_username).toBe("testuser");
    expect(json.starred).toBe(false);
    expect(json.need_to_read).toBe(false);
  });

  it("returns proper JSON shape with all bookmark fields", async () => {
    const bookmark = {
      id: "bm-2",
      tweet_id: "tweet-456",
      text: "A tagged bookmark",
      author_name: "Jane Doe",
      author_username: "janedoe",
      created_at: "2024-06-01T12:00:00.000Z",
      starred: true,
      need_to_read: true,
      notes: "Important read",
      tags: ["ai", "ml"],
      folder_id: "folder-1",
      folder_name: "Research",
    };
    mockGetBookmarkById.mockResolvedValueOnce(bookmark);

    const bm2params = Promise.resolve({ id: "bm-2" });
    const req = new Request("http://localhost:3000/api/v1/bookmarks/bm-2", {
      method: "GET",
    });

    const res = await GET(req, { params: bm2params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      id: "bm-2",
      tweet_id: "tweet-456",
      starred: true,
      need_to_read: true,
      notes: "Important read",
      folder_id: "folder-1",
      folder_name: "Research",
    });
    expect(json.tags).toEqual(["ai", "ml"]);
  });

  it("returns 500 when repo throws an unexpected error", async () => {
    mockGetBookmarkById.mockRejectedValueOnce(new Error("Database error"));

    const res = await GET(getRequest(), { params });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
