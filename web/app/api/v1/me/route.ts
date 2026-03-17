// ABOUTME: Returns the authenticated user's profile.
// ABOUTME: Used by CLI `xbook login` to validate API keys.

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
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

  return NextResponse.json({ userId: "local", name: "Local User", mode: "local" });
}
