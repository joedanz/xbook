// ABOUTME: Tests for web/lib/api-auth.ts — API authentication.
// ABOUTME: In local mode, always returns userId "local" regardless of headers.

import { describe, it, expect } from "vitest";
import { authenticateApiRequest } from "../web/lib/api-auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/v1/test", { headers });
}

describe("authenticateApiRequest", () => {
  it("returns userId 'local' when called", async () => {
    const result = await authenticateApiRequest(makeRequest());
    expect(result).toEqual({ userId: "local" });
  });

  it("skips auth entirely — no headers needed", async () => {
    const result = await authenticateApiRequest(
      makeRequest({ authorization: "completely-invalid" })
    );
    expect(result).toEqual({ userId: "local" });
  });

  it("ignores Bearer tokens in local mode", async () => {
    const result = await authenticateApiRequest(
      makeRequest({ authorization: "Bearer xb_live_test123" })
    );
    expect(result).toEqual({ userId: "local" });
  });
});
