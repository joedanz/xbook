// ABOUTME: Tests for the connect-x OAuth callback route handler.
// ABOUTME: Covers error cases: missing params, expired cookie, state mismatch, token exchange failure.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch before importing the route handler
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock fs to prevent actual file writes
vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  chmodSync: vi.fn(),
}));

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 }),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));


import { GET } from "../web/app/api/connect-x/callback/route";

// Suppress console.error from the route handler
vi.spyOn(console, "error").mockImplementation(() => {});

let savedClientId: string | undefined;
let savedClientSecret: string | undefined;

beforeEach(() => {
  mockFetch.mockReset();
  savedClientId = process.env.X_CLIENT_ID;
  savedClientSecret = process.env.X_CLIENT_SECRET;
  // Set required env vars
  process.env.X_CLIENT_ID = "test-client-id";
  process.env.X_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  if (savedClientId !== undefined) process.env.X_CLIENT_ID = savedClientId;
  else delete process.env.X_CLIENT_ID;
  if (savedClientSecret !== undefined) process.env.X_CLIENT_SECRET = savedClientSecret;
  else delete process.env.X_CLIENT_SECRET;
});

function callbackUrl(params: Record<string, string> = {}): string {
  const url = new URL("http://localhost:3000/api/connect-x/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function makeRequest(
  url: string,
  cookie?: string
): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(url, { headers });
}

function oauthCookie(state: string, codeVerifier = "test-verifier"): string {
  return `xbook_oauth=${encodeURIComponent(JSON.stringify({ codeVerifier, state }))}`;
}

// ── Error cases ─────────────────────────────────────────────────────

describe("connect-x callback", () => {
  it("returns 400 when error param is present", async () => {
    const res = await GET(
      makeRequest(callbackUrl({ error: "access_denied" }))
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("access_denied");
  });

  it("returns 400 when code is missing", async () => {
    const res = await GET(
      makeRequest(callbackUrl({ state: "abc" }))
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Missing authorization code");
  });

  it("returns 400 when OAuth cookie is missing", async () => {
    const res = await GET(
      makeRequest(callbackUrl({ code: "auth-code", state: "abc" }))
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("OAuth session expired");
  });

  it("returns 400 when OAuth cookie has invalid JSON", async () => {
    const res = await GET(
      makeRequest(
        callbackUrl({ code: "auth-code", state: "abc" }),
        "xbook_oauth=not-valid-json"
      )
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Invalid OAuth session");
  });

  it("returns 400 when state does not match", async () => {
    const res = await GET(
      makeRequest(
        callbackUrl({ code: "auth-code", state: "returned-state" }),
        oauthCookie("different-state")
      )
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("State mismatch");
  });

  it("returns 500 when X_CLIENT_ID is missing", async () => {
    delete process.env.X_CLIENT_ID;
    const res = await GET(
      makeRequest(
        callbackUrl({ code: "auth-code", state: "test-state" }),
        oauthCookie("test-state")
      )
    );
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("not configured");
  });

  it("returns 500 when token exchange fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("invalid_grant"),
    });

    const res = await GET(
      makeRequest(
        callbackUrl({ code: "bad-code", state: "test-state" }),
        oauthCookie("test-state")
      )
    );
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("Unable to connect your X account");
  });

  // ── Success case (local mode) ───────────────────────────────────

  it("exchanges code for tokens and redirects in local mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 7200,
        }),
    });

    const res = await GET(
      makeRequest(
        callbackUrl({ code: "valid-code", state: "test-state" }),
        oauthCookie("test-state")
      )
    );

    // Should redirect to dashboard
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/");

    // Verify the token exchange was called with correct params
    const [fetchUrl, fetchOpts] = mockFetch.mock.calls[0];
    expect(fetchUrl).toBe("https://api.x.com/2/oauth2/token");
    expect(fetchOpts.method).toBe("POST");

    const body = new URLSearchParams(fetchOpts.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("valid-code");
    expect(body.get("code_verifier")).toBe("test-verifier");
    expect(body.get("client_id")).toBe("test-client-id");

    // Verify fs.writeFileSync was called
    const { writeFileSync } = await import("fs");
    expect(writeFileSync).toHaveBeenCalled();
  });

});
