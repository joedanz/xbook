// ABOUTME: Tests for newsletter HTML rendering.
// ABOUTME: Covers empty state, date grouping, image rendering, article previews, folder badges, bookmark cap, and HTML escaping.

import { describe, it, expect } from "vitest";
import {
  renderNewsletter,
  resolveNewsletterDates,
  validateDateRange,
  parseDateRange,
  formatSqliteDate,
} from "../shared/newsletter";
import type { StoredBookmark, NewsletterDateRange } from "../shared/types";

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
    url_title: null,
    url_description: null,
    url_image: null,
    expanded_url: null,
    starred: false,
    need_to_read: false,
    hidden: false,
    deleted: false,
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

  it("groups bookmarks by synced_at date", () => {
    const bm1 = makeBookmark({
      tweet_id: "1",
      synced_at: "2024-06-15T10:00:00Z",
      text: "First day bookmark",
    });
    const bm2 = makeBookmark({
      tweet_id: "2",
      synced_at: "2024-06-16T10:00:00Z",
      text: "Second day bookmark",
    });
    const { html } = renderNewsletter([bm1, bm2]);
    // Should have date group headers (not folder headers)
    expect(html).toContain("June");
    expect(html).toContain("2024");
    // Both bookmarks rendered
    expect(html).toContain("First day bookmark");
    expect(html).toContain("Second day bookmark");
  });

  it("sorts bookmarks by synced_at descending (newest first)", () => {
    const older = makeBookmark({
      tweet_id: "1",
      synced_at: "2024-06-14T10:00:00Z",
      text: "Older bookmark",
    });
    const newer = makeBookmark({
      tweet_id: "2",
      synced_at: "2024-06-16T10:00:00Z",
      text: "Newer bookmark",
    });
    const { html } = renderNewsletter([older, newer]);
    const newerIdx = html.indexOf("Newer bookmark");
    const olderIdx = html.indexOf("Older bookmark");
    expect(newerIdx).toBeLessThan(olderIdx);
  });

  it("includes hero image when includeImages is true and media_url exists", () => {
    const bm = makeBookmark({
      media_url: "https://example.com/photo.jpg",
    });
    const { html } = renderNewsletter([bm], { includeImages: true });
    expect(html).toContain('<img src="https://example.com/photo.jpg"');
    expect(html).toContain('alt="Tweet media"');
  });

  it("excludes images when includeImages is false", () => {
    const bm = makeBookmark({
      media_url: "https://example.com/photo.jpg",
      url_image: "https://example.com/og.jpg",
    });
    const { html } = renderNewsletter([bm], { includeImages: false });
    expect(html).not.toContain("<img");
  });

  it("defaults includeImages to true when options omitted", () => {
    const bm = makeBookmark({
      media_url: "https://example.com/photo.jpg",
    });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("<img");
  });

  it("renders article preview with left-border accent when url_title and expanded_url exist", () => {
    const bm = makeBookmark({
      url_title: "Great Article",
      url_description: "An interesting read",
      expanded_url: "https://example.com/article",
    });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("border-left:3px solid #1d9bf0");
    expect(html).toContain("Great Article");
    expect(html).toContain("An interesting read");
    expect(html).toContain('href="https://example.com/article"');
  });

  it("shows url_image in article preview only when no media_url", () => {
    const bm = makeBookmark({
      url_title: "Article",
      expanded_url: "https://example.com",
      url_image: "https://example.com/og.jpg",
      media_url: null,
    });
    const { html } = renderNewsletter([bm], { includeImages: true });
    expect(html).toContain("https://example.com/og.jpg");

    // When media_url exists, url_image should NOT appear
    const bm2 = makeBookmark({
      url_title: "Article",
      expanded_url: "https://example.com",
      url_image: "https://example.com/og.jpg",
      media_url: "https://example.com/photo.jpg",
    });
    const { html: html2 } = renderNewsletter([bm2], { includeImages: true });
    expect(html2).toContain("https://example.com/photo.jpg"); // hero image
    expect(html2).not.toContain("https://example.com/og.jpg"); // no OG image
  });

  it("renders folder badge on cards", () => {
    const bm = makeBookmark({ folder_name: "Tech" });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("Tech");
    expect(html).toContain("border-radius:10px"); // badge styling
  });

  it("caps bookmarks at 100 and shows overflow message", () => {
    const bookmarks = Array.from({ length: 101 }, (_, i) =>
      makeBookmark({
        tweet_id: String(i),
        synced_at: "2024-06-15T10:00:00Z",
      })
    );
    const { html } = renderNewsletter(bookmarks);
    // Should render overflow notice
    expect(html).toContain("and 1 more bookmark");
    // Footer should show total count
    expect(html).toContain("101 bookmarks");
  });

  it("escapes HTML in tweet text", () => {
    const bm = makeBookmark({ text: '<script>alert("xss")</script>' });
    const { html } = renderNewsletter([bm]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in url_title and url_description", () => {
    const bm = makeBookmark({
      url_title: '<img onerror="alert(1)">',
      url_description: "Safe & Sound <b>bold</b>",
      expanded_url: "https://example.com",
    });
    const { html } = renderNewsletter([bm]);
    expect(html).not.toContain('<img onerror');
    expect(html).toContain("&lt;img onerror");
    expect(html).toContain("Safe &amp; Sound &lt;b&gt;bold&lt;/b&gt;");
  });

  it("escapes HTML in folder_name badge", () => {
    const bm = makeBookmark({ folder_name: '<b>Hacked</b>' });
    const { html } = renderNewsletter([bm]);
    expect(html).not.toContain("<b>Hacked</b>");
    expect(html).toContain("&lt;b&gt;Hacked&lt;/b&gt;");
  });

  it("rejects javascript: URLs in media_url and expanded_url", () => {
    const bm = makeBookmark({
      media_url: "javascript:alert(1)",
      url_title: "Evil",
      expanded_url: "javascript:alert(2)",
      url_image: "javascript:alert(3)",
    });
    const { html } = renderNewsletter([bm]);
    expect(html).not.toContain("javascript:");
  });

  it("generates correct tweet URLs", () => {
    const bm = makeBookmark({ tweet_id: "12345", author_username: "bob" });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("https://x.com/bob/status/12345");
  });

  it("includes viewport meta tag", () => {
    const { html } = renderNewsletter([makeBookmark()]);
    expect(html).toContain('name="viewport"');
    expect(html).toContain("width=device-width");
  });

  it("handles invalid synced_at dates gracefully", () => {
    const bm = makeBookmark({ synced_at: "invalid-date" });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("Recent");
  });

  it("renders unknown author fallback when author_name is null", () => {
    const bm = makeBookmark({ author_name: null, author_username: null });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("Unknown author");
  });

  it("renders article preview without description when url_description is null", () => {
    const bm = makeBookmark({
      url_title: "Title Only",
      expanded_url: "https://example.com",
      url_description: null,
    });
    const { html } = renderNewsletter([bm]);
    expect(html).toContain("Title Only");
    expect(html).toContain('href="https://example.com"');
  });

  it("groups multiple bookmarks on the same day together", () => {
    const bm1 = makeBookmark({ tweet_id: "1", synced_at: "2024-06-15T08:00:00Z", text: "Morning" });
    const bm2 = makeBookmark({ tweet_id: "2", synced_at: "2024-06-15T20:00:00Z", text: "Evening" });
    const { html } = renderNewsletter([bm1, bm2]);
    // Both should be under the same group header — only one date header for June 15
    const matches = html.match(/Saturday, June 15, 2024/g);
    expect(matches).toHaveLength(1);
    expect(html).toContain("Morning");
    expect(html).toContain("Evening");
  });

  it("shows no overflow message at exactly MAX_BOOKMARKS (100)", () => {
    const bookmarks = Array.from({ length: 100 }, (_, i) =>
      makeBookmark({ tweet_id: String(i), synced_at: "2024-06-15T10:00:00Z" })
    );
    const { html } = renderNewsletter(bookmarks);
    expect(html).not.toContain("more bookmark");
    expect(html).toContain("100 bookmarks");
  });
});

// ---------------------------------------------------------------------------
// resolveNewsletterDates — pure function, all 4 mode branches
// ---------------------------------------------------------------------------

describe("resolveNewsletterDates", () => {
  it("returns no date filter for undefined range", () => {
    const result = resolveNewsletterDates(undefined, null);
    expect(result).toEqual({ includeAlreadySent: false });
    expect(result.sinceDate).toBeUndefined();
    expect(result.beforeDate).toBeUndefined();
  });

  it("returns no date filter for all_unsent mode", () => {
    const result = resolveNewsletterDates({ mode: "all_unsent" }, null);
    expect(result).toEqual({ includeAlreadySent: false });
  });

  it("returns sinceDate for since_last_send with valid lastSendDate", () => {
    const result = resolveNewsletterDates(
      { mode: "since_last_send" },
      "2025-03-01T12:00:00.000Z"
    );
    expect(result.sinceDate).toEqual(new Date("2025-03-01T12:00:00.000Z"));
    expect(result.includeAlreadySent).toBe(false);
  });

  it("falls back to all_unsent when since_last_send has no lastSendDate", () => {
    const result = resolveNewsletterDates({ mode: "since_last_send" }, null);
    expect(result).toEqual({ includeAlreadySent: false });
  });

  it("falls back to all_unsent when since_last_send has corrupt lastSendDate", () => {
    const result = resolveNewsletterDates({ mode: "since_last_send" }, "not-a-date");
    expect(result).toEqual({ includeAlreadySent: false });
  });

  it("respects includePreviouslySent on since_last_send", () => {
    const result = resolveNewsletterDates(
      { mode: "since_last_send", includePreviouslySent: true },
      "2025-03-01T12:00:00.000Z"
    );
    expect(result.includeAlreadySent).toBe(true);
  });

  it("calculates sinceDate for last_n_weeks", () => {
    const before = Date.now();
    const result = resolveNewsletterDates({ mode: "last_n_weeks", weeks: 2 }, null);
    const after = Date.now();
    expect(result.sinceDate).toBeDefined();
    // sinceDate should be ~14 days ago
    const twoWeeksMs = 2 * 7 * 24 * 60 * 60 * 1000;
    expect(result.sinceDate!.getTime()).toBeGreaterThanOrEqual(before - twoWeeksMs);
    expect(result.sinceDate!.getTime()).toBeLessThanOrEqual(after - twoWeeksMs);
  });

  it("returns sinceDate and beforeDate for custom range", () => {
    const result = resolveNewsletterDates(
      { mode: "custom", startDate: "2025-03-01", endDate: "2025-03-15" },
      null
    );
    expect(result.sinceDate).toEqual(new Date("2025-03-01"));
    expect(result.beforeDate).toBeDefined();
    // beforeDate should be end-of-day
    expect(result.beforeDate!.getUTCHours()).toBe(23);
    expect(result.beforeDate!.getUTCMinutes()).toBe(59);
  });

  it("throws on invalid custom dates", () => {
    expect(() =>
      resolveNewsletterDates({ mode: "custom", startDate: "bad", endDate: "bad" }, null)
    ).toThrow("Invalid date");
  });

  it("throws when custom end date is before start date", () => {
    expect(() =>
      resolveNewsletterDates({ mode: "custom", startDate: "2025-03-15", endDate: "2025-03-01" }, null)
    ).toThrow("End date must be on or after start date");
  });
});

// ---------------------------------------------------------------------------
// validateDateRange
// ---------------------------------------------------------------------------

describe("validateDateRange", () => {
  it("returns null for undefined", () => {
    expect(validateDateRange(undefined)).toBeNull();
  });

  it("returns null for valid all_unsent", () => {
    expect(validateDateRange({ mode: "all_unsent" })).toBeNull();
  });

  it("returns error for invalid mode", () => {
    expect(validateDateRange({ mode: "bogus" } as unknown as NewsletterDateRange)).toContain("Invalid");
  });

  it("returns error for out-of-range weeks", () => {
    expect(validateDateRange({ mode: "last_n_weeks", weeks: 10 } as unknown as NewsletterDateRange)).toContain("1-4");
  });

  it("returns null for valid last_n_weeks", () => {
    expect(validateDateRange({ mode: "last_n_weeks", weeks: 2 })).toBeNull();
  });

  it("returns error for custom missing dates", () => {
    expect(validateDateRange({ mode: "custom" } as unknown as NewsletterDateRange)).toContain("required");
  });

  it("returns error for custom with invalid date format", () => {
    expect(validateDateRange({ mode: "custom", startDate: "bad", endDate: "bad" })).toContain("Invalid date");
  });

  it("returns error for custom with end before start", () => {
    expect(validateDateRange({ mode: "custom", startDate: "2025-03-15", endDate: "2025-03-01" })).toContain("End date");
  });

  it("returns null for valid custom range", () => {
    expect(validateDateRange({ mode: "custom", startDate: "2025-03-01", endDate: "2025-03-15" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDateRange — snake_case API body to typed object
// ---------------------------------------------------------------------------

describe("parseDateRange", () => {
  it("returns undefined when no date_range in body", () => {
    expect(parseDateRange({})).toBeUndefined();
  });

  it("returns undefined for invalid mode", () => {
    expect(parseDateRange({ date_range: { mode: "invalid" } })).toBeUndefined();
  });

  it("parses all_unsent", () => {
    expect(parseDateRange({ date_range: { mode: "all_unsent" } })).toEqual({ mode: "all_unsent" });
  });

  it("parses since_last_send with include_previously_sent", () => {
    expect(parseDateRange({ date_range: { mode: "since_last_send", include_previously_sent: true } }))
      .toEqual({ mode: "since_last_send", includePreviouslySent: true });
  });

  it("parses last_n_weeks", () => {
    expect(parseDateRange({ date_range: { mode: "last_n_weeks", weeks: 2 } }))
      .toEqual({ mode: "last_n_weeks", weeks: 2, includePreviouslySent: false });
  });

  it("returns undefined for invalid weeks in last_n_weeks", () => {
    expect(parseDateRange({ date_range: { mode: "last_n_weeks", weeks: 10 } })).toBeUndefined();
  });

  it("parses custom with snake_case dates", () => {
    const result = parseDateRange({ date_range: { mode: "custom", start_date: "2025-03-01", end_date: "2025-03-15" } });
    expect(result).toEqual({ mode: "custom", startDate: "2025-03-01", endDate: "2025-03-15", includePreviouslySent: false });
  });

  it("returns undefined for custom missing dates", () => {
    expect(parseDateRange({ date_range: { mode: "custom" } })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatSqliteDate
// ---------------------------------------------------------------------------

describe("formatSqliteDate", () => {
  it("converts Date to YYYY-MM-DD HH:MM:SS format", () => {
    const result = formatSqliteDate(new Date("2025-03-15T14:30:45.000Z"));
    expect(result).toBe("2025-03-15 14:30:45");
  });

  it("zero-pads single-digit months and days", () => {
    const result = formatSqliteDate(new Date("2025-01-05T09:05:03.000Z"));
    expect(result).toBe("2025-01-05 09:05:03");
  });
});
