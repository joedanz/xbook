// ABOUTME: Returns whether the user has authenticated (tokens exist).
// ABOUTME: Used by client components to show connect vs sync UI.

import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { resolve } from "path";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const STATUS_RATE_LIMIT = { limit: 30, windowSeconds: 60 };
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`cx-status:${ip}`, STATUS_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Check for .tokens.json on disk
  const candidates = [
    process.env.TOKEN_FILE_PATH,
    resolve(process.cwd(), ".tokens.json"),
    resolve(process.cwd(), "../.tokens.json"),
  ].filter(Boolean) as string[];

  const authenticated = candidates.some((p) => existsSync(p));

  return NextResponse.json({ authenticated });
}
