// ABOUTME: Generates HTML email content from bookmarked tweets.
// ABOUTME: Groups bookmarks by date (synced_at), renders cards with optional images and article previews. Shared by CLI and web.

import type { StoredBookmark, NewsletterOptions, NewsletterDateRange } from "./types";
import { escapeHtml } from "./html";
import { tweetUrl } from "./urls";

// --- Newsletter constants and validation ---

export const VALID_DATE_RANGE_MODES = ["all_unsent", "since_last_send", "last_n_weeks", "custom"] as const satisfies readonly NewsletterDateRange["mode"][];
export const VALID_WEEKS = [1, 2, 3, 4] as const satisfies readonly (1 | 2 | 3 | 4)[];

// --- Date resolution for newsletter range queries ---

export interface ResolvedNewsletterDates {
  sinceDate?: Date;
  beforeDate?: Date;
  includeAlreadySent: boolean;
}

/**
 * Pure function that resolves a NewsletterDateRange into concrete Date boundaries.
 * Returns Date objects — each repo formats for its DB engine.
 * `beforeDate` is already adjusted to end-of-day (23:59:59.999).
 */
export function resolveNewsletterDates(
  range: NewsletterDateRange | undefined,
  lastSendDate: string | null
): ResolvedNewsletterDates {
  // Default / all_unsent: no date filter, only unsent
  if (!range || range.mode === "all_unsent") {
    return { includeAlreadySent: false };
  }

  if (range.mode === "since_last_send") {
    if (!lastSendDate) {
      // No prior send — fall back to all_unsent behavior
      return { includeAlreadySent: false };
    }
    const sinceDate = new Date(lastSendDate);
    if (isNaN(sinceDate.getTime())) {
      // Corrupt lastSendDate — fall back to all_unsent rather than generating broken SQL
      return { includeAlreadySent: false };
    }
    return {
      sinceDate,
      includeAlreadySent: range.includePreviouslySent ?? false,
    };
  }

  if (range.mode === "last_n_weeks") {
    const now = new Date();
    const sinceDate = new Date(now.getTime() - range.weeks * 7 * 24 * 60 * 60 * 1000);
    return {
      sinceDate,
      includeAlreadySent: range.includePreviouslySent ?? false,
    };
  }

  if (range.mode === "custom") {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date in custom range");
    }
    if (end < start) {
      throw new Error("End date must be on or after start date");
    }
    // Adjust end to end-of-day (UTC) so the date is inclusive
    end.setUTCHours(23, 59, 59, 999);
    return {
      sinceDate: start,
      beforeDate: end,
      includeAlreadySent: range.includePreviouslySent ?? false,
    };
  }

  // Exhaustive check — compile error if a new mode is added but not handled
  const _exhaustive: never = range;
  throw new Error(`Unhandled date range mode: ${(_exhaustive as { mode: string }).mode}`);
}

/**
 * Validate a NewsletterDateRange at runtime. Returns an error message or null.
 */
export function validateDateRange(dateRange?: NewsletterDateRange): string | null {
  if (!dateRange) return null;
  if (!VALID_DATE_RANGE_MODES.includes(dateRange.mode as typeof VALID_DATE_RANGE_MODES[number])) {
    return "Invalid date range mode";
  }
  if (dateRange.mode === "last_n_weeks") {
    if (!VALID_WEEKS.includes(dateRange.weeks as typeof VALID_WEEKS[number])) {
      return "Weeks must be 1-4";
    }
  }
  if (dateRange.mode === "custom") {
    if (!dateRange.startDate || !dateRange.endDate) return "Start and end dates are required";
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid date format";
    if (end < start) return "End date must be on or after start date";
  }
  return null;
}

/**
 * Parse a raw API body's `date_range` object into a typed NewsletterDateRange.
 * Handles snake_case → camelCase mapping. Returns undefined if invalid.
 */
export function parseDateRange(raw: Record<string, unknown>): NewsletterDateRange | undefined {
  if (!raw.date_range || typeof raw.date_range !== "object") return undefined;
  const dr = raw.date_range as Record<string, unknown>;
  const mode = dr.mode as string;

  if (!VALID_DATE_RANGE_MODES.includes(mode as typeof VALID_DATE_RANGE_MODES[number])) return undefined;

  if (mode === "all_unsent") return { mode: "all_unsent" };
  if (mode === "since_last_send") {
    return { mode: "since_last_send", includePreviouslySent: dr.include_previously_sent === true };
  }
  if (mode === "last_n_weeks") {
    const weeks = Number(dr.weeks);
    if (!VALID_WEEKS.includes(weeks as typeof VALID_WEEKS[number])) return undefined;
    return { mode: "last_n_weeks", weeks: weeks as 1 | 2 | 3 | 4, includePreviouslySent: dr.include_previously_sent === true };
  }
  if (mode === "custom") {
    const startDate = String(dr.start_date ?? "");
    const endDate = String(dr.end_date ?? "");
    if (!startDate || !endDate) return undefined;
    return { mode: "custom", startDate, endDate, includePreviouslySent: dr.include_previously_sent === true };
  }
  return undefined;
}

/**
 * Format a Date for SQLite comparison. SQLite stores dates as TEXT in
 * `YYYY-MM-DD HH:MM:SS` format (no T, no Z) via datetime('now').
 */
export function formatSqliteDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return url;
    }
  } catch {
    // invalid URL
  }
  return "";
}

export const MAX_BOOKMARKS = 100;

function formatCardDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function dateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "unknown";
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function renderNewsletter(
  bookmarks: StoredBookmark[],
  options?: NewsletterOptions
): { html: string; subject: string } {
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subject = `Your X Bookmarks — ${date}`;
  const includeImages = options?.includeImages !== false;

  if (bookmarks.length === 0) {
    return {
      subject,
      html: wrapHtml(subject, "<p>No new bookmarks this week.</p>", 0),
    };
  }

  // Sort by synced_at descending (newest first)
  const sorted = [...bookmarks].sort((a, b) => {
    const ta = new Date(a.synced_at).getTime();
    const tb = new Date(b.synced_at).getTime();
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;  // push invalid dates to end
    if (isNaN(tb)) return -1;
    return tb - ta;
  });

  // Cap at MAX_BOOKMARKS
  const capped = sorted.slice(0, MAX_BOOKMARKS);
  const overflowCount = sorted.length - capped.length;

  // Group by date (day of synced_at)
  const grouped = new Map<string, { label: string; items: StoredBookmark[] }>();
  for (const bm of capped) {
    const key = dateKey(bm.synced_at);
    if (!grouped.has(key)) {
      grouped.set(key, { label: formatGroupDate(bm.synced_at), items: [] });
    }
    grouped.get(key)!.items.push(bm);
  }

  let body = "";
  for (const [, group] of grouped) {
    body += `<div style="font-size:18px;font-weight:600;color:#536471;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid #e1e8ed;">${escapeHtml(group.label)}</div>\n`;

    for (const bm of group.items) {
      body += renderCard(bm, includeImages);
    }
  }

  if (overflowCount > 0) {
    body += `<div style="text-align:center;padding:16px;color:#536471;font-size:14px;">and ${overflowCount} more bookmark${overflowCount === 1 ? "" : "s"} in your account\u2026</div>\n`;
  }

  return { subject, html: wrapHtml(subject, body, bookmarks.length) };
}

function renderCard(bm: StoredBookmark, includeImages: boolean): string {
  const url = tweetUrl(bm.tweet_id, bm.author_username);
  const safeMediaUrl = bm.media_url ? sanitizeUrl(bm.media_url) : null;
  const safeExpandedUrl = bm.expanded_url ? sanitizeUrl(bm.expanded_url) : null;
  const safeUrlImage = bm.url_image ? sanitizeUrl(bm.url_image) : null;
  const author = bm.author_name
    ? `${escapeHtml(bm.author_name)} <span style="color:#536471;">@${escapeHtml(bm.author_username || "")}</span>`
    : "Unknown author";
  const cardDate = formatCardDate(bm.created_at);
  const folderBadge = bm.folder_name
    ? `<span style="display:inline-block;background:#e8f5fd;color:#1d9bf0;font-size:12px;padding:2px 8px;border-radius:10px;">${escapeHtml(bm.folder_name)}</span> · `
    : "";

  let heroImage = "";
  if (includeImages && safeMediaUrl) {
    heroImage = `<div style="margin-bottom:12px;"><img src="${escapeHtml(safeMediaUrl)}" alt="Tweet media" style="max-width:100%;display:block;border-radius:8px;" /></div>\n`;
  }

  let articlePreview = "";
  if (bm.url_title && safeExpandedUrl) {
    let articleImage = "";
    if (includeImages && safeUrlImage && !safeMediaUrl) {
      articleImage = `<img src="${escapeHtml(safeUrlImage)}" alt="${escapeHtml(bm.url_title)}" style="max-width:100%;display:block;border-radius:6px;margin-top:8px;" />\n`;
    }
    const description = bm.url_description
      ? `<div style="font-size:13px;color:#536471;margin-top:4px;">${escapeHtml(bm.url_description)}</div>\n`
      : "";
    articlePreview = `
      <div style="border-left:3px solid #1d9bf0;padding:8px 12px;margin:8px 0;">
        <a href="${escapeHtml(safeExpandedUrl)}" style="color:#1d9bf0;font-weight:600;text-decoration:none;font-size:14px;">${escapeHtml(bm.url_title)}</a>
        ${description}${articleImage}</div>\n`;
  }

  return `
    <div style="border:1px solid #e1e8ed;border-radius:12px;padding:16px;margin:8px 0;background:#fff;">
      ${heroImage}<div style="font-weight:600;margin-bottom:4px;">${author}</div>
      <div style="margin-bottom:8px;">${escapeHtml(bm.text)}</div>
      ${articlePreview}<div style="font-size:13px;color:#536471;">
        ${cardDate ? `${cardDate} · ` : ""}${folderBadge}<a href="${escapeHtml(url)}" style="color:#1d9bf0;">View on X</a>
      </div>
    </div>
  `;
}

function wrapHtml(title: string, body: string, totalCount: number): string {
  const footer = totalCount > 0
    ? `<p style="font-size:12px;color:#536471;">${totalCount} bookmark${totalCount === 1 ? "" : "s"} · Generated by xbook</p>`
    : `<p style="font-size:12px;color:#536471;">Generated by xbook</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f8fa;color:#14171a;">
  <h1 style="font-size:22px;margin-bottom:4px;">${escapeHtml(title)}</h1>
  ${body}
  <hr style="border:none;border-top:1px solid #e1e8ed;margin:24px 0;">
  ${footer}
</body>
</html>`;
}
