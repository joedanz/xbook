// ABOUTME: Fetches bookmarks from X via Chrome cookie-based GraphQL and stores them via BookmarkRepository.
// ABOUTME: Parallels shared/sync.ts but uses GraphQL client instead of the official X API. Shared by CLI and web.

import type { BookmarkRepository } from "./repository";
import type { ChromeCookies, SyncResult } from "./types";
import type { GraphQLSyncOptions } from "./graphql-api";
import { getGraphQLBookmarks } from "./graphql-api";

export interface ChromeSyncOptions {
  /** When true, skip early termination and paginate through all bookmarks. */
  full?: boolean;
  /** Maximum number of pages to fetch. Default: 500. */
  maxPages?: number;
}

export async function syncBookmarksChrome(
  repo: BookmarkRepository,
  cookies: ChromeCookies,
  onProgress?: (message: string) => void,
  onRateLimit?: (waitSeconds: number, attempt: number, maxRetries: number) => void,
  options?: ChromeSyncOptions
): Promise<SyncResult> {
  const MAX_PAGES = options?.maxPages ?? 500;
  const DELAY_MS = 1500;

  function log(msg: string) {
    console.log(msg);
    onProgress?.(msg);
  }

  const graphqlOptions: GraphQLSyncOptions = { onRateLimit };

  const hiddenIds = await repo.getHiddenTweetIds();

  let fetched = 0;
  let newCount = 0;
  const seen = new Set<string>();
  const paginationLog: string[] = [];
  let earlyTerminated = false;

  const lastSyncedTweetId = options?.full ? null : await repo.getUserInfo("last_synced_tweet_id");
  let newestTweetId: string | undefined;

  let cursor: string | undefined;
  let page = 0;

  try {
    do {
      page++;
      if (page > MAX_PAGES) {
        log(`Pagination safety limit reached (${MAX_PAGES} pages). Stopping Chrome sync.`);
        break;
      }

      const response = await getGraphQLBookmarks(cookies, cursor, 3, graphqlOptions);

      const logMsg =
        `Page ${page}: ${response.tweets.length} tweets` +
        (response.nextToken ? "" : " (last page)");
      log(`Chrome sync ${logMsg}`);
      paginationLog.push(logMsg);

      if (!newestTweetId && response.tweets.length > 0) {
        newestTweetId = response.tweets[0].id;
      }

      const reachedHorizon = lastSyncedTweetId && response.tweets.some(t => t.id === lastSyncedTweetId);

      const uniqueTweets = response.tweets.filter(tweet => {
        if (seen.has(tweet.id)) return false;
        seen.add(tweet.id);
        return true;
      });

      const visibleTweets = uniqueTweets.filter((t) => !hiddenIds.has(t.id));

      if (visibleTweets.length > 0) {
        const result = await repo.upsertBookmarksBatch(visibleTweets, response.users);
        fetched += visibleTweets.length;
        newCount += result.imported;
      }

      if (reachedHorizon) {
        earlyTerminated = true;
        log("Reached last synced bookmark — stopping early (use --full for full sync)");
        break;
      }

      cursor = response.nextToken;

      if (cursor && DELAY_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } while (cursor);

    log(`Chrome sync complete: ${fetched} total across ${page} page(s)${earlyTerminated ? " (early termination)" : ""}`);

    if (newestTweetId) {
      await repo.setUserInfo("last_synced_tweet_id", newestTweetId);
    }

    await repo.logSync(fetched, newCount);

    return {
      fetched,
      newCount,
      removedCount: 0,
      foldersFound: 0,
      folderAssignments: 0,
      articleImagesFound: 0,
      pages: page,
      paginationLog,
      earlyTerminated,
    };
  } finally {
    cookies.ct0 = "";
    cookies.authToken = "";
  }
}
