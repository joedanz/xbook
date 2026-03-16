// ABOUTME: Tests for newsletter HTML rendering.
// ABOUTME: Covers empty state, grouping by folder, and HTML escaping.

import { describe, it, expect } from "vitest";
import { renderNewsletter } from "../shared/newsletter";
import type { StoredBookmark } from "../shared/types";

function makeBookmark(overrides: Partial<StoredBookmark> = {}): StoredBookmark {
  return {
    tweet_id: "1",
    text: "Some tweet text",
    author_id: "u1",
    author_name: "Alice",
    author_username: "alice",
    created_at: "2024-06-15T12:00:00Z",
    folder_id: null,
    folder_name: null,
    synced_at: "2024-06-15T13:00:00Z",
    newslettered_at: null,
    notes: null,
    tags: null,
    media_url: null,
    ...overrides,
  };
}

describe("renderNewsletter", () => {
  it("handles empty bookmarks", () => {
    const { html, subject } = renderNewsletter([]);
    expect(subject).toContain("Your X Bookmarks");
    expect(html).toContain("No new bookmarks this week");
  });

  it("renders bookmarks with author info", () => {
    const bm = makeBookmark({ text: "Great thread on TypeScript" });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("Great thread on TypeScript");
    expect(html).toContain("Alice");
    expect(html).toContain("@alice");
    expect(html).toContain("View on X");
  });

  it("groups by folder", () => {
    const bm1 = makeBookmark({ tweet_id: "1", folder_name: "Tech" });
    const bm2 = makeBookmark({ tweet_id: "2", folder_name: "Fun" });
    const bm3 = makeBookmark({ tweet_id: "3", folder_name: null });
    const { html } = renderNewsletter([bm1, bm2, bm3]);
    expect(html).toContain("Tech (1)");
    expect(html).toContain("Fun (1)");
    expect(html).toContain("Unsorted (1)");
  });

  it("escapes HTML in tweet text", () => {
    const bm = makeBookmark({ text: '<script>alert("xss")</script>' });
    const { html } = renderNewsletter([bm]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("generates correct tweet URLs", () => {
    const bm = makeBookmark({ tweet_id: "12345", author_username: "bob" });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("https://x.com/bob/status/12345");
  });
});
