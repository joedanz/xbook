// ABOUTME: Tests for the X API client (shared/api.ts).
// ABOUTME: Mocks global fetch to verify URL construction, response parsing, and rate limit retry.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMe, getBookmarks, getBookmarkFolders, getFolderBookmarks, fetchArticleMetadata } from "../shared/api";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Suppress console.log for rate limit retry messages
vi.spyOn(console, "log").mockImplementation(() => {});

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key] || null,
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe("getMe", () => {
  it("fetches the authenticated user", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { id: "123", name: "Joe", username: "joe" } })
    );

    const user = await getMe("test-token");

    expect(user).toEqual({ id: "123", name: "Joe", username: "joe" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.x.com/2/users/me",
      { headers: { Authorization: "Bearer test-token" } }
    );
  });
});

describe("getBookmarks", () => {
  it("fetches bookmarks and builds users map", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: "t1", text: "tweet one", author_id: "u1", created_at: "2024-01-01" },
          { id: "t2", text: "tweet two", author_id: "u2", created_at: "2024-01-02" },
        ],
        includes: {
          users: [
            { id: "u1", name: "Alice", username: "alice" },
            { id: "u2", name: "Bob", username: "bob" },
          ],
        },
        meta: { result_count: 2 },
      })
    );

    const result = await getBookmarks("token", "user123");

    expect(result.tweets).toHaveLength(2);
    expect(result.tweets[0].id).toBe("t1");
    expect(result.users.get("u1")?.username).toBe("alice");
    expect(result.users.get("u2")?.name).toBe("Bob");
    expect(result.nextToken).toBeUndefined();

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/2/users/user123/bookmarks");
    expect(url.searchParams.get("max_results")).toBe("100");
    expect(url.searchParams.get("tweet.fields")).toBe("created_at,author_id,attachments,entities");
    expect(url.searchParams.get("media.fields")).toBe("url,preview_image_url,type");
    expect(url.searchParams.get("expansions")).toContain("attachments.media_keys");
  });

  it("extracts media URL from includes.media", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "t1",
            text: "check this out",
            author_id: "u1",
            attachments: { media_keys: ["media_1"] },
          },
          { id: "t2", text: "no image", author_id: "u1" },
        ],
        includes: {
          users: [{ id: "u1", name: "Alice", username: "alice" }],
          media: [
            { media_key: "media_1", type: "photo", url: "https://pbs.twimg.com/media/photo1.jpg" },
          ],
        },
        meta: { result_count: 2 },
      })
    );

    const result = await getBookmarks("token", "user123");

    expect(result.tweets[0].media_url).toBe("https://pbs.twimg.com/media/photo1.jpg");
    expect(result.tweets[1].media_url).toBeUndefined();
  });

  it("uses preview_image_url for video media", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "t1",
            text: "video tweet",
            author_id: "u1",
            attachments: { media_keys: ["media_v1"] },
          },
        ],
        includes: {
          users: [{ id: "u1", name: "Alice", username: "alice" }],
          media: [
            { media_key: "media_v1", type: "video", preview_image_url: "https://pbs.twimg.com/media/thumb1.jpg" },
          ],
        },
        meta: { result_count: 1 },
      })
    );

    const result = await getBookmarks("token", "user123");

    expect(result.tweets[0].media_url).toBe("https://pbs.twimg.com/media/thumb1.jpg");
  });

  it("passes pagination token when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "t3", text: "page two" }],
        meta: { next_token: "next123" },
      })
    );

    const result = await getBookmarks("token", "user123", "page-token-abc");

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("pagination_token")).toBe("page-token-abc");
    expect(result.nextToken).toBe("next123");
  });

  it("handles empty response (no bookmarks)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ meta: { result_count: 0 } })
    );

    const result = await getBookmarks("token", "user123");

    expect(result.tweets).toEqual([]);
    expect(result.users.size).toBe(0);
    expect(result.nextToken).toBeUndefined();
  });
});

describe("getBookmarkFolders", () => {
  it("fetches folders", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: "f1", name: "Tech" },
          { id: "f2", name: "Fun" },
        ],
      })
    );

    const result = await getBookmarkFolders("token", "user123");

    expect(result.folders).toHaveLength(2);
    expect(result.folders[0]).toEqual({ id: "f1", name: "Tech" });

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/2/users/user123/bookmarks/folders");
  });

  it("handles pagination", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "f1", name: "Tech" }],
        meta: { next_token: "folder-page-2" },
      })
    );

    const result = await getBookmarkFolders("token", "user123");
    expect(result.nextToken).toBe("folder-page-2");
  });

  it("handles empty folders list", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const result = await getBookmarkFolders("token", "user123");
    expect(result.folders).toEqual([]);
  });
});

describe("getFolderBookmarks", () => {
  it("constructs the correct URL and returns tweet IDs only", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "t10" }, { id: "t20" }],
      })
    );

    const result = await getFolderBookmarks("token", "user123", "folder-abc");

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/2/users/user123/bookmarks/folders/folder-abc");
    expect(url.pathname).not.toContain("/tweets");

    // Should NOT send tweet.fields, expansions, etc. (folder endpoint doesn't support them)
    expect(url.searchParams.has("tweet.fields")).toBe(false);
    expect(url.searchParams.has("expansions")).toBe(false);
    expect(url.searchParams.has("user.fields")).toBe(false);
    expect(url.searchParams.has("max_results")).toBe(false);

    expect(result.tweetIds).toEqual(["t10", "t20"]);
    expect(result.nextToken).toBeUndefined();
  });

  it("handles pagination", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "t1" }],
        meta: { next_token: "page2" },
      })
    );

    const result = await getFolderBookmarks("token", "user123", "f1", "page1");

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("pagination_token")).toBe("page1");
    expect(result.nextToken).toBe("page2");
  });

  it("handles empty folder", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const result = await getFolderBookmarks("token", "user123", "f1");

    expect(result.tweetIds).toEqual([]);
  });
});

describe("rate limit handling", () => {
  it("retries after rate limit with wait", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 1; // 1 second from now

    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ error: "rate limited" }, 429, {
          "x-rate-limit-reset": String(resetTime),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: "123", name: "Joe", username: "joe" } })
      );

    const user = await getMe("token");

    expect(user).toEqual({ id: "123", name: "Joe", username: "joe" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 1;

    mockFetch.mockResolvedValue(
      jsonResponse({ error: "rate limited" }, 429, {
        "x-rate-limit-reset": String(resetTime),
      })
    );

    await expect(getMe("token")).rejects.toThrow("Rate limited after maximum retries");
    // 1 initial attempt + 3 retries = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe("error handling", () => {
  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Unauthorized" }, 403)
    );

    await expect(getMe("bad-token")).rejects.toThrow("API error 403");
  });
});

describe("fetchArticleMetadata", () => {
  it("returns image URL and preview text from syndication API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          article: {
            preview_text: "This is the article intro...",
            cover_media: {
              media_info: {
                original_img_url: "https://pbs.twimg.com/media/cover.jpg",
              },
            },
          },
        }),
    });

    const result = await fetchArticleMetadata("tweet123");

    expect(result.imageUrl).toBe("https://pbs.twimg.com/media/cover.jpg");
    expect(result.previewText).toBe("This is the article intro...");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn.syndication.twimg.com/tweet-result?id=tweet123&token=x"
    );
  });

  it("returns nulls when article has no metadata", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ article: { title: "Some Article" } }),
    });

    const result = await fetchArticleMetadata("tweet456");

    expect(result.imageUrl).toBeNull();
    expect(result.previewText).toBeNull();
  });

  it("returns nulls on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchArticleMetadata("tweet789");

    expect(result).toEqual({ imageUrl: null, previewText: null });
  });

  it("returns nulls on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchArticleMetadata("tweet000");

    expect(result).toEqual({ imageUrl: null, previewText: null });
  });
});
