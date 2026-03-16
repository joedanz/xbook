// ABOUTME: CLI login command — validates API key and saves to config.
// ABOUTME: Reads key from argument, XBOOK_API_KEY env var, or interactive prompt.

import { Command } from "commander";
import { resolveConfig, saveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";
import { createInterface } from "readline";

export const loginCommand = new Command("login")
  .description("Authenticate with an xbook API key")
  .argument("[api-key]", "API key (or set XBOOK_API_KEY env var)")
  .action(async (apiKeyArg: string | undefined, opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;

    let apiKey = apiKeyArg || process.env.XBOOK_API_KEY;

    // Interactive prompt if no key provided and not in CI/JSON mode
    if (!apiKey && !json && !process.env.CI) {
      apiKey = await promptForKey();
    }

    if (!apiKey) {
      outputError("No API key provided. Pass as argument or set XBOOK_API_KEY.", json);
      process.exit(3);
    }

    const config = resolveConfig({ apiKey });

    try {
      const user = (await apiRequest(config, "GET", "/api/v1/me")) as Record<string, unknown>;
      saveConfig({ apiKey });

      if (json) {
        outputJson({ success: true, user });
      } else {
        outputText(`Logged in as ${user.name || user.email || user.userId}`);
        outputText(`API URL: ${config.apiUrl}`);
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

function promptForKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question("Enter your xbook API key: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
