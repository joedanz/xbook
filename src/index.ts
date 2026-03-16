#!/usr/bin/env node
// ABOUTME: CLI entry point for xbook — thin HTTP client for the xbook API.
// ABOUTME: Provides login, sync, bookmarks, folders, stats, newsletter, and status commands.

import { Command } from "commander";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { syncCommand } from "./commands/sync";
import { bookmarksCommand } from "./commands/bookmarks";
import { foldersCommand } from "./commands/folders";
import { statsCommand } from "./commands/stats";
import { newsletterCommand } from "./commands/newsletter";
import { statusCommand } from "./commands/status";
import { importCommand } from "./commands/import";
import { serveCommand } from "./commands/serve";

const program = new Command();

program
  .name("xbook")
  .description("X Bookmarks organizer — CLI client")
  .version("0.1.0")
  .option("--json", "Output JSON (for scripting and agents)")
  .option("--api-url <url>", "API URL override");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(syncCommand);
program.addCommand(bookmarksCommand);
program.addCommand(foldersCommand);
program.addCommand(statsCommand);
program.addCommand(newsletterCommand);
program.addCommand(statusCommand);
program.addCommand(importCommand);
program.addCommand(serveCommand);

program.parse();
