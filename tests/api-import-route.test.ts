// ABOUTME: Tests for the v1 import POST route handler.
// ABOUTME: Covers auth, validation, size limits, chunked import, and partial failures.

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
const mockUpsertBookmarksBatch = vi.fn();
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    upsertBookmarksBatch: mockUpsertBookmarksBatch,
  })),
}));

// Mock import-parser module
vi.mock("@shared/import-parser", () => ({
  parseImportFile: vi.fn(),
}));

import { POST } from "../web/app/api/v1/import/route";
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
  mockedCheckRateLimit.mockResolvedValue({ allowed: true, resetAt: 0 });
  mockedAuth.mockResolvedValue({ userId: "test-user" });
});

afterEach(() => {
  if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
  else delete process.env.DATABASE_URL;
});

function makeImportRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeTweet(id: string) {
  return {
    id,
    text: `Tweet ${id}`,
    authorId: "u1",
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("POST /api/v1/import", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedAuth.mockResolvedValueOnce({
      error: "Missing API key. Use: Authorization: Bearer <api-key>",
      status: 401,
    });

    const res = await POST(makeImportRequest({ tweets: [] }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Missing API key");
  });

  it("returns 429 when rate-limited", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      resetAt: Date.now() + 30000,
    });

    const res = await POST(makeImportRequest({ tweets: [] }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 for invalid JSON body (missing tweets and content)", async () => {
    const res = await POST(makeImportRequest({ foo: "bar" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid request");
  });

  it("returns 400 when exceeding MAX_IMPORT_ITEMS", async () => {
    // Create array with 50,001 tweets
    const tweets = Array.from({ length: 50_001 }, (_, i) => makeTweet(`t-${i}`));
    const res = await POST(makeImportRequest({ tweets, users: {} }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Too many items");
    expect(json.error).toContain("50000");
  });

  it("successfully imports a batch of tweets", async () => {
    mockUpsertBookmarksBatch.mockResolvedValue({ imported: 3, skipped: 0 });

    const tweets = [makeTweet("1"), makeTweet("2"), makeTweet("3")];
    const users = { u1: { id: "u1", username: "alice", name: "Alice" } };

    const res = await POST(makeImportRequest({ tweets, users, format: "json-flat" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.total).toBe(3);
    expect(json.imported).toBe(3);
    expect(json.skipped).toBe(0);
    expect(json.errors).toBe(0);
    expect(json.format).toBe("json-flat");
    expect(mockUpsertBookmarksBatch).toHaveBeenCalledTimes(1);
  });

  it("handles partial failures in chunked import", async () => {
    // First chunk succeeds, second chunk fails
    mockUpsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 500, skipped: 0 })
      .mockRejectedValueOnce(new Error("DB error"));

    // Create 600 tweets so we get 2 chunks (500 + 100)
    const tweets = Array.from({ length: 600 }, (_, i) => makeTweet(`t-${i}`));
    const users = { u1: { id: "u1", username: "alice", name: "Alice" } };

    const res = await POST(makeImportRequest({ tweets, users }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.total).toBe(600);
    expect(json.imported).toBe(500);
    expect(json.errors).toBe(100);
    expect(mockUpsertBookmarksBatch).toHaveBeenCalledTimes(2);
  });

  it("passes format field through to the response", async () => {
    mockUpsertBookmarksBatch.mockResolvedValue({ imported: 1, skipped: 0 });

    const res = await POST(
      makeImportRequest({
        tweets: [makeTweet("1")],
        users: {},
        format: "csv",
      })
    );
    const json = await res.json();
    expect(json.format).toBe("csv");
  });

  it("reports skipped bookmarks from upsert", async () => {
    mockUpsertBookmarksBatch.mockResolvedValue({ imported: 1, skipped: 2 });

    const tweets = [makeTweet("1"), makeTweet("2"), makeTweet("3")];
    const res = await POST(makeImportRequest({ tweets, users: {} }));
    const json = await res.json();
    expect(json.imported).toBe(1);
    expect(json.skipped).toBe(2);
  });

  it("returns 400 for non-JSON request body", async () => {
    const req = new Request("http://localhost:3000/api/v1/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("handles empty tweets array successfully", async () => {
    const res = await POST(makeImportRequest({ tweets: [], users: {} }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.total).toBe(0);
    expect(json.imported).toBe(0);
    expect(json.errors).toBe(0);
    // No chunks to process when array is empty
    expect(mockUpsertBookmarksBatch).not.toHaveBeenCalled();
  });
});
