// ABOUTME: Fetches bookmarks from X API and stores them via BookmarkRepository.
// ABOUTME: Handles pagination, deduplication, folder assignment, and article enrichment. Shared by CLI and web.

import type { BookmarkRepository } from "./repository";
import type { SyncResult } from "./types";
import { getBookmarks, getBookmarkFolders, getFolderBookmarks, getMe, fetchArticleMetadata } from "./api";

export type { SyncResult };

/** Safety limit for pagination loops to prevent infinite iteration on malformed tokens. */
const MAX_PAGES = 200;

export async function syncBookmarks(
  repo: BookmarkRepository,
  accessToken: string
): Promise<SyncResult> {
  // Get or cache user ID
  let userId = await repo.getUserInfo("user_id");
  if (!userId) {
    const me = await getMe(accessToken);
    userId = me.id;
    await repo.setUserInfo("user_id", userId);
    await repo.setUserInfo("username", me.username);
  }

  let fetched = 0;
  let newCount = 0;
  const seen = new Set<string>();
  const paginationLog: string[] = [];

  // Fetch main bookmarks with pagination
  let nextToken: string | undefined;
  let page = 0;
  do {
    page++;
    if (page > MAX_PAGES) {
      console.warn(`Pagination safety limit reached (${MAX_PAGES} pages). Stopping bookmark sync.`);
      break;
    }
    const response = await getBookmarks(accessToken, userId, nextToken);
    const logMsg =
      `Page ${page}: ${response.tweets.length} tweets` +
      (response.nextToken ? `, next_token: ${response.nextToken.slice(0, 20)}...` : ", no next_token (last page)");
    console.log(`Bookmark ${logMsg}`);
    paginationLog.push(logMsg);
    // Deduplicate within this page against previously seen tweets
    const uniqueTweets = response.tweets.filter(tweet => {
      if (seen.has(tweet.id)) return false;
      seen.add(tweet.id);
      return true;
    });

    if (uniqueTweets.length > 0) {
      const result = await repo.upsertBookmarksBatch(uniqueTweets, response.users);
      fetched += uniqueTweets.length;
      newCount += result.imported;
    }
    nextToken = response.nextToken;
  } while (nextToken);
  console.log(`Bookmark sync complete: ${fetched} total across ${page} page(s)`);

  // Fetch folders and assign bookmarks to them.
  // The folder bookmarks endpoint only returns tweet IDs (no expansions),
  // so we use those IDs to tag already-fetched bookmarks with their folder.
  let foldersFound = 0;
  let folderAssignments = 0;
  let folderToken: string | undefined;
  let folderPage = 0;
  do {
    folderPage++;
    if (folderPage > MAX_PAGES) {
      console.warn(`Pagination safety limit reached (${MAX_PAGES} pages). Stopping folder list sync.`);
      break;
    }
    const folderResponse = await getBookmarkFolders(accessToken, userId, folderToken);
    for (const folder of folderResponse.folders) {
      foldersFound++;
      await repo.upsertFolder(folder);
      console.log(`Syncing folder "${folder.name}" (${folder.id})...`);

      let folderBookmarkToken: string | undefined;
      let folderBookmarkPage = 0;
      do {
        folderBookmarkPage++;
        if (folderBookmarkPage > MAX_PAGES) {
          console.warn(`Pagination safety limit reached (${MAX_PAGES} pages). Stopping folder bookmark sync for "${folder.name}".`);
          break;
        }
        const folderBookmarks = await getFolderBookmarks(
          accessToken,
          userId,
          folder.id,
          folderBookmarkToken
        );
        console.log(`  → Got ${folderBookmarks.tweetIds.length} bookmark IDs`);
        if (folderBookmarks.tweetIds.length > 0) {
          await repo.assignBookmarkFolderBatch(folderBookmarks.tweetIds, folder.id, folder.name);
          folderAssignments += folderBookmarks.tweetIds.length;
        }
        folderBookmarkToken = folderBookmarks.nextToken;
      } while (folderBookmarkToken);
    }
    folderToken = folderResponse.nextToken;
  } while (folderToken);

  // Enrich article bookmarks with metadata from the syndication API
  let articlesEnriched = 0;
  const articlesNeedingMetadata = await repo.getArticleBookmarksMissingMetadata();
  if (articlesNeedingMetadata.length > 0) {
    console.log(`Fetching metadata for ${articlesNeedingMetadata.length} article bookmarks...`);
    for (const { tweet_id } of articlesNeedingMetadata) {
      const metadata = await fetchArticleMetadata(tweet_id);
      if (metadata.imageUrl || metadata.previewText) {
        await repo.updateArticleMetadata(tweet_id, metadata.imageUrl, metadata.previewText);
        articlesEnriched++;
      }
    }
    console.log(`  → Enriched ${articlesEnriched} articles`);
  }

  await repo.logSync(fetched, newCount);
  return { fetched, newCount, foldersFound, folderAssignments, articleImagesFound: articlesEnriched, pages: page, paginationLog };
}
