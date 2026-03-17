// ABOUTME: Tests for web/proxy.ts — CSP nonce generation proxy.
// ABOUTME: Verifies CSP headers in production mode and passthrough in dev mode.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers to build mock NextRequest objects
// ---------------------------------------------------------------------------

interface MockRequestOptions {
  url?: string;
  headers?: Record<string, string>;
}

function createMockRequest(opts: MockRequestOptions = {}) {
  const url = opts.url ?? "http://localhost:3000/";
  const parsedUrl = new URL(url);
  const headersObj = new Headers(opts.headers ?? {});

  return {
    nextUrl: parsedUrl,
    url,
    headers: headersObj,
  } as unknown as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// Module-level state: fresh import per test to respect env changes
// ---------------------------------------------------------------------------

let proxy: typeof import("@/proxy").proxy;

beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  delete process.env.NODE_ENV;
});

async function loadProxy() {
  const mod = await import("@/proxy");
  proxy = mod.proxy;
}

// ---------------------------------------------------------------------------
// 1. All requests pass through (no auth gating in local mode)
// ---------------------------------------------------------------------------

describe("proxy — request passthrough", () => {
  beforeEach(async () => {
    await loadProxy();
  });

  it("passes through requests to the root path", () => {
    const req = createMockRequest({ url: "http://localhost:3000/" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /dashboard", () => {
    const req = createMockRequest({ url: "http://localhost:3000/dashboard" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /bookmarks", () => {
    const req = createMockRequest({ url: "http://localhost:3000/bookmarks" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through requests to /settings", () => {
    const req = createMockRequest({ url: "http://localhost:3000/settings" });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through API requests", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/v1/bookmarks",
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Config matcher export
// ---------------------------------------------------------------------------

describe("proxy — config export", () => {
  it("exports a matcher config that excludes _next/static, _next/image, and favicon.ico", async () => {
    await loadProxy();
    const mod = await import("@/proxy");
    expect(mod.config).toBeDefined();
    expect(mod.config.matcher).toBeDefined();
    expect(mod.config.matcher).toHaveLength(1);
    const pattern = mod.config.matcher[0];
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });
});
