// ABOUTME: API v1 bookmarks list/search endpoint.
// ABOUTME: Used by CLI `xbook bookmarks` command with filter options.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { checkRateLimit, rateLimitResponse, getClientIp, API_RATE_LIMIT } from "@/lib/rate-limit";
import { clampPageSize } from "@/lib/validation";
import type { BookmarkQuery } from "@shared/types";

/** Lighter pre-auth IP rate limit for DoS protection */
const IP_RATE_LIMIT = { limit: 200, windowSeconds: 60 };

export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const query: BookmarkQuery = {};

    if (url.searchParams.has("folder")) query.folderId = url.searchParams.get("folder")!;
    if (url.searchParams.has("author")) query.authorUsername = url.searchParams.get("author")!;
    if (url.searchParams.has("search")) query.search = url.searchParams.get("search")!.slice(0, 500);
    if (url.searchParams.has("starred")) query.starred = url.searchParams.get("starred") === "true";
    if (url.searchParams.has("need_to_read")) query.needToRead = url.searchParams.get("need_to_read") === "true";
    if (url.searchParams.has("tags")) query.tags = url.searchParams.get("tags")!.split(",").slice(0, 20);
    if (url.searchParams.has("page")) {
      const p = parseInt(url.searchParams.get("page")!, 10);
      query.page = Number.isFinite(p) && p > 0 ? p : 1;
    }
    if (url.searchParams.has("page_size")) query.pageSize = clampPageSize(url.searchParams.get("page_size")!);

    const VALID_ORDER_BY = new Set(["created_at", "synced_at", "author_name"]);
    const VALID_ORDER_DIR = new Set(["asc", "desc"]);
    if (url.searchParams.has("order_by")) {
      const ob = url.searchParams.get("order_by")!;
      if (VALID_ORDER_BY.has(ob)) query.orderBy = ob as BookmarkQuery["orderBy"];
    }
    if (url.searchParams.has("order_dir")) {
      const od = url.searchParams.get("order_dir")!;
      if (VALID_ORDER_DIR.has(od)) query.orderDir = od as BookmarkQuery["orderDir"];
    }

    const repo = getRepository(auth.userId);
    const result = await repo.queryBookmarks(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/v1/bookmarks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
