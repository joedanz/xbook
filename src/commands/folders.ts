// ABOUTME: CLI folders command — list bookmark folders via API.

import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError, outputTable } from "../lib/output";

export const foldersCommand = new Command("folders")
  .description("List bookmark folders")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    try {
      const result = (await apiRequest(config, "GET", "/api/v1/folders")) as {
        folders: Array<{ id: string; name: string; count: number }>;
      };

      if (json) {
        outputJson(result);
      } else {
        if (result.folders.length === 0) {
          outputText("No folders found.");
          return;
        }

        outputTable(
          ["ID", "Name", "Bookmarks"],
          result.folders.map((f) => [f.id, f.name, String(f.count || 0)])
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
