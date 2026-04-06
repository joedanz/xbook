// ABOUTME: Tests for the v1 newsletter POST route handler (OSS overlay).
// ABOUTME: Covers rate limiting, auth, dry run, send flow, and error handling.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation((rl: { resetAt: number }, message = "Too many requests") =>
    NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  ),
  getClientIp: vi.fn(() => "127.0.0.1"),
  API_RATE_LIMIT: { limit: 100, windowSeconds: 60 },
  NEWSLETTER_RATE_LIMIT: { limit: 3, windowSeconds: 300 },
}));

// Mock api-auth module
vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: vi.fn(),
}));

// Mock db module
const mockGetNewsletterBookmarks = vi.fn();
const mockMarkNewslettered = vi.fn();
const mockLogNewsletter = vi.fn();
vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    getNewsletterBookmarks: mockGetNewsletterBookmarks,
    markNewslettered: mockMarkNewslettered,
    logNewsletter: mockLogNewsletter,
  })),
}));

// Mock newsletter renderer — use importOriginal to preserve parseDateRange, validateDateRange, MAX_BOOKMARKS
vi.mock("@shared/newsletter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/newsletter")>();
  return {
    ...actual,
    renderNewsletter: vi.fn(() => ({
      subject: "Your X Bookmarks — March 6, 2026",
      html: "<html>newsletter</html>",
    })),
  };
});

// Mock email sender
const mockSendEmail = vi.fn();
vi.mock("@shared/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { POST } from "../web/app/api/v1/newsletter/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { authenticateApiRequest } from "../web/lib/api-auth";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAuth = vi.mocked(authenticateApiRequest);

const MOCK_BOOKMARKS = [
  { tweet_id: "111", text: "Great article", author_name: "Alice", author_username: "alice" },
  { tweet_id: "222", text: "Thread on React", author_name: "Bob", author_username: "bob" },
];

let savedResendKey: string | undefined;
let savedNewsletterTo: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedResendKey = process.env.RESEND_API_KEY;
  savedNewsletterTo = process.env.NEWSLETTER_TO;
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.NEWSLETTER_TO = "joe@example.com";
});

afterEach(() => {
  if (savedResendKey !== undefined) process.env.RESEND_API_KEY = savedResendKey;
  else delete process.env.RESEND_API_KEY;
  if (savedNewsletterTo !== undefined) process.env.NEWSLETTER_TO = savedNewsletterTo;
  else delete process.env.NEWSLETTER_TO;
});

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/v1/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/v1/newsletter", () => {
  it("returns 429 when API rate limit is exceeded", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns auth error when authentication fails", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ error: "Unauthorized", status: 401 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 429 when newsletter-specific rate limit is exceeded", async () => {
    // API rate limit passes
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    // Newsletter rate limit fails
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 300000,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("newsletter");
  });

  it("returns success with count 0 when no new bookmarks", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetNewsletterBookmarks.mockResolvedValueOnce([]);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(0);
  });

  it("returns preview HTML on dry_run", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetNewsletterBookmarks.mockResolvedValueOnce(MOCK_BOOKMARKS);

    const res = await POST(makeRequest({ dry_run: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.html).toBeTruthy();
    expect(json.count).toBe(2);
    // Should not send email on dry run
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends email and marks bookmarks on success", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetNewsletterBookmarks.mockResolvedValueOnce(MOCK_BOOKMARKS);
    mockSendEmail.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(2);
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockMarkNewslettered).toHaveBeenCalledWith(["111", "222"]);
    expect(mockLogNewsletter).toHaveBeenCalledWith(2);
  });

  it("returns 500 when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetNewsletterBookmarks.mockResolvedValueOnce(MOCK_BOOKMARKS);

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("RESEND_API_KEY");
  });

  it("returns 502 when email send fails", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedAuth.mockResolvedValueOnce({ userId: "local" });
    mockGetNewsletterBookmarks.mockResolvedValueOnce(MOCK_BOOKMARKS);
    mockSendEmail.mockRejectedValueOnce(new Error("Email service down"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("failed to send");
    // Bookmarks must NOT be marked on failure
    expect(mockMarkNewslettered).not.toHaveBeenCalled();
  });
});
