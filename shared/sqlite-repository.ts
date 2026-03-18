// ABOUTME: SQLite implementation of BookmarkRepository using better-sqlite3.
// ABOUTME: All methods return promises (wrapping sync better-sqlite3 calls) for interface compatibility.

import Database from "better-sqlite3";
import type { BookmarkRepository } from "./repository";
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
} from "./types";

/** Coerce SQLite 0/1 integers to booleans for starred, need_to_read, and hidden */
function coerceBooleans(row: Record<string, unknown>): StoredBookmark {
  return {
    ...row,
    starred: row.starred === 1,
    need_to_read: row.need_to_read === 1,
    hidden: row.hidden === 1,
  } as StoredBookmark;
}

export class SqliteBookmarkRepository implements BookmarkRepository {
  private db: Database.Database;

  private sanitizeLike(term: string): string {
    return term.replace(/[%_\\]/g, "\\$&");
  }

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        tweet_id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        author_id TEXT,
        author_name TEXT,
        author_username TEXT,
        created_at TEXT,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        folder_name TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        newslettered_at TEXT,
        notes TEXT,
        tags TEXT
      );

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        bookmarks_fetched INTEGER NOT NULL DEFAULT 0,
        bookmarks_new INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS newsletter_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        bookmark_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Add new columns to existing databases that lack them
    const columns = this.db.pragma("table_info(bookmarks)") as {
      name: string;
    }[];
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("notes")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN notes TEXT");
    }
    if (!columnNames.has("tags")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN tags TEXT");
    }
    if (!columnNames.has("media_url")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN media_url TEXT");
    }
    if (!columnNames.has("starred")) {
      this.db.exec(
        "ALTER TABLE bookmarks ADD COLUMN starred INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!columnNames.has("need_to_read")) {
      this.db.exec(
        "ALTER TABLE bookmarks ADD COLUMN need_to_read INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!columnNames.has("url_title")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN url_title TEXT");
    }
    if (!columnNames.has("url_description")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN url_description TEXT");
    }
    if (!columnNames.has("url_image")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN url_image TEXT");
    }
    if (!columnNames.has("expanded_url")) {
      this.db.exec("ALTER TABLE bookmarks ADD COLUMN expanded_url TEXT");
    }
    if (!columnNames.has("hidden")) {
      this.db.exec(
        "ALTER TABLE bookmarks ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0"
      );
    }
    // Create indexes (IF NOT EXISTS is safe for repeated runs)
    const indexStatements = [
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_synced_at ON bookmarks(synced_at)",
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_id ON bookmarks(folder_id)",
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_author ON bookmarks(author_username)",
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_newslettered ON bookmarks(newslettered_at)",
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_starred ON bookmarks(starred) WHERE starred = 1",
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_need_to_read ON bookmarks(need_to_read) WHERE need_to_read = 1",
      "CREATE INDEX IF NOT EXISTS idx_bookmarks_hidden ON bookmarks(hidden) WHERE hidden = 1",
    ];
    for (const stmt of indexStatements) {
      this.db.prepare(stmt).run();
    }
  }

  // --- Sync operations ---

  async upsertBookmark(
    tweet: Tweet,
    users: Map<string, User>,
    folderId?: string,
    folderName?: string
  ): Promise<boolean> {
    const user = tweet.author_id ? users.get(tweet.author_id) : undefined;

    return this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT 1 FROM bookmarks WHERE tweet_id = ?")
        .get(tweet.id);

      this.db
        .prepare(
          `INSERT INTO bookmarks (tweet_id, text, author_id, author_name, author_username, created_at, folder_id, folder_name, media_url, url_title, url_description, url_image, expanded_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tweet_id) DO UPDATE SET
           folder_id = COALESCE(excluded.folder_id, folder_id),
           folder_name = COALESCE(excluded.folder_name, folder_name),
           media_url = COALESCE(excluded.media_url, media_url),
           url_title = COALESCE(excluded.url_title, url_title),
           url_description = COALESCE(excluded.url_description, url_description),
           url_image = COALESCE(excluded.url_image, url_image),
           expanded_url = COALESCE(excluded.expanded_url, expanded_url)`
        )
        .run(
          tweet.id,
          tweet.text,
          tweet.author_id || null,
          user?.name || null,
          user?.username || null,
          tweet.created_at || null,
          folderId || null,
          folderName || null,
          tweet.media_url || null,
          tweet.url_title || null,
          tweet.url_description || null,
          tweet.url_image || null,
          tweet.expanded_url || null
        );

      return !existing;
    })();
  }

  async upsertBookmarksBatch(
    tweets: Tweet[],
    users: Map<string, User>,
    folderId?: string,
    folderName?: string
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    this.db.transaction(() => {
      for (const tweet of tweets) {
        const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
        const existing = this.db
          .prepare("SELECT 1 FROM bookmarks WHERE tweet_id = ?")
          .get(tweet.id);

        this.db
          .prepare(
            `INSERT INTO bookmarks (tweet_id, text, author_id, author_name, author_username, created_at, folder_id, folder_name, media_url, url_title, url_description, url_image, expanded_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(tweet_id) DO UPDATE SET
               folder_id = COALESCE(excluded.folder_id, folder_id),
               folder_name = COALESCE(excluded.folder_name, folder_name),
               media_url = COALESCE(excluded.media_url, media_url),
               url_title = COALESCE(excluded.url_title, url_title),
               url_description = COALESCE(excluded.url_description, url_description),
               url_image = COALESCE(excluded.url_image, url_image),
               expanded_url = COALESCE(excluded.expanded_url, expanded_url)`
          )
          .run(
            tweet.id,
            tweet.text,
            tweet.author_id || null,
            user?.name || null,
            user?.username || null,
            tweet.created_at || null,
            folderId || null,
            folderName || null,
            tweet.media_url || null,
            tweet.url_title || null,
            tweet.url_description || null,
            tweet.url_image || null,
            tweet.expanded_url || null
          );

        if (!existing) imported++;
        else skipped++;
      }
    })();

    return { imported, skipped };
  }

  async upsertFolder(folder: BookmarkFolder): Promise<void> {
    this.db
      .prepare("INSERT OR REPLACE INTO folders (id, name) VALUES (?, ?)")
      .run(folder.id, folder.name);
  }

  async getBookmarkCount(): Promise<number> {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE hidden = 0 OR hidden IS NULL")
      .get() as { count: number };
    return row.count;
  }

  async isNewBookmark(tweetId: string): Promise<boolean> {
    const row = this.db
      .prepare("SELECT 1 FROM bookmarks WHERE tweet_id = ?")
      .get(tweetId);
    return !row;
  }

  async getNewBookmarks(limit: number = 200): Promise<StoredBookmark[]> {
    return this.db
      .prepare(
        "SELECT * FROM bookmarks WHERE newslettered_at IS NULL ORDER BY synced_at DESC LIMIT ?"
      )
      .all(limit)
      .map((r) => coerceBooleans(r as Record<string, unknown>));
  }

  async markNewslettered(tweetIds: string[]): Promise<void> {
    const stmt = this.db.prepare(
      "UPDATE bookmarks SET newslettered_at = datetime('now') WHERE tweet_id = ?"
    );
    const tx = this.db.transaction((ids: string[]) => {
      for (const id of ids) stmt.run(id);
    });
    tx(tweetIds);
  }

  async logSync(fetched: number, newCount: number): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO sync_log (bookmarks_fetched, bookmarks_new) VALUES (?, ?)"
      )
      .run(fetched, newCount);
  }

  async logNewsletter(count: number): Promise<void> {
    this.db
      .prepare("INSERT INTO newsletter_log (bookmark_count) VALUES (?)")
      .run(count);
  }

  async setUserInfo(key: string, value: string): Promise<void> {
    this.db
      .prepare("INSERT OR REPLACE INTO user_info (key, value) VALUES (?, ?)")
      .run(key, value);
  }

  async getUserInfo(key: string): Promise<string | null> {
    const row = this.db
      .prepare("SELECT value FROM user_info WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  // --- Sync-specific operations (absorbed from src/db.ts) ---

  async assignBookmarkFolder(
    tweetId: string,
    folderId: string,
    folderName: string
  ): Promise<void> {
    this.db
      .prepare(
        "UPDATE bookmarks SET folder_id = ?, folder_name = ? WHERE tweet_id = ?"
      )
      .run(folderId, folderName, tweetId);
  }

  async assignBookmarkFolderBatch(
    tweetIds: string[],
    folderId: string,
    folderName: string
  ): Promise<void> {
    if (tweetIds.length === 0) return;
    const stmt = this.db.prepare(
      "UPDATE bookmarks SET folder_id = ?, folder_name = ? WHERE tweet_id = ?"
    );
    const batch = this.db.transaction((ids: string[]) => {
      for (const tweetId of ids) {
        stmt.run(folderId, folderName, tweetId);
      }
    });
    batch(tweetIds);
  }

  async getArticleBookmarksMissingMetadata(): Promise<{ tweet_id: string }[]> {
    return this.db
      .prepare(
        "SELECT tweet_id FROM bookmarks WHERE expanded_url LIKE '%/i/article/%' AND (media_url IS NULL OR url_description IS NULL)"
      )
      .all() as { tweet_id: string }[];
  }

  async updateArticleMetadata(
    tweetId: string,
    mediaUrl: string | null,
    description: string | null
  ): Promise<void> {
    this.db
      .prepare(
        "UPDATE bookmarks SET media_url = COALESCE(?, media_url), url_description = COALESCE(?, url_description) WHERE tweet_id = ?"
      )
      .run(mediaUrl, description, tweetId);
  }

  // --- Query operations ---

  async queryBookmarks(query: BookmarkQuery): Promise<PaginatedResult<StoredBookmark>> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.folderId) {
      conditions.push("folder_id = ?");
      params.push(query.folderId);
    }

    if (query.authorUsername) {
      conditions.push("author_username = ?");
      params.push(query.authorUsername);
    }

    if (query.search) {
      conditions.push(
        "(text LIKE ? ESCAPE '\\' COLLATE NOCASE OR author_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR author_username LIKE ? ESCAPE '\\' COLLATE NOCASE)"
      );
      const escaped = this.sanitizeLike(query.search);
      const term = `%${escaped}%`;
      params.push(term, term, term);
    }

    if (query.dateFrom) {
      conditions.push("created_at >= ?");
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      conditions.push("created_at <= ?");
      params.push(query.dateTo);
    }

    if (query.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        conditions.push(
          "EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)"
        );
        params.push(tag);
      }
    }

    if (query.newslettered === true) {
      conditions.push("newslettered_at IS NOT NULL");
    } else if (query.newslettered === false) {
      conditions.push("newslettered_at IS NULL");
    }

    if (query.starred) {
      conditions.push("starred = 1");
    }

    if (query.needToRead) {
      conditions.push("need_to_read = 1");
    }

    if (query.hidden === true) {
      conditions.push("hidden = 1");
    } else {
      conditions.push("(hidden = 0 OR hidden IS NULL)");
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const ALLOWED_ORDER_BY = new Set(["created_at", "synced_at", "author_name"]);
    const ALLOWED_ORDER_DIR = new Set(["asc", "desc"]);
    const orderBy = ALLOWED_ORDER_BY.has(query.orderBy || "") ? query.orderBy! : "synced_at";
    const orderDir = ALLOWED_ORDER_DIR.has(query.orderDir || "") ? query.orderDir! : "desc";
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM bookmarks ${where}`)
      .get(...params) as { count: number };
    const total = countRow.count;

    const items = this.db
      .prepare(
        `SELECT * FROM bookmarks ${where} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset)
      .map((r) => coerceBooleans(r as Record<string, unknown>));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBookmarkById(tweetId: string): Promise<StoredBookmark | null> {
    const row = this.db
      .prepare("SELECT * FROM bookmarks WHERE tweet_id = ?")
      .get(tweetId) as Record<string, unknown> | undefined;
    return row ? coerceBooleans(row) : null;
  }

  async getFolders(): Promise<(BookmarkFolder & { count: number })[]> {
    return this.db
      .prepare(
        `SELECT f.id, f.name, COUNT(b.tweet_id) as count
       FROM folders f
       LEFT JOIN bookmarks b ON f.id = b.folder_id
       GROUP BY f.id
       ORDER BY f.name`
      )
      .all() as (BookmarkFolder & { count: number })[];
  }

  async getAuthors(): Promise<{ username: string; name: string; count: number }[]> {
    return this.db
      .prepare(
        `SELECT author_username as username, author_name as name, COUNT(*) as count
       FROM bookmarks
       WHERE author_username IS NOT NULL
       GROUP BY author_username
       ORDER BY count DESC`
      )
      .all() as { username: string; name: string; count: number }[];
  }

  async searchBookmarks(term: string, limit: number = 50): Promise<StoredBookmark[]> {
    const likeTerm = `%${this.sanitizeLike(term)}%`;
    return this.db
      .prepare(
        `SELECT * FROM bookmarks
       WHERE text LIKE ? ESCAPE '\\' OR author_name LIKE ? ESCAPE '\\' OR author_username LIKE ? ESCAPE '\\'
       ORDER BY synced_at DESC
       LIMIT ?`
      )
      .all(likeTerm, likeTerm, likeTerm, limit)
      .map((r) => coerceBooleans(r as Record<string, unknown>));
  }

  // --- Management operations ---

  async hideBookmark(tweetId: string): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE bookmarks SET hidden = 1 WHERE tweet_id = ?")
      .run(tweetId);
    return result.changes > 0;
  }

  async unhideBookmark(tweetId: string): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE bookmarks SET hidden = 0 WHERE tweet_id = ?")
      .run(tweetId);
    return result.changes > 0;
  }

  async getHiddenTweetIds(): Promise<Set<string>> {
    const rows = this.db
      .prepare("SELECT tweet_id FROM bookmarks WHERE hidden = 1")
      .all() as { tweet_id: string }[];
    return new Set(rows.map((r) => r.tweet_id));
  }

  async moveBookmarkToFolder(
    tweetId: string,
    folderId: string | null,
    folderName: string | null
  ): Promise<boolean> {
    const result = this.db
      .prepare(
        "UPDATE bookmarks SET folder_id = ?, folder_name = ? WHERE tweet_id = ?"
      )
      .run(folderId, folderName, tweetId);
    return result.changes > 0;
  }

  async updateBookmarkNotes(tweetId: string, notes: string | null): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE bookmarks SET notes = ? WHERE tweet_id = ?")
      .run(notes, tweetId);
    return result.changes > 0;
  }

  async toggleStarred(tweetId: string): Promise<boolean> {
    const txn = this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE bookmarks SET starred = CASE WHEN starred = 1 THEN 0 ELSE 1 END WHERE tweet_id = ?"
        )
        .run(tweetId);
      const row = this.db
        .prepare("SELECT starred FROM bookmarks WHERE tweet_id = ?")
        .get(tweetId) as { starred: number } | undefined;
      return row?.starred === 1;
    });
    return txn();
  }

  async toggleNeedToRead(tweetId: string): Promise<boolean> {
    const txn = this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE bookmarks SET need_to_read = CASE WHEN need_to_read = 1 THEN 0 ELSE 1 END WHERE tweet_id = ?"
        )
        .run(tweetId);
      const row = this.db
        .prepare("SELECT need_to_read FROM bookmarks WHERE tweet_id = ?")
        .get(tweetId) as { need_to_read: number } | undefined;
      return row?.need_to_read === 1;
    });
    return txn();
  }

  async setStarred(tweetId: string, value: boolean): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE bookmarks SET starred = ? WHERE tweet_id = ?")
      .run(value ? 1 : 0, tweetId);
    return result.changes > 0;
  }

  async setNeedToRead(tweetId: string, value: boolean): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE bookmarks SET need_to_read = ? WHERE tweet_id = ?")
      .run(value ? 1 : 0, tweetId);
    return result.changes > 0;
  }

  async addBookmarkTag(tweetId: string, tag: string): Promise<boolean> {
    return this.db.transaction(() => {
      const bm = this.db
        .prepare("SELECT * FROM bookmarks WHERE tweet_id = ?")
        .get(tweetId) as StoredBookmark | undefined;
      if (!bm) return false;
      const tags: string[] = bm.tags ? JSON.parse(bm.tags) : [];
      if (tags.includes(tag)) return true;
      tags.push(tag);
      this.db
        .prepare("UPDATE bookmarks SET tags = ? WHERE tweet_id = ?")
        .run(JSON.stringify(tags), tweetId);
      return true;
    })();
  }

  async removeBookmarkTag(tweetId: string, tag: string): Promise<boolean> {
    return this.db.transaction(() => {
      const bm = this.db
        .prepare("SELECT * FROM bookmarks WHERE tweet_id = ?")
        .get(tweetId) as StoredBookmark | undefined;
      if (!bm) return false;
      const tags: string[] = bm.tags ? JSON.parse(bm.tags) : [];
      const filtered = tags.filter((t) => t !== tag);
      if (filtered.length === tags.length) return false;
      this.db
        .prepare("UPDATE bookmarks SET tags = ? WHERE tweet_id = ?")
        .run(filtered.length > 0 ? JSON.stringify(filtered) : null, tweetId);
      return true;
    })();
  }

  async getAllTags(): Promise<{ tag: string; count: number }[]> {
    return this.db
      .prepare(
        `SELECT j.value AS tag, COUNT(*) AS count
         FROM bookmarks, json_each(bookmarks.tags) AS j
         WHERE bookmarks.tags IS NOT NULL AND bookmarks.tags != '[]'
         GROUP BY j.value
         ORDER BY count DESC, tag ASC
         LIMIT 1000`
      )
      .all() as { tag: string; count: number }[];
  }

  // --- Stats ---

  async getSyncHistory(limit: number = 10): Promise<SyncLogEntry[]> {
    return this.db
      .prepare("SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT ?")
      .all(limit) as SyncLogEntry[];
  }

  async getNewsletterHistory(limit: number = 10): Promise<NewsletterLogEntry[]> {
    return this.db
      .prepare("SELECT * FROM newsletter_log ORDER BY sent_at DESC LIMIT ?")
      .all(limit) as NewsletterLogEntry[];
  }

  async getStats(): Promise<BookmarkStats> {
    const totalBookmarks = await this.getBookmarkCount();

    const folderCount = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM folders")
        .get() as { count: number }
    ).count;

    const lastSync = this.db
      .prepare("SELECT synced_at FROM sync_log ORDER BY synced_at DESC LIMIT 1")
      .get() as { synced_at: string } | undefined;

    const lastNewsletter = this.db
      .prepare(
        "SELECT sent_at FROM newsletter_log ORDER BY sent_at DESC LIMIT 1"
      )
      .get() as { sent_at: string } | undefined;

    const bookmarksByFolder = this.db
      .prepare(
        `SELECT COALESCE(folder_name, 'Unsorted') as folder, COUNT(*) as count
       FROM bookmarks
       GROUP BY folder_name
       ORDER BY count DESC`
      )
      .all() as { folder: string; count: number }[];

    return {
      totalBookmarks,
      folderCount,
      lastSyncAt: lastSync?.synced_at || null,
      lastNewsletterAt: lastNewsletter?.sent_at || null,
      bookmarksByFolder,
    };
  }

  // --- Lifecycle ---

  close(): void {
    this.db.close();
  }
}
