// ABOUTME: CLI newsletter command — send or preview weekly digest via API.

import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";

export const newsletterCommand = new Command("newsletter")
  .description("Send or preview bookmark newsletter")
  .option("--dry-run", "Preview newsletter without sending")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    try {
      const result = (await apiRequest(config, "POST", "/api/v1/newsletter", {
        dry_run: opts.dryRun || false,
      })) as Record<string, unknown>;

      if (json) {
        outputJson(result);
      } else {
        if (opts.dryRun && result.html) {
          outputText(`Subject: ${result.subject}`);
          outputText(`Bookmarks: ${result.count}`);
          outputText(String(result.html));
        } else {
          outputText(String(result.message));
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
