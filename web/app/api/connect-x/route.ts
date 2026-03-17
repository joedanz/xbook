// ABOUTME: Initiates the OAuth2 PKCE flow for X (Twitter) bookmark access.
// ABOUTME: Generates PKCE challenge, stores verifier in a cookie, redirects to X.

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { escapeHtml } from "@shared/html";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const SCOPES = ["tweet.read", "users.read", "bookmark.read", "bookmark.write", "offline.access"];

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export async function GET(request: Request) {
  const OAUTH_RATE_LIMIT = { limit: 5, windowSeconds: 60 };
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`oauth:${ip}`, OAUTH_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      errorPage("X_CLIENT_ID not configured. Add X_CLIENT_ID and X_CLIENT_SECRET to web/.env.local"),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  // Local mode: no authentication required to start OAuth

  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64url(randomBytes(16));

  // Use explicit redirect URI (X rejects "localhost", requires 127.0.0.1)
  const url = new URL(request.url);
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI || `${url.origin}/api/connect-x/callback`;

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // Store verifier and state in a short-lived HTTP-only cookie
  const oauthData = JSON.stringify({ codeVerifier, state });

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("xbook_oauth", oauthData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html><head><title>xbook — Auth Error</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}
.card{background:white;border-radius:12px;padding:2rem;max-width:480px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#666;margin:0 0 1rem}a{color:#000;font-weight:500}
code{background:#f0f0f0;padding:.15em .4em;border-radius:4px;font-size:.9em}</style>
</head><body><div class="card"><h1>Configuration Required</h1><p>${escapeHtml(message)}</p><a href="/">Back to Dashboard</a></div></body></html>`;
}
