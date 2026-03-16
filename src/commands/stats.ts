// ABOUTME: CLI stats command — show dashboard statistics via API.

import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";

export const statsCommand = new Command("stats")
  .description("Show bookmark statistics")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    try {
      const result = (await apiRequest(config, "GET", "/api/v1/stats")) as {
        stats: Record<string, unknown>;
        syncHistory: Array<Record<string, unknown>>;
      };

      if (json) {
        outputJson(result);
      } else {
        const s = result.stats;
        outputText(`Bookmarks: ${s.totalBookmarks}`);
        outputText(`Folders:   ${s.folderCount}`);
        outputText(`Last sync: ${s.lastSyncAt ?? "never"}`);
        outputText(`Newsletter: ${s.lastNewsletterAt ?? "never"}`);

        if (result.syncHistory.length > 0) {
          const last = result.syncHistory[0];
          outputText(`\nLast sync: ${last.synced_at} (${last.bookmarks_fetched} fetched, ${last.bookmarks_new} new)`);
        }
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
