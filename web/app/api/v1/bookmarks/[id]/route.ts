// ABOUTME: API v1 single bookmark endpoint — get, update, or delete.
// ABOUTME: Used by CLI for bookmark management operations.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { checkRateLimit, rateLimitResponse, getClientIp, API_RATE_LIMIT } from "@/lib/rate-limit";

const MAX_ID_LEN = 30;
const MAX_TAG_LEN = 100;
const MAX_FOLDER_ID_LEN = 100;
const MAX_FOLDER_NAME_LEN = 200;

/** Lighter pre-auth IP rate limit for DoS protection */
const IP_RATE_LIMIT = { limit: 200, windowSeconds: 60 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Pre-auth IP-based rate limit for DoS protection
  const ip = getClientIp(request);
  const ipRl = await checkRateLimit(`ip:${ip}`, IP_RATE_LIMIT);
  if (!ipRl.allowed) {
    return rateLimitResponse(ipRl);
  }

  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Per-user rate limit after authentication (stricter than IP limit)
  const rl = await checkRateLimit(`api:${auth.userId}`, API_RATE_LIMIT);
  if (rl && !rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const { id } = await params;
    if (id.length > MAX_ID_LEN) {
      return NextResponse.json({ error: "Invalid bookmark ID" }, { status: 400 });
    }
    const repo = getRepository(auth.userId);
    const bookmark = await repo.getBookmarkById(id);

    if (!bookmark) {
      return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }

    return NextResponse.json(bookmark);
  } catch (error) {
    console.error("GET /api/v1/bookmarks/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Pre-auth IP-based rate limit for DoS protection
  const ip = getClientIp(request);
  const ipRl = await checkRateLimit(`ip:${ip}`, IP_RATE_LIMIT);
  if (!ipRl.allowed) {
    return rateLimitResponse(ipRl);
  }

  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Per-user rate limit after authentication (stricter than IP limit)
  const rl = await checkRateLimit(`api:${auth.userId}`, API_RATE_LIMIT);
  if (rl && !rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const { id } = await params;
    if (id.length > MAX_ID_LEN) {
      return NextResponse.json({ error: "Invalid bookmark ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;

    // Validate notes
    if (b.notes !== undefined && b.notes !== null && typeof b.notes !== "string") {
      return NextResponse.json({ error: "notes must be a string or null" }, { status: 400 });
    }
    if (typeof b.notes === "string" && b.notes.length > 10000) {
      return NextResponse.json({ error: "notes must be at most 10000 characters" }, { status: 400 });
    }

    // Validate add_tags
    if (b.add_tags !== undefined) {
      if (!Array.isArray(b.add_tags) || !b.add_tags.every((t: unknown) => typeof t === "string")) {
        return NextResponse.json({ error: "add_tags must be an array of strings" }, { status: 400 });
      }
      if (Array.isArray(b.add_tags) && b.add_tags.length > 50) {
        return NextResponse.json({ error: "add_tags limited to 50 per request" }, { status: 400 });
      }
      if (Array.isArray(b.add_tags) && b.add_tags.some((t: unknown) => typeof t === "string" && t.length > MAX_TAG_LEN)) {
        return NextResponse.json({ error: `Each tag must be at most ${MAX_TAG_LEN} characters` }, { status: 400 });
      }
    }

    // Validate remove_tags
    if (b.remove_tags !== undefined) {
      if (!Array.isArray(b.remove_tags) || !b.remove_tags.every((t: unknown) => typeof t === "string")) {
        return NextResponse.json({ error: "remove_tags must be an array of strings" }, { status: 400 });
      }
      if (Array.isArray(b.remove_tags) && b.remove_tags.length > 50) {
        return NextResponse.json({ error: "remove_tags limited to 50 per request" }, { status: 400 });
      }
      if (Array.isArray(b.remove_tags) && b.remove_tags.some((t: unknown) => typeof t === "string" && t.length > MAX_TAG_LEN)) {
        return NextResponse.json({ error: `Each tag must be at most ${MAX_TAG_LEN} characters` }, { status: 400 });
      }
    }

    // Validate folder_id and folder_name
    if (b.folder_id !== undefined && b.folder_id !== null && typeof b.folder_id !== "string") {
      return NextResponse.json({ error: "folder_id must be a string or null" }, { status: 400 });
    }
    if (b.folder_name !== undefined && b.folder_name !== null && typeof b.folder_name !== "string") {
      return NextResponse.json({ error: "folder_name must be a string or null" }, { status: 400 });
    }
    if (typeof b.folder_id === "string" && b.folder_id.length > MAX_FOLDER_ID_LEN) {
      return NextResponse.json({ error: `folder_id must be at most ${MAX_FOLDER_ID_LEN} characters` }, { status: 400 });
    }
    if (typeof b.folder_name === "string" && b.folder_name.length > MAX_FOLDER_NAME_LEN) {
      return NextResponse.json({ error: `folder_name must be at most ${MAX_FOLDER_NAME_LEN} characters` }, { status: 400 });
    }

    const repo = getRepository(auth.userId);

    const existing = await repo.getBookmarkById(id);
    if (!existing) {
      return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }

    // Apply each mutation independently — track failures so partial success is reported
    const errors: string[] = [];

    if (typeof b.starred === "boolean") {
      try { await repo.setStarred(id, b.starred); }
      catch { errors.push("starred"); }
    }
    if (typeof b.need_to_read === "boolean") {
      try { await repo.setNeedToRead(id, b.need_to_read); }
      catch { errors.push("need_to_read"); }
    }
    if (b.notes !== undefined) {
      try { await repo.updateBookmarkNotes(id, (b.notes as string) || null); }
      catch { errors.push("notes"); }
    }
    if (b.add_tags) {
      for (const tag of (b.add_tags as string[]).map(t => t.trim()).filter(Boolean)) {
        try { await repo.addBookmarkTag(id, tag); }
        catch { errors.push(`add_tag:${tag}`); }
      }
    }
    if (b.remove_tags) {
      for (const tag of (b.remove_tags as string[]).map(t => t.trim()).filter(Boolean)) {
        try { await repo.removeBookmarkTag(id, tag); }
        catch { errors.push(`remove_tag:${tag}`); }
      }
    }
    if (b.folder_id !== undefined) {
      try {
        await repo.moveBookmarkToFolder(
          id,
          (b.folder_id as string) || null,
          (b.folder_name as string) || null
        );
      } catch { errors.push("folder"); }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: "Some updates failed", failed_fields: errors },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/v1/bookmarks/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Pre-auth IP-based rate limit for DoS protection
  const ip = getClientIp(request);
  const ipRl = await checkRateLimit(`ip:${ip}`, IP_RATE_LIMIT);
  if (!ipRl.allowed) {
    return rateLimitResponse(ipRl);
  }

  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Per-user rate limit after authentication (stricter than IP limit)
  const rl = await checkRateLimit(`api:${auth.userId}`, API_RATE_LIMIT);
  if (rl && !rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const { id } = await params;
    if (id.length > MAX_ID_LEN) {
      return NextResponse.json({ error: "Invalid bookmark ID" }, { status: 400 });
    }
    const repo = getRepository(auth.userId);

    const existing = await repo.getBookmarkById(id);
    if (!existing) {
      return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }

    await repo.deleteBookmark(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/v1/bookmarks/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
