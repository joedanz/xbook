// ABOUTME: In-memory rate limiter for the web app.
// ABOUTME: Tracks request counts per key with configurable windows.

import { NextResponse } from "next/server";

/** Build a standardized 429 Too Many Requests response */
export function rateLimitResponse(rl: { resetAt: number }, message = "Too many requests"): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
  );
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (in-memory only)
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * In-memory rate limit check (used in local mode).
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimitMemory(key, config);
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  // Prefer x-real-ip (set by Vercel, not spoofable) over x-forwarded-for
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // Fallback: use a hash of User-Agent + Accept-Language as a rough client fingerprint
  // to avoid all unknown-IP clients sharing one rate-limit bucket
  const ua = request.headers.get("user-agent") || "";
  const lang = request.headers.get("accept-language") || "";
  const raw = `${ua}:${lang}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `anon-${hash.toString(36)}`;
}

// Pre-configured rate limiters
export const API_RATE_LIMIT: RateLimitConfig = { limit: 100, windowSeconds: 60 };
export const SYNC_RATE_LIMIT: RateLimitConfig = { limit: 5, windowSeconds: 60 };
export const NEWSLETTER_RATE_LIMIT: RateLimitConfig = { limit: 3, windowSeconds: 300 };
export const IMPORT_RATE_LIMIT: RateLimitConfig = { limit: 10, windowSeconds: 3600 };
export const ACTION_RATE_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60 };
