// ABOUTME: API v1 sync endpoint — triggers bookmark sync for the authenticated user.
// ABOUTME: Used by CLI `xbook sync` command.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { loadCliTokens, saveCliTokens } from "@/lib/load-cli-tokens";
import { checkRateLimit, rateLimitResponse, SYNC_RATE_LIMIT } from "@/lib/rate-limit";
import { acquireSyncLock, releaseSyncLock } from "@/lib/sync-lock";

export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await checkRateLimit(`sync:${auth.userId}`, SYNC_RATE_LIMIT);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  const locked = await acquireSyncLock(auth.userId);
  if (!locked) {
    return NextResponse.json(
      { error: "Sync already in progress" },
      { status: 409 }
    );
  }

  const repo = getRepository();

  try {
    const tokens = loadCliTokens();

    if (!tokens) {
      return NextResponse.json(
        { error: "Not authenticated. Run `xbook login` first." },
        { status: 401 }
      );
    }

    // Refresh expired tokens before syncing
    let accessToken = tokens.accessToken;
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;

    if (clientId && clientSecret && tokens.expiresAt < Date.now()) {
      try {
        const { refreshXTokenForWeb } = await import("@shared/x-auth");
        const refreshed = await refreshXTokenForWeb(tokens.refreshToken, clientId, clientSecret);
        accessToken = refreshed.accessToken;

        // Save refreshed tokens back to disk
        saveCliTokens(refreshed);
      } catch {
        return NextResponse.json(
          { error: "X token expired and refresh failed. Please run `xbook login` again." },
          { status: 401 }
        );
      }
    }

    const { syncBookmarks } = await import("@shared/sync");
    const result = await syncBookmarks(repo, accessToken);

    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      newCount: result.newCount,
      foldersFound: result.foldersFound,
    });
  } catch (error) {
    console.error("POST /api/v1/sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await releaseSyncLock(auth.userId);
  }
}
