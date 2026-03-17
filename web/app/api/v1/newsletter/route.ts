// ABOUTME: API v1 newsletter endpoint — send or preview newsletter.
// ABOUTME: Used by CLI `xbook newsletter` command.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { checkRateLimit, rateLimitResponse, getClientIp, API_RATE_LIMIT, NEWSLETTER_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`api:${ip}`, API_RATE_LIMIT);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Stricter per-user rate limit for email-sending endpoint
  const nlRl = await checkRateLimit(`newsletter:${auth.userId}`, NEWSLETTER_RATE_LIMIT);
  if (!nlRl.allowed) {
    return rateLimitResponse(nlRl, "Too many newsletter requests. Please wait before sending another.");
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const dryRun = body.dry_run === true;

    const repo = getRepository(auth.userId);
    const bookmarks = await repo.getNewBookmarks(200);

    if (bookmarks.length === 0) {
      return NextResponse.json({ success: true, message: "No new bookmarks to send", count: 0 });
    }

    const { renderNewsletter } = await import("@shared/newsletter");
    const { subject, html } = renderNewsletter(bookmarks);

    if (dryRun) {
      return NextResponse.json({ success: true, subject, count: bookmarks.length, html });
    }

    // Get email config
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    // Determine recipient from env var
    const recipientEmail = process.env.NEWSLETTER_TO || null;

    if (!recipientEmail) {
      return NextResponse.json({ error: "No newsletter email configured. Set NEWSLETTER_TO in your .env.local" }, { status: 400 });
    }

    // Send email first — if it fails, bookmarks remain unmarked for the next attempt
    const { sendEmail } = await import("@shared/email");
    const newsletterFrom = process.env.NEWSLETTER_FROM || "xbook <newsletter@localhost>";
    try {
      await sendEmail(resendApiKey, newsletterFrom, recipientEmail, subject, html);
    } catch {
      return NextResponse.json(
        { error: "Newsletter email failed to send. Bookmarks will be included in the next newsletter." },
        { status: 502 }
      );
    }

    // Mark only after successful send
    const tweetIds = bookmarks.map((b) => b.tweet_id);
    await repo.markNewslettered(tweetIds);
    await repo.logNewsletter(bookmarks.length);

    return NextResponse.json({ success: true, message: `Newsletter sent with ${bookmarks.length} bookmarks`, count: bookmarks.length });
  } catch (error) {
    console.error("POST /api/v1/newsletter error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
