// ABOUTME: Tests for web/proxy.ts — auth proxy for cloud vs local mode.
// ABOUTME: Verifies public paths, API v1 Bearer token gating, session cookie checks, and login redirects.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers to build mock NextRequest objects
// ---------------------------------------------------------------------------

interface MockRequestOptions {
  url?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

function createMockRequest(opts: MockRequestOptions = {}) {
  const url = opts.url ?? "http://localhost:3000/";
  const parsedUrl = new URL(url);

  const cookieMap = new Map<string, { value: string }>();
  if (opts.cookies) {
    for (const [name, value] of Object.entries(opts.cookies)) {
      cookieMap.set(name, { value });
    }
  }

  const headersObj = new Headers(opts.headers ?? {});

  return {
    nextUrl: parsedUrl,
    url,
    cookies: {
      get: (name: string) => cookieMap.get(name),
    },
    headers: headersObj,
  } as unknown as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// Module-level state: fresh import per test to respect env changes
// ---------------------------------------------------------------------------

let proxy: typeof import("@/proxy").proxy;

beforeEach(async () => {
  vi.resetModules();
  // Default: local mode (no DATABASE_URL)
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  delete process.env.DATABASE_URL;
});

// Helper: import proxy fresh (call after setting env vars)
async function loadProxy() {
  const mod = await import("@/proxy");
  proxy = mod.proxy;
}

// ---------------------------------------------------------------------------
// 1. Local mode (no DATABASE_URL) — all requests pass through
// ---------------------------------------------------------------------------

describe("proxy — local mode (no DATABASE_URL)", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    await loadProxy();
  });

  it("passes through requests to the root path", () => {
    const req = createMockRequest({ url: "http://localhost:3000/" });
    const res = proxy(req);
    // NextResponse.next() has no redirect — status should not be 307/302
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to protected routes like /dashboard", () => {
    const req = createMockRequest({ url: "http://localhost:3000/dashboard" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /bookmarks without session cookies", () => {
    const req = createMockRequest({ url: "http://localhost:3000/bookmarks" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through API v1 requests without Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
    });
    const res = proxy(req);
    // In local mode, no Bearer check happens — just NextResponse.next()
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /settings without any cookies", () => {
    const req = createMockRequest({ url: "http://localhost:3000/settings" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Cloud mode — public paths pass through without session check
// ---------------------------------------------------------------------------

describe("proxy — cloud mode, public paths", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();
  });

  const publicPaths = [
    "/api/auth/signin",
    "/api/auth/callback",
    "/api/connect-x",
    "/api/connect-x/callback",
    "/api/cron/sync",
    "/_next/data/abc.json",
    "/favicon.ico",
    "/pricing",
    "/login",
  ];

  for (const path of publicPaths) {
    it(`passes through public path: ${path}`, () => {
      const req = createMockRequest({
        url: `http://localhost:3000${path}`,
      });
      const res = proxy(req);
      expect(res.headers.get("location")).toBeNull();
    });
  }

  it("passes through the root path /", () => {
    const req = createMockRequest({ url: "http://localhost:3000/" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through static file paths (containing a dot)", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/logo.png",
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through robots.txt", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/robots.txt",
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through sitemap.xml", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/sitemap.xml",
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Cloud mode — API v1 routes require Bearer token
// ---------------------------------------------------------------------------

describe("proxy — cloud mode, API v1 routes", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();
  });

  it("returns 401 JSON when /api/v1/* is requested without Authorization header", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
    });
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 JSON when Authorization header is not a Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
      headers: { authorization: "Basic abc123" },
    });
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it("passes through /api/v1/* with a valid Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
      headers: { authorization: "Bearer my-api-key-123" },
    });
    const res = proxy(req);
    // Should pass through — no redirect, no 401
    expect(res.status).not.toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /api/v1/sync with a valid Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/sync",
      headers: { authorization: "Bearer test-key" },
    });
    const res = proxy(req);
    expect(res.status).not.toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns 401 for /api/v1/status without Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/status",
    });
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it("returns error message mentioning API key in the 401 response", async () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
    });
    const res = proxy(req);
    const body = await res.json();
    expect(body.error).toContain("API key");
  });

  it("passes through nested /api/v1 paths with Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks/abc123",
      headers: { authorization: "Bearer valid-key" },
    });
    const res = proxy(req);
    expect(res.status).not.toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Cloud mode — protected routes without session redirect to /login
// ---------------------------------------------------------------------------

describe("proxy — cloud mode, protected routes without session", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();
  });

  it("redirects /dashboard to /login when no session cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/dashboard",
    });
    const res = proxy(req);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/login");
  });

  it("redirects /bookmarks to /login when no session cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/bookmarks",
    });
    const res = proxy(req);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/login");
  });

  it("redirects /settings to /login when no session cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/settings",
    });
    const res = proxy(req);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/login");
  });

  it("redirects /newsletters to /login when no session cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/newsletters",
    });
    const res = proxy(req);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/login");
  });

  it("redirects a deeply nested protected route to /login", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/some/deep/protected/route",
    });
    const res = proxy(req);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/login");
  });
});

// ---------------------------------------------------------------------------
// 5. Cloud mode — protected routes with valid session pass through
// ---------------------------------------------------------------------------

describe("proxy — cloud mode, protected routes with session", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();
  });

  it("passes through /dashboard with better-auth.session_token cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/dashboard",
      cookies: { "better-auth.session_token": "valid-session-abc" },
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /bookmarks with better-auth.session_token cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/bookmarks",
      cookies: { "better-auth.session_token": "valid-session-xyz" },
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /settings with __Secure-better-auth.session_token cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/settings",
      cookies: {
        "__Secure-better-auth.session_token": "secure-session-123",
      },
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /newsletters with __Secure-better-auth.session_token cookie", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/newsletters",
      cookies: {
        "__Secure-better-auth.session_token": "secure-session-456",
      },
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through any protected route when either cookie variant is present", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/some/protected/page",
      cookies: { "better-auth.session_token": "any-token-value" },
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Redirect preservation — original path in query param
// ---------------------------------------------------------------------------

describe("proxy — redirect preservation", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();
  });

  it("preserves /dashboard as redirect query param when redirecting", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/dashboard",
    });
    const res = proxy(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/dashboard");
  });

  it("preserves /bookmarks as redirect query param", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/bookmarks",
    });
    const res = proxy(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/bookmarks");
  });

  it("preserves /settings as redirect query param", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/settings",
    });
    const res = proxy(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/settings");
  });

  it("preserves deeply nested paths in redirect query param", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/some/deep/route",
    });
    const res = proxy(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/some/deep/route");
  });

  it("redirect URL uses the same origin as the request", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/dashboard",
    });
    const res = proxy(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe("http://localhost:3000");
  });
});

// ---------------------------------------------------------------------------
// 7. Edge cases
// ---------------------------------------------------------------------------

describe("proxy — edge cases", () => {
  it("does not treat /api/v1 paths as public even though /api/auth is public", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();

    // /api/v1 without Bearer should get 401, not pass through as public
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/me",
    });
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it("/api/auth is public but /api/v1 is gated by Bearer token", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();

    // /api/auth should pass through
    const authReq = createMockRequest({
      url: "http://localhost:3000/api/auth/session",
    });
    const authRes = proxy(authReq);
    expect(authRes.headers.get("location")).toBeNull();
    expect(authRes.status).not.toBe(401);

    // /api/v1 without Bearer should be blocked
    const v1Req = createMockRequest({
      url: "http://localhost:3000/api/v1/stats",
    });
    const v1Res = proxy(v1Req);
    expect(v1Res.status).toBe(401);
  });

  it("static files with dots in cloud mode pass through without session", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();

    const req = createMockRequest({
      url: "http://localhost:3000/images/hero.webp",
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("/_next paths pass through in cloud mode (both via PUBLIC_PATHS and root check)", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();

    const req = createMockRequest({
      url: "http://localhost:3000/_next/data/build-id/page.json",
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("rejects 'Bearer ' with no token value (Headers API trims trailing space)", async () => {
    // The Headers API trims trailing whitespace, so "Bearer " becomes "Bearer",
    // which does NOT start with "Bearer " — resulting in a 401.
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();

    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
      headers: { authorization: "Bearer " },
    });
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it("redirects /dashboard even with unrelated cookies (no session token)", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/xbook";
    await loadProxy();

    const req = createMockRequest({
      url: "http://localhost:3000/dashboard",
      cookies: { "some-other-cookie": "value" },
    });
    const res = proxy(req);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/login");
  });
});

// ---------------------------------------------------------------------------
// 8. Config matcher export
// ---------------------------------------------------------------------------

describe("proxy — config export", () => {
  it("exports a matcher config that excludes _next/static, _next/image, and favicon.ico", async () => {
    await loadProxy();
    const mod = await import("@/proxy");
    expect(mod.config).toBeDefined();
    expect(mod.config.matcher).toBeDefined();
    expect(mod.config.matcher).toHaveLength(1);
    // The regex should exclude _next/static, _next/image, and favicon.ico
    const pattern = mod.config.matcher[0];
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });
});
