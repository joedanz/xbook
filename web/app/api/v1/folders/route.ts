// ABOUTME: API v1 folders list endpoint.
// ABOUTME: Used by CLI `xbook folders` command.

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
    const repo = getRepository();
    const folders = await repo.getFolders();

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("GET /api/v1/folders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
