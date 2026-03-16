// ABOUTME: CLI configuration management — loads/saves ~/.xbook/config.json.
// ABOUTME: Supports env var overrides and config resolution order.

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "fs";
import { resolve, dirname } from "path";
import { homedir } from "os";

export interface CliConfig {
  apiKey?: string;
  apiUrl: string;
  outputJson: boolean;
}

const CONFIG_DIR = resolve(homedir(), ".xbook");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.json");

function loadConfigFile(): Partial<CliConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveConfig(updates: Partial<CliConfig>): void {
  const existing = loadConfigFile();
  const merged = { ...existing, ...updates };
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  chmodSync(CONFIG_FILE, 0o600);
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, "{}", "utf-8");
  }
}

/**
 * Resolution order:
 * 1. CLI flags (passed in via overrides)
 * 2. Environment variables
 * 3. Config file (~/.xbook/config.json)
 * 4. Defaults
 */
export function resolveConfig(overrides?: Partial<CliConfig>): CliConfig {
  const file = loadConfigFile();

  return {
    apiKey:
      overrides?.apiKey ||
      process.env.XBOOK_API_KEY ||
      file.apiKey ||
      undefined,
    apiUrl:
      overrides?.apiUrl ||
      process.env.XBOOK_API_URL ||
      file.apiUrl ||
      "http://localhost:3000",
    outputJson:
      overrides?.outputJson ??
      (process.env.XBOOK_OUTPUT === "json" || undefined) ??
      file.outputJson ??
      false,
  };
}
