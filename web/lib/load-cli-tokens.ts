// ABOUTME: Shared local-mode CLI token loading.
// ABOUTME: Searches for .tokens.json on disk and optionally refreshes expired tokens.

import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "fs";

export interface CliTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/** Search paths for the CLI-generated .tokens.json file. */
function tokenCandidates(): string[] {
  return [
    process.env.TOKEN_FILE_PATH,
    resolve(process.cwd(), ".tokens.json"),
    resolve(process.cwd(), "../.tokens.json"),
  ].filter(Boolean) as string[];
}

/** Load tokens from the CLI's .tokens.json file. Returns null if not found. */
export function loadCliTokens(): CliTokens | null {
  for (const path of tokenCandidates()) {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, "utf-8"));
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Save refreshed tokens back to the .tokens.json file. */
export function saveCliTokens(tokens: CliTokens): void {
  const candidates = tokenCandidates();
  for (const path of candidates) {
    if (existsSync(path)) {
      writeFileSync(path, JSON.stringify(tokens, null, 2), "utf-8");
      chmodSync(path, 0o600);
      return;
    }
  }
  if (candidates.length > 0) {
    writeFileSync(candidates[0], JSON.stringify(tokens, null, 2), "utf-8");
    chmodSync(candidates[0], 0o600);
  }
}
