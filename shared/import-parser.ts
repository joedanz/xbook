// ABOUTME: Shared import parser for bookmark files (JSON, CSV).
// ABOUTME: Auto-detects format (flat JSON, twitter-web-exporter, CSV) and normalizes to Tweet/User objects.

import type { Tweet, User } from "./types";

export interface ImportResult {
  tweets: Tweet[];
  users: Map<string, User>;
  format: "json-flat" | "json-twitter-exporter" | "csv";
  warnings: string[];
}

/**
 * Parse an import file and return normalized Tweet/User data.
 * Auto-detects format based on file extension and content structure.
 */
export function parseImportFile(content: string, filename: string): ImportResult {
  // Strip UTF-8 BOM
  const cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const trimmed = cleaned.trim();

  if (!trimmed) {
    throw new Error("File is empty");
  }

  // CSV detection by extension
  if (filename.toLowerCase().endsWith(".csv")) {
    return parseCsv(trimmed);
  }

  // Otherwise try JSON
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON: could not parse file content");
  }

  if (!Array.isArray(data)) {
    throw new Error("Expected a JSON array of bookmarks");
  }

  if (data.length === 0) {
    throw new Error("JSON array is empty");
  }

  // Detect twitter-web-exporter format: items have rest_id, legacy, or core fields
  const sample = data[0] as Record<string, unknown>;
  if (sample.rest_id || sample.legacy || sample.core) {
    return parseTwitterExporter(data);
  }

  return parseFlatJson(data);
}

// --- Field alias mapping for flat JSON/CSV ---

function getField(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return String(obj[key]);
    }
  }
  return undefined;
}

function mapFlatItem(
  obj: Record<string, unknown>,
  warnings: string[],
  index: number
): { tweet: Tweet; user: Partial<User> } | null {
  const id = getField(obj, "id", "tweet_id", "tweetId");
  const text = getField(obj, "text", "full_text", "tweet_text");

  if (!id) {
    warnings.push(`Item ${index}: missing id field, skipped`);
    return null;
  }
  if (!text) {
    warnings.push(`Item ${index}: missing text field, skipped`);
    return null;
  }

  // Extract media URL: check string fields first, then media array (twitter-web-exporter)
  let mediaUrl = getField(obj, "media_url", "mediaUrl");
  if (!mediaUrl) {
    const mediaArr = obj.media;
    if (Array.isArray(mediaArr) && mediaArr.length > 0) {
      const first = mediaArr[0] as Record<string, unknown>;
      mediaUrl = getField(first, "thumbnail", "original", "media_url_https");
    }
  }

  const tweet: Tweet = {
    id,
    text,
    created_at: getField(obj, "created_at", "createdAt"),
    author_id: getField(obj, "author_id", "user_id"),
    media_url: mediaUrl,
    expanded_url: getField(obj, "expanded_url", "url"),
  };

  const user: Partial<User> = {
    username: getField(obj, "author_username", "screen_name", "username"),
    name: getField(obj, "author_name", "name"),
  };

  return { tweet, user };
}

// --- Flat JSON parser ---

function parseFlatJson(data: unknown[]): ImportResult {
  const tweets: Tweet[] = [];
  const users = new Map<string, User>();
  const warnings: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>;
    const result = mapFlatItem(item, warnings, i);
    if (!result) continue;

    tweets.push(result.tweet);

    if (result.tweet.author_id && result.user.username) {
      users.set(result.tweet.author_id, {
        id: result.tweet.author_id,
        name: result.user.name || result.user.username,
        username: result.user.username,
      });
    }
  }

  return { tweets, users, format: "json-flat", warnings };
}

// --- twitter-web-exporter parser ---

function parseTwitterExporter(data: unknown[]): ImportResult {
  const tweets: Tweet[] = [];
  const users = new Map<string, User>();
  const warnings: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>;

    const id = getString(item, "rest_id");
    const legacy = item.legacy as Record<string, unknown> | undefined;

    if (!id) {
      warnings.push(`Item ${i}: missing rest_id, skipped`);
      continue;
    }

    const text = legacy ? getString(legacy, "full_text") : undefined;
    if (!text) {
      warnings.push(`Item ${i}: missing legacy.full_text, skipped`);
      continue;
    }

    // Extract user info from core.user_results.result.legacy
    const core = item.core as Record<string, unknown> | undefined;
    const userResults = core?.user_results as Record<string, unknown> | undefined;
    const userResult = userResults?.result as Record<string, unknown> | undefined;
    const userLegacy = userResult?.legacy as Record<string, unknown> | undefined;

    const userId = userResult ? getString(userResult, "rest_id") : undefined;
    const screenName = userLegacy ? getString(userLegacy, "screen_name") : undefined;
    const userName = userLegacy ? getString(userLegacy, "name") : undefined;

    // Extract media
    const entities = legacy?.entities as Record<string, unknown> | undefined;
    const media = entities?.media as Record<string, unknown>[] | undefined;
    const mediaUrl = media?.[0] ? getString(media[0], "media_url_https") : undefined;

    // Extract URLs
    const urls = entities?.urls as Record<string, unknown>[] | undefined;
    const expandedUrl = urls?.[0] ? getString(urls[0], "expanded_url") : undefined;

    const createdAt = legacy ? getString(legacy, "created_at") : undefined;

    const tweet: Tweet = {
      id,
      text,
      created_at: createdAt,
      author_id: userId,
      media_url: mediaUrl,
      expanded_url: expandedUrl,
    };

    tweets.push(tweet);

    if (userId && screenName) {
      users.set(userId, {
        id: userId,
        name: userName || screenName,
        username: screenName,
      });
    }
  }

  return { tweets, users, format: "json-twitter-exporter", warnings };
}

// --- CSV parser ---

function parseCsv(content: string): ImportResult {
  const lines = parseCsvLines(content);

  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one data row");
  }

  const headers = lines[0];
  const tweets: Tweet[] = [];
  const users = new Map<string, User>();
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // Build object from header/value pairs
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j].trim()] = row[j]?.trim() ?? "";
    }

    const result = mapFlatItem(obj, warnings, i);
    if (!result) continue;

    tweets.push(result.tweet);

    if (result.tweet.author_id && result.user.username) {
      users.set(result.tweet.author_id, {
        id: result.tweet.author_id,
        name: result.user.name || result.user.username,
        username: result.user.username,
      });
    }
  }

  return { tweets, users, format: "csv", warnings };
}

/**
 * Parse CSV content into rows of fields.
 * Handles quoted fields containing commas and newlines.
 */
function parseCsvLines(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && content[i + 1] === "\n")) {
        current.push(field);
        field = "";
        if (current.some((f) => f.length > 0)) {
          rows.push(current);
        }
        current = [];
        if (ch === "\r") i++; // skip \n after \r
      } else {
        field += ch;
      }
    }
  }

  // Last field/row
  current.push(field);
  if (current.some((f) => f.length > 0)) {
    rows.push(current);
  }

  return rows;
}

// --- Helpers ---

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  return String(val);
}
