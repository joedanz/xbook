// ABOUTME: API v1 import endpoint — imports bookmarks from JSON or CSV files.
// ABOUTME: Accepts pre-parsed {tweets, users} JSON (web UI batches), raw {content, filename} JSON (CLI), or multipart file upload.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseImportFile } from "@shared/import-parser";
import type { Tweet, User } from "@shared/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// More permissive than sync — imports are infrequent but can be large
const IMPORT_RATE_LIMIT = { limit: 50, windowSeconds: 60 };

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await checkRateLimit(`import:${auth.userId}`, IMPORT_RATE_LIMIT);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    // Extract tweets and users from the request
    let tweets: Tweet[];
    let users: Map<string, User>;
    let format: string | undefined;
    let warnings: string[] = [];

    const contentType = request.headers.get("content-type") || "";

    try {
      if (contentType.includes("multipart/form-data")) {
        // Web UI file upload (small files)
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          return NextResponse.json(
            { error: "No file provided" },
            { status: 400 }
          );
        }

        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "File too large (max 10MB)" },
            { status: 400 }
          );
        }

        const content = await file.text();
        const parsed = parseImportFile(content, file.name);
        tweets = parsed.tweets;
        users = parsed.users;
        format = parsed.format;
        warnings = parsed.warnings;
      } else {
        // JSON body — either pre-parsed {tweets, users} or raw {content, filename}
        const body = await request.json() as Record<string, unknown>;

        if (body.tweets && Array.isArray(body.tweets)) {
          // Pre-parsed batch from web UI (client-side parsing)
          // Validate required fields and enforce length limits
          const rawTweets = body.tweets as Record<string, unknown>[];
          tweets = rawTweets.filter(
            (t) =>
              typeof t.id === "string" && t.id.length > 0 && t.id.length <= 30 &&
              typeof t.text === "string" && t.text.length <= 10_000
          ) as unknown as Tweet[];
          if (tweets.length === 0 && rawTweets.length > 0) {
            return NextResponse.json(
              { error: "No valid tweets in request — each must have id (≤30 chars) and text (≤10k chars)" },
              { status: 400 }
            );
          }
          // Reconstruct Map from plain object
          const usersObj = (body.users || {}) as Record<string, User>;
          users = new Map(Object.entries(usersObj));
          format = body.format as string | undefined;
        } else if (body.content && typeof body.content === "string") {
          // Raw file content from CLI
          if (Buffer.byteLength(body.content, "utf-8") > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: "Content too large (max 10MB)" },
              { status: 400 }
            );
          }

          const parsed = parseImportFile(
            body.content,
            (body.filename as string) || "import.json"
          );
          tweets = parsed.tweets;
          users = parsed.users;
          format = parsed.format;
          warnings = parsed.warnings;
        } else {
          return NextResponse.json(
            { error: "Invalid request: expected {tweets, users} or {content, filename}" },
            { status: 400 }
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const MAX_IMPORT_ITEMS = 50_000;
    if (tweets.length > MAX_IMPORT_ITEMS) {
      return NextResponse.json(
        { error: `Too many items (max ${MAX_IMPORT_ITEMS})` },
        { status: 400 }
      );
    }

    // Import into database
    const repo = getRepository();
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const CHUNK_SIZE = 500;
    for (let i = 0; i < tweets.length; i += CHUNK_SIZE) {
      const chunk = tweets.slice(i, i + CHUNK_SIZE);
      try {
        const result = await repo.upsertBookmarksBatch(chunk, users);
        imported += result.imported;
        skipped += result.skipped;
      } catch {
        errors += chunk.length;
      }
    }

    return NextResponse.json({
      success: true,
      total: tweets.length,
      imported,
      skipped,
      errors,
      format,
      warnings,
    });
  } catch (error) {
    console.error("POST /api/v1/import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
