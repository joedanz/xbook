// ABOUTME: CLI sync command — triggers bookmark sync via API.

import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";

export const syncCommand = new Command("sync")
  .description("Sync bookmarks from X")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    try {
      const result = (await apiRequest(config, "POST", "/api/v1/sync")) as Record<string, unknown>;

      if (json) {
        outputJson(result);
      } else {
        outputText(
          `Synced: ${result.fetched} fetched, ${result.newCount} new, ${result.foldersFound} folders`
        );
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
