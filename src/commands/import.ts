// ABOUTME: CLI import command — imports bookmarks from JSON or CSV files.
// ABOUTME: Reads file locally, POSTs to web API for storage. Supports --dry-run for validation.

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";
import { parseImportFile } from "../../shared/import-parser";

export const importCommand = new Command("import")
  .description("Import bookmarks from a JSON or CSV file")
  .argument("<file>", "Path to JSON or CSV file")
  .option("--dry-run", "Validate file without importing")
  .action(async (file: string, opts: { dryRun?: boolean }, cmd) => {
    const json = cmd.parent?.opts().json ?? false;

    // Read file
    const filePath = resolve(file);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      outputError(`Cannot read file: ${filePath}`, json);
      process.exit(1);
    }

    const filename = file.split("/").pop() || file;

    // Dry run: parse locally and report
    if (opts.dryRun) {
      try {
        const result = parseImportFile(content, filename);
        if (json) {
          outputJson({
            valid: true,
            format: result.format,
            totalTweets: result.tweets.length,
            totalUsers: result.users.size,
            warnings: result.warnings,
          });
        } else {
          outputText(
            `Valid ${result.format}: ${result.tweets.length} bookmarks, ${result.users.size} users`
          );
          if (result.warnings.length > 0) {
            outputText(`Warnings (${result.warnings.length}):`);
            for (const w of result.warnings.slice(0, 10)) {
              outputText(`  - ${w}`);
            }
            if (result.warnings.length > 10) {
              outputText(`  ... and ${result.warnings.length - 10} more`);
            }
          }
        }
      } catch (err) {
        outputError((err as Error).message, json);
        process.exit(1);
      }
      return;
    }

    // Full import: POST to API
    const config = resolveConfig();

    try {
      const result = (await apiRequest(config, "POST", "/api/v1/import", {
        content,
        filename,
      })) as Record<string, unknown>;

      if (json) {
        outputJson(result);
      } else {
        outputText(
          `Imported: ${result.imported} new, ${result.skipped} existing, ${result.errors} errors (${result.format} format)`
        );
        const warnings = result.warnings as string[] | undefined;
        if (warnings && warnings.length > 0) {
          outputText(`Warnings (${warnings.length}):`);
          for (const w of warnings.slice(0, 10)) {
            outputText(`  - ${w}`);
          }
          if (warnings.length > 10) {
            outputText(`  ... and ${warnings.length - 10} more`);
          }
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
