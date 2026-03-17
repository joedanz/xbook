// ABOUTME: Health check endpoint for the API.
// ABOUTME: Returns server status and database connectivity.

import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import packageJson from "../../../../package.json" with { type: "json" };

const STATUS_RATE_LIMIT = { limit: 30, windowSeconds: 60 };

async function checkDatabase(): Promise<{ status: string; message?: string }> {
  try {
    const Database = (await import("better-sqlite3")).default;
    const dbPath = process.env.DB_PATH || "../xbook.db";
    const db = new Database(dbPath, { readonly: true });
    db.prepare("SELECT 1").get();
    db.close();
    return { status: "ok" };
  } catch (err) {
    console.error("Database health check failed:", err);
    return { status: "error", message: "Database connection failed" };
  }
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`status:${ip}`, STATUS_RATE_LIMIT);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const database = await checkDatabase();

    const isHealthy = database.status === "ok";

    return NextResponse.json(
      {
        status: isHealthy ? "ok" : "degraded",
        mode: "local",
        version: process.env.npm_package_version || packageJson.version || "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error) {
    console.error("GET /api/v1/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
