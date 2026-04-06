// ABOUTME: CLI sync command — triggers bookmark sync via API or Chrome session.
// ABOUTME: Supports first-run sync method choice, Chrome cookie extraction, and direct-to-DB sync.

import { Command } from "commander";
import { createInterface } from "readline";
import { resolveConfig, saveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";
import type { CliConfig } from "../lib/config";

/**
 * Prompt the user to choose a sync method on first run (macOS only).
 * Returns "chrome" or "api". Enter defaults to Chrome.
 */
async function promptSyncMethod(): Promise<NonNullable<CliConfig["syncMethod"]>> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    console.log(`
How would you like to sync your bookmarks?

  1. Chrome (recommended)
     Syncs directly from your Chrome browser. Full history, engagement
     stats, and media. No API key needed.

  2. X API
     Uses the official X API. Works on all platforms but limited to
     ~100 most recent bookmarks. Requires an X developer account.
`);
    rl.question("Choose [1/2] (press Enter for Chrome): ", (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === "2") {
        resolve("api");
      } else {
        resolve("chrome");
      }
    });
  });
}

/**
 * Determine which sync method to use based on flags, config, and platform.
 * Returns the method and whether this is a first run with a new method.
 */
export function resolveSyncMethod(opts: {
  chrome?: boolean;
  api?: boolean;
  configSyncMethod?: CliConfig["syncMethod"];
  hasApiKey: boolean;
}): { method: NonNullable<CliConfig["syncMethod"]> | "prompt"; isMethodSwitch: boolean } {
  // Priority 1: Explicit flags
  if (opts.chrome) {
    if (process.platform !== "darwin") {
      throw new Error("Chrome sync requires macOS. Run 'xbook sync' to use the X API instead.");
    }
    return {
      method: "chrome",
      isMethodSwitch: !!opts.configSyncMethod && opts.configSyncMethod !== "chrome",
    };
  }
  if (opts.api) {
    return {
      method: "api",
      isMethodSwitch: !!opts.configSyncMethod && opts.configSyncMethod !== "api",
    };
  }

  // Priority 2: Saved preference
  if (opts.configSyncMethod) {
    return { method: opts.configSyncMethod, isMethodSwitch: false };
  }

  // Priority 3: Existing apiKey implies API sync (upgrade path)
  if (opts.hasApiKey) {
    return { method: "api", isMethodSwitch: false };
  }

  // Priority 4: Non-macOS → API silently
  if (process.platform !== "darwin") {
    return { method: "api", isMethodSwitch: false };
  }

  // Priority 5: First run on macOS → prompt
  return { method: "prompt", isMethodSwitch: false };
}

async function runChromeSync(opts: {
  profile?: string;
  full?: boolean;
  verbose?: boolean;
  json: boolean;
  dbPath?: string;
}): Promise<void> {
  // Dynamic imports to avoid loading Chrome/SQLite code when using API sync
  const { extractChromeCookies } = await import("../lib/chrome-cookies");
  const { syncBookmarksChrome } = await import("../../shared/sync-chrome");
  const { SqliteBookmarkRepository } = await import("../../shared/sqlite-repository");

  const cookies = await extractChromeCookies(opts.profile);
  const dbPath = opts.dbPath || "./xbook.db";
  let repo: InstanceType<typeof SqliteBookmarkRepository> | undefined;

  try {
    repo = new SqliteBookmarkRepository(dbPath);
    const onProgress = opts.verbose ? (msg: string) => console.log(msg) : undefined;
    const result = await syncBookmarksChrome(repo, cookies, onProgress, undefined, {
      full: opts.full,
    });

    if (opts.json) {
      outputJson(result);
    } else {
      outputText(
        `Synced: ${result.fetched} fetched, ${result.newCount} new across ${result.pages} page(s) (via Chrome)`
      );
    }
  } finally {
    try { repo?.close(); } catch { /* don't mask original error */ }
  }
}

export const syncCommand = new Command("sync")
  .description("Sync bookmarks from X")
  .option("--chrome", "Use Chrome session sync (macOS only)")
  .option("--api", "Use X API sync (OAuth)")
  .option("--profile <name>", "Chrome profile to use (default: Default)")
  .option("--full", "Full sync — skip early termination")
  .option("--verbose", "Show detailed progress per page")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    try {
      const { method, isMethodSwitch } = resolveSyncMethod({
        chrome: opts.chrome,
        api: opts.api,
        configSyncMethod: config.syncMethod,
        hasApiKey: !!config.apiKey,
      });

      let finalMethod: NonNullable<CliConfig["syncMethod"]>;

      if (method === "prompt") {
        finalMethod = await promptSyncMethod();
        saveConfig({ syncMethod: finalMethod });
      } else {
        finalMethod = method;
        // Save the method if not already saved
        if (!config.syncMethod) {
          saveConfig({ syncMethod: finalMethod });
        }
      }

      if (isMethodSwitch) {
        outputText("Sync method changed — running full sync to avoid stale data.");
        opts.full = true;
      }

      if (finalMethod === "chrome") {
        await runChromeSync({
          profile: opts.profile,
          full: opts.full,
          verbose: opts.verbose,
          json,
          dbPath: config.dbPath,
        });
      } else {
        // API sync — existing behavior
        const params = opts.full ? "?full=true" : "";
        const result = (await apiRequest(config, "POST", `/api/v1/sync${params}`)) as Record<string, unknown>;

        if (json) {
          outputJson(result);
        } else {
          outputText(
            `Synced: ${result.fetched} fetched, ${result.newCount} new, ${result.foldersFound} folders`
          );
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
      if (err instanceof Error) {
        outputError(err.message, json);
        process.exit(1);
      }
      throw err;
    }
  });
