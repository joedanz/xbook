// ABOUTME: Tests for the dashboard POST /api/sync route handler.
// ABOUTME: Covers local mode token loading, sync lock, rate limiting, and error handling.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation((rl: { resetAt: number }, message = "Too many requests") =>
    NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  ),
  SYNC_RATE_LIMIT: { limit: 5, windowSeconds: 60 },
}));

// Mock sync-lock module
const mockAcquireSyncLock = vi.fn();
const mockReleaseSyncLock = vi.fn();
vi.mock("@/lib/sync-lock", () => ({
  acquireSyncLock: (...args: unknown[]) => mockAcquireSyncLock(...args),
  releaseSyncLock: (...args: unknown[]) => mockReleaseSyncLock(...args),
}));

// Mock db module
const mockRepo = {
  getBookmarkById: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => mockRepo),
}));

// Mock x-auth
const mockRefreshXTokenForWeb = vi.fn();
vi.mock("@shared/x-auth", () => ({
  refreshXTokenForWeb: (...args: unknown[]) => mockRefreshXTokenForWeb(...args),
}));

// Mock fs for token file loading
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    chmodSync: vi.fn(),
  };
});

// Mock sync module (used via dynamic import inside the route)
const mockSyncBookmarks = vi.fn();
vi.mock("@shared/sync", () => ({
  syncBookmarks: (...args: unknown[]) => mockSyncBookmarks(...args),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { POST } from "../web/app/api/sync/route";
import { checkRateLimit } from "../web/lib/rate-limit";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

const savedEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]) {
  for (const key of keys) savedEnv[key] = process.env[key];
}

function restoreEnv() {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/sync", { method: "POST" });
}

function validTokens() {
  return JSON.stringify({
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt: Date.now() + 3_600_000, // 1 hour from now
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveEnv("DATABASE_URL", "X_CLIENT_ID", "X_CLIENT_SECRET", "TOKEN_FILE_PATH");
  delete process.env.DATABASE_URL;
  process.env.X_CLIENT_ID = "test-client-id";
  process.env.X_CLIENT_SECRET = "test-client-secret";
  delete process.env.TOKEN_FILE_PATH;
  // Default: rate limit passes and lock acquires
  mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
  mockAcquireSyncLock.mockResolvedValue(true);
  mockReleaseSyncLock.mockResolvedValue(undefined);
});

afterEach(() => {
  restoreEnv();
});

describe("POST /api/sync (dashboard)", () => {
  // ── Local mode: no tokens file ──────────────────────────────────────

  it("returns 401 when .tokens.json is missing (local mode)", async () => {
    // existsSync returns false by default — no token file found

    const res = await POST();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain("Not authenticated");
  });

  it("releases lock when .tokens.json is missing", async () => {
    await POST();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith("local");
  });

  // ── Rate limiting ────────────────────────────────────────────────────

  it("returns 429 when rate limit is exceeded", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const res = await POST();
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("does not acquire lock when rate limited", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    await POST();
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
  });

  // ── Sync lock ────────────────────────────────────────────────────────

  it("returns 409 when sync lock cannot be acquired", async () => {
    mockAcquireSyncLock.mockResolvedValueOnce(false);

    const res = await POST();
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toBe("Sync already in progress");
  });

  it("does not release lock when lock was never acquired", async () => {
    mockAcquireSyncLock.mockResolvedValueOnce(false);

    await POST();
    expect(mockReleaseSyncLock).not.toHaveBeenCalled();
  });

  // ── Missing credentials ──────────────────────────────────────────────

  it("returns 500 when X_CLIENT_ID is missing", async () => {
    delete process.env.X_CLIENT_ID;

    const res = await POST();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain("X_CLIENT_ID");
  });

  it("releases lock when credentials are missing", async () => {
    delete process.env.X_CLIENT_ID;

    await POST();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith("local");
  });

  // ── Successful sync ──────────────────────────────────────────────────

  it("returns 200 with sync result data on success", async () => {
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(validTokens());

    mockSyncBookmarks.mockResolvedValueOnce({ fetched: 42, newCount: 7, pages: 2 });

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.fetched).toBe(42);
    expect(json.newCount).toBe(7);
    expect(json.pages).toBe(2);
    expect(json.message).toContain("42");
    expect(json.message).toContain("7 new");
  });

  it("releases lock in finally block on success", async () => {
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(validTokens());
    mockSyncBookmarks.mockResolvedValueOnce({ fetched: 10, newCount: 2, pages: 1 });

    await POST();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith("local");
  });

  // ── Error handling ────────────────────────────────────────────────────

  it("returns 500 when sync throws an unexpected error", async () => {
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(validTokens());

    mockSyncBookmarks.mockRejectedValueOnce(new Error("X API down"));

    const res = await POST();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain("Sync failed");
  });

  it("releases lock in finally block even when sync throws", async () => {
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(validTokens());

    mockSyncBookmarks.mockRejectedValueOnce(new Error("Network error"));

    await POST();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith("local");
  });

  // ── Token refresh ────────────────────────────────────────────────────

  it("refreshes token when it is about to expire", async () => {
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        accessToken: "old-token",
        refreshToken: "old-refresh",
        expiresAt: Date.now() - 1000, // already expired
      })
    );
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    mockRefreshXTokenForWeb.mockResolvedValueOnce({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: Date.now() + 7_200_000,
    });
    mockSyncBookmarks.mockResolvedValueOnce({ fetched: 5, newCount: 1, pages: 1 });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockRefreshXTokenForWeb).toHaveBeenCalledWith(
      "old-refresh",
      "test-client-id",
      "test-client-secret"
    );
  });
});
