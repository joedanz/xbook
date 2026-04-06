import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(),
  getNeonSql: vi.fn(),
}));

vi.mock("@/lib/load-cli-tokens", () => ({
  loadCliTokens: vi.fn(),
  saveCliTokens: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn(),
  SYNC_RATE_LIMIT: { limit: 5, windowSeconds: 60 },
}));

vi.mock("@/lib/sync-lock", () => ({
  acquireSyncLock: vi.fn(),
  releaseSyncLock: vi.fn(),
}));

vi.mock("@/lib/token-refresh", () => ({
  refreshCloudTokens: vi.fn(),
}));

vi.mock("@shared/sync", () => ({
  syncBookmarks: vi.fn(),
}));

vi.mock("@shared/x-auth", () => ({
  refreshXTokenForWeb: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock references — resolved after vi.mock() hoisting
// ---------------------------------------------------------------------------

import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { loadCliTokens, saveCliTokens } from "@/lib/load-cli-tokens";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { acquireSyncLock, releaseSyncLock } from "@/lib/sync-lock";
import { refreshCloudTokens } from "@/lib/token-refresh";
import { syncBookmarks } from "@shared/sync";
import { refreshXTokenForWeb } from "@shared/x-auth";

const mockAuthenticateApiRequest = vi.mocked(authenticateApiRequest);
const mockGetRepository = vi.mocked(getRepository);
const mockLoadCliTokens = vi.mocked(loadCliTokens);
const mockSaveCliTokens = vi.mocked(saveCliTokens);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockRateLimitResponse = vi.mocked(rateLimitResponse);
const mockAcquireSyncLock = vi.mocked(acquireSyncLock);
const mockReleaseSyncLock = vi.mocked(releaseSyncLock);
const mockRefreshCloudTokens = vi.mocked(refreshCloudTokens);
const mockSyncBookmarks = vi.mocked(syncBookmarks);
const mockRefreshXTokenForWeb = vi.mocked(refreshXTokenForWeb);

// ---------------------------------------------------------------------------
// Import the module under test after mocks are wired up
// ---------------------------------------------------------------------------

const { POST } = await import("@/app/api/v1/sync/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): Request {
  return new Request("http://localhost/api/v1/sync", { method: "POST" });
}

/** Tokens that are not yet expired (expires 1 hour from "now"). */
const VALID_TOKENS = {
  accessToken: "access-token-valid",
  refreshToken: "refresh-token-valid",
  expiresAt: Date.now() + 60 * 60 * 1000,
};

/** Tokens whose expiry is in the past, triggering a refresh attempt. */
const EXPIRED_TOKENS = {
  accessToken: "access-token-expired",
  refreshToken: "refresh-token-expired",
  expiresAt: Date.now() - 1000,
};

const SYNC_RESULT = {
  fetched: 42,
  newCount: 10,
  removedCount: 0,
  foldersFound: 3,
  folderAssignments: 2,
  articleImagesFound: 5,
  pages: 1,
  paginationLog: [],
};

const MOCK_REPO = {};

// ---------------------------------------------------------------------------
// Default happy-path setup (local mode, no DATABASE_URL)
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();

  // Restore env before each test; individual tests override as needed.
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL;
  process.env.X_CLIENT_ID = "client-id";
  process.env.X_CLIENT_SECRET = "client-secret";

  // Happy-path defaults for shared middleware mocks
  mockAuthenticateApiRequest.mockResolvedValue({ userId: "local" });
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 });
  mockAcquireSyncLock.mockResolvedValue(true);
  mockReleaseSyncLock.mockResolvedValue(undefined);
  mockGetRepository.mockReturnValue(MOCK_REPO as ReturnType<typeof getRepository>);
  mockSyncBookmarks.mockResolvedValue(SYNC_RESULT);
});

afterEach(() => {
  process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — auth", () => {
  it("returns 401 when authenticateApiRequest returns an error", async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: "Missing API key. Use: Authorization: Bearer <api-key>",
      status: 401,
    });

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/Missing API key/);

    // Nothing downstream should have been called
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — rate limiting", () => {
  it("returns the rateLimitResponse when the rate limit is exceeded", async () => {
    const rlResult = { allowed: false, remaining: 0, resetAt: Date.now() + 60000 };
    mockCheckRateLimit.mockResolvedValue(rlResult);

    const mockRateLimitBody = { error: "Too many requests" };
    const stubResponse = new Response(JSON.stringify(mockRateLimitBody), { status: 429 });
    mockRateLimitResponse.mockReturnValue(stubResponse as ReturnType<typeof rateLimitResponse>);

    const response = await POST(makeRequest());

    expect(mockRateLimitResponse).toHaveBeenCalledWith(rlResult);
    expect(response.status).toBe(429);

    // Sync should not have been attempted
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });

  it("passes the correct rate-limit key scoped to the authenticated userId", async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-abc" });
    mockLoadCliTokens.mockReturnValue(VALID_TOKENS);

    await POST(makeRequest());

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "sync:user-abc",
      expect.objectContaining({ limit: 5, windowSeconds: 60 })
    );
  });
});

// ---------------------------------------------------------------------------
// Sync lock
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — sync lock", () => {
  it("returns 409 when acquireSyncLock returns false", async () => {
    mockAcquireSyncLock.mockResolvedValue(false);

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Sync already in progress");
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Local mode (no DATABASE_URL)
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — local mode", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("happy path: loads CLI tokens, runs sync, and returns counts", async () => {
    mockLoadCliTokens.mockReturnValue(VALID_TOKENS);

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      fetched: SYNC_RESULT.fetched,
      newCount: SYNC_RESULT.newCount,
      foldersFound: SYNC_RESULT.foldersFound,
    });

    expect(mockLoadCliTokens).toHaveBeenCalled();
    expect(mockSyncBookmarks).toHaveBeenCalledWith(MOCK_REPO, VALID_TOKENS.accessToken);
  });

  it("returns 401 when no CLI tokens are found on disk", async () => {
    mockLoadCliTokens.mockReturnValue(null);

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/Not authenticated/);
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });

  it("refreshes expired tokens before syncing and saves them back to disk", async () => {
    mockLoadCliTokens.mockReturnValue(EXPIRED_TOKENS);
    const refreshedTokens = {
      accessToken: "access-token-refreshed",
      refreshToken: "refresh-token-new",
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    };
    mockRefreshXTokenForWeb.mockResolvedValue(refreshedTokens);

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Should have refreshed using the expired refresh token and client credentials
    expect(mockRefreshXTokenForWeb).toHaveBeenCalledWith(
      EXPIRED_TOKENS.refreshToken,
      process.env.X_CLIENT_ID,
      process.env.X_CLIENT_SECRET
    );

    // Sync must use the fresh access token, not the expired one
    expect(mockSyncBookmarks).toHaveBeenCalledWith(MOCK_REPO, refreshedTokens.accessToken);

    // Refreshed tokens must be persisted back to disk
    expect(mockSaveCliTokens).toHaveBeenCalledWith(refreshedTokens);
  });

  it("skips refresh when tokens are still valid (expiresAt in the future)", async () => {
    mockLoadCliTokens.mockReturnValue(VALID_TOKENS);

    await POST(makeRequest());

    expect(mockRefreshXTokenForWeb).not.toHaveBeenCalled();
    expect(mockSaveCliTokens).not.toHaveBeenCalled();
    expect(mockSyncBookmarks).toHaveBeenCalledWith(MOCK_REPO, VALID_TOKENS.accessToken);
  });

  it("skips refresh when X_CLIENT_ID or X_CLIENT_SECRET are not set", async () => {
    mockLoadCliTokens.mockReturnValue(EXPIRED_TOKENS);
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CLIENT_SECRET;

    await POST(makeRequest());

    expect(mockRefreshXTokenForWeb).not.toHaveBeenCalled();
    // Falls through to sync with the original (expired) access token
    expect(mockSyncBookmarks).toHaveBeenCalledWith(MOCK_REPO, EXPIRED_TOKENS.accessToken);
  });

  it("returns 401 when token refresh throws", async () => {
    mockLoadCliTokens.mockReturnValue(EXPIRED_TOKENS);
    mockRefreshXTokenForWeb.mockRejectedValue(new Error("Token refresh failed"));

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/token expired and refresh failed/i);
    expect(data.error).toMatch(/xbook login/i);
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cloud mode (DATABASE_URL set)
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — cloud mode", () => {
  // A mock tagged-template sql function used in cloud mode
  let mockSql: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost/testdb";

    mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-cloud-123" });

    // Build a mock sql tag that returns whatever we configure via mockResolvedValue
    mockSql = vi.fn();

    const { getNeonSql } = await import("@/lib/db");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getNeonSql).mockReturnValue(mockSql as any);

    // Default: user_settings row with valid tokens
    mockSql.mockResolvedValue([
      {
        x_access_token: "cloud-access-token",
        x_refresh_token: "cloud-refresh-token",
        x_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    ]);

    mockRefreshCloudTokens.mockResolvedValue({
      accessToken: "cloud-access-token-refreshed",
      wasRefreshed: false,
    });
  });

  it("happy path: loads tokens from DB, refreshes if needed, runs sync, returns counts", async () => {
    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      fetched: SYNC_RESULT.fetched,
      newCount: SYNC_RESULT.newCount,
      foldersFound: SYNC_RESULT.foldersFound,
    });

    // refreshCloudTokens is called with the DB row, the userId, and the sql tag
    expect(mockRefreshCloudTokens).toHaveBeenCalledWith(
      expect.objectContaining({ x_access_token: "cloud-access-token" }),
      "user-cloud-123",
      mockSql
    );

    // syncBookmarks receives the token returned by refreshCloudTokens
    expect(mockSyncBookmarks).toHaveBeenCalledWith(MOCK_REPO, "cloud-access-token-refreshed");
  });

  it("returns 401 when the user_settings row has no x_access_token", async () => {
    mockSql.mockResolvedValue([{ x_access_token: null, x_refresh_token: null, x_token_expires_at: null }]);

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/X account not connected/i);
    expect(mockRefreshCloudTokens).not.toHaveBeenCalled();
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });

  it("returns 401 when no user_settings row exists for the user", async () => {
    mockSql.mockResolvedValue([]);

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/X account not connected/i);
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });

  it("returns 401 when refreshCloudTokens throws", async () => {
    mockRefreshCloudTokens.mockRejectedValue(new Error("Refresh failed"));

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/token expired and refresh failed/i);
    expect(data.error).toMatch(/reconnect/i);
    expect(mockSyncBookmarks).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Internal errors
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — internal errors", () => {
  it("returns 500 when syncBookmarks throws an unexpected error", async () => {
    mockLoadCliTokens.mockReturnValue(VALID_TOKENS);
    mockSyncBookmarks.mockRejectedValue(new Error("Unexpected DB failure"));

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// Lock lifecycle — releaseSyncLock must run in the finally block
// ---------------------------------------------------------------------------

describe("POST /api/v1/sync — lock lifecycle", () => {
  it("releases the lock after a successful sync", async () => {
    mockLoadCliTokens.mockReturnValue(VALID_TOKENS);

    await POST(makeRequest());

    expect(mockReleaseSyncLock).toHaveBeenCalledWith("local");
    expect(mockReleaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock even when syncBookmarks throws", async () => {
    mockLoadCliTokens.mockReturnValue(VALID_TOKENS);
    mockSyncBookmarks.mockRejectedValue(new Error("Crash during sync"));

    await POST(makeRequest());

    expect(mockReleaseSyncLock).toHaveBeenCalledWith("local");
    expect(mockReleaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it("does not release the lock when the lock was never acquired", async () => {
    mockAcquireSyncLock.mockResolvedValue(false);

    await POST(makeRequest());

    // acquireSyncLock returned false — the try block is never entered, so
    // releaseSyncLock must not be called (it's inside the try/finally).
    expect(mockReleaseSyncLock).not.toHaveBeenCalled();
  });

  it("releases the lock using the correct userId in cloud mode", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost/testdb";
    mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-cloud-xyz" });

    const { getNeonSql } = await import("@/lib/db");
    const mockSql = vi.fn().mockResolvedValue([
      {
        x_access_token: "tok",
        x_refresh_token: "rtok",
        x_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getNeonSql).mockReturnValue(mockSql as any);
    mockRefreshCloudTokens.mockResolvedValue({ accessToken: "tok", wasRefreshed: false });

    await POST(makeRequest());

    expect(mockReleaseSyncLock).toHaveBeenCalledWith("user-cloud-xyz");
  });
});
