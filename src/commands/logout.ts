// ABOUTME: CLI logout command — clears saved API key.

import { Command } from "commander";
import { clearConfig } from "../lib/config";
import { outputJson, outputText } from "../lib/output";

export const logoutCommand = new Command("logout")
  .description("Clear saved API key")
  .action((opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    clearConfig();

    if (json) {
      outputJson({ success: true });
    } else {
      outputText("Logged out. API key cleared.");
    }
  });
