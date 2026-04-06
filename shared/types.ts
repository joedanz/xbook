// ABOUTME: Shared type definitions used by both the CLI and web interface.
// ABOUTME: Extracted from shared/api.ts and shared/repository.ts to avoid duplication.

// --- Chrome sync types ---

export interface ChromeCookies {
  ct0: string; // CSRF token
  authToken: string; // Session auth token
}

// --- X API types (originally from shared/api.ts) ---

export interface Tweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  media_url?: string;
  url_title?: string;
  url_description?: string;
  url_image?: string;
  expanded_url?: string;
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  impression_count?: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
}

export interface BookmarkFolder {
  id: string;
  name: string;
}

export interface BookmarkResponse {
  tweets: Tweet[];
  users: Map<string, User>;
  nextToken?: string;
}

export interface FolderResponse {
  folders: BookmarkFolder[];
  nextToken?: string;
}

// --- Database / stored types (originally from src/db.ts) ---

export interface StoredBookmark {
  tweet_id: string;
  text: string;
  author_id: string | null;
  author_name: string | null;
  author_username: string | null;
  created_at: string | null;
  folder_id: string | null;
  folder_name: string | null;
  synced_at: string;
  newslettered_at: string | null;
  notes: string | null;
  tags: string | null; // JSON array stored as text, e.g. '["typescript","react"]'
  media_url: string | null;
  url_title: string | null;
  url_description: string | null;
  url_image: string | null;
  expanded_url: string | null;
  starred: boolean;
  need_to_read: boolean;
  hidden: boolean;
  deleted: boolean;
  like_count: number | null;
  retweet_count: number | null;
  reply_count: number | null;
  quote_count: number | null;
  impression_count: number | null;
}

// --- Sync types ---

export interface SyncResult {
  fetched: number;
  newCount: number;
  removedCount: number;
  foldersFound: number;
  folderAssignments: number;
  articleImagesFound: number;
  pages: number;
  paginationLog: string[];
  earlyTerminated: boolean;
}

// --- Web query types ---

export interface BookmarkQuery {
  folderId?: string;
  authorUsername?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  newslettered?: boolean;
  starred?: boolean;
  needToRead?: boolean;
  hidden?: boolean;
  deleted?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: "created_at" | "synced_at" | "author_name" | "like_count";
  orderDir?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SyncLogEntry {
  id: number;
  synced_at: string;
  bookmarks_fetched: number;
  bookmarks_new: number;
}

export interface NewsletterLogEntry {
  id: number;
  sent_at: string;
  bookmark_count: number;
}

export interface BookmarkStats {
  totalBookmarks: number;
  folderCount: number;
  lastSyncAt: string | null;
  lastNewsletterAt: string | null;
  bookmarksByFolder: { folder: string; count: number }[];
}

// --- Newsletter types ---

export type NewsletterDateRange =
  | { mode: "all_unsent" }
  | { mode: "since_last_send"; includePreviouslySent?: boolean }
  | { mode: "last_n_weeks"; weeks: 1 | 2 | 3 | 4; includePreviouslySent?: boolean }
  | { mode: "custom"; startDate: string; endDate: string; includePreviouslySent?: boolean };

/** Filtering criteria for newsletter bookmark queries — used by repository and actions. */
export interface NewsletterBookmarkQuery {
  dateRange?: NewsletterDateRange;
  starredOnly?: boolean;
  mustReadOnly?: boolean;
}

export interface NewsletterOptions extends NewsletterBookmarkQuery {
  includeImages?: boolean;
}
