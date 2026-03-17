import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import { loadCliTokens, saveCliTokens } from "@/lib/load-cli-tokens";
import { refreshXTokenForWeb } from "@shared/x-auth";
import { acquireSyncLock, releaseSyncLock } from "@/lib/sync-lock";
import { checkRateLimit, rateLimitResponse, SYNC_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST() {
  const userId = "local";

  const rl = await checkRateLimit(`sync:${userId}`, SYNC_RATE_LIMIT);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  const lockAcquired = await acquireSyncLock(userId);
  if (!lockAcquired) {
    return NextResponse.json(
      { success: false, message: "Sync already in progress" },
      { status: 409 }
    );
  }

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await releaseSyncLock(userId);
    return NextResponse.json(
      {
        success: false,
        message:
          "X API credentials not configured. Add X_CLIENT_ID and X_CLIENT_SECRET to .env.local",
      },
      { status: 500 }
    );
  }

  const tokens = loadCliTokens();
  if (!tokens) {
    await releaseSyncLock(userId);
    return NextResponse.json(
      {
        success: false,
        message:
          "Not authenticated. Run `xbook login` from the CLI first to generate tokens.",
      },
      { status: 401 }
    );
  }

  try {
    // Get a valid access token (refresh if needed)
    let accessToken = tokens.accessToken;
    if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
      const refreshed = await refreshXTokenForWeb(
        tokens.refreshToken,
        clientId,
        clientSecret
      );
      accessToken = refreshed.accessToken;

      // Save refreshed tokens back to disk
      saveCliTokens(refreshed);
    }

    // Import syncBookmarks dynamically to avoid bundling CLI code at build time
    const { syncBookmarks } = await import("@shared/sync");
    const repo = getRepository();

    const result = await syncBookmarks(repo, accessToken);

    return NextResponse.json({
      success: true,
      message: `Synced ${result.fetched} bookmarks (${result.newCount} new) across ${result.pages} page(s)`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/sync error:", error);
    return NextResponse.json(
      { success: false, message: "Sync failed. Please try again." },
      { status: 500 }
    );
  } finally {
    await releaseSyncLock(userId);
  }
}
