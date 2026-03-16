// ABOUTME: Tests for the shared import parser.
// ABOUTME: Covers flat JSON, twitter-web-exporter, CSV formats, validation, and edge cases.

import { describe, it, expect } from "vitest";
import { parseImportFile } from "../shared/import-parser";

describe("parseImportFile", () => {
  // --- Flat JSON ---

  describe("flat JSON", () => {
    it("parses a flat JSON array", () => {
      const data = [
        {
          id: "123",
          text: "Hello world",
          created_at: "2024-01-15T12:00:00Z",
          author_id: "user1",
          author_username: "alice",
          author_name: "Alice",
        },
        {
          id: "456",
          text: "Another tweet",
          author_id: "user2",
          author_username: "bob",
          author_name: "Bob",
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "bookmarks.json");

      expect(result.format).toBe("json-flat");
      expect(result.tweets).toHaveLength(2);
      expect(result.tweets[0].id).toBe("123");
      expect(result.tweets[0].text).toBe("Hello world");
      expect(result.tweets[0].created_at).toBe("2024-01-15T12:00:00Z");
      expect(result.tweets[1].id).toBe("456");
      expect(result.users.size).toBe(2);
      expect(result.users.get("user1")?.username).toBe("alice");
      expect(result.users.get("user2")?.name).toBe("Bob");
      expect(result.warnings).toHaveLength(0);
    });

    it("maps field aliases correctly", () => {
      const data = [
        {
          tweet_id: "789",
          full_text: "Alias test",
          user_id: "u1",
          screen_name: "charlie",
          name: "Charlie",
          mediaUrl: "https://img.example.com/pic.jpg",
          url: "https://example.com/article",
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "export.json");

      expect(result.tweets[0].id).toBe("789");
      expect(result.tweets[0].text).toBe("Alias test");
      expect(result.tweets[0].author_id).toBe("u1");
      expect(result.tweets[0].media_url).toBe("https://img.example.com/pic.jpg");
      expect(result.tweets[0].expanded_url).toBe("https://example.com/article");
      expect(result.users.get("u1")?.username).toBe("charlie");
    });

    it("extracts media URL from media array (twitter-web-exporter flat format)", () => {
      const data = [
        {
          id: "999",
          full_text: "Tweet with media array",
          user_id: "u1",
          screen_name: "mediauser",
          media: [
            {
              type: "photo",
              url: "https://t.co/abc",
              thumbnail: "https://pbs.twimg.com/media/abc?format=jpg&name=thumb",
              original: "https://pbs.twimg.com/media/abc?format=jpg&name=orig",
            },
          ],
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "export.json");

      expect(result.tweets[0].media_url).toBe(
        "https://pbs.twimg.com/media/abc?format=jpg&name=thumb"
      );
    });

    it("prefers media_url string over media array", () => {
      const data = [
        {
          id: "888",
          text: "Has both",
          media_url: "https://direct-url.com/img.jpg",
          media: [{ thumbnail: "https://array-url.com/img.jpg" }],
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets[0].media_url).toBe("https://direct-url.com/img.jpg");
    });

    it("handles video media with thumbnail", () => {
      const data = [
        {
          id: "777",
          full_text: "Video tweet",
          media: [
            {
              type: "video",
              thumbnail: "https://pbs.twimg.com/video_thumb/123.jpg",
              original: "https://video.twimg.com/vid/123.mp4",
            },
          ],
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets[0].media_url).toBe(
        "https://pbs.twimg.com/video_thumb/123.jpg"
      );
    });

    it("maps tweetId and createdAt camelCase aliases", () => {
      const data = [
        {
          tweetId: "111",
          tweet_text: "CamelCase test",
          createdAt: "2024-06-01",
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets[0].id).toBe("111");
      expect(result.tweets[0].text).toBe("CamelCase test");
      expect(result.tweets[0].created_at).toBe("2024-06-01");
    });
  });

  // --- twitter-web-exporter ---

  describe("twitter-web-exporter format", () => {
    it("parses nested GraphQL structure", () => {
      const data = [
        {
          rest_id: "tw1",
          legacy: {
            full_text: "Exported tweet",
            created_at: "Sat Jan 15 12:00:00 +0000 2024",
            entities: {
              media: [
                { media_url_https: "https://pbs.twimg.com/media/abc.jpg" },
              ],
              urls: [
                { expanded_url: "https://example.com" },
              ],
            },
          },
          core: {
            user_results: {
              result: {
                rest_id: "u100",
                legacy: {
                  screen_name: "exporter_user",
                  name: "Exporter User",
                },
              },
            },
          },
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "bookmarks.json");

      expect(result.format).toBe("json-twitter-exporter");
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].id).toBe("tw1");
      expect(result.tweets[0].text).toBe("Exported tweet");
      expect(result.tweets[0].author_id).toBe("u100");
      expect(result.tweets[0].media_url).toBe(
        "https://pbs.twimg.com/media/abc.jpg"
      );
      expect(result.tweets[0].expanded_url).toBe("https://example.com");
      expect(result.users.get("u100")?.username).toBe("exporter_user");
      expect(result.users.get("u100")?.name).toBe("Exporter User");
    });

    it("handles items without media or URLs", () => {
      const data = [
        {
          rest_id: "tw2",
          legacy: {
            full_text: "No media tweet",
            entities: {},
          },
          core: {
            user_results: {
              result: {
                rest_id: "u200",
                legacy: {
                  screen_name: "plain_user",
                  name: "Plain User",
                },
              },
            },
          },
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets[0].media_url).toBeUndefined();
      expect(result.tweets[0].expanded_url).toBeUndefined();
      expect(result.warnings).toHaveLength(0);
    });
  });

  // --- CSV ---

  describe("CSV", () => {
    it("parses CSV with header row", () => {
      const csv = `id,text,author_id,author_username,author_name
100,Hello from CSV,u1,csvuser,CSV User
200,Another row,u2,bob,Bob`;

      const result = parseImportFile(csv, "bookmarks.csv");

      expect(result.format).toBe("csv");
      expect(result.tweets).toHaveLength(2);
      expect(result.tweets[0].id).toBe("100");
      expect(result.tweets[0].text).toBe("Hello from CSV");
      expect(result.tweets[1].id).toBe("200");
      expect(result.users.get("u1")?.username).toBe("csvuser");
    });

    it("handles quoted fields with commas", () => {
      const csv = `id,text,author_id
300,"Hello, world",u3`;

      const result = parseImportFile(csv, "test.csv");

      expect(result.tweets[0].text).toBe("Hello, world");
    });

    it("handles escaped quotes in CSV", () => {
      const csv = `id,text
400,"She said ""hello""."`;

      const result = parseImportFile(csv, "test.csv");

      expect(result.tweets[0].text).toBe('She said "hello".');
    });
  });

  // --- Validation ---

  describe("validation", () => {
    it("skips items missing id with warning", () => {
      const data = [
        { text: "No ID here" },
        { id: "valid", text: "Has ID" },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].id).toBe("valid");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("missing id");
    });

    it("skips items missing text with warning", () => {
      const data = [{ id: "123" }, { id: "456", text: "Has text" }];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("missing text");
    });

    it("throws on empty file", () => {
      expect(() => parseImportFile("", "file.json")).toThrow("File is empty");
    });

    it("throws on invalid JSON", () => {
      expect(() => parseImportFile("{bad", "file.json")).toThrow(
        "Invalid JSON"
      );
    });

    it("throws on non-array JSON", () => {
      expect(() =>
        parseImportFile('{"key": "value"}', "file.json")
      ).toThrow("Expected a JSON array");
    });

    it("throws on empty JSON array", () => {
      expect(() => parseImportFile("[]", "file.json")).toThrow(
        "JSON array is empty"
      );
    });

    it("throws on CSV with header only", () => {
      expect(() => parseImportFile("id,text", "file.csv")).toThrow(
        "at least one data row"
      );
    });
  });

  // --- Edge cases ---

  describe("edge cases", () => {
    it("strips UTF-8 BOM", () => {
      const bom = "\uFEFF";
      const data = [{ id: "1", text: "BOM test" }];
      const content = bom + JSON.stringify(data);

      const result = parseImportFile(content, "bom.json");

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].id).toBe("1");
    });

    it("handles format auto-detection for twitter-web-exporter", () => {
      // Item with 'legacy' field triggers exporter detection
      const data = [
        {
          rest_id: "auto1",
          legacy: { full_text: "Auto-detected" },
        },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");
      expect(result.format).toBe("json-twitter-exporter");
    });

    it("populates user map from author fields", () => {
      const data = [
        { id: "1", text: "T1", author_id: "a1", author_username: "user1", author_name: "User One" },
        { id: "2", text: "T2", author_id: "a1", author_username: "user1", author_name: "User One" },
        { id: "3", text: "T3", author_id: "a2", author_username: "user2", author_name: "User Two" },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.users.size).toBe(2);
      expect(result.users.get("a1")?.username).toBe("user1");
      expect(result.users.get("a2")?.username).toBe("user2");
    });

    it("skips user map entry when no author_id", () => {
      const data = [{ id: "1", text: "No author" }];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.tweets).toHaveLength(1);
      expect(result.users.size).toBe(0);
    });

    it("uses username as name fallback", () => {
      const data = [
        { id: "1", text: "T", author_id: "a1", author_username: "fallback_user" },
      ];

      const result = parseImportFile(JSON.stringify(data), "file.json");

      expect(result.users.get("a1")?.name).toBe("fallback_user");
    });
  });
});
