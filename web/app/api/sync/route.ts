import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import { loadCliTokens, saveCliTokens } from "@/lib/load-cli-tokens";
import { refreshXTokenForWeb } from "@shared/x-auth";
import { acquireSyncLock, releaseSyncLock } from "@/lib/sync-lock";
import { checkRateLimit, rateLimitResponse, SYNC_RATE_LIMIT } from "@/lib/rate-limit";

const userId = "local";

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Validate rate limits, credentials, and tokens before syncing. */
async function preflight(): Promise<
  { ok: true; accessToken: string } |
  { ok: false; response: Response }
> {
  const rl = await checkRateLimit(`sync:${userId}`, SYNC_RATE_LIMIT);
  if (!rl.allowed) {
    return { ok: false, response: rateLimitResponse(rl) };
  }

  const lockAcquired = await acquireSyncLock(userId);
  if (!lockAcquired) {
    return { ok: false, response: NextResponse.json({ success: false, message: "Sync already in progress" }, { status: 409 }) };
  }

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await releaseSyncLock(userId);
    return { ok: false, response: NextResponse.json({ success: false, message: "X API credentials not configured. Add X_CLIENT_ID and X_CLIENT_SECRET to .env.local" }, { status: 500 }) };
  }

  const tokens = loadCliTokens();
  if (!tokens) {
    await releaseSyncLock(userId);
    return { ok: false, response: NextResponse.json({ success: false, message: "Not authenticated. Run `xbook login` from the CLI first to generate tokens." }, { status: 401 }) };
  }

  try {
    let accessToken = tokens.accessToken;
    if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
      const refreshed = await refreshXTokenForWeb(tokens.refreshToken, clientId, clientSecret);
      accessToken = refreshed.accessToken;
      saveCliTokens(refreshed);
    }
    return { ok: true, accessToken };
  } catch (error) {
    await releaseSyncLock(userId);
    console.error("Token refresh failed:", error);
    return { ok: false, response: NextResponse.json({ success: false, message: "Your X session has expired. Go to Settings and re-connect your X account." }, { status: 401 }) };
  }
}

export async function POST(request: NextRequest) {
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

  const check = await preflight();
  if (!check.ok) return check.response;

  const { accessToken } = check;

  if (wantsStream) {
    return streamSync(accessToken);
  }

  // JSON response for CLI and non-streaming callers
  try {
    const { syncBookmarks } = await import("@shared/sync");
    const repo = getRepository();
    const result = await syncBookmarks(repo, accessToken);

    return NextResponse.json({
      success: true,
      message: `Synced ${result.fetched} bookmarks (${result.newCount} new${result.removedCount ? `, ${result.removedCount} removed` : ""}) across ${result.pages} page(s)`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/sync error:", error);
    return NextResponse.json({ success: false, message: "Sync failed. Please try again." }, { status: 500 });
  } finally {
    await releaseSyncLock(userId);
  }
}

function streamSync(accessToken: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { syncBookmarks } = await import("@shared/sync");
        const repo = getRepository();

        const result = await syncBookmarks(
          repo,
          accessToken,
          (message) => {
            controller.enqueue(encoder.encode(sseEvent("progress", { message })));
          },
          (waitSeconds, attempt, maxRetries) => {
            controller.enqueue(encoder.encode(sseEvent("ratelimit", { waitSeconds, attempt, maxRetries })));
          }
        );

        controller.enqueue(encoder.encode(sseEvent("done", {
          success: true,
          message: `Synced ${result.fetched} bookmarks (${result.newCount} new${result.removedCount ? `, ${result.removedCount} removed` : ""}) across ${result.pages} page(s)`,
          fetched: result.fetched,
          newCount: result.newCount,
        })));
      } catch (error) {
        console.error("SSE sync error:", error);
        controller.enqueue(encoder.encode(sseEvent("error", { message: "Sync failed. Please try again." })));
      } finally {
        await releaseSyncLock(userId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
