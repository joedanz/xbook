// ABOUTME: Reads Chrome's local SQLite cookie database on macOS and decrypts X/Twitter session cookies.
// ABOUTME: Used by the CLI sync command to authenticate against X's GraphQL API without needing OAuth.

import {
  existsSync,
  readFileSync,
  copyFileSync,
  chmodSync,
  mkdtempSync,
  rmSync,
} from "fs";
import { resolve, join } from "path";
import { homedir, tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { pbkdf2Sync, createDecipheriv } from "crypto";
import Database from "better-sqlite3";
import type { ChromeCookies } from "../../shared/types";

const execFileAsync = promisify(execFile);

/**
 * Lists available Chrome profile directory names by reading Local State.
 * Returns ["Default"] as a fallback if the file cannot be read or parsed.
 */
export function listChromeProfiles(): string[] {
  const chromeDataDir = resolve(
    homedir(),
    "Library",
    "Application Support",
    "Google",
    "Chrome"
  );

  try {
    const localStatePath = join(chromeDataDir, "Local State");
    const raw = readFileSync(localStatePath, "utf-8");
    const localState = JSON.parse(raw);
    const infoCache = localState?.profile?.info_cache;
    if (infoCache && typeof infoCache === "object") {
      return Object.keys(infoCache);
    }
    return ["Default"];
  } catch {
    return ["Default"];
  }
}

/**
 * Extracts and decrypts X/Twitter session cookies (ct0, auth_token) from
 * Chrome's local Cookies database on macOS.
 *
 * @param profileName - Chrome profile directory name (e.g. "Default", "Profile 1")
 */
export async function extractChromeCookies(
  profileName?: string
): Promise<ChromeCookies> {
  // 1. Platform check
  if (process.platform !== "darwin") {
    throw new Error(
      "Chrome sync requires macOS. Run 'xbook sync' to use the X API instead."
    );
  }

  // 2. Locate Chrome data directory
  const chromeDataDir = resolve(
    homedir(),
    "Library",
    "Application Support",
    "Google",
    "Chrome"
  );

  if (!existsSync(chromeDataDir)) {
    throw new Error(
      "Chrome not found at ~/Library/Application Support/Google/Chrome/. Is Chrome installed?"
    );
  }

  // 3. Resolve profile
  const profile = profileName || "Default";
  const profileDir = resolve(chromeDataDir, profile);

  // Prevent path traversal: resolved path must start with Chrome data dir
  if (!profileDir.startsWith(chromeDataDir + "/")) {
    throw new Error(
      `Invalid Chrome profile name: '${profile}'.`
    );
  }

  if (!existsSync(profileDir)) {
    const available = listChromeProfiles();
    throw new Error(
      `Chrome profile '${profile}' not found. Available profiles: ${available.join(", ")}`
    );
  }

  // 4. Copy Cookies DB to temp file (Chrome almost always has the DB locked)
  const cookiesSourcePath = join(profileDir, "Cookies");
  if (!existsSync(cookiesSourcePath)) {
    throw new Error(
      `No Cookies database found in Chrome profile '${profile}'. Is Chrome installed correctly?`
    );
  }

  const tempDir = mkdtempSync(join(tmpdir(), "xbook-"));
  const tempCookiesPath = join(tempDir, "Cookies");

  try {
    try {
      copyFileSync(cookiesSourcePath, tempCookiesPath);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EACCES" || code === "EPERM") {
        throw new Error(
          "Permission denied reading Chrome data. Add your terminal to System Settings > Privacy & Security > Full Disk Access."
        );
      }
      throw err;
    }

    chmodSync(tempCookiesPath, 0o600);

    // 5. Open temp Cookies DB with better-sqlite3
    const db = new Database(tempCookiesPath, { readonly: true });

    let rows: { name: string; encrypted_value: Buffer; host_key: string }[];
    let dbVersion = 0;
    try {
      // Chrome 130+ (DB version >= 24) prepends SHA256(host_key) to plaintext
      const metaRow = db.prepare(
        `SELECT value FROM meta WHERE key = 'version'`
      ).get() as { value: number } | undefined;
      dbVersion = metaRow?.value ?? 0;

      const stmt = db.prepare(
        `SELECT name, encrypted_value, host_key FROM cookies
         WHERE host_key IN ('.x.com', '.twitter.com')
         AND name IN ('ct0', 'auth_token')`
      );
      rows = stmt.all() as typeof rows;
    } finally {
      db.close();
    }

    // 6. Extract Chrome Safe Storage key from macOS Keychain
    let keychainPassword: string;
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-s",
        "Chrome Safe Storage",
        "-a",
        "Chrome",
        "-w",
      ]);
      keychainPassword = stdout.trim();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Keychain access failed: ${detail}. If this is a permissions error, add your terminal to System Settings > Privacy & Security > Full Disk Access.`
      );
    }

    // 7. Derive decryption key (PBKDF2)
    let derivedKey = pbkdf2Sync(keychainPassword, "saltysalt", 1003, 16, "sha1");

    try {
      // 8. Decrypt each cookie value
      let ct0 = "";
      let authToken = "";

      for (const row of rows) {
        let value: string;
        try {
          value = decryptCookieValue(
            Buffer.isBuffer(row.encrypted_value)
              ? row.encrypted_value
              : Buffer.from(row.encrypted_value),
            derivedKey,
            dbVersion
          );
        } catch {
          // Skip cookies with unsupported encryption (e.g. v20 on newer Chrome)
          continue;
        }

        if (!value) continue;

        if (row.name === "ct0" && !ct0) {
          ct0 = value;
        } else if (row.name === "auth_token" && !authToken) {
          authToken = value;
        }
      }

      // 9. Validate extracted cookies
      if (!ct0 || !authToken) {
        throw new Error(
          "No X session found in Chrome. Log into x.com in Chrome and try again."
        );
      }

      return { ct0, authToken };
    } finally {
      // 10. Security cleanup: zero out sensitive material
      keychainPassword = "";
      derivedKey.fill(0);
    }
  } finally {
    // Always clean up temp files
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Decrypts a single Chrome cookie encrypted_value buffer using the derived key.
 * Handles v10 (AES-128-CBC) prefix; throws on unsupported versions (e.g. v20).
 *
 * Chrome 130+ (DB version >= 24) prepends SHA256(host_key) (32 bytes) to the
 * plaintext before encryption as a domain-binding measure. We strip it after
 * decryption so the caller gets the raw cookie value.
 */
function decryptCookieValue(encryptedValue: Buffer, derivedKey: Buffer, dbVersion: number): string {
  if (encryptedValue.length <= 3) return "";

  const prefix = encryptedValue.subarray(0, 3).toString("ascii");

  if (prefix === "v10") {
    const iv = Buffer.alloc(16, 0x20); // 16 space characters
    const encrypted = encryptedValue.subarray(3);
    const decipher = createDecipheriv("aes-128-cbc", derivedKey, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // Chrome 130+ prepends SHA256(host_key) to the plaintext — strip it
    if (dbVersion >= 24 && decrypted.length > 32) {
      decrypted = decrypted.subarray(32);
    }

    return decrypted.toString("utf-8");
  }

  // v20 would need AES-256-GCM with a 32-byte key — not yet encountered on macOS
  throw new Error(`Unsupported Chrome cookie encryption version: ${prefix}`);
}
