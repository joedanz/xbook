// ABOUTME: Repository factory for the web app.
// ABOUTME: Returns a cached SQLite BookmarkRepository singleton.

import type { BookmarkRepository } from "@shared/repository";

let repository: BookmarkRepository | null = null;

export function getRepository(_userId?: string): BookmarkRepository {
  if (!repository) {
    const { SqliteBookmarkRepository } = require("@shared/sqlite-repository"); // eslint-disable-line @typescript-eslint/no-require-imports
    const dbPath = process.env.DB_PATH || "../xbook.db";
    const repo = new SqliteBookmarkRepository(dbPath) as BookmarkRepository;
    repository = repo;
    return repo;
  }
  return repository;
}
