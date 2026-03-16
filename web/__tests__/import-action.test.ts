import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache before importing actions
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

// Mock session helper
vi.mock("@/lib/session", () => ({
  requireUser: () => Promise.resolve({ userId: "test-user" }),
}));

// Mock repository
const mockRepo = {
  upsertBookmarksBatch: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  getRepository: () => mockRepo,
}));

// Mock rate-limit — default to allowed; override in specific tests
const mockCheckRateLimit = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 9,
  resetAt: Date.now() + 3600000,
});
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit"
  );
  return {
    ...actual,
    checkRateLimit: mockCheckRateLimit,
  };
});

// Import after mocks are set up
const { importBookmarks } = await import("@/lib/actions");

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to default happy-path for rate limiting
  mockCheckRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetAt: Date.now() + 3600000,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTweet(id: string) {
  return { id, text: `Tweet ${id}`, created_at: "2026-03-01T12:00:00Z", author_id: "user-1" };
}

function makeTweets(count: number) {
  return Array.from({ length: count }, (_, i) => makeTweet(String(i + 1)));
}

const USERS_OBJ: Record<string, { id: string; name: string; username: string }> = {
  "user-1": { id: "user-1", name: "Test User", username: "testuser" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("importBookmarks", () => {
  it("happy path — small import returns correct counts", async () => {
    const tweets = makeTweets(10);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 8, skipped: 2 });

    const result = await importBookmarks(tweets, USERS_OBJ);

    expect(result).toEqual({
      success: true,
      total: 10,
      imported: 8,
      skipped: 2,
      errors: 0,
      format: undefined,
    });
    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(1);
  });

  it("returns error when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 3600000,
    });

    const result = await importBookmarks(makeTweets(5), USERS_OBJ);

    expect(result).toEqual({
      success: false,
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      error: "Too many import requests.",
    });
    // Should not touch the repo at all
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects when tweets exceed MAX_IMPORT_TWEETS (50000)", async () => {
    // Create an array with length > 50000 without allocating real objects
    const oversizedTweets = new Array(50_001).fill(makeTweet("1"));

    const result = await importBookmarks(oversizedTweets, USERS_OBJ);

    expect(result).toEqual({
      success: false,
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      format: undefined,
      error: "Too many items (max 50000)",
    });
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("chunks 1200 tweets into 3 batches (500+500+200)", async () => {
    const tweets = makeTweets(1200);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 0, skipped: 0 });

    await importBookmarks(tweets, USERS_OBJ);

    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(3);

    // Verify chunk sizes
    const call1Args = mockRepo.upsertBookmarksBatch.mock.calls[0][0];
    const call2Args = mockRepo.upsertBookmarksBatch.mock.calls[1][0];
    const call3Args = mockRepo.upsertBookmarksBatch.mock.calls[2][0];
    expect(call1Args).toHaveLength(500);
    expect(call2Args).toHaveLength(500);
    expect(call3Args).toHaveLength(200);
  });

  it("handles partial failure — first chunk succeeds, second throws", async () => {
    const tweets = makeTweets(800); // 2 chunks: 500 + 300
    mockRepo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 450, skipped: 50 })
      .mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await importBookmarks(tweets, USERS_OBJ);

    expect(result).toEqual({
      success: true,
      total: 800,
      imported: 450,
      skipped: 50,
      errors: 300, // second chunk of 300 items counted as errors
      format: undefined,
    });
    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(2);
  });

  it("revalidates /bookmarks and /dashboard after import", async () => {
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 1, skipped: 0 });

    await importBookmarks(makeTweets(1), USERS_OBJ);

    expect(revalidatePath).toHaveBeenCalledWith("/bookmarks");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("passes format string through to the response", async () => {
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 5, skipped: 0 });

    const result = await importBookmarks(makeTweets(5), USERS_OBJ, "twitter-archive");

    expect(result.format).toBe("twitter-archive");
  });

  it("accumulates counts across multiple chunks correctly", async () => {
    const tweets = makeTweets(1500); // 3 chunks: 500+500+500
    mockRepo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 400, skipped: 100 })
      .mockResolvedValueOnce({ imported: 350, skipped: 150 })
      .mockResolvedValueOnce({ imported: 480, skipped: 20 });

    const result = await importBookmarks(tweets, USERS_OBJ);

    expect(result).toEqual({
      success: true,
      total: 1500,
      imported: 1230,   // 400 + 350 + 480
      skipped: 270,     // 100 + 150 + 20
      errors: 0,
      format: undefined,
    });
  });

  it("passes the users Map to upsertBookmarksBatch", async () => {
    const tweets = makeTweets(3);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 3, skipped: 0 });

    await importBookmarks(tweets, USERS_OBJ);

    // Second argument should be a Map created from the users object
    const usersArg = mockRepo.upsertBookmarksBatch.mock.calls[0][1];
    expect(usersArg).toBeInstanceOf(Map);
    expect(usersArg.get("user-1")).toEqual({ id: "user-1", name: "Test User", username: "testuser" });
  });
});
