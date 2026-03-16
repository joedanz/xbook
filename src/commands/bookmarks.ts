// ABOUTME: CLI bookmarks command — list and search bookmarks via API.

import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError, outputTable } from "../lib/output";

export const bookmarksCommand = new Command("bookmarks")
  .description("List bookmarks")
  .option("-s, --search <query>", "Search text")
  .option("--starred", "Show only starred bookmarks")
  .option("--folder <id>", "Filter by folder ID")
  .option("--author <username>", "Filter by author username")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("-p, --page <n>", "Page number", "1")
  .option("--page-size <n>", "Results per page", "20")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    const params = new URLSearchParams();
    if (opts.search) params.set("search", opts.search);
    if (opts.starred) params.set("starred", "true");
    if (opts.folder) params.set("folder", opts.folder);
    if (opts.author) params.set("author", opts.author);
    if (opts.tags) params.set("tags", opts.tags);
    params.set("page", opts.page);
    params.set("page_size", opts.pageSize);

    try {
      const result = (await apiRequest(
        config,
        "GET",
        `/api/v1/bookmarks?${params.toString()}`
      )) as { items: Array<Record<string, unknown>>; total: number; page: number; totalPages: number };

      if (json) {
        outputJson(result);
      } else {
        if (result.items.length === 0) {
          outputText("No bookmarks found.");
          return;
        }

        outputTable(
          ["ID", "Author", "Text", "Starred"],
          result.items.map((bm) => [
            String(bm.tweet_id || ""),
            String(bm.author_username || ""),
            String(bm.text || "").slice(0, 60) + (String(bm.text || "").length > 60 ? "..." : ""),
            bm.starred ? "*" : "",
          ])
        );
        outputText(`\nPage ${result.page}/${result.totalPages} (${result.total} total)`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        outputError(err.message, json);
        process.exit(err.statusCode === 401 ? 3 : 4);
      }
      if (err instanceof NetworkError) {
        outputError(err.message, json);
        process.exit(5);
      }
      throw err;
    }
  });
