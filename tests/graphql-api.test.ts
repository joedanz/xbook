// ABOUTME: Tests for the GraphQL bookmarks client (shared/graphql-api.ts).
// ABOUTME: Mocks global.fetch to verify request construction, response normalization, and error handling.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getGraphQLBookmarks } from "../shared/graphql-api";
import type { ChromeCookies } from "../shared/types";

// Suppress console.log/warn during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const cookies: ChromeCookies = { ct0: "test-csrf", authToken: "test-auth" };

/** Build a minimal GraphQL response structure with the given entries. */
function makeGraphQLResponse(entries: unknown[]) {
  return {
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries,
            },
          ],
        },
      },
    },
  };
}

/** Build a tweet entry matching X's GraphQL shape. */
function makeTweetEntry(
  id: string,
  overrides?: {
    text?: string;
    userId?: string;
    screenName?: string;
    userName?: string;
    createdAt?: string;
    favoriteCount?: number;
    retweetCount?: number;
    replyCount?: number;
    quoteCount?: number;
    mediaUrl?: string;
    urls?: { expanded_url?: string; title?: string; description?: string }[];
  }
) {
  const opts = {
    text: "Hello world",
    userId: "user1",
    screenName: "alice",
    userName: "Alice",
    createdAt: "Wed Oct 10 20:19:24 +0000 2018",
    favoriteCount: 42,
    retweetCount: 5,
    replyCount: 3,
    quoteCount: 1,
    ...overrides,
  };

  return {
    entryId: `tweet-${id}`,
    content: {
      itemContent: {
        tweet_results: {
          result: {
            rest_id: id,
            legacy: {
              full_text: opts.text,
              created_at: opts.createdAt,
              favorite_count: opts.favoriteCount,
              retweet_count: opts.retweetCount,
              reply_count: opts.replyCount,
              quote_count: opts.quoteCount,
              entities: {
                media: opts.mediaUrl
                  ? [{ media_url_https: opts.mediaUrl }]
                  : undefined,
                urls: opts.urls ?? [],
              },
            },
            core: {
              user_results: {
                result: {
                  rest_id: opts.userId,
                  legacy: {
                    screen_name: opts.screenName,
                    name: opts.userName,
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function makeCursorEntry(type: "bottom" | "top", value: string) {
  return {
    entryId: `cursor-${type}-${value}`,
    content: { value },
  };
}

function mockFetchResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers?.[key] ?? null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGraphQLBookmarks", () => {
  it("fetches and normalizes a response with 2 tweets", async () => {
    const entries = [
      makeTweetEntry("123", { text: "First tweet", userId: "u1", screenName: "alice", userName: "Alice" }),
      makeTweetEntry("456", { text: "Second tweet", userId: "u2", screenName: "bob", userName: "Bob" }),
      makeCursorEntry("bottom", "cursor_next_page"),
      makeCursorEntry("top", "cursor_top_page"),
    ];
    mockFetchResponse(makeGraphQLResponse(entries));

    const result = await getGraphQLBookmarks(cookies);

    expect(result.tweets).toHaveLength(2);
    expect(result.tweets[0].id).toBe("123");
    expect(result.tweets[0].text).toBe("First tweet");
    expect(result.tweets[1].id).toBe("456");
    expect(result.tweets[1].text).toBe("Second tweet");
    expect(result.users.size).toBe(2);
    expect(result.users.get("u1")).toEqual({ id: "u1", name: "Alice", username: "alice" });
    expect(result.users.get("u2")).toEqual({ id: "u2", name: "Bob", username: "bob" });
    expect(result.nextToken).toBe("cursor_next_page");
  });

  it("maps all Tweet fields correctly", async () => {
    const entries = [
      makeTweetEntry("t1", {
        text: "Full fields",
        userId: "u1",
        screenName: "carol",
        userName: "Carol",
        createdAt: "Mon Jan 01 12:00:00 +0000 2024",
        favoriteCount: 100,
        retweetCount: 50,
        replyCount: 25,
        quoteCount: 10,
        mediaUrl: "https://pbs.twimg.com/media/abc.jpg",
        urls: [
          { expanded_url: "https://example.com", title: "Example", description: "A page" },
        ],
      }),
    ];
    mockFetchResponse(makeGraphQLResponse(entries));

    const result = await getGraphQLBookmarks(cookies);
    const tweet = result.tweets[0];

    expect(tweet.id).toBe("t1");
    expect(tweet.text).toBe("Full fields");
    expect(tweet.created_at).toBe("Mon Jan 01 12:00:00 +0000 2024");
    expect(tweet.author_id).toBe("u1");
    expect(tweet.like_count).toBe(100);
    expect(tweet.retweet_count).toBe(50);
    expect(tweet.reply_count).toBe(25);
    expect(tweet.quote_count).toBe(10);
    expect(tweet.media_url).toBe("https://pbs.twimg.com/media/abc.jpg");
    expect(tweet.url_title).toBe("Example");
    expect(tweet.url_description).toBe("A page");
    expect(tweet.expanded_url).toBe("https://example.com");
    expect(tweet.impression_count).toBeUndefined();
  });

  it("unwraps TweetWithVisibilityResults wrapper", async () => {
    const entry = {
      entryId: "tweet-wrapped",
      content: {
        itemContent: {
          tweet_results: {
            result: {
              __typename: "TweetWithVisibilityResults",
              tweet: {
                rest_id: "wrapped-id",
                legacy: {
                  full_text: "Unwrapped text",
                  favorite_count: 7,
                  retweet_count: 0,
                  reply_count: 0,
                  quote_count: 0,
                  entities: { urls: [] },
                },
                core: {
                  user_results: {
                    result: {
                      rest_id: "u-wrapped",
                      legacy: { screen_name: "wrapped_user", name: "Wrapped User" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    mockFetchResponse(makeGraphQLResponse([entry]));

    const result = await getGraphQLBookmarks(cookies);

    expect(result.tweets).toHaveLength(1);
    expect(result.tweets[0].id).toBe("wrapped-id");
    expect(result.tweets[0].text).toBe("Unwrapped text");
    expect(result.users.get("u-wrapped")?.username).toBe("wrapped_user");
  });

  it("extracts cursor-bottom as nextToken and skips cursor-top", async () => {
    const entries = [
      makeTweetEntry("t1"),
      makeCursorEntry("bottom", "abc123"),
      makeCursorEntry("top", "def456"),
    ];
    mockFetchResponse(makeGraphQLResponse(entries));

    const result = await getGraphQLBookmarks(cookies);

    expect(result.nextToken).toBe("abc123");
    expect(result.tweets).toHaveLength(1); // cursor entries are not tweets
  });

  it("returns empty tweets for an empty response", async () => {
    mockFetchResponse(makeGraphQLResponse([]));

    const result = await getGraphQLBookmarks(cookies);

    expect(result.tweets).toEqual([]);
    expect(result.users.size).toBe(0);
    expect(result.nextToken).toBeUndefined();
  });

  it("retries on 429 rate limit and calls onRateLimit callback", async () => {
    // First call: 429 with a reset header
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (key: string) =>
          key === "x-rate-limit-reset"
            ? String(Math.floor(Date.now() / 1000) + 1)
            : null,
      },
      json: async () => ({}),
      text: async () => "",
    });
    // Second call: success
    mockFetchResponse(makeGraphQLResponse([makeTweetEntry("t1")]));

    const onRateLimit = vi.fn();
    const result = await getGraphQLBookmarks(cookies, undefined, 3, { onRateLimit });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onRateLimit).toHaveBeenCalledWith(expect.any(Number), 1, 3);
    expect(result.tweets).toHaveLength(1);
  }, 15000);

  it("throws with update message on 400 (stale query ID)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => "Bad Request",
    });

    await expect(getGraphQLBookmarks(cookies)).rejects.toThrow(
      "Check for an xbook update"
    );
  });

  it("throws on redirect (302) instead of following it", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => "",
    });

    await expect(getGraphQLBookmarks(cookies)).rejects.toThrow(
      "Unexpected redirect"
    );
  });

  it("skips malformed entries and still processes valid tweets", async () => {
    const entries = [
      makeTweetEntry("valid-1", { text: "Good tweet" }),
      // Malformed entry: missing tweet_results entirely
      {
        entryId: "tweet-broken",
        content: {
          itemContent: {
            tweet_results: {
              result: null,
            },
          },
        },
      },
      makeTweetEntry("valid-2", { text: "Also good" }),
    ];
    mockFetchResponse(makeGraphQLResponse(entries));

    const result = await getGraphQLBookmarks(cookies);

    expect(result.tweets).toHaveLength(2);
    expect(result.tweets[0].id).toBe("valid-1");
    expect(result.tweets[1].id).toBe("valid-2");
  });
});
