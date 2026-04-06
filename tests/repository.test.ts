import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteBookmarkRepository } from "../shared/sqlite-repository";
import type { Tweet, User } from "../shared/types";
import Database from "better-sqlite3";

let repo: SqliteBookmarkRepository;

beforeEach(() => {
  repo = new SqliteBookmarkRepository(":memory:");
});

afterEach(() => {
  repo.close();
});

function makeUsers(...users: [string, string, string][]): Map<string, User> {
  const map = new Map<string, User>();
  for (const [id, name, username] of users) {
    map.set(id, { id, name, username });
  }
  return map;
}

async function seedBookmarks() {
  const users = makeUsers(
    ["u1", "Alice", "alice"],
    ["u2", "Bob", "bob"],
    ["u3", "Carol", "carol"]
  );

  await repo.upsertFolder({ id: "f1", name: "Tech" });
  await repo.upsertFolder({ id: "f2", name: "Design" });

  await repo.upsertBookmark(
    { id: "t1", text: "TypeScript is great", author_id: "u1", created_at: "2025-02-15T00:00:00Z" },
    users, "f1", "Tech"
  );
  await repo.upsertBookmark(
    { id: "t2", text: "New CSS features", author_id: "u2", created_at: "2025-02-14T00:00:00Z" },
    users, "f2", "Design"
  );
  await repo.upsertBookmark(
    { id: "t3", text: "React Server Components", author_id: "u1", created_at: "2025-02-13T00:00:00Z" },
    users, "f1", "Tech"
  );
  await repo.upsertBookmark(
    { id: "t4", text: "No folder bookmark", author_id: "u3", created_at: "2025-02-12T00:00:00Z" },
    users
  );

  return users;
}

describe("SqliteBookmarkRepository", () => {
  describe("migration", () => {
    it("creates expected indexes on bookmarks table", () => {
      const db = (repo as unknown as { db: Database }).db;
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='bookmarks'"
      ).all() as { name: string }[];
      const names = indexes.map((i) => i.name);
      expect(names).toContain("idx_bookmarks_synced_at");
      expect(names).toContain("idx_bookmarks_folder_id");
      expect(names).toContain("idx_bookmarks_author");
      expect(names).toContain("idx_bookmarks_newslettered");
      expect(names).toContain("idx_bookmarks_starred");
      expect(names).toContain("idx_bookmarks_need_to_read");
    });

    it("creates tables via repository constructor", async () => {
      // Verify by inserting and reading — if tables exist, this succeeds
      const users = makeUsers(["u1", "Test", "test"]);
      await repo.upsertBookmark({ id: "t1", text: "test" }, users);
      expect(await repo.getBookmarkCount()).toBe(1);
    });

    it("includes notes and tags columns", async () => {
      // Verify notes and tags columns exist by using them
      const users = makeUsers(["u1", "Test", "test"]);
      await repo.upsertBookmark({ id: "t1", text: "test" }, users);
      await repo.updateBookmarkNotes("t1", "some notes");
      await repo.addBookmarkTag("t1", "test-tag");
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.notes).toBe("some notes");
      expect(JSON.parse(bm!.tags!)).toEqual(["test-tag"]);
    });
  });

  describe("upsertBookmark / getBookmarkCount", () => {
    it("inserts and counts bookmarks", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark({ id: "t1", text: "hello" }, users);
      expect(await repo.getBookmarkCount()).toBe(1);
    });

    it("deduplicates by tweet_id", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark({ id: "t1", text: "hello", author_id: "u1" }, users);
      await repo.upsertBookmark({ id: "t1", text: "hello", author_id: "u1" }, users);
      expect(await repo.getBookmarkCount()).toBe(1);
    });
  });

  describe("upsertBookmarksBatch", () => {
    it("inserts multiple bookmarks in one call and returns counts", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      const tweets: Tweet[] = [
        { id: "t1", text: "first", author_id: "u1" },
        { id: "t2", text: "second", author_id: "u1" },
        { id: "t3", text: "third", author_id: "u1" },
      ];

      const result = await repo.upsertBookmarksBatch(tweets, users);
      expect(result.imported).toBe(3);
      expect(result.skipped).toBe(0);
      expect(await repo.getBookmarkCount()).toBe(3);
    });

    it("counts skipped (existing) bookmarks correctly", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark({ id: "t1", text: "first", author_id: "u1" }, users);

      const tweets: Tweet[] = [
        { id: "t1", text: "first updated", author_id: "u1" },
        { id: "t2", text: "second", author_id: "u1" },
      ];

      const result = await repo.upsertBookmarksBatch(tweets, users);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(await repo.getBookmarkCount()).toBe(2);
    });

    it("handles empty array", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      const result = await repo.upsertBookmarksBatch([], users);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe("getNewBookmarks", () => {
    it("respects limit parameter", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      for (let i = 1; i <= 5; i++) {
        await repo.upsertBookmark(
          { id: `t${i}`, text: `tweet ${i}`, author_id: "u1" },
          users
        );
      }

      const limited = await repo.getNewBookmarks(3);
      expect(limited).toHaveLength(3);

      const all = await repo.getNewBookmarks();
      expect(all).toHaveLength(5);
    });
  });

  describe("queryBookmarks", () => {
    beforeEach(seedBookmarks);

    it("returns all bookmarks with default query", async () => {
      const result = await repo.queryBookmarks({});
      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(4);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("filters by folderId", async () => {
      const result = await repo.queryBookmarks({ folderId: "f1" });
      expect(result.total).toBe(2);
      expect(result.items.every((b) => b.folder_id === "f1")).toBe(true);
    });

    it("filters by authorUsername", async () => {
      const result = await repo.queryBookmarks({ authorUsername: "alice" });
      expect(result.total).toBe(2);
    });

    it("filters by search term", async () => {
      const result = await repo.queryBookmarks({ search: "CSS" });
      expect(result.total).toBe(1);
      expect(result.items[0].tweet_id).toBe("t2");
    });

    it("escapes LIKE wildcards in search", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark(
        { id: "t100", text: "50% off sale", author_id: "u1" } as Tweet,
        users
      );
      await repo.upsertBookmark(
        { id: "t101", text: "normal tweet", author_id: "u1" } as Tweet,
        users
      );

      const result = await repo.queryBookmarks({ search: "50%" });
      expect(result.total).toBe(1);
      expect(result.items[0].tweet_id).toBe("t100");
    });

    it("paginates correctly", async () => {
      const page1 = await repo.queryBookmarks({ pageSize: 2, page: 1 });
      expect(page1.items).toHaveLength(2);
      expect(page1.totalPages).toBe(2);

      const page2 = await repo.queryBookmarks({ pageSize: 2, page: 2 });
      expect(page2.items).toHaveLength(2);
    });

    it("sorts by created_at", async () => {
      const result = await repo.queryBookmarks({ orderBy: "created_at", orderDir: "asc" });
      const dates = result.items.map((b) => b.created_at);
      expect(dates).toEqual([...dates].sort());
    });

    it("filters by multiple tags with AND logic", async () => {
      // t1 gets both "react" and "typescript" tags
      await repo.addBookmarkTag("t1", "react");
      await repo.addBookmarkTag("t1", "typescript");
      // t2 gets only "react"
      await repo.addBookmarkTag("t2", "react");
      // t3 gets only "typescript"
      await repo.addBookmarkTag("t3", "typescript");

      // Querying for both tags should only return t1 (AND logic)
      const result = await repo.queryBookmarks({ tags: ["react", "typescript"] });
      expect(result.total).toBe(1);
      expect(result.items[0].tweet_id).toBe("t1");
    });

    it("filters by a single tag", async () => {
      await repo.addBookmarkTag("t1", "react");
      await repo.addBookmarkTag("t2", "react");
      await repo.addBookmarkTag("t3", "typescript");

      const result = await repo.queryBookmarks({ tags: ["react"] });
      expect(result.total).toBe(2);
      const ids = result.items.map((b) => b.tweet_id).sort();
      expect(ids).toEqual(["t1", "t2"]);
    });
  });

  describe("getBookmarkById", () => {
    it("returns bookmark by id", async () => {
      await seedBookmarks();
      const bm = await repo.getBookmarkById("t1");
      expect(bm).not.toBeNull();
      expect(bm!.text).toBe("TypeScript is great");
    });

    it("returns null for missing id", async () => {
      expect(await repo.getBookmarkById("nonexistent")).toBeNull();
    });
  });

  describe("getFolders", () => {
    it("returns folders with counts", async () => {
      await seedBookmarks();
      const folders = await repo.getFolders();
      expect(folders).toHaveLength(2);

      const tech = folders.find((f) => f.id === "f1");
      expect(tech!.name).toBe("Tech");
      expect(tech!.count).toBe(2);

      const design = folders.find((f) => f.id === "f2");
      expect(design!.count).toBe(1);
    });
  });

  describe("getAuthors", () => {
    it("returns authors with counts", async () => {
      await seedBookmarks();
      const authors = await repo.getAuthors();
      expect(authors.length).toBeGreaterThanOrEqual(3);

      const alice = authors.find((a) => a.username === "alice");
      expect(alice!.count).toBe(2);
    });
  });

  describe("hideBookmark / unhideBookmark / getHiddenTweetIds", () => {
    it("hideBookmark marks a bookmark as hidden", async () => {
      await seedBookmarks();
      const result = await repo.hideBookmark("t1");
      expect(result).toBe(true);
      const bm = await repo.getBookmarkById("t1");
      expect(bm).not.toBeNull();
      expect(bm!.hidden).toBe(true);
    });

    it("unhideBookmark restores a hidden bookmark", async () => {
      await seedBookmarks();
      await repo.hideBookmark("t1");
      const result = await repo.unhideBookmark("t1");
      expect(result).toBe(true);
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.hidden).toBe(false);
    });

    it("hidden bookmarks excluded from default getBookmarkCount", async () => {
      await seedBookmarks();
      expect(await repo.getBookmarkCount()).toBe(4);
      await repo.hideBookmark("t1");
      expect(await repo.getBookmarkCount()).toBe(3);
      await repo.hideBookmark("t2");
      expect(await repo.getBookmarkCount()).toBe(2);
    });

    it("getHiddenTweetIds returns the correct Set of IDs", async () => {
      await seedBookmarks();
      await repo.hideBookmark("t1");
      await repo.hideBookmark("t3");
      const hiddenIds = await repo.getHiddenTweetIds();
      expect(hiddenIds).toBeInstanceOf(Set);
      expect(hiddenIds.size).toBe(2);
      expect(hiddenIds.has("t1")).toBe(true);
      expect(hiddenIds.has("t3")).toBe(true);
      expect(hiddenIds.has("t2")).toBe(false);
    });

    it("returns false for non-existent bookmark", async () => {
      expect(await repo.hideBookmark("nonexistent")).toBe(false);
      expect(await repo.unhideBookmark("nonexistent")).toBe(false);
    });
  });

  describe("deleteBookmark / undeleteBookmark", () => {
    it("deleteBookmark soft-deletes (sets deleted flag)", async () => {
      await seedBookmarks();
      const result = await repo.deleteBookmark("t1");
      expect(result).toBe(true);
      const bm = await repo.getBookmarkById("t1");
      expect(bm).not.toBeNull();
      expect(bm!.deleted).toBe(true);
    });

    it("undeleteBookmark restores a deleted bookmark", async () => {
      await seedBookmarks();
      await repo.deleteBookmark("t1");
      const result = await repo.undeleteBookmark("t1");
      expect(result).toBe(true);
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.deleted).toBe(false);
    });

    it("deleted bookmarks excluded from default getBookmarkCount", async () => {
      await seedBookmarks();
      expect(await repo.getBookmarkCount()).toBe(4);
      await repo.deleteBookmark("t1");
      expect(await repo.getBookmarkCount()).toBe(3);
    });

    it("deleted bookmarks excluded from default queryBookmarks", async () => {
      await seedBookmarks();
      await repo.deleteBookmark("t1");
      const result = await repo.queryBookmarks({});
      expect(result.items.find((b) => b.tweet_id === "t1")).toBeUndefined();
    });

    it("deleted bookmarks visible with deleted=true query", async () => {
      await seedBookmarks();
      await repo.deleteBookmark("t1");
      const result = await repo.queryBookmarks({ deleted: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].tweet_id).toBe("t1");
    });

    it("getHiddenTweetIds includes deleted bookmark IDs", async () => {
      await seedBookmarks();
      await repo.deleteBookmark("t2");
      const ids = await repo.getHiddenTweetIds();
      expect(ids.has("t2")).toBe(true);
    });

    it("hidden and deleted are independent", async () => {
      await seedBookmarks();
      await repo.hideBookmark("t1");
      await repo.deleteBookmark("t1");
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.hidden).toBe(true);
      expect(bm!.deleted).toBe(true);
      await repo.unhideBookmark("t1");
      const bm2 = await repo.getBookmarkById("t1");
      expect(bm2!.hidden).toBe(false);
      expect(bm2!.deleted).toBe(true);
    });

    it("returns false for non-existent bookmark", async () => {
      expect(await repo.deleteBookmark("nonexistent")).toBe(false);
      expect(await repo.undeleteBookmark("nonexistent")).toBe(false);
    });
  });

  describe("moveBookmarkToFolder", () => {
    it("moves bookmark to a different folder", async () => {
      await seedBookmarks();
      await repo.moveBookmarkToFolder("t1", "f2", "Design");
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.folder_id).toBe("f2");
      expect(bm!.folder_name).toBe("Design");
    });

    it("removes bookmark from folder", async () => {
      await seedBookmarks();
      await repo.moveBookmarkToFolder("t1", null, null);
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.folder_id).toBeNull();
      expect(bm!.folder_name).toBeNull();
    });
  });

  describe("updateBookmarkNotes", () => {
    it("adds notes to a bookmark", async () => {
      await seedBookmarks();
      await repo.updateBookmarkNotes("t1", "This is a great tweet");
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.notes).toBe("This is a great tweet");
    });

    it("clears notes with null", async () => {
      await seedBookmarks();
      await repo.updateBookmarkNotes("t1", "temp note");
      await repo.updateBookmarkNotes("t1", null);
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.notes).toBeNull();
    });
  });

  describe("addBookmarkTag / removeBookmarkTag", () => {
    it("adds tags to a bookmark", async () => {
      await seedBookmarks();
      await repo.addBookmarkTag("t1", "typescript");
      await repo.addBookmarkTag("t1", "programming");
      const bm = await repo.getBookmarkById("t1");
      const tags = JSON.parse(bm!.tags!);
      expect(tags).toEqual(["typescript", "programming"]);
    });

    it("doesn't duplicate tags", async () => {
      await seedBookmarks();
      await repo.addBookmarkTag("t1", "typescript");
      await repo.addBookmarkTag("t1", "typescript");
      const bm = await repo.getBookmarkById("t1");
      const tags = JSON.parse(bm!.tags!);
      expect(tags).toEqual(["typescript"]);
    });

    it("removes a tag", async () => {
      await seedBookmarks();
      await repo.addBookmarkTag("t1", "typescript");
      await repo.addBookmarkTag("t1", "programming");
      await repo.removeBookmarkTag("t1", "typescript");
      const bm = await repo.getBookmarkById("t1");
      const tags = JSON.parse(bm!.tags!);
      expect(tags).toEqual(["programming"]);
    });

    it("sets tags to null when last tag is removed", async () => {
      await seedBookmarks();
      await repo.addBookmarkTag("t1", "only-tag");
      await repo.removeBookmarkTag("t1", "only-tag");
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.tags).toBeNull();
    });
  });

  describe("getAllTags", () => {
    it("returns all tags with counts", async () => {
      await seedBookmarks();
      await repo.addBookmarkTag("t1", "typescript");
      await repo.addBookmarkTag("t2", "css");
      await repo.addBookmarkTag("t3", "typescript");
      const tags = await repo.getAllTags();
      expect(tags.find((t) => t.tag === "typescript")!.count).toBe(2);
      expect(tags.find((t) => t.tag === "css")!.count).toBe(1);
    });

    it("returns empty array when no tags", async () => {
      expect(await repo.getAllTags()).toEqual([]);
    });
  });

  describe("getStats", () => {
    it("returns correct stats", async () => {
      await seedBookmarks();
      await repo.logSync(50, 10);
      const stats = await repo.getStats();
      expect(stats.totalBookmarks).toBe(4);
      expect(stats.folderCount).toBe(2);
      expect(stats.lastSyncAt).not.toBeNull();
      expect(stats.bookmarksByFolder.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("syncHistory / newsletterHistory", () => {
    it("tracks sync history", async () => {
      await repo.logSync(100, 20);
      await repo.logSync(50, 5);
      const history = await repo.getSyncHistory();
      expect(history).toHaveLength(2);
      const newCounts = history.map((h) => h.bookmarks_new).sort((a, b) => a - b);
      expect(newCounts).toEqual([5, 20]);
    });

    it("tracks newsletter history", async () => {
      await repo.logNewsletter(10);
      const history = await repo.getNewsletterHistory();
      expect(history).toHaveLength(1);
      expect(history[0].bookmark_count).toBe(10);
    });
  });

  describe("searchBookmarks", () => {
    it("searches by text content", async () => {
      await seedBookmarks();
      const results = await repo.searchBookmarks("TypeScript");
      expect(results).toHaveLength(1);
      expect(results[0].tweet_id).toBe("t1");
    });

    it("searches by author name", async () => {
      await seedBookmarks();
      const results = await repo.searchBookmarks("Alice");
      expect(results).toHaveLength(2);
    });

    it("escapes LIKE wildcards in search", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark(
        { id: "t100", text: "100% complete", author_id: "u1" } as Tweet,
        users
      );
      await repo.upsertBookmark(
        { id: "t101", text: "normal tweet", author_id: "u1" } as Tweet,
        users
      );

      // Searching for literal "%" should only match the tweet containing "%"
      const results = await repo.searchBookmarks("%");
      expect(results).toHaveLength(1);
      expect(results[0].tweet_id).toBe("t100");
    });
  });

  describe("assignBookmarkFolder", () => {
    it("assigns a folder to a bookmark", async () => {
      await seedBookmarks();
      await repo.assignBookmarkFolder("t4", "f1", "Tech");
      const bm = await repo.getBookmarkById("t4");
      expect(bm!.folder_id).toBe("f1");
      expect(bm!.folder_name).toBe("Tech");
    });
  });

  describe("article metadata", () => {
    it("finds articles missing metadata", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark(
        { id: "t1", text: "article", expanded_url: "https://x.com/i/article/123" },
        users
      );
      const missing = await repo.getArticleBookmarksMissingMetadata();
      expect(missing).toHaveLength(1);
      expect(missing[0].tweet_id).toBe("t1");
    });

    it("updates article metadata", async () => {
      const users = makeUsers(["u1", "Alice", "alice"]);
      await repo.upsertBookmark(
        { id: "t1", text: "article", expanded_url: "https://x.com/i/article/123" },
        users
      );
      await repo.updateArticleMetadata("t1", "https://img.com/cover.jpg", "Article summary");
      const bm = await repo.getBookmarkById("t1");
      expect(bm!.media_url).toBe("https://img.com/cover.jpg");
      expect(bm!.url_description).toBe("Article summary");
    });
  });

  describe("setStarred / setNeedToRead", () => {
    it("sets starred to explicit value", async () => {
      await repo.upsertBookmark(
        { id: "t1", text: "test" } as Tweet,
        new Map()
      );

      await repo.setStarred("t1", true);
      let bm = await repo.getBookmarkById("t1");
      expect(bm!.starred).toBe(true);

      // Setting to true again should stay true (not toggle)
      await repo.setStarred("t1", true);
      bm = await repo.getBookmarkById("t1");
      expect(bm!.starred).toBe(true);

      await repo.setStarred("t1", false);
      bm = await repo.getBookmarkById("t1");
      expect(bm!.starred).toBe(false);
    });

    it("sets need_to_read to explicit value", async () => {
      await repo.upsertBookmark(
        { id: "t1", text: "test" } as Tweet,
        new Map()
      );

      await repo.setNeedToRead("t1", true);
      let bm = await repo.getBookmarkById("t1");
      expect(bm!.need_to_read).toBe(true);

      await repo.setNeedToRead("t1", true);
      bm = await repo.getBookmarkById("t1");
      expect(bm!.need_to_read).toBe(true);
    });

    it("returns false for non-existent bookmark", async () => {
      const result = await repo.setStarred("missing", true);
      expect(result).toBe(false);
    });
  });

  describe("newsletter starred/mustRead filters", () => {
    async function seedFilteredBookmarks() {
      const users = makeUsers(["u1", "Alice", "alice"]);

      // t1: starred only
      await repo.upsertBookmark({ id: "t1", text: "starred only" } as Tweet, users);
      await repo.setStarred("t1", true);

      // t2: must-read only
      await repo.upsertBookmark({ id: "t2", text: "must read only" } as Tweet, users);
      await repo.setNeedToRead("t2", true);

      // t3: both starred and must-read
      await repo.upsertBookmark({ id: "t3", text: "starred and must-read" } as Tweet, users);
      await repo.setStarred("t3", true);
      await repo.setNeedToRead("t3", true);

      // t4: neither
      await repo.upsertBookmark({ id: "t4", text: "plain bookmark" } as Tweet, users);

      // t5: starred but hidden
      await repo.upsertBookmark({ id: "t5", text: "starred hidden" } as Tweet, users);
      await repo.setStarred("t5", true);
      await repo.hideBookmark("t5");

      // t6: must-read but deleted
      await repo.upsertBookmark({ id: "t6", text: "must-read deleted" } as Tweet, users);
      await repo.setNeedToRead("t6", true);
      await repo.deleteBookmark("t6");
    }

    it("returns only starred bookmarks when starredOnly=true", async () => {
      await seedFilteredBookmarks();
      const results = await repo.getNewsletterBookmarks({ starredOnly: true });

      const ids = results.map((b) => b.tweet_id).sort();
      expect(ids).toEqual(["t1", "t3"]); // t5 excluded (hidden)
    });

    it("returns only must-read bookmarks when mustReadOnly=true", async () => {
      await seedFilteredBookmarks();
      const results = await repo.getNewsletterBookmarks({ mustReadOnly: true });

      const ids = results.map((b) => b.tweet_id).sort();
      expect(ids).toEqual(["t2", "t3"]); // t6 excluded (deleted)
    });

    it("returns only both-flagged bookmarks when both filters are true (AND logic)", async () => {
      await seedFilteredBookmarks();
      const results = await repo.getNewsletterBookmarks({ starredOnly: true, mustReadOnly: true });

      expect(results).toHaveLength(1);
      expect(results[0].tweet_id).toBe("t3");
    });

    it("getNewsletterBookmarkCount matches filtered results length", async () => {
      await seedFilteredBookmarks();

      const starredCount = await repo.getNewsletterBookmarkCount({ starredOnly: true });
      const starredBookmarks = await repo.getNewsletterBookmarks({ starredOnly: true });
      expect(starredCount).toBe(starredBookmarks.length);

      const bothCount = await repo.getNewsletterBookmarkCount({ starredOnly: true, mustReadOnly: true });
      expect(bothCount).toBe(1);
    });

    it("filters combine correctly with date range", async () => {
      await seedFilteredBookmarks();
      // Mark t1 as already sent
      await repo.markNewslettered(["t1"]);

      const results = await repo.getNewsletterBookmarks({ starredOnly: true });
      const ids = results.map((b) => b.tweet_id);
      // t1 excluded (already sent, default mode is unsent only)
      expect(ids).toEqual(["t3"]);
    });

    it("hidden/deleted bookmarks excluded when filters active", async () => {
      await seedFilteredBookmarks();

      // t5 is starred+hidden, t6 is must-read+deleted
      const starred = await repo.getNewsletterBookmarks({ starredOnly: true });
      expect(starred.find((b) => b.tweet_id === "t5")).toBeUndefined();

      const mustRead = await repo.getNewsletterBookmarks({ mustReadOnly: true });
      expect(mustRead.find((b) => b.tweet_id === "t6")).toBeUndefined();
    });

    it("returns all bookmarks when no filters set (backward compat)", async () => {
      await seedFilteredBookmarks();
      const results = await repo.getNewsletterBookmarks();
      // Should include t1-t4 (t5 hidden, t6 deleted)
      expect(results).toHaveLength(4);
    });
  });
});
