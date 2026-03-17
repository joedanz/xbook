// ABOUTME: API v1 stats endpoint — returns dashboard statistics.
// ABOUTME: Used by CLI `xbook stats` command.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getRepository } from "@/lib/db";
import { checkRateLimit, rateLimitResponse, getClientIp, API_RATE_LIMIT } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`api:${ip}`, API_RATE_LIMIT);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  const auth = await authenticateApiRequest(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const repo = getRepository(auth.userId);
    const stats = await repo.getStats();
    const syncHistory = await repo.getSyncHistory();

    return NextResponse.json({ stats, syncHistory });
  } catch (error) {
    console.error("GET /api/v1/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
