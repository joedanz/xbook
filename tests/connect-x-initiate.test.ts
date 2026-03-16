// ABOUTME: Tests for the connect-x OAuth initiation route handler.
// ABOUTME: Covers PKCE challenge generation, cookie storage, rate limiting, and cloud mode auth requirement.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));


import { GET } from "../web/app/api/connect-x/route";
import { checkRateLimit } from "../web/lib/rate-limit";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

let savedClientId: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedClientId = process.env.X_CLIENT_ID;
  process.env.X_CLIENT_ID = "test-client-id";
  mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
});

afterEach(() => {
  if (savedClientId !== undefined) process.env.X_CLIENT_ID = savedClientId;
  else delete process.env.X_CLIENT_ID;
});

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/connect-x");
}

describe("connect-x initiation", () => {
  it("returns 429 when rate limited", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 500 when X_CLIENT_ID is not configured", async () => {
    delete process.env.X_CLIENT_ID;

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("X_CLIENT_ID not configured");
  });

  it("redirects to X with PKCE params and sets OAuth cookie", async () => {
    const res = await GET(makeRequest());

    // Should redirect (307)
    expect(res.status).toBe(307);

    // Check redirect URL has required OAuth params
    const location = res.headers.get("location")!;
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location);
    expect(redirectUrl.origin).toBe("https://x.com");
    expect(redirectUrl.pathname).toBe("/i/oauth2/authorize");
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("client_id")).toBe("test-client-id");
    expect(redirectUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(redirectUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(redirectUrl.searchParams.get("state")).toBeTruthy();
    expect(redirectUrl.searchParams.get("scope")).toContain("bookmark.read");

    // Should set xbook_oauth cookie
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("xbook_oauth");
    expect(setCookie).toContain("HttpOnly");
  });

  it("generates unique PKCE values per request", async () => {
    const res1 = await GET(makeRequest());
    const res2 = await GET(makeRequest());

    const url1 = new URL(res1.headers.get("location")!);
    const url2 = new URL(res2.headers.get("location")!);

    // Each request should produce a different code_challenge and state
    expect(url1.searchParams.get("code_challenge")).not.toBe(
      url2.searchParams.get("code_challenge")
    );
    expect(url1.searchParams.get("state")).not.toBe(
      url2.searchParams.get("state")
    );
  });

});
