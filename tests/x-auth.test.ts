// ABOUTME: Tests for shared/x-auth.ts — X OAuth2 token refresh.
// ABOUTME: Covers network errors, 429 rate limits, non-OK responses, and camelCase mapping.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refreshXToken, refreshXTokenForWeb } from "../shared/x-auth";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Suppress console output from retry logic
vi.spyOn(console, "log").mockImplementation(() => {});

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── refreshXToken ───────────────────────────────────────────────────

describe("refreshXToken", () => {
  it("returns tokens on successful refresh", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 7200,
        }),
    });

    const result = await refreshXToken("old-refresh", "client-id", "client-secret");

    expect(result.access_token).toBe("new-access");
    expect(result.refresh_token).toBe("new-refresh");
    expect(result.expires_in).toBe(7200);
  });

  it("sends correct URL, headers, and body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
    });

    await refreshXToken("my-refresh", "my-client-id", "my-secret");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.x.com/2/oauth2/token");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(options.headers["Authorization"]).toBe(
      `Basic ${btoa("my-client-id:my-secret")}`
    );

    const body = new URLSearchParams(options.body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("my-refresh");
    expect(body.get("client_id")).toBe("my-client-id");
  });

  // ── Network errors ──────────────────────────────────────────────

  it("retries on network error and succeeds on second attempt", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
      });

    const promise = refreshXToken("rt", "cid", "cs");
    // Advance past the 1s backoff (attempt 0: 2^0 * 1000 = 1000ms)
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result.access_token).toBe("at");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries on persistent network error", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const promise = refreshXToken("rt", "cid", "cs");
    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow(
      "Token refresh failed after 3 retries: network error: ECONNREFUSED"
    );
    // Advance past all backoffs: 1s + 2s + 4s = 7s
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;

    // 1 initial attempt + 3 retries = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  // ── 429 Rate limits ─────────────────────────────────────────────

  it("retries on 429 and succeeds on next attempt", async () => {
    const now = Date.now();
    const resetTime = Math.floor(now / 1000) + 2;

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) =>
            key === "x-rate-limit-reset" ? String(resetTime) : null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ access_token: "new-at", refresh_token: "new-rt", expires_in: 3600 }),
      });

    const promise = refreshXToken("rt", "cid", "cs");
    await vi.advanceTimersByTimeAsync(3000);

    const result = await promise;
    expect(result.access_token).toBe("new-at");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max 429 retries", async () => {
    const now = Date.now();
    const resetTime = Math.floor(now / 1000) + 2;

    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (key: string) =>
          key === "x-rate-limit-reset" ? String(resetTime) : null,
      },
    });

    const promise = refreshXToken("rt", "cid", "cs");
    // Attach rejection handler before advancing timers
    const assertion = expect(promise).rejects.toThrow(
      "Token refresh rate limited after maximum retries"
    );
    // Advance past all waits (4 iterations with ~2s each)
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("uses exponential backoff when x-rate-limit-reset header is missing", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
      });

    const promise = refreshXToken("rt", "cid", "cs");
    // Advance past backoff (2^0 * 1000 = 1000ms)
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result.access_token).toBe("at");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── Non-OK responses ────────────────────────────────────────────

  it("throws on 400 bad request with error body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: () => Promise.resolve('{"error":"invalid_grant"}'),
    });

    await expect(refreshXToken("rt", "cid", "cs")).rejects.toThrow(
      'Token refresh failed (400): {"error":"invalid_grant"}'
    );
  });

  it("throws on 401 unauthorized", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(refreshXToken("rt", "cid", "cs")).rejects.toThrow(
      "Token refresh failed (401): Unauthorized"
    );
  });

  it("throws on 500 server error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(refreshXToken("rt", "cid", "cs")).rejects.toThrow(
      "Token refresh failed (500): Internal Server Error"
    );
  });

  it("does not retry non-429 errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: () => Promise.resolve("Bad Request"),
    });

    await expect(refreshXToken("rt", "cid", "cs")).rejects.toThrow(
      "Token refresh failed (400)"
    );

    // Only 1 call — no retries for non-429 errors
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── refreshXTokenForWeb ─────────────────────────────────────────────

describe("refreshXTokenForWeb", () => {
  it("maps snake_case response to camelCase with computed expiresAt", async () => {
    // With fake timers, Date.now() returns the faked time
    const now = Date.now();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "web-access",
          refresh_token: "web-refresh",
          expires_in: 7200,
        }),
    });

    const result = await refreshXTokenForWeb("rt", "cid", "cs");

    expect(result.accessToken).toBe("web-access");
    expect(result.refreshToken).toBe("web-refresh");
    expect(result.expiresAt).toBe(now + 7200 * 1000);
  });

  it("propagates errors from refreshXToken", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: () => Promise.resolve("bad"),
    });

    await expect(refreshXTokenForWeb("rt", "cid", "cs")).rejects.toThrow(
      "Token refresh failed (400)"
    );
  });
});
