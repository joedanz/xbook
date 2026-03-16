// ABOUTME: Tests for the v1 sync POST route handler.
// ABOUTME: Covers auth, rate limiting, sync lock, local token loading, and error handling.

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

// Mock api-auth module
vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: vi.fn(),
}));

// Mock sync-lock module
vi.mock("@/lib/sync-lock", () => ({
  acquireSyncLock: vi.fn(),
  releaseSyncLock: vi.fn(),
}));

// Mock db module
const mockRepo = {
  getNewBookmarks: vi.fn(),
  markNewslettered: vi.fn(),
  logNewsletter: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => mockRepo),
}));

// Mock x-auth
vi.mock("@shared/x-auth", () => ({
  refreshXTokenForWeb: vi.fn(),
}));

// Mock encryption
vi.mock("@shared/encryption", () => ({
  encryptIfAvailable: vi.fn((v: string) => v),
  decryptIfAvailable: vi.fn((v: string) => v),
}));

// Mock fs for local token loading
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

// Mock sync module
const mockSyncBookmarks = vi.fn();
vi.mock("@shared/sync", () => ({
  syncBookmarks: (...args: unknown[]) => mockSyncBookmarks(...args),
}));

import { POST } from "../web/app/api/v1/sync/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { authenticateApiRequest } from "../web/lib/api-auth";
import { acquireSyncLock, releaseSyncLock } from "../web/lib/sync-lock";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAuth = vi.mocked(authenticateApiRequest);
const mockedAcquireLock = vi.mocked(acquireSyncLock);
const mockedReleaseLock = vi.mocked(releaseSyncLock);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/v1/sync", {
    method: "POST",
  });
}

describe("POST /api/v1/sync", () => {
  it("returns auth error when authentication fails", async () => {
    mockedAuth.mockResolvedValueOnce({ error: "Unauthorized", status: 401 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns 409 when sync lock cannot be acquired", async () => {
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: 0 });
    mockedAcquireLock.mockResolvedValueOnce(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Sync already in progress");
  });

  it("returns 401 when no tokens file found in local mode", async () => {
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: 0 });
    mockedAcquireLock.mockResolvedValueOnce(true);
    // existsSync returns false by default — no tokens file

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Not authenticated");
  });

  it("always releases sync lock in finally block", async () => {
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: 0 });
    mockedAcquireLock.mockResolvedValueOnce(true);
    // No tokens file — will return 401, but lock should still be released

    await POST(makeRequest());
    expect(mockedReleaseLock).toHaveBeenCalledWith("local");
  });

  it("returns 500 when sync throws an unexpected error", async () => {
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: 0 });
    mockedAcquireLock.mockResolvedValueOnce(true);

    // Mock fs to find tokens
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: Date.now() + 3600000,
      })
    );

    mockSyncBookmarks.mockRejectedValueOnce(new Error("X API down"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
    // Lock must still be released
    expect(mockedReleaseLock).toHaveBeenCalledWith("local");
  });

});
