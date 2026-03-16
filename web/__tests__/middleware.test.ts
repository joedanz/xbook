// ABOUTME: Tests for web/middleware.ts — auth middleware for local mode.
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

let middleware: typeof import("@/middleware").middleware;

beforeEach(async () => {
  vi.resetModules();
});

// Helper: import middleware fresh (call after setting env vars)
async function loadMiddleware() {
  const mod = await import("@/middleware");
  middleware = mod.middleware;
}

// ---------------------------------------------------------------------------
// 1. Local mode — all requests pass through
// ---------------------------------------------------------------------------

describe("middleware — local mode", () => {
  beforeEach(async () => {
    await loadMiddleware();
  });

  it("passes through requests to the root path", () => {
    const req = createMockRequest({ url: "http://localhost:3000/" });
    const res = middleware(req);
    // NextResponse.next() has no redirect — status should not be 307/302
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to protected routes like /dashboard", () => {
    const req = createMockRequest({ url: "http://localhost:3000/dashboard" });
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /bookmarks without session cookies", () => {
    const req = createMockRequest({ url: "http://localhost:3000/bookmarks" });
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through API v1 requests without Bearer token", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
    });
    const res = middleware(req);
    // In local mode, no Bearer check happens — just NextResponse.next()
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /settings without any cookies", () => {
    const req = createMockRequest({ url: "http://localhost:3000/settings" });
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Config matcher export
// ---------------------------------------------------------------------------

describe("middleware — config export", () => {
  it("exports a matcher config that excludes _next/static, _next/image, and favicon.ico", async () => {
    await loadMiddleware();
    const mod = await import("@/middleware");
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
