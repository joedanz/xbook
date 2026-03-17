// ABOUTME: Repository factory for the web app.
// ABOUTME: Returns a cached SQLite BookmarkRepository singleton.
// ABOUTME: userId parameter is accepted for cloud-compatibility but ignored in local mode.

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

// Stub for cloud-compatibility — never called in local mode, but satisfies
// TypeScript when cloud code dynamically imports { getNeonSql } from "@/lib/db".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNeonSql(): any {
  throw new Error("getNeonSql is not available in local/OSS mode");
}
