// ABOUTME: Tests for sync orchestration logic (shared/sync.ts).
// ABOUTME: Uses a mock BookmarkRepository to verify pagination, deduplication, and counting.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tweet, User, BookmarkResponse, FolderResponse } from "../shared/types";
import type { BookmarkRepository } from "../shared/repository";

// Mock the API module
vi.mock("../shared/api", () => ({
  getMe: vi.fn(),
  getBookmarks: vi.fn(),
  getBookmarkFolders: vi.fn(),
  getFolderBookmarks: vi.fn(),
  fetchArticleMetadata: vi.fn(),
}));

import { syncBookmarks } from "../shared/sync";
import { getMe, getBookmarks, getBookmarkFolders, getFolderBookmarks, fetchArticleMetadata } from "../shared/api";
import type { FolderBookmarkIdsResponse } from "../shared/api";

const mockGetMe = vi.mocked(getMe);
const mockGetBookmarks = vi.mocked(getBookmarks);
const mockGetBookmarkFolders = vi.mocked(getBookmarkFolders);
const mockGetFolderBookmarks = vi.mocked(getFolderBookmarks);
const mockFetchArticleMetadata = vi.mocked(fetchArticleMetadata);

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

function makeFolderResponse(
  folders: { id: string; name: string }[],
  nextToken?: string
): FolderResponse {
  return { folders, nextToken };
}

function makeFolderBookmarkIds(
  tweetIds: string[],
  nextToken?: string
): FolderBookmarkIdsResponse {
  return { tweetIds, nextToken };
}

// Suppress console.log for sync progress messages
vi.spyOn(console, "log").mockImplementation(() => {});

// Create a mock BookmarkRepository
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
    // Unused by sync but required by interface
    getBookmarkCount: vi.fn().mockResolvedValue(0),
    getNewBookmarks: vi.fn().mockResolvedValue([]),
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
  // Default: no folders
  mockGetBookmarkFolders.mockResolvedValue(makeFolderResponse([]));
});

describe("syncBookmarks", () => {
  it("fetches and stores bookmarks", async () => {
    const users = makeUsers(["u1", "Alice", "alice"]);
    mockGetBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse(
        [
          { id: "t1", text: "tweet one", author_id: "u1" },
          { id: "t2", text: "tweet two", author_id: "u1" },
        ],
        users
      )
    );
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 2, skipped: 0 });

    const result = await syncBookmarks(repo, "token");

    expect(result.fetched).toBe(2);
    expect(result.newCount).toBe(2);
    expect(repo.upsertBookmarksBatch).toHaveBeenCalledTimes(1);
    expect(repo.upsertBookmarksBatch).toHaveBeenCalledWith(
      [
        { id: "t1", text: "tweet one", author_id: "u1" },
        { id: "t2", text: "tweet two", author_id: "u1" },
      ],
      users
    );
    expect(repo.upsertBookmark).not.toHaveBeenCalled();
    expect(repo.logSync).toHaveBeenCalledWith(2, 2);
  });

  it("fetches user info on first sync", async () => {
    repo.getUserInfo.mockResolvedValue(null); // No cached user
    mockGetMe.mockResolvedValueOnce({ id: "user456", name: "Joe", username: "joe" });
    mockGetBookmarks.mockResolvedValueOnce(makeBookmarkResponse([]));

    await syncBookmarks(repo, "token");

    expect(mockGetMe).toHaveBeenCalledWith("token", undefined);
    expect(repo.setUserInfo).toHaveBeenCalledWith("user_id", "user456");
    expect(repo.setUserInfo).toHaveBeenCalledWith("username", "joe");
  });

  it("uses cached user ID when available", async () => {
    mockGetBookmarks.mockResolvedValueOnce(makeBookmarkResponse([]));

    await syncBookmarks(repo, "token");

    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it("handles pagination across multiple pages", async () => {
    mockGetBookmarks
      .mockResolvedValueOnce(
        makeBookmarkResponse([{ id: "t1", text: "page 1" }], new Map(), "next-page")
      )
      .mockResolvedValueOnce(
        makeBookmarkResponse([{ id: "t2", text: "page 2" }], new Map())
      );

    const result = await syncBookmarks(repo, "token");

    expect(mockGetBookmarks).toHaveBeenCalledTimes(2);
    expect(mockGetBookmarks).toHaveBeenCalledWith("token", "user123", undefined, undefined);
    expect(mockGetBookmarks).toHaveBeenCalledWith("token", "user123", "next-page", undefined);
    expect(result.fetched).toBe(2);
  });

  it("assigns folder to bookmarks that appear in both main list and folders", async () => {
    const sharedTweet: Tweet = { id: "t1", text: "shared", author_id: "u1" };
    const users = makeUsers(["u1", "Alice", "alice"]);

    mockGetBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([sharedTweet], users)
    );
    mockGetBookmarkFolders.mockResolvedValueOnce(
      makeFolderResponse([{ id: "f1", name: "Tech" }])
    );
    mockGetFolderBookmarks.mockResolvedValueOnce(
      makeFolderBookmarkIds(["t1"])
    );
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 1, skipped: 0 });

    const result = await syncBookmarks(repo, "token");

    expect(result.fetched).toBe(1);
    expect(result.newCount).toBe(1);
    expect(repo.upsertBookmarksBatch).toHaveBeenCalledTimes(1);
    expect(repo.assignBookmarkFolderBatch).toHaveBeenCalledWith(["t1"], "f1", "Tech");
    expect(repo.logSync).toHaveBeenCalledWith(1, 1);
  });

  it("correctly counts new vs existing bookmarks", async () => {
    mockGetBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([
        { id: "t1", text: "new" },
        { id: "t2", text: "existing" },
        { id: "t3", text: "also new" },
      ])
    );
    // upsertBookmarksBatch returns imported=2 (new), skipped=1 (existing)
    repo.upsertBookmarksBatch.mockResolvedValueOnce({ imported: 2, skipped: 1 });

    const result = await syncBookmarks(repo, "token");

    expect(result.fetched).toBe(3);
    expect(result.newCount).toBe(2);
    expect(repo.upsertBookmarksBatch).toHaveBeenCalledTimes(1);
    // upsertBookmark (singular) should no longer be called
    expect(repo.upsertBookmark).not.toHaveBeenCalled();
    // isNewBookmark should no longer be called
    expect(repo.isNewBookmark).not.toHaveBeenCalled();
  });

  it("fetches and stores folders and assigns bookmarks", async () => {
    mockGetBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([
        { id: "t10", text: "tech tweet" },
        { id: "t20", text: "fun tweet" },
      ])
    );
    mockGetBookmarkFolders.mockResolvedValueOnce(
      makeFolderResponse([
        { id: "f1", name: "Tech" },
        { id: "f2", name: "Fun" },
      ])
    );
    mockGetFolderBookmarks
      .mockResolvedValueOnce(makeFolderBookmarkIds(["t10"]))
      .mockResolvedValueOnce(makeFolderBookmarkIds(["t20"]));

    const result = await syncBookmarks(repo, "token");

    expect(repo.upsertFolder).toHaveBeenCalledTimes(2);
    expect(repo.upsertFolder).toHaveBeenCalledWith({ id: "f1", name: "Tech" });
    expect(repo.upsertFolder).toHaveBeenCalledWith({ id: "f2", name: "Fun" });
    expect(repo.assignBookmarkFolderBatch).toHaveBeenCalledWith(["t10"], "f1", "Tech");
    expect(repo.assignBookmarkFolderBatch).toHaveBeenCalledWith(["t20"], "f2", "Fun");
    expect(result.fetched).toBe(2);
    expect(result.foldersFound).toBe(2);
    expect(result.folderAssignments).toBe(2);
  });

  it("handles folder bookmark pagination", async () => {
    mockGetBookmarks.mockResolvedValueOnce(
      makeBookmarkResponse([
        { id: "t1", text: "page 1" },
        { id: "t2", text: "page 2" },
      ])
    );
    mockGetBookmarkFolders.mockResolvedValueOnce(
      makeFolderResponse([{ id: "f1", name: "Tech" }])
    );
    mockGetFolderBookmarks
      .mockResolvedValueOnce(makeFolderBookmarkIds(["t1"], "folder-page-2"))
      .mockResolvedValueOnce(makeFolderBookmarkIds(["t2"]));

    const result = await syncBookmarks(repo, "token");

    expect(mockGetFolderBookmarks).toHaveBeenCalledTimes(2);
    expect(mockGetFolderBookmarks).toHaveBeenCalledWith("token", "user123", "f1", undefined, undefined);
    expect(mockGetFolderBookmarks).toHaveBeenCalledWith("token", "user123", "f1", "folder-page-2", undefined);
    expect(repo.assignBookmarkFolderBatch).toHaveBeenCalledTimes(2);
    expect(result.fetched).toBe(2);
  });

  it("logs sync results even with zero bookmarks", async () => {
    mockGetBookmarks.mockResolvedValueOnce(makeBookmarkResponse([]));

    const result = await syncBookmarks(repo, "token");

    expect(result.fetched).toBe(0);
    expect(result.newCount).toBe(0);
    expect(repo.logSync).toHaveBeenCalledWith(0, 0);
  });

  it("fetches article metadata for bookmarks missing image or description", async () => {
    mockGetBookmarks.mockResolvedValueOnce(makeBookmarkResponse([]));
    repo.getArticleBookmarksMissingMetadata.mockResolvedValue([
      { tweet_id: "t100" },
      { tweet_id: "t200" },
    ]);
    mockFetchArticleMetadata
      .mockResolvedValueOnce({
        imageUrl: "https://pbs.twimg.com/media/cover1.jpg",
        previewText: "Article intro text...",
      })
      .mockResolvedValueOnce({ imageUrl: null, previewText: null });

    const result = await syncBookmarks(repo, "token");

    expect(mockFetchArticleMetadata).toHaveBeenCalledTimes(2);
    expect(mockFetchArticleMetadata).toHaveBeenCalledWith("t100");
    expect(mockFetchArticleMetadata).toHaveBeenCalledWith("t200");
    expect(repo.updateArticleMetadata).toHaveBeenCalledTimes(1);
    expect(repo.updateArticleMetadata).toHaveBeenCalledWith(
      "t100",
      "https://pbs.twimg.com/media/cover1.jpg",
      "Article intro text..."
    );
    expect(result.articleImagesFound).toBe(1);
  });

  it("skips article enrichment when no articles need metadata", async () => {
    mockGetBookmarks.mockResolvedValueOnce(makeBookmarkResponse([]));

    const result = await syncBookmarks(repo, "token");

    expect(mockFetchArticleMetadata).not.toHaveBeenCalled();
    expect(result.articleImagesFound).toBe(0);
  });
});
