// ABOUTME: GraphQL-based X bookmarks client using session cookies (not OAuth).
// ABOUTME: Normalizes X's internal GraphQL responses to the same BookmarkResponse type used by the REST API client.

import type { ChromeCookies, Tweet, User, BookmarkResponse } from "./types";

export interface GraphQLSyncOptions {
  onRateLimit?: (waitSeconds: number, attempt: number, maxRetries: number) => void;
}

/** X's public bearer token — not a secret. Visible in x.com's frontend JS on every page load. */
const PUBLIC_BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

/** X's internal GraphQL query ID for bookmarks. Changes periodically — update when X changes their API. */
const BOOKMARKS_QUERY_ID = "Z9GWmP0kP2dajyckAaDUBw";

const GRAPHQL_URL = `https://x.com/i/api/graphql/${BOOKMARKS_QUERY_ID}/Bookmarks`;

const STALE_QUERY_ERROR =
  "Chrome sync failed — X may have changed their API. Check for an xbook update: npm update -g xbook";

const GRAPHQL_FEATURES_JSON = JSON.stringify({
  graphql_timeline_v2_bookmark_timeline: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_media_download_video_enabled: false,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_grok_share_attachment_enabled: false,
});

/**
 * Fetch bookmarks from X's internal GraphQL endpoint using session cookies.
 * Returns the same BookmarkResponse shape as the REST API client for interchangeability.
 */
export async function getGraphQLBookmarks(
  cookies: ChromeCookies,
  cursor?: string,
  maxRetries: number = 3,
  options?: GraphQLSyncOptions,
): Promise<BookmarkResponse> {
  const variables: Record<string, unknown> = {
    count: 20,
    includePromotedContent: false,
  };
  if (cursor) {
    variables.cursor = cursor;
  }

  const url = new URL(GRAPHQL_URL);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("features", GRAPHQL_FEATURES_JSON);

  // -- Fetch with retry loop --
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        authorization: `Bearer ${PUBLIC_BEARER_TOKEN}`,
        "x-csrf-token": cookies.ct0,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "x-twitter-client-language": "en",
        cookie: `ct0=${cookies.ct0}; auth_token=${cookies.authToken}`,
        "content-type": "application/json",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Redirects should not happen — prevent cookie leakage
    if (res.status >= 300 && res.status < 400) {
      throw new Error(
        `Unexpected redirect (${res.status}) from GraphQL bookmarks endpoint. ` +
          "This may indicate expired cookies or an API change.",
      );
    }

    // Rate limit handling — mirrors the pattern in shared/api.ts
    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error("Rate limited after maximum retries");
      }
      const reset = res.headers.get("x-rate-limit-reset");
      const parsed = reset ? parseInt(reset, 10) : NaN;
      const waitSec = Number.isFinite(parsed)
        ? Math.min(Math.max(1, parsed - Math.floor(Date.now() / 1000)), 900)
        : 60;
      options?.onRateLimit?.(waitSec, attempt + 1, maxRetries);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      continue;
    }

    // Stale query ID detection
    if (res.status === 400) {
      throw new Error(STALE_QUERY_ERROR);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`GraphQL API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const body = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Failed to parse GraphQL response (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }

    // Validate expected structure before normalization
    const data = json as Record<string, unknown>;
    if (!data?.data || !(data.data as Record<string, unknown>)?.bookmark_timeline_v2) {
      throw new Error(STALE_QUERY_ERROR);
    }

    return normalizeGraphQLResponse(json);
  }

  throw new Error("getGraphQLBookmarks: exhausted all retries without a response");
}

// ---------------------------------------------------------------------------
// Normalization — GraphQL response -> BookmarkResponse
// ---------------------------------------------------------------------------

/** Safely access a nested property path on an unknown object. */
function dig(obj: unknown, ...keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Truncate a string to maxLen, returning undefined for empty/missing values. */
function truncate(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

interface GraphQLUrlEntity {
  url?: string;
  expanded_url?: string;
  title?: string;
  description?: string;
  images?: { url: string; width: number; height: number }[];
}

/**
 * Unwrap a tweet result object, handling both direct results and
 * `TweetWithVisibilityResults` wrappers (which nest the real tweet under `.tweet`).
 */
function unwrapTweetResult(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;

  // TweetWithVisibilityResults wraps the real tweet in a `tweet` property
  const typeName = obj.__typename as string | undefined;
  if (typeName === "TweetWithVisibilityResults" && obj.tweet) {
    return obj.tweet as Record<string, unknown>;
  }

  // Sometimes there's an extra `tweet` wrapper even without the type name
  if (obj.tweet && typeof obj.tweet === "object" && dig(obj.tweet, "rest_id")) {
    return obj.tweet as Record<string, unknown>;
  }

  // Direct tweet result
  if (obj.rest_id) {
    return obj;
  }

  return undefined;
}

function normalizeGraphQLResponse(data: unknown): BookmarkResponse {
  const tweets: Tweet[] = [];
  const users = new Map<string, User>();
  let nextToken: string | undefined;

  // Navigate to the entries array
  const instructions = dig(
    data,
    "data",
    "bookmark_timeline_v2",
    "timeline",
    "instructions",
  ) as unknown[] | undefined;

  if (!Array.isArray(instructions)) {
    throw new Error(STALE_QUERY_ERROR);
  }

  // Find the instruction that contains entries (usually the first one, type "TimelineAddEntries")
  let entries: unknown[] | undefined;
  for (const instruction of instructions) {
    const candidateEntries = dig(instruction, "entries") as unknown[] | undefined;
    if (Array.isArray(candidateEntries) && candidateEntries.length > 0) {
      entries = candidateEntries;
      break;
    }
  }

  if (!entries) {
    return { tweets, users, nextToken };
  }

  let skippedEntries = 0;

  for (const entry of entries) {
    if (entry == null || typeof entry !== "object") continue;
    const entryObj = entry as Record<string, unknown>;
    const entryId = entryObj.entryId as string | undefined;

    // Extract pagination cursors
    if (typeof entryId === "string" && entryId.startsWith("cursor-bottom-")) {
      const cursorValue = dig(entry, "content", "value") as string | undefined;
      if (cursorValue) {
        nextToken = cursorValue;
      }
      continue;
    }

    // Skip non-tweet entries (e.g. cursor-top-*)
    if (typeof entryId === "string" && entryId.startsWith("cursor-")) {
      continue;
    }

    // Extract tweet result
    try {
      const rawResult = dig(entry, "content", "itemContent", "tweet_results", "result");
      const result = unwrapTweetResult(rawResult);
      if (!result) continue;

      const tweetId = result.rest_id as string | undefined;
      if (!tweetId) continue;

      const legacy = result.legacy as Record<string, unknown> | undefined;

      // Extract user
      const userResult = dig(result, "core", "user_results", "result") as
        | Record<string, unknown>
        | undefined;
      const userLegacy = userResult?.legacy as Record<string, unknown> | undefined;
      const userId = userResult?.rest_id as string | undefined;

      if (userId && userLegacy) {
        const userName = truncate(userLegacy.name, 100) ?? "";
        const userUsername = truncate(userLegacy.screen_name, 100) ?? "";
        if (!users.has(userId)) {
          users.set(userId, {
            id: userId,
            name: userName,
            username: userUsername,
          });
        }
      }

      // Extract URL entity metadata
      let url_title: string | undefined;
      let url_description: string | undefined;
      let url_image: string | undefined;
      let expanded_url: string | undefined;

      const urlEntities = dig(legacy, "entities", "urls") as GraphQLUrlEntity[] | undefined;
      if (Array.isArray(urlEntities) && urlEntities.length > 0) {
        // Prefer a URL entity with a title (rich card)
        const richEntity = urlEntities.find((u) => u.title);
        if (richEntity) {
          url_title = richEntity.title;
          url_description = richEntity.description;
          url_image = richEntity.images?.[0]?.url;
          expanded_url = richEntity.expanded_url;
        } else {
          // Fall back to first expanded URL that isn't a t.co short URL
          for (const urlEntity of urlEntities) {
            const candidate = urlEntity.expanded_url;
            if (candidate && !candidate.startsWith("https://t.co/")) {
              expanded_url = candidate;
              break;
            }
          }
        }
      }

      // Extract media URL (first photo)
      const mediaUrl = dig(legacy, "entities", "media", "0", "media_url_https") as
        | string
        | undefined;

      // Build normalized tweet
      const tweet: Tweet = {
        id: tweetId,
        text: truncate(legacy?.full_text, 10000) ?? "",
        created_at: legacy?.created_at as string | undefined,
        author_id: userId,
        media_url: mediaUrl,
        url_title,
        url_description,
        url_image,
        expanded_url,
        like_count: asNumber(legacy?.favorite_count),
        retweet_count: asNumber(legacy?.retweet_count),
        reply_count: asNumber(legacy?.reply_count),
        quote_count: asNumber(legacy?.quote_count),
        impression_count: undefined, // GraphQL doesn't expose this directly
      };

      tweets.push(tweet);
    } catch (err) {
      skippedEntries++;
      console.warn(
        `Skipping malformed bookmark entry (${(entry as Record<string, unknown>).entryId ?? "unknown"}):`,
        err,
      );
      continue;
    }
  }

  // If all non-cursor entries failed to parse, the API structure likely changed
  const tweetEntryCount = tweets.length + skippedEntries;
  if (tweetEntryCount > 0 && tweets.length === 0) {
    throw new Error(STALE_QUERY_ERROR);
  }

  return { tweets, users, nextToken };
}

/** Safely coerce a value to a number, returning undefined for non-numeric values. */
function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}
