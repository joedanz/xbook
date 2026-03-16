// ABOUTME: CLI serve command — runs sync and newsletter on a cron schedule via the API.
// ABOUTME: Uses node-cron for scheduling with graceful shutdown support.

import { Command } from "commander";
import cron from "node-cron";
import { resolveConfig } from "../lib/config";
import { apiRequest } from "../lib/client";
import { outputText, outputError } from "../lib/output";

const DEFAULT_CRON = "0 9 * * 1"; // Monday at 9am

function timestamp(): string {
  return new Date().toISOString();
}

async function runSync(config: ReturnType<typeof resolveConfig>): Promise<void> {
  outputText(`[${timestamp()}] Running sync...`);
  try {
    const result = (await apiRequest(config, "POST", "/api/v1/sync")) as Record<string, unknown>;
    outputText(
      `[${timestamp()}] Sync complete: ${result.fetched} fetched, ${result.newCount} new, ${result.foldersFound} folders`
    );
  } catch (err) {
    outputError(`[${timestamp()}] Sync failed: ${(err as Error).message}`, false);
  }
}

async function runNewsletter(config: ReturnType<typeof resolveConfig>): Promise<void> {
  outputText(`[${timestamp()}] Running newsletter...`);
  try {
    const result = (await apiRequest(config, "POST", "/api/v1/newsletter", {
      dry_run: false,
    })) as Record<string, unknown>;
    outputText(`[${timestamp()}] Newsletter complete: ${result.message}`);
  } catch (err) {
    outputError(`[${timestamp()}] Newsletter failed: ${(err as Error).message}`, false);
  }
}

export const serveCommand = new Command("serve")
  .description("Run sync and newsletter on a cron schedule")
  .option("--cron <expression>", "Cron schedule expression", DEFAULT_CRON)
  .option("--sync-only", "Only run sync on each trigger")
  .option("--newsletter-only", "Only run newsletter on each trigger")
  .action(async (opts) => {
    const config = resolveConfig();
    const cronExpr: string = opts.cron;
    const syncOnly: boolean = opts.syncOnly ?? false;
    const newsletterOnly: boolean = opts.newsletterOnly ?? false;

    if (!cron.validate(cronExpr)) {
      outputError(`Invalid cron expression: "${cronExpr}"`, false);
      process.exit(1);
    }

    if (syncOnly && newsletterOnly) {
      outputError("Cannot use --sync-only and --newsletter-only together", false);
      process.exit(1);
    }

    const tasks = [];
    if (!newsletterOnly) tasks.push("sync");
    if (!syncOnly) tasks.push("newsletter");

    outputText(`xbook serve starting`);
    outputText(`  Schedule: ${cronExpr}`);
    outputText(`  Tasks:    ${tasks.join(", ")}`);
    outputText(`  API:      ${config.apiUrl}`);
    outputText(`  Started:  ${timestamp()}`);
    outputText(``);
    outputText(`Waiting for next cron trigger... (Ctrl+C to stop)`);

    const task = cron.schedule(cronExpr, async () => {
      outputText(`\n[${timestamp()}] Cron triggered`);

      if (!newsletterOnly) {
        await runSync(config);
      }
      if (!syncOnly) {
        await runNewsletter(config);
      }

      outputText(`[${timestamp()}] Run complete. Waiting for next trigger...`);
    });

    const shutdown = () => {
      outputText(`\n[${timestamp()}] Shutting down...`);
      task.stop();
      outputText(`[${timestamp()}] Cron stopped. Goodbye.`);
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
