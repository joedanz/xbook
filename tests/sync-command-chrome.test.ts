// ABOUTME: Tests for the sync command's resolveSyncMethod logic (src/commands/sync.ts).
// ABOUTME: Verifies flag priority, platform constraints, config inference, and method-switch detection.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveSyncMethod } from "../src/commands/sync";

// Suppress console.log/warn during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

// Store original platform to restore after tests
const originalPlatform = process.platform;

function setPlatform(platform: string) {
  Object.defineProperty(process, "platform", { value: platform, writable: true });
}

afterEach(() => {
  Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
});

describe("resolveSyncMethod", () => {
  describe("explicit --chrome flag", () => {
    it("selects Chrome sync on macOS", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        chrome: true,
        hasApiKey: false,
      });

      expect(result.method).toBe("chrome");
    });

    it("throws on non-macOS platform", () => {
      setPlatform("linux");

      expect(() =>
        resolveSyncMethod({
          chrome: true,
          hasApiKey: false,
        })
      ).toThrow("Chrome sync requires macOS");
    });
  });

  describe("explicit --api flag", () => {
    it("selects API sync regardless of platform", () => {
      setPlatform("linux");

      const result = resolveSyncMethod({
        api: true,
        hasApiKey: false,
      });

      expect(result.method).toBe("api");
    });

    it("selects API sync on macOS", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        api: true,
        hasApiKey: false,
      });

      expect(result.method).toBe("api");
    });
  });

  describe("saved config syncMethod", () => {
    it("uses saved syncMethod when no flags provided", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        configSyncMethod: "chrome",
        hasApiKey: false,
      });

      expect(result.method).toBe("chrome");
      expect(result.isMethodSwitch).toBe(false);
    });

    it("uses saved api syncMethod", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        configSyncMethod: "api",
        hasApiKey: false,
      });

      expect(result.method).toBe("api");
      expect(result.isMethodSwitch).toBe(false);
    });
  });

  describe("inference from existing apiKey", () => {
    it("infers API sync when apiKey exists and no syncMethod saved", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        hasApiKey: true,
      });

      expect(result.method).toBe("api");
      expect(result.isMethodSwitch).toBe(false);
    });
  });

  describe("non-macOS default", () => {
    it("defaults to API sync on Linux with no flags or config", () => {
      setPlatform("linux");

      const result = resolveSyncMethod({
        hasApiKey: false,
      });

      expect(result.method).toBe("api");
      expect(result.isMethodSwitch).toBe(false);
    });

    it("defaults to API sync on Windows with no flags or config", () => {
      setPlatform("win32");

      const result = resolveSyncMethod({
        hasApiKey: false,
      });

      expect(result.method).toBe("api");
      expect(result.isMethodSwitch).toBe(false);
    });
  });

  describe("macOS first run (prompt)", () => {
    it("returns prompt on macOS with no flags, no config, no apiKey", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        hasApiKey: false,
      });

      expect(result.method).toBe("prompt");
      expect(result.isMethodSwitch).toBe(false);
    });
  });

  describe("method switch detection", () => {
    it("detects switch from chrome to api", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        api: true,
        configSyncMethod: "chrome",
        hasApiKey: false,
      });

      expect(result.method).toBe("api");
      expect(result.isMethodSwitch).toBe(true);
    });

    it("detects switch from api to chrome", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        chrome: true,
        configSyncMethod: "api",
        hasApiKey: false,
      });

      expect(result.method).toBe("chrome");
      expect(result.isMethodSwitch).toBe(true);
    });

    it("no switch when flag matches saved method", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        chrome: true,
        configSyncMethod: "chrome",
        hasApiKey: false,
      });

      expect(result.method).toBe("chrome");
      expect(result.isMethodSwitch).toBe(false);
    });

    it("no switch when using saved config without flags", () => {
      setPlatform("darwin");

      const result = resolveSyncMethod({
        configSyncMethod: "api",
        hasApiKey: false,
      });

      expect(result.isMethodSwitch).toBe(false);
    });
  });
});
