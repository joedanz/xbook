// ABOUTME: BookmarkRepository interface — the abstraction layer for data access.
// ABOUTME: All methods are async for interface consistency.

import type {
  StoredBookmark,
  BookmarkFolder,
  BookmarkQuery,
  PaginatedResult,
  SyncLogEntry,
  NewsletterLogEntry,
  BookmarkStats,
  Tweet,
  User,
  NewsletterBookmarkQuery,
} from "./types";

export interface BookmarkRepository {
  // --- Sync operations (used by CLI sync + newsletter) ---
  upsertBookmark(
    tweet: Tweet,
    users: Map<string, User>,
    folderId?: string,
    folderName?: string
  ): Promise<boolean>;
  upsertBookmarksBatch(
    tweets: Tweet[],
    users: Map<string, User>,
    folderId?: string,
    folderName?: string
  ): Promise<{ imported: number; skipped: number }>;
  upsertFolder(folder: BookmarkFolder): Promise<void>;
  getBookmarkCount(): Promise<number>;
  isNewBookmark(tweetId: string): Promise<boolean>;
  /** @deprecated Use getNewsletterBookmarks instead */
  getNewBookmarks(limit?: number): Promise<StoredBookmark[]>;
  getNewsletterBookmarks(options?: NewsletterBookmarkQuery & { limit?: number }): Promise<StoredBookmark[]>;
  getNewsletterBookmarkCount(options?: NewsletterBookmarkQuery): Promise<number>;
  markNewslettered(tweetIds: string[]): Promise<void>;
  logSync(fetched: number, newCount: number): Promise<void>;
  logNewsletter(count: number): Promise<void>;
  setUserInfo(key: string, value: string): Promise<void>;
  getUserInfo(key: string): Promise<string | null>;

  // --- Sync-specific operations (previously in src/db.ts) ---
  assignBookmarkFolder(
    tweetId: string,
    folderId: string,
    folderName: string
  ): Promise<void>;
  assignBookmarkFolderBatch(
    tweetIds: string[],
    folderId: string,
    folderName: string
  ): Promise<void>;
  getArticleBookmarksMissingMetadata(): Promise<{ tweet_id: string }[]>;
  updateArticleMetadata(
    tweetId: string,
    mediaUrl: string | null,
    description: string | null
  ): Promise<void>;

  // --- Query operations (for web UI) ---
  queryBookmarks(query: BookmarkQuery): Promise<PaginatedResult<StoredBookmark>>;
  getBookmarkById(tweetId: string): Promise<StoredBookmark | null>;
  getFolders(): Promise<(BookmarkFolder & { count: number })[]>;
  getAuthors(): Promise<{ username: string; name: string; count: number }[]>;
  searchBookmarks(term: string, limit?: number): Promise<StoredBookmark[]>;

  // --- Management operations (for web UI) ---
  hideBookmark(tweetId: string): Promise<boolean>;
  unhideBookmark(tweetId: string): Promise<boolean>;
  deleteBookmark(tweetId: string): Promise<boolean>;
  undeleteBookmark(tweetId: string): Promise<boolean>;
  getHiddenTweetIds(): Promise<Set<string>>;
  moveBookmarkToFolder(
    tweetId: string,
    folderId: string | null,
    folderName: string | null
  ): Promise<boolean>;
  updateBookmarkNotes(tweetId: string, notes: string | null): Promise<boolean>;
  toggleStarred(tweetId: string): Promise<boolean>;
  toggleNeedToRead(tweetId: string): Promise<boolean>;
  setStarred(tweetId: string, value: boolean): Promise<boolean>;
  setNeedToRead(tweetId: string, value: boolean): Promise<boolean>;
  addBookmarkTag(tweetId: string, tag: string): Promise<boolean>;
  removeBookmarkTag(tweetId: string, tag: string): Promise<boolean>;
  getAllTags(): Promise<{ tag: string; count: number }[]>;

  // --- Stats (for dashboard) ---
  getSyncHistory(limit?: number): Promise<SyncLogEntry[]>;
  getNewsletterHistory(limit?: number): Promise<NewsletterLogEntry[]>;
  getStats(): Promise<BookmarkStats>;

  // --- Lifecycle ---
  close(): void;
}
