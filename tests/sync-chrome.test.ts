// ABOUTME: Tests for the Chrome sync orchestrator (shared/sync-chrome.ts).
// ABOUTME: Mocks the GraphQL API module and uses a mock BookmarkRepository to verify pagination, deduplication, and filtering.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tweet, User, BookmarkResponse } from "../shared/types";
import type { BookmarkRepository } from "../shared/repository";

// Mock the GraphQL API module
vi.mock("../shared/graphql-api", () => ({
  getGraphQLBookmarks: vi.fn(),
}));

import { syncBookmarksChrome } from "../shared/sync-chrome";
import { getGraphQLBookmarks } from "../shared/graphql-api";

const mockGetGraphQLBookmarks = vi.mocked(getGraphQLBookmarks);

// Suppress console.log/warn during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

function makeUsers(...entries: [string, string, string][]): Map<string, User> {
  const map = new Map<string, User>();
  for (const [id, name, username] of entries) {
    map.set(id, { id, name, username });
  }
  return map;
}

function makeBookmarkResponse(
  tweets: Tweet[],
  users: Map<string, User> = new Map(),
  nextToken?: string
): BookmarkResponse {
  return { tweets, users, nextToken };
}

// Create a mock BookmarkRepository (same pattern as sync.test.ts)
function createMockRepo(): BookmarkRepository & { [key: string]: ReturnType<typeof vi.fn> } {
  return {
    getUserInfo: vi.fn().mockResolvedValue("user123"),
    setUserInfo: vi.fn().mockResolvedValue(undefined),
    upsertBookmark: vi.fn().mockResolvedValue(true),
    upsertBookmarksBatch: vi.fn().mockResolvedValue({ imported: 0, skipped: 0 }),
    upsertFolder: vi.fn().mockResolvedValue(undefined),
    isNewBookmark: vi.fn().mockResolvedValue(true),
    assignBookmarkFolder: vi.fn().mockResolvedValue(undefined),
    assignBookmarkFolderBatch: vi.fn().mockResolvedValue(undefined),
    getArticleBookmarksMissingMetadata: vi.fn().mockResolvedValue([]),
    updateArticleMetadata: vi.fn().mockResolvedValue(undefined),
    logSync: vi.fn().mockResolvedValue(undefined),
    getBookmarkCount: vi.fn().mockResolvedValue(0),
    getNewBookmarks: vi.fn().mockResolvedValue([]),
    getNewsletterBookmarks: vi.fn().mockResolvedValue([]),
    getNewsletterBookmarkCount: vi.fn().mockResolvedValue(0),
    markNewslettered: vi.fn().mockResolvedValue(undefined),
    logNewsletter: vi.fn().mockResolvedValue(undefined),
    queryBookmarks: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
    getBookmarkById: vi.fn().mockResolvedValue(null),
    getFolders: vi.fn().mockResolvedValue([]),
    getAuthors: vi.fn().mockResolvedValue([]),
    searchBookmarks: vi.fn().mockResolvedValue([]),
    hideBookmark: vi.fn().mockResolvedValue(false),
    unhideBookmark: vi.fn().mockResolvedValue(false),
    deleteBookmark: vi.fn().mockResolvedValue(false),
    undeleteBookmark: vi.fn().mockResolvedValue(false),
    getHiddenTweetIds: vi.fn().mockResolvedValue(new Set()),
    moveBookmarkToFolder: vi.fn().mockResolvedValue(false),
    updateBookmarkNotes: vi.fn().mockResolvedValue(false),
    toggleStarred: vi.fn().mockResolvedValue(false),
    toggleNeedToRead: vi.fn().mockResolvedValue(false),
    setStarred: vi.fn().mockResolvedValue(false),
    setNeedToRead: vi.fn().mockResolvedValue(false),
    addBookmarkTag: vi.fn().mockResolvedValue(false),
    removeBookmarkTag: vi.fn().mockResolvedValue(false),
    getAllTags: vi.fn().mockResolvedValue([]),
    getSyncHistory: vi.fn().mockResolvedValue([]),
    getNewsletterHistory: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ totalBookmarks: 0, folderCount: 0, lastSyncAt: null, lastNewsletterAt: null, bookmarksByFolder: [] }),
    close: vi.fn(),
  };
}

let repo: ReturnType<typeof createMockRepo>;

beforeEach(() => {
  vi.clearAllMocks();
  repo = createMockRepo();
  // Default: no last_synced_tweet_id
  repo.getUserInfo.mockImplementation(async (key: string) =>
    key === "last_synced_tweet_id" ? null : "user123"
  );
});

describe("syncBookmarksChrome", () => {
  it("fetches and stores bookmarks across 2 pages", async () => {
    const users = makeUsers(["u1", "Alice", "alice"]);
    mockGetGraphQLBookmarks
      .mockResolvedValueOnce(
        makeBookmarkResponse(
          [{ id: "t1", text: "page 1", author_id: "u1" }],
          users,
          "next-page"
        )
      )
      .mockResolvedValueOnce(
        makeBookmarkResponse(
          [{ id: "t2", text: "page 2", author_id: "u1" }],
          users
        )
      );
    repo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 1, skipped: 0 })
      .mockResolvedValueOnce({ imported: 1, skipped: 0 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies);

    expect(result.fetched).toBe(2);
    expect(result.newCount).toBe(2);
    expect(result.pages).toBe(2);
    expect(repo.upsertBookmarksBatch).toHaveBeenCalledTimes(2);
    expect(mockGetGraphQLBookmarks).toHaveBeenCalledTimes(2);
  });

  it("terminates early when last_synced_tweet_id is reached (incremental sync)", async () => {
    repo.getUserInfo.mockImplementation(async (key: string) =>
      key === "last_synced_tweet_id" ? "t2" : "user123"
    );

    mockGetGraphQLBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse(
        [
          { id: "t1", text: "new tweet" },
          { id: "t2", text: "last synced" },
        ],
        new Map(),
        "would-have-next-page"
      )
    );
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 1, skipped: 1 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies);

    expect(result.earlyTerminated).toBe(true);
    expect(result.fetched).toBe(2);
    expect(mockGetGraphQLBookmarks).toHaveBeenCalledTimes(1);
  });

  it("does not terminate early when full: true even if horizon tweet is present", async () => {
    repo.getUserInfo.mockImplementation(async (key: string) =>
      key === "last_synced_tweet_id" ? "t1" : "user123"
    );

    mockGetGraphQLBookmarks
      .mockResolvedValueOnce(
        makeBookmarkResponse(
          [{ id: "t1", text: "known" }],
          new Map(),
          "next"
        )
      )
      .mockResolvedValueOnce(
        makeBookmarkResponse(
          [{ id: "t2", text: "also known" }],
          new Map()
        )
      );
    repo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 0, skipped: 1 })
      .mockResolvedValueOnce({ imported: 0, skipped: 1 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies, undefined, undefined, { full: true });

    expect(result.earlyTerminated).toBe(false);
    expect(result.pages).toBe(2);
    expect(mockGetGraphQLBookmarks).toHaveBeenCalledTimes(2);
  });

  it("filters out hidden bookmarks before upsert", async () => {
    repo.getHiddenTweetIds.mockResolvedValue(new Set(["t2"]));

    mockGetGraphQLBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse(
        [
          { id: "t1", text: "visible" },
          { id: "t2", text: "hidden" },
          { id: "t3", text: "also visible" },
        ],
        new Map()
      )
    );
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 2, skipped: 0 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies);

    expect(result.fetched).toBe(2);
    // Verify hidden tweet was filtered out of the batch
    const batchCall = repo.upsertBookmarksBatch.mock.calls[0];
    const upsertedTweets = batchCall[0] as Tweet[];
    expect(upsertedTweets).toHaveLength(2);
    expect(upsertedTweets.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("deduplicates tweets across pages", async () => {
    mockGetGraphQLBookmarks
      .mockResolvedValueOnce(
        makeBookmarkResponse(
          [{ id: "t1", text: "first" }, { id: "t2", text: "second" }],
          new Map(),
          "next"
        )
      )
      .mockResolvedValueOnce(
        makeBookmarkResponse(
          [{ id: "t2", text: "second (dup)" }, { id: "t3", text: "third" }],
          new Map()
        )
      );
    repo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 2, skipped: 0 })
      .mockResolvedValueOnce({ imported: 1, skipped: 0 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies);

    // Page 2 should only upsert t3 (t2 already seen)
    const page2Tweets = repo.upsertBookmarksBatch.mock.calls[1][0] as Tweet[];
    expect(page2Tweets).toHaveLength(1);
    expect(page2Tweets[0].id).toBe("t3");
    expect(result.fetched).toBe(3); // t1 + t2 + t3
  });

  it("returns SyncResult with 0 counts for empty response", async () => {
    mockGetGraphQLBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([], new Map())
    );

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies);

    expect(result.fetched).toBe(0);
    expect(result.newCount).toBe(0);
    expect(result.pages).toBe(1);
    expect(result.earlyTerminated).toBe(false);
  });

  it("returns 0 for foldersFound, folderAssignments, and articleImagesFound", async () => {
    mockGetGraphQLBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([{ id: "t1", text: "tweet" }], new Map())
    );
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 1, skipped: 0 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies);

    expect(result.foldersFound).toBe(0);
    expect(result.folderAssignments).toBe(0);
    expect(result.articleImagesFound).toBe(0);
  });

  it("zeroes out cookies after sync completes", async () => {
    mockGetGraphQLBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([], new Map())
    );

    const cookies = { ct0: "my-csrf-token", authToken: "my-auth-token" };
    await syncBookmarksChrome(repo, cookies);

    expect(cookies.ct0).toBe("");
    expect(cookies.authToken).toBe("");
  });

  it("calls onProgress with log messages", async () => {
    mockGetGraphQLBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([{ id: "t1", text: "tweet" }], new Map())
    );
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 1, skipped: 0 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const onProgress = vi.fn();
    await syncBookmarksChrome(repo, cookies, onProgress);

    expect(onProgress).toHaveBeenCalled();
    // Should include page progress and completion messages
    const messages = onProgress.mock.calls.map((c) => c[0] as string);
    expect(messages.some((m) => m.includes("Page 1"))).toBe(true);
    expect(messages.some((m) => m.includes("complete"))).toBe(true);
  });

  it("respects maxPages limit", async () => {
    mockGetGraphQLBookmarks
      .mockResolvedValueOnce(
        makeBookmarkResponse([{ id: "t1", text: "p1" }], new Map(), "cursor-2")
      )
      .mockResolvedValueOnce(
        makeBookmarkResponse([{ id: "t2", text: "p2" }], new Map(), "cursor-3")
      )
      // Third page should never be fetched
      .mockResolvedValueOnce(
        makeBookmarkResponse([{ id: "t3", text: "p3" }], new Map())
      );
    repo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 1, skipped: 0 })
      .mockResolvedValueOnce({ imported: 1, skipped: 0 });

    const cookies = { ct0: "csrf", authToken: "auth" };
    const result = await syncBookmarksChrome(repo, cookies, undefined, undefined, { maxPages: 2 });

    expect(mockGetGraphQLBookmarks).toHaveBeenCalledTimes(2);
    // page counter increments before the maxPages check, so page=3 when it breaks
    expect(result.pages).toBe(3);
    expect(result.fetched).toBe(2);
  });
});
