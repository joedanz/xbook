// ABOUTME: Tests for the POST /api/waitlist route handler.
// ABOUTME: Covers email validation, rate limiting, duplicate handling, and confirmation email.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation(
    (rl: { resetAt: number }, message = "Too many requests") =>
      NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      )
  ),
  getClientIp: vi.fn(() => "127.0.0.1"),
  WAITLIST_RATE_LIMIT: { limit: 3, windowSeconds: 3600 },
}));

// Mock Neon SQL
const mockSql = vi.fn();
vi.mock("@/lib/db", () => ({
  getNeonSql: vi.fn(() => mockSql),
}));

// Mock sendEmail
vi.mock("@shared/email", () => ({
  sendEmail: vi.fn(),
}));

import { POST } from "../web/app/api/waitlist/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { sendEmail } from "../shared/email";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedSendEmail = vi.mocked(sendEmail);

let savedDbUrl: string | undefined;
let savedResendKey: string | undefined;
let savedNewsletterFrom: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedDbUrl = process.env.DATABASE_URL;
  savedResendKey = process.env.RESEND_API_KEY;
  savedNewsletterFrom = process.env.NEWSLETTER_FROM;
  process.env.DATABASE_URL = "postgres://test:test@localhost/test";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.NEWSLETTER_FROM = "xbook <hello@xbook.sh>";
});

afterEach(() => {
  if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
  else delete process.env.DATABASE_URL;
  if (savedResendKey !== undefined) process.env.RESEND_API_KEY = savedResendKey;
  else delete process.env.RESEND_API_KEY;
  if (savedNewsletterFrom !== undefined)
    process.env.NEWSLETTER_FROM = savedNewsletterFrom;
  else delete process.env.NEWSLETTER_FROM;
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  it("returns 429 when rate-limited", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for missing email", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it("returns 400 for invalid email format", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });

    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it("inserts email and sends confirmation on success", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });
    // First mockSql call: INSERT (returns a row with inserted: true)
    mockSql.mockResolvedValueOnce([{ inserted: true }]);
    mockedSendEmail.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ email: "joe@example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockedSendEmail).toHaveBeenCalledOnce();
    expect(mockedSendEmail).toHaveBeenCalledWith(
      "re_test_key",
      "xbook <hello@xbook.sh>",
      "joe@example.com",
      expect.stringContaining("waitlist"),
      expect.stringContaining("xbook Cloud")
    );
  });

  it("returns success without sending email for duplicate email", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });
    // INSERT returns empty array when ON CONFLICT DO NOTHING fires
    mockSql.mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ email: "existing@example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // No confirmation email for duplicate
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected DB error", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });
    mockSql.mockRejectedValueOnce(new Error("Connection refused"));

    const res = await POST(makeRequest({ email: "joe@example.com" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns success even when sendEmail throws", async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });
    mockSql.mockResolvedValueOnce([{ id: "abc" }]);
    mockedSendEmail.mockRejectedValueOnce(new Error("Resend is down"));

    const res = await POST(makeRequest({ email: "joe@example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
