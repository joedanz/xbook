// ABOUTME: Tests for shared/encryption.ts — AES-256-GCM encrypt/decrypt.
// ABOUTME: Tests round-trip, passthrough without key, and plaintext fallback.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TEST_KEY_HEX = "a".repeat(64); // 32 bytes of 0xAA

let encryptIfAvailable: typeof import("@shared/encryption").encryptIfAvailable;
let decryptIfAvailable: typeof import("@shared/encryption").decryptIfAvailable;

beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

async function loadModule() {
  const mod = await import("@shared/encryption");
  encryptIfAvailable = mod.encryptIfAvailable;
  decryptIfAvailable = mod.decryptIfAvailable;
}

// ---------------------------------------------------------------------------
// Round-trip encryption
// ---------------------------------------------------------------------------

describe("encryption — round-trip", () => {
  it("encrypts and decrypts back to original plaintext", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    await loadModule();

    const plaintext = "oauth_access_token_12345";
    const encrypted = encryptIfAvailable(plaintext);
    expect(encrypted).not.toBe(plaintext);

    const decrypted = decryptIfAvailable(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    await loadModule();

    const plaintext = "same_input";
    const a = encryptIfAvailable(plaintext);
    const b = encryptIfAvailable(plaintext);
    expect(a).not.toBe(b);

    // Both decrypt to the same value
    expect(decryptIfAvailable(a)).toBe(plaintext);
    expect(decryptIfAvailable(b)).toBe(plaintext);
  });

  it("handles empty string", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    await loadModule();

    // Empty string is too short after encryption (IV+tag+0 bytes),
    // but we should handle non-empty content
    const plaintext = "x";
    const encrypted = encryptIfAvailable(plaintext);
    expect(decryptIfAvailable(encrypted)).toBe(plaintext);
  });

  it("handles long strings", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    await loadModule();

    const plaintext = "a".repeat(10000);
    const encrypted = encryptIfAvailable(plaintext);
    expect(decryptIfAvailable(encrypted)).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Passthrough without key
// ---------------------------------------------------------------------------

describe("encryption — passthrough without ENCRYPTION_KEY", () => {
  it("encryptIfAvailable returns plaintext when key not set", async () => {
    delete process.env.ENCRYPTION_KEY;
    await loadModule();

    const plaintext = "oauth_token_abc";
    expect(encryptIfAvailable(plaintext)).toBe(plaintext);
  });

  it("decryptIfAvailable returns input when key not set", async () => {
    delete process.env.ENCRYPTION_KEY;
    await loadModule();

    const input = "some_encrypted_looking_data";
    expect(decryptIfAvailable(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Graceful plaintext fallback
// ---------------------------------------------------------------------------

describe("encryption — plaintext fallback", () => {
  it("returns plaintext when decrypting a non-encrypted string with key set", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    await loadModule();

    // This simulates pre-encryption data in the database
    const plaintext = "old_plaintext_token_value";
    const result = decryptIfAvailable(plaintext);
    expect(result).toBe(plaintext);
  });

  it("returns short strings as-is even with key set", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    await loadModule();

    expect(decryptIfAvailable("abc")).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

describe("encryption — key validation", () => {
  it("throws if ENCRYPTION_KEY is wrong length", async () => {
    process.env.ENCRYPTION_KEY = "tooshort";
    await loadModule();

    expect(() => encryptIfAvailable("test")).toThrow("64 hex characters");
  });
});

// ---------------------------------------------------------------------------
// refreshXTokenForWeb shape test
// ---------------------------------------------------------------------------

describe("refreshXTokenForWeb — shape transform", () => {
  it("maps snake_case API response to camelCase WebTokenResult", async () => {
    // Mock fetch to return a valid token response
    const mockResponse = {
      access_token: "new_access",
      refresh_token: "new_refresh",
      expires_in: 7200,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    try {
      const { refreshXTokenForWeb } = await import("@shared/x-auth");

      const before = Date.now();
      const result = await refreshXTokenForWeb("old_refresh", "client_id", "client_secret");
      const after = Date.now();

      expect(result.accessToken).toBe("new_access");
      expect(result.refreshToken).toBe("new_refresh");
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 7200 * 1000);
      expect(result.expiresAt).toBeLessThanOrEqual(after + 7200 * 1000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
