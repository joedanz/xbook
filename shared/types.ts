// ABOUTME: Shared type definitions used by both the CLI and web interface.
// ABOUTME: Extracted from shared/api.ts and shared/repository.ts to avoid duplication.

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
  page?: number;
  pageSize?: number;
  orderBy?: "created_at" | "synced_at" | "author_name";
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
