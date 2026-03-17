// ABOUTME: Handles the OAuth2 PKCE callback from X (Twitter).
// ABOUTME: Exchanges authorization code for tokens and saves them to .tokens.json.

import { NextResponse } from "next/server";
import { resolve } from "path";
import { writeFileSync, chmodSync } from "fs";
import { escapeHtml } from "@shared/html";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";

function getTokenFilePath(): string {
  if (process.env.TOKEN_FILE_PATH) return process.env.TOKEN_FILE_PATH;
  return resolve(process.cwd(), ".tokens.json");
}

export async function GET(request: Request) {
  const CALLBACK_RATE_LIMIT = { limit: 10, windowSeconds: 60 };
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`oauth-cb:${ip}`, CALLBACK_RATE_LIMIT);
  if (!rl.allowed) {
    return new NextResponse(errorPage("Too many requests. Please try again later."), {
      status: 429, headers: { "Content-Type": "text/html" },
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const ERROR_MESSAGES: Record<string, string> = {
      access_denied: "You declined the authorization request.",
      invalid_request: "The authorization request was invalid. Please try again.",
      server_error: "X (Twitter) encountered an error. Please try again later.",
    };
    const userMessage = ERROR_MESSAGES[error] || "An unexpected error occurred during authorization.";
    // Include error code in HTML (data attribute) for debugging; show user-friendly message
    return new NextResponse(errorPage(`${userMessage} (${escapeHtml(error)})`), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code) {
    return new NextResponse(errorPage("Missing authorization code"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Retrieve PKCE verifier and state from cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const oauthCookie = parseCookie(cookieHeader, "xbook_oauth");
  if (!oauthCookie) {
    return new NextResponse(
      errorPage("OAuth session expired. Please try again."),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  let oauthData: { codeVerifier: string; state: string };
  try {
    oauthData = JSON.parse(oauthCookie);
  } catch {
    return new NextResponse(
      errorPage("Invalid OAuth session. Please try again."),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (returnedState !== oauthData.state) {
    return new NextResponse(
      errorPage("State mismatch — possible CSRF attack."),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse(
      errorPage("X API credentials not configured."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  // Exchange code for tokens (must match the URI sent during authorization)
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI || `${url.origin}/api/connect-x/callback`;
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: oauthData.codeVerifier,
    client_id: clientId,
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error(`X token exchange failed (${tokenRes.status}):`, text.slice(0, 200));
    return new NextResponse(
      errorPage("Unable to connect your X account. Please try again."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  // Local mode: save tokens to disk
  const tokenPath = getTokenFilePath();
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), "utf-8");
  chmodSync(tokenPath, 0o600);

  // Clear the OAuth cookie and redirect to dashboard
  const response = NextResponse.redirect(new URL("/dashboard", url.origin));
  response.cookies.delete("xbook_oauth");
  return response;
}

function parseCookie(header: string, name: string): string | null {
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html><head><title>xbook — Auth Error</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}
.card{background:white;border-radius:12px;padding:2rem;max-width:400px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#666;margin:0 0 1rem}a{color:#000;font-weight:500}</style>
</head><body><div class="card"><h1>Authentication Failed</h1><p>${escapeHtml(message)}</p><a href="/">Back to Dashboard</a></div></body></html>`;
}
