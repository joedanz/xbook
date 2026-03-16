// ABOUTME: CLI status command — check server health and connection.

import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { apiRequest, ApiError, NetworkError } from "../lib/client";
import { outputJson, outputText, outputError } from "../lib/output";

export const statusCommand = new Command("status")
  .description("Check server status and connection")
  .action(async (opts, cmd) => {
    const json = cmd.parent?.opts().json ?? false;
    const config = resolveConfig();

    try {
      const result = (await apiRequest(config, "GET", "/api/v1/status")) as Record<string, unknown>;

      if (json) {
        outputJson(result);
      } else {
        outputText(`Status:  ${result.status}`);
        outputText(`Mode:    ${result.mode}`);
        outputText(`Version: ${result.version}`);
        outputText(`API URL: ${config.apiUrl}`);
      }
    } catch (err) {
      if (err instanceof NetworkError) {
        outputError(`Cannot reach ${config.apiUrl}: ${err.message}`, json);
        process.exit(5);
      }
      if (err instanceof ApiError) {
        outputError(err.message, json);
        process.exit(4);
      }
      throw err;
    }
  });
